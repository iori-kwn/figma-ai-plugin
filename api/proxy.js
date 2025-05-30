// Vercel serverless function to proxy requests to Claude API
export default async function handler(req, res) {
  // Set CORS headers for all responses (critical)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-api-key, Authorization, anthropic-version, X-Requested-With',
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.setHeader('Access-Control-Allow-Credentials', 'false');

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    return res.status(200).end();
  }

  // Handle GET request for testing
  if (req.method === 'GET') {
    console.log('Handling GET request for proxy status check');
    return res.status(200).json({
      status: 'Proxy server is running',
      timestamp: new Date().toISOString(),
      message: 'Use POST method to send requests to Claude API',
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    });
  }

  // Only allow POST requests for API calls
  if (req.method !== 'POST') {
    console.log(`Method ${req.method} not allowed`);
    return res.status(405).json({ error: 'Method not allowed. Use POST for API calls or GET for status check.' });
  }

  try {
    console.log('Processing POST request to Claude API');
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    // Get the API key from environment variables (preferred) or request headers (fallback)
    const apiKey = process.env.ANTHROPIC_API_KEY || req.headers['x-api-key'];

    if (!apiKey) {
      console.log('No API key found in environment variables or request headers');
      return res.status(400).json({
        error: 'API key is required. Please set ANTHROPIC_API_KEY environment variable or provide x-api-key header.',
        hasEnvKey: !!process.env.ANTHROPIC_API_KEY,
        hasHeaderKey: !!req.headers['x-api-key'],
      });
    }

    console.log('API key found, making request to Claude API...');
    console.log('Using environment API key:', !!process.env.ANTHROPIC_API_KEY);

    // Validate request body
    console.log('Received request body:', JSON.stringify(req.body, null, 2));
    console.log('Body keys:', Object.keys(req.body || {}));
    console.log('Model:', req.body?.model);
    console.log('Messages:', req.body?.messages);
    
    if (!req.body || !req.body.model || !req.body.messages) {
      console.log('Invalid request body validation failed:');
      console.log('- Has body:', !!req.body);
      console.log('- Has model:', !!(req.body && req.body.model));
      console.log('- Has messages:', !!(req.body && req.body.messages));
      return res.status(400).json({
        error: 'Invalid request body. Required fields: model, messages',
        receivedBody: req.body,
        validation: {
          hasBody: !!req.body,
          hasModel: !!(req.body && req.body.model),
          hasMessages: !!(req.body && req.body.messages)
        }
      });
    }

    // Forward the request to Claude API
    const claudeRequest = {
      model: req.body.model,
      max_tokens: req.body.max_tokens || 1000,
      system: req.body.system,
      messages: req.body.messages,
    };

    console.log('Sending to Claude API:', JSON.stringify(claudeRequest, null, 2));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(claudeRequest),
    });

    console.log(`Claude API responded with status: ${response.status}`);

    // Get the response data
    const data = await response.json();
    console.log('Claude API response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.log('Claude API error:', data);
      return res.status(response.status).json({
        error: 'Claude API error',
        claudeError: data,
        status: response.status,
      });
    }

    console.log('Successfully received response from Claude API');
    // Return the data with CORS headers
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in proxy handler:', error);
    // Return error with CORS headers
    return res.status(500).json({
      error: 'An error occurred while processing your request',
      details: error.message,
      stack: error.stack,
    });
  }
}
