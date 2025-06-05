// AWS Lambda function to proxy requests to Claude API - Enhanced for Large Design Responses
export const handler = async (event, context) => {
  console.log('Lambda event:', JSON.stringify(event, null, 2));

  const startTime = Date.now();

  // Extract HTTP method and headers from the Lambda event
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const headers = event.headers || {};
  const body = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : null;

  // Enhanced CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, HEAD',
    'Access-Control-Allow-Headers':
      'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token, x-api-key, anthropic-version, X-Requested-With, Accept, Origin, Referer, User-Agent',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Date, Server, X-Amzn-RequestId',
  };

  // Helper function to create Lambda response with enhanced CORS
  const createResponse = (statusCode, responseBody, additionalHeaders = {}) => {
    return {
      statusCode,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        ...additionalHeaders,
      },
      body: typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody),
    };
  };

  console.log('Processing request with method:', method);
  console.log('Request headers:', headers);

  // Handle OPTIONS request (preflight) - This is critical for CORS
  if (method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request for CORS');
    return createResponse(200, { message: 'CORS preflight successful' });
  }

  // Handle GET request for testing
  if (method === 'GET') {
    console.log('Handling GET request for proxy status check');
    return createResponse(200, {
      status: 'Lambda proxy server is running - Enhanced for Large Designs',
      timestamp: new Date().toISOString(),
      message: 'Use POST method to send requests to Claude API',
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
      maxDuration: '110 seconds',
      maxTokens: '3000',
      environment: process.env.AWS_EXECUTION_ENV || 'lambda',
      cors: 'enabled',
      method: method,
      headers: Object.keys(headers),
      enhancements: [
        'Extended timeout (110s)',
        'Higher token limit (3000)',
        'Large response handling',
        'Improved error recovery',
      ],
    });
  }

  // Only allow POST requests for API calls
  if (method !== 'POST') {
    console.log(`Method ${method} not allowed`);
    return createResponse(405, {
      error: 'Method not allowed. Use POST for API calls or GET for status check.',
      allowedMethods: ['GET', 'POST', 'OPTIONS'],
      receivedMethod: method,
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

    console.log('Request body parsed successfully');

    // Get the API key from environment variables (preferred) or request headers (fallback)
    const apiKey = process.env.ANTHROPIC_API_KEY || headers['x-api-key'] || headers['X-Api-Key'];

    if (!apiKey) {
      console.log('No API key found in environment variables or request headers');
      return createResponse(400, {
        error: 'API key is required. Please set ANTHROPIC_API_KEY environment variable or provide x-api-key header.',
        hasEnvKey: !!process.env.ANTHROPIC_API_KEY,
        hasHeaderKey: !!(headers['x-api-key'] || headers['X-Api-Key']),
        availableHeaders: Object.keys(headers),
      });
    }

    console.log('API key found, making request to Claude API...');

    // Validate request body
    if (!requestBody || !requestBody.model || !requestBody.messages) {
      console.log('Invalid request body validation failed');
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

    // Enhanced token handling for large designs - allow up to 3000 tokens
    const maxTokens = Math.min(requestBody.max_tokens || 1500, 3000);
    console.log(`Using max_tokens: ${maxTokens} (requested: ${requestBody.max_tokens || 'default'})`);

    // Forward the request to Claude API
    const claudeRequest = {
      model: requestBody.model,
      max_tokens: maxTokens,
      system: requestBody.system,
      messages: requestBody.messages,
      stream: false,
    };

    console.log('Sending request to Claude API...');

    // Extended timeout for large design generation - 110 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 110000);

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

      clearTimeout(timeoutId);

      const requestDuration = Date.now() - startTime;
      console.log(`Claude API responded with status: ${response.status} in ${requestDuration}ms`);

      const data = await response.json();

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

      // Log response size for monitoring
      const responseSize = JSON.stringify(data).length;
      console.log(`Response size: ${responseSize} characters`);

      // Enhanced response validation for large designs
      if (data.content && data.content[0] && data.content[0].text) {
        const responseText = data.content[0].text;
        const hasJSONContent = responseText.includes('"nodes"') && responseText.includes('"type"');
        console.log(`Response validation - Has JSON content: ${hasJSONContent}, Text length: ${responseText.length}`);

        // If response seems truncated, log for debugging
        if (!responseText.trim().endsWith('}') && !responseText.trim().endsWith('```')) {
          console.warn('Response may be truncated - does not end with proper JSON closure');
        }
      }

      // Return the data with CORS headers and enhanced timing info
      return createResponse(200, {
        ...data,
        _meta: {
          requestDuration: requestDuration,
          timestamp: new Date().toISOString(),
          maxTokensUsed: maxTokens,
          responseSize: responseSize,
          enhanced: true,
          timeout: '110s',
          maxTokensAllowed: 3000,
        },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        console.error('Request timed out after 110 seconds');
        return createResponse(408, {
          error: 'Request timeout',
          message: 'Claude API request took longer than 110 seconds',
          requestDuration: Date.now() - startTime,
          suggestion: 'Try reducing design complexity or max_tokens',
        });
      }

      throw fetchError;
    }
  } catch (error) {
    console.error('Error in Lambda handler:', error);
    const requestDuration = Date.now() - startTime;

    return createResponse(500, {
      error: 'An error occurred while processing your request',
      details: error.message,
      requestDuration: requestDuration,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
    });
  }
};
