// AWS Lambda function for API Gateway - Enhanced with Secret Manager
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
  console.log('API Gateway Request:', {
    requestId: context.awsRequestId,
    method: event.httpMethod,
    path: event.path,
    queryString: event.queryStringParameters,
    userAgent: event.headers['User-Agent'],
    origin: event.headers['Origin'],
    timestamp: new Date().toISOString(),
  });

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
    'X-Powered-By': 'AWS Lambda + API Gateway',
  };

  // Helper function to create API Gateway response
  const createResponse = (statusCode, body, additionalHeaders = {}) => {
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
      body: typeof body === 'string' ? body : JSON.stringify(body),
    };

    // Log response for CloudWatch
    console.log('Response:', {
      statusCode,
      requestId: context.awsRequestId,
      bodySize: response.body.length,
      duration: Date.now() - startTime,
    });

    return response;
  };

  // Handle OPTIONS request (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return createResponse(200, { message: 'CORS preflight successful' });
  }

  // Handle GET request for health check
  if (event.httpMethod === 'GET') {
    console.log('Handling health check request');
    return createResponse(200, {
      status: 'API Gateway proxy server is running',
      version: '2.0',
      timestamp: new Date().toISOString(),
      requestId: context.awsRequestId,
      message: 'Use POST method to send requests to Claude API',
      capabilities: [
        'Secret Manager integration',
        'CloudWatch logging',
        'Enhanced error handling',
        'Large response support (10MB)',
        'Response compression',
        'Performance monitoring',
      ],
      endpoints: {
        health: 'GET /',
        claude: 'POST /',
      },
    });
  }

  // Only allow POST for Claude API calls
  if (event.httpMethod !== 'POST') {
    console.log(`Method ${event.httpMethod} not allowed`);
    return createResponse(405, {
      error: 'Method not allowed',
      allowed: ['GET', 'POST', 'OPTIONS'],
      received: event.httpMethod,
    });
  }

  try {
    // Get API key from Secret Manager (with caching)
    const apiKey = await getApiKey();

    if (!apiKey) {
      console.error('Failed to retrieve API key from Secret Manager');
      return createResponse(500, {
        error: 'Internal configuration error',
        message: 'Unable to access API credentials',
        requestId: context.awsRequestId,
      });
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = event.body ? JSON.parse(event.body) : {};
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return createResponse(400, {
        error: 'Invalid JSON in request body',
        details: parseError.message,
        requestId: context.awsRequestId,
      });
    }

    // Validate request
    if (!requestBody.model || !requestBody.messages) {
      console.error('Missing required fields in request');
      return createResponse(400, {
        error: 'Missing required fields',
        required: ['model', 'messages'],
        received: Object.keys(requestBody),
        requestId: context.awsRequestId,
      });
    }

    // Enhanced token handling for large designs
    const maxTokens = Math.min(requestBody.max_tokens || 2000, 4000);

    console.log('Claude API request:', {
      model: requestBody.model,
      maxTokens,
      systemPromptLength: requestBody.system?.length || 0,
      messagesCount: requestBody.messages?.length || 0,
    });

    // Prepare Claude API request
    const claudeRequest = {
      model: requestBody.model,
      max_tokens: maxTokens,
      system: requestBody.system,
      messages: requestBody.messages,
      stream: false,
    };

    // Call Claude API with enhanced timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes

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
      console.log(`Claude API response: ${response.status} in ${requestDuration}ms`);

      const data = await response.json();

      if (!response.ok) {
        console.error('Claude API error:', data);
        return createResponse(response.status, {
          error: 'Claude API error',
          details: data,
          requestId: context.awsRequestId,
          duration: requestDuration,
        });
      }

      // Log response metrics for CloudWatch
      const responseSize = JSON.stringify(data).length;
      console.log('Success metrics:', {
        responseSize,
        requestDuration,
        maxTokensUsed: maxTokens,
        requestId: context.awsRequestId,
      });

      // Enhanced response validation
      if (data.content?.[0]?.text) {
        const responseText = data.content[0].text;
        const hasJSONContent = responseText.includes('"nodes"');

        console.log('Response validation:', {
          hasJSONContent,
          textLength: responseText.length,
          endsWithValidJSON: responseText.trim().endsWith('}') || responseText.trim().endsWith('```'),
        });
      }

      // Return enhanced response
      return createResponse(200, {
        ...data,
        _meta: {
          requestId: context.awsRequestId,
          requestDuration,
          timestamp: new Date().toISOString(),
          maxTokensUsed: maxTokens,
          responseSize,
          version: '2.0',
          infrastructure: 'API Gateway + Lambda + Secret Manager',
        },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        console.error('Request timeout after 2 minutes');
        return createResponse(408, {
          error: 'Request timeout',
          message: 'Claude API request took longer than 2 minutes',
          requestId: context.awsRequestId,
          duration: Date.now() - startTime,
        });
      }

      throw fetchError;
    }
  } catch (error) {
    console.error('Unexpected error:', {
      error: error.message,
      stack: error.stack,
      requestId: context.awsRequestId,
    });

    return createResponse(500, {
      error: 'Internal server error',
      message: error.message,
      requestId: context.awsRequestId,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
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
