// AWS Lambda function to proxy requests to Claude API
export const handler = async (event, context) => {
  console.log('Lambda event:', JSON.stringify(event, null, 2));

  const startTime = Date.now();

  // Extract HTTP method and headers from the Lambda event
  const method = event.requestContext?.http?.method || event.httpMethod;
  const headers = event.headers || {};
  const body = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : null;

  // Helper function to create Lambda response
  const createResponse = (statusCode, responseBody, additionalHeaders = {}) => {
    return {
      statusCode,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization, anthropic-version, X-Requested-With',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false',
        'Content-Type': 'application/json',
        ...additionalHeaders,
      },
      body: typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody),
    };
  };

  // Handle OPTIONS request (preflight)
  if (method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    return createResponse(200, '');
  }

  // Handle GET request for testing
  if (method === 'GET') {
    console.log('Handling GET request for proxy status check');
    return createResponse(200, {
      status: 'Lambda proxy server is running',
      timestamp: new Date().toISOString(),
      message: 'Use POST method to send requests to Claude API',
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
      maxDuration: '60 seconds',
      environment: process.env.AWS_EXECUTION_ENV || 'lambda',
    });
  }

  // Only allow POST requests for API calls
  if (method !== 'POST') {
    console.log(`Method ${method} not allowed`);
    return createResponse(405, {
      error: 'Method not allowed. Use POST for API calls or GET for status check.',
    });
  }

  try {
    console.log('Processing POST request to Claude API at', new Date().toISOString());
    console.log('Request headers:', JSON.stringify(headers, null, 2));

    // Parse request body
    let requestBody;
    try {
      requestBody = body ? JSON.parse(body) : {};
    } catch (parseError) {
      console.log('Failed to parse request body:', parseError);
      return createResponse(400, {
        error: 'Invalid JSON in request body',
        details: parseError.message,
      });
    }

    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    // Get the API key from environment variables (preferred) or request headers (fallback)
    const apiKey = process.env.ANTHROPIC_API_KEY || headers['x-api-key'];

    if (!apiKey) {
      console.log('No API key found in environment variables or request headers');
      return createResponse(400, {
        error: 'API key is required. Please set ANTHROPIC_API_KEY environment variable or provide x-api-key header.',
        hasEnvKey: !!process.env.ANTHROPIC_API_KEY,
        hasHeaderKey: !!headers['x-api-key'],
      });
    }

    console.log('API key found, making request to Claude API...');
    console.log('Using environment API key:', !!process.env.ANTHROPIC_API_KEY);

    // Validate request body
    console.log('Received request body:', JSON.stringify(requestBody, null, 2));
    console.log('Body keys:', Object.keys(requestBody || {}));
    console.log('Model:', requestBody?.model);
    console.log('Messages:', requestBody?.messages);

    if (!requestBody || !requestBody.model || !requestBody.messages) {
      console.log('Invalid request body validation failed:');
      console.log('- Has body:', !!requestBody);
      console.log('- Has model:', !!(requestBody && requestBody.model));
      console.log('- Has messages:', !!(requestBody && requestBody.messages));
      return createResponse(400, {
        error: 'Invalid request body. Required fields: model, messages',
        receivedBody: requestBody,
        validation: {
          hasBody: !!requestBody,
          hasModel: !!(requestBody && requestBody.model),
          hasMessages: !!(requestBody && requestBody.messages),
        },
      });
    }

    // Optimize Claude request - ensure max_tokens is reasonable for time constraints
    const maxTokens = Math.min(requestBody.max_tokens || 1000, 1500); // Cap at 1500 for better performance

    // Forward the request to Claude API
    const claudeRequest = {
      model: requestBody.model,
      max_tokens: maxTokens,
      system: requestBody.system,
      messages: requestBody.messages,
      // Add stream parameter if supported to get faster initial response
      stream: false,
    };

    console.log('Sending to Claude API:', JSON.stringify(claudeRequest, null, 2));
    console.log('Request start time:', startTime, 'ms since epoch');

    // Set a reasonable timeout for the Claude API request (50 seconds to leave buffer)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50 second timeout

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(claudeRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId); // Clear timeout if request completes

      const requestDuration = Date.now() - startTime;
      console.log(`Claude API responded with status: ${response.status} in ${requestDuration}ms`);

      // Get the response data
      const data = await response.json();
      console.log('Claude API response received, size:', JSON.stringify(data).length, 'characters');

      if (!response.ok) {
        console.log('Claude API error:', data);
        return createResponse(response.status, {
          error: 'Claude API error',
          claudeError: data,
          status: response.status,
          requestDuration: requestDuration,
        });
      }

      console.log('Successfully received response from Claude API');
      console.log('Total request duration:', requestDuration, 'ms');

      // Return the data with CORS headers and timing info
      return createResponse(200, {
        ...data,
        _meta: {
          requestDuration: requestDuration,
          timestamp: new Date().toISOString(),
          maxTokensUsed: maxTokens,
        },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        console.error('Request timed out after 50 seconds');
        return createResponse(408, {
          error: 'Request timeout',
          message: 'Claude API request took longer than 50 seconds',
          requestDuration: Date.now() - startTime,
        });
      }

      throw fetchError; // Re-throw other fetch errors
    }
  } catch (error) {
    console.error('Error in Lambda handler:', error);
    const requestDuration = Date.now() - startTime;

    // Return error with CORS headers and timing info
    return createResponse(500, {
      error: 'An error occurred while processing your request',
      details: error.message,
      requestDuration: requestDuration,
      timestamp: new Date().toISOString(),
      // Don't include stack trace in production
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
    });
  }
};
