// Netlify function to proxy requests to Claude API
exports.handler = async (event, context) => {
  // Set CORS headers for all responses (critical)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization, anthropic-version, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false',
  };

  // Handle OPTIONS request (preflight)
  if (event.httpMethod === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Handle GET request for testing
  if (event.httpMethod === 'GET') {
    console.log('Handling GET request for proxy status check');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'Proxy server is running',
        timestamp: new Date().toISOString(),
        message: 'Use POST method to send requests to Claude API',
      }),
    };
  }

  // Only allow POST requests for API calls
  if (event.httpMethod !== 'POST') {
    console.log(`Method ${event.httpMethod} not allowed`);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Use POST for API calls or GET for status check.' }),
    };
  }

  try {
    console.log('Processing POST request to Claude API');

    // Get the API key from the request headers
    const apiKey = event.headers['x-api-key'];

    if (!apiKey) {
      console.log('No API key provided in request headers');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'API key is required' }),
      };
    }

    console.log('API key found, making request to Claude API...');

    // Parse the request body
    const requestBody = JSON.parse(event.body);

    // Forward the request to Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`Claude API responded with status: ${response.status}`);

    // Get the response data
    const data = await response.json();

    if (!response.ok) {
      console.log('Claude API error:', data);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify(data),
      };
    }

    console.log('Successfully received response from Claude API');
    // Return the data with CORS headers
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Error in proxy handler:', error);
    // Return error with CORS headers
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'An error occurred while processing your request',
        details: error.message,
      }),
    };
  }
};
