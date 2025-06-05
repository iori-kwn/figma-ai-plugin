// Enhanced Lambda Function for API Gateway - Secret Manager Integration
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsManager = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

// Cache for API key to avoid repeated Secret Manager calls
let cachedApiKey = null;
let cacheExpiry = 0;
const CACHE_TTL = 300000; // 5 minutes

export const handler = async (event, context) => {
  const startTime = Date.now();

  // Enhanced logging for CloudWatch
  console.log('API Gateway Lambda Request:', {
    requestId: context.awsRequestId,
    httpMethod: event.httpMethod,
    path: event.path,
    resource: event.resource,
    userAgent: event.headers?.['User-Agent'],
    origin: event.headers?.['origin'] || event.headers?.['Origin'],
    timestamp: new Date().toISOString(),
    isBase64: event.isBase64Encoded,
  });

  const method = event.httpMethod || 'GET';
  const headers = event.headers || {};
  const body = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : null;

  // Enhanced CORS headers for API Gateway
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, HEAD',
    'Access-Control-Allow-Headers':
      'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token, ' +
      'x-api-key, anthropic-version, X-Requested-With, Accept, Origin, Referer, User-Agent',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Date, Server, X-Amzn-RequestId',
    'X-Request-ID': context.awsRequestId,
    'X-Powered-By': 'AWS API Gateway + Lambda + Secret Manager - Enhanced v3.0',
  };

  // Helper function to create API Gateway response
  const createResponse = (statusCode, responseBody, additionalHeaders = {}) => {
    const response = {
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

    // Enhanced response logging
    console.log('Response Summary:', {
      statusCode,
      requestId: context.awsRequestId,
      bodySize: response.body.length,
      duration: Date.now() - startTime,
      success: statusCode >= 200 && statusCode < 300,
    });

    return response;
  };

  // Handle OPTIONS request (CORS preflight)
  if (method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return createResponse(200, { message: 'CORS preflight successful' });
  }

  // Handle GET request for health check
  if (method === 'GET') {
    console.log('Handling health check request');
    return createResponse(200, {
      status: 'API Gateway + Lambda proxy server is running - Enhanced for Large Designs',
      version: '3.0',
      timestamp: new Date().toISOString(),
      requestId: context.awsRequestId,
      message: 'Use POST method to send requests to Claude API',
      capabilities: [
        'API Gateway integration (10MB response limit)',
        'Secret Manager integration',
        'Enhanced error handling',
        'Large response support',
        'Higher token limits (up to 4000)',
        'CloudWatch enhanced logging',
        'API key caching for performance',
      ],
      endpoints: {
        health: 'GET /',
        claude: 'POST /',
      },
      improvements: {
        max_tokens: 'Increased from 1500 to 4000',
        api_key_management: 'Secure Secret Manager integration',
        error_handling: 'Enhanced with detailed logging',
        performance: 'API key caching reduces latency',
        response_limit: 'API Gateway 10MB vs Lambda URL 6MB',
      },
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
    // Parse the request body
    if (!body) {
      console.log('Empty request body');
      return createResponse(400, {
        error: 'Request body is required',
        requestId: context.awsRequestId,
      });
    }

    let requestData;
    try {
      requestData = JSON.parse(body);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return createResponse(400, {
        error: 'Invalid JSON in request body',
        details: parseError.message,
        requestId: context.awsRequestId,
      });
    }

    // Get API key from Secret Manager
    const apiKey = await getApiKey();
    if (!apiKey) {
      console.error('Failed to retrieve API key');
      return createResponse(500, {
        error: 'Failed to retrieve API key from Secret Manager',
        requestId: context.awsRequestId,
      });
    }

    console.log('Enhanced Claude API request:', {
      model: requestData.model,
      maxTokens: requestData.max_tokens,
      systemPromptLength: requestData.system?.length || 0,
      messageCount: requestData.messages?.length || 0,
      expectedResponseSize: 'Large design JSON (up to 10MB)',
    });

    // Make request to Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestData),
    });

    const claudeRequestDuration = Date.now() - startTime;

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error(`Claude API error: ${claudeResponse.status} - ${errorText}`);

      return createResponse(claudeResponse.status, {
        error: 'Claude API request failed',
        status: claudeResponse.status,
        details: errorText,
        requestDuration: claudeRequestDuration,
        requestId: context.awsRequestId,
      });
    }

    // Parse Claude response
    const claudeData = await claudeResponse.json();
    console.log('Claude API response received:', {
      id: claudeData.id,
      model: claudeData.model,
      contentLength: claudeData.content?.[0]?.text?.length || 0,
      usage: claudeData.usage,
      requestDuration: claudeRequestDuration,
    });

    // Add metadata for debugging
    claudeData._meta = {
      requestId: context.awsRequestId,
      requestDuration: claudeRequestDuration,
      timestamp: new Date().toISOString(),
      responseSizeBytes: JSON.stringify(claudeData).length,
    };

    // Return the successful response
    return createResponse(200, claudeData);
  } catch (error) {
    console.error('Error in Lambda handler:', error);
    const requestDuration = Date.now() - startTime;

    // Return error with CORS headers and timing info
    return createResponse(500, {
      error: 'An error occurred while processing your request',
      details: error.message,
      requestDuration: requestDuration,
      timestamp: new Date().toISOString(),
      requestId: context.awsRequestId,
      // Don't include stack trace in production
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
    });
  }
};

/**
 * Get API key from Secret Manager with caching
 */
async function getApiKey() {
  const now = Date.now();

  // Return cached key if still valid
  if (cachedApiKey && now < cacheExpiry) {
    console.log('Using cached API key');
    return cachedApiKey;
  }

  try {
    console.log('Retrieving API key from Secret Manager');

    const command = new GetSecretValueCommand({
      SecretId: process.env.SECRET_NAME || 'figma-claude-api-key',
      VersionStage: 'AWSCURRENT',
    });

    const response = await secretsManager.send(command);

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    const secretData = JSON.parse(response.SecretString);
    const apiKey = secretData['api-key'];

    if (!apiKey) {
      throw new Error('API key not found in secret');
    }

    // Cache the API key
    cachedApiKey = apiKey;
    cacheExpiry = now + CACHE_TTL;

    console.log('API key retrieved and cached successfully');
    return apiKey;
  } catch (error) {
    console.error('Failed to get API key from Secret Manager:', error);

    // Clear cache on error
    cachedApiKey = null;
    cacheExpiry = 0;

    return null;
  }
}
