// Netlify function to proxy requests to Claude API
exports.handler = async (event, context) => {
  // Set comprehensive CORS headers for all responses
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization, anthropic-version, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false',
    'Content-Type': 'application/json',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    console.log('🔧 Handling OPTIONS preflight request');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight successful' }),
    };
  }

  // Handle GET request for health check
  if (event.httpMethod === 'GET') {
    console.log('📊 Handling GET request for proxy status check');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'Proxy server is running',
        timestamp: new Date().toISOString(),
        message: 'Use POST method to send requests to Claude API',
        environment: 'Netlify Functions',
      }),
    };
  }

  // Only allow POST requests for API calls
  if (event.httpMethod !== 'POST') {
    console.log(`❌ Method ${event.httpMethod} not allowed`);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        error: 'Method not allowed. Use POST for API calls or GET for status check.',
        allowedMethods: ['GET', 'POST', 'OPTIONS'],
      }),
    };
  }

  try {
    console.log('🚀 Processing POST request to Claude API');
    console.log('📥 Event details:', {
      httpMethod: event.httpMethod,
      headers: Object.keys(event.headers || {}),
      bodyLength: event.body ? event.body.length : 0,
    });

    // Get the API key from headers
    const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];

    if (!apiKey) {
      console.log('❌ No API key provided in request headers');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'API key is required',
          hint: 'Include x-api-key header with your Claude API key',
        }),
      };
    }

    console.log('✅ API key found, making request to Claude API...');

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
      console.log('📝 Request body parsed successfully');
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid JSON in request body',
          details: parseError.message,
        }),
      };
    }

    // Forward the request to Claude API
    console.log('🌐 Sending request to Claude API...');
    const startTime = Date.now();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    const requestDuration = Date.now() - startTime;
    console.log(`⏱️ Claude API responded with status: ${response.status} in ${requestDuration}ms`);

    // Get response data
    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Claude API error:', {
        status: response.status,
        statusText: response.statusText,
        error: data,
      });
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: 'Claude API error',
          status: response.status,
          details: data,
          duration: requestDuration,
        }),
      };
    }

    console.log('✅ Successfully received response from Claude API');

    // Add metadata for debugging
    const responseWithMeta = {
      ...data,
      _meta: {
        requestDuration,
        timestamp: new Date().toISOString(),
        function: 'netlify-proxy',
      },
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(responseWithMeta),
    };
  } catch (error) {
    console.error('💥 Error in proxy handler:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    // Return error with proper CORS headers
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString(),
        function: 'netlify-proxy',
      }),
    };
  }
};
