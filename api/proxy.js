// Vercel serverless function to proxy requests to Claude API
// This file should be deployed to Vercel

export default async function handler(req, res) {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the API key from the request headers
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    // Log the request for debugging (in production, you might want to remove this)
    console.log('Request body:', JSON.stringify(req.body));

    // Forward the request to Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    // Get the response data
    const data = await response.json();

    // Log the response for debugging (in production, you might want to remove this)
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data).substring(0, 500) + '...');

    // Set additional CORS headers again to ensure they're present
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Return the data
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy server error:', error);

    // Set CORS headers even for error responses
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.status(500).json({
      error: 'An error occurred while processing your request',
      details: error.message,
    });
  }
}
