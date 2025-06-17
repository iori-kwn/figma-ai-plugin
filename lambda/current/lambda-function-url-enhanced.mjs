// Enhanced Lambda Function URL - Secret Manager Integration
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsManager = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

// Cache for API key to avoid repeated Secret Manager calls
let cachedApiKey = null;
let cacheExpiry = 0;
const CACHE_TTL = 300000; // 5 minutes

/**
 * Clean markdown-formatted JSON from AI responses
 * Handles common patterns like ```json...``` blocks
 */
function cleanMarkdownJson(responseText) {
  if (!responseText) return responseText;

  console.log('Cleaning markdown JSON, input length:', responseText.length);
  console.log('Input preview:', responseText.substring(0, 200));

  let cleanedJson = responseText;

  try {
    // Pattern 1: ```json...``` blocks (most reliable)
    let jsonMatch = responseText.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
    if (jsonMatch) {
      cleanedJson = jsonMatch[1].trim();
      console.log('Extracted JSON from ```json blocks (Pattern 1)');
    }
    // Pattern 2: Generic ``` blocks starting with {
    else {
      jsonMatch = responseText.match(/```\s*\n?([\s\S]*?)\n?\s*```/);
      if (jsonMatch && jsonMatch[1].trim().startsWith('{')) {
        cleanedJson = jsonMatch[1].trim();
        console.log('Extracted JSON from generic ``` blocks (Pattern 2)');
      }
      // Pattern 3: Remove just the markdown markers
      else if (responseText.includes('```json')) {
        cleanedJson = responseText
          .replace(/^```json\s*\n?/, '') // Remove opening ```json
          .replace(/\n?\s*```\s*$/, '') // Remove closing ```
          .trim();
        console.log('Cleaned JSON by removing markdown markers (Pattern 3)');
      }
      // Pattern 4: Find the first balanced JSON object
      else {
        const firstBrace = responseText.indexOf('{');
        if (firstBrace !== -1) {
          let braceCount = 0;
          let endBrace = -1;

          for (let i = firstBrace; i < responseText.length; i++) {
            if (responseText[i] === '{') {
              braceCount++;
            } else if (responseText[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                endBrace = i;
                break;
              }
            }
          }

          if (endBrace !== -1) {
            cleanedJson = responseText.substring(firstBrace, endBrace + 1);
            console.log('Extracted balanced JSON object (Pattern 4)');
          }
        }
      }
    }

    // Validate that we have valid JSON
    JSON.parse(cleanedJson);
    console.log('Successfully cleaned and validated JSON, length:', cleanedJson.length);

    return cleanedJson;
  } catch (error) {
    console.error('Error cleaning markdown JSON:', error.message);
    console.log('Returning original text as fallback');
    return responseText;
  }
}

export const handler = async (event, context) => {
  const startTime = Date.now();

  // Enhanced logging for CloudWatch
  console.log('Lambda Function URL Request:', {
    requestId: context.awsRequestId,
    method: event.requestContext?.http?.method || 'UNKNOWN',
    path: event.rawPath,
    userAgent: event.headers?.['user-agent'],
    origin: event.headers?.['origin'],
    timestamp: new Date().toISOString(),
    isBase64: event.isBase64Encoded,
  });

  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const headers = event.headers || {};
  const body = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : null;

  // Enhanced CORS headers
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
    'X-Powered-By': 'AWS Lambda Function URL + Secret Manager - Enhanced v2.0',
  };

  // Helper function to create response
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
      status: 'Lambda proxy server is running - Enhanced for Large Designs',
      version: '2.0',
      timestamp: new Date().toISOString(),
      requestId: context.awsRequestId,
      message: 'Use POST method to send requests to Claude API',
      capabilities: [
        'Secret Manager integration',
        'Enhanced error handling',
        'Large response support (Function URL)',
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
      },
    });
  }

  // Only allow POST for Claude API calls
  if (method !== 'POST') {
    console.log(`Method ${method} not allowed`);
    return createResponse(405, {
      error: 'Method not allowed',
      allowed: ['GET', 'POST', 'OPTIONS'],
      received: method,
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
        troubleshooting: 'Check Secret Manager configuration and IAM permissions',
      });
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = body ? JSON.parse(body) : {};
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return createResponse(400, {
        error: 'Invalid JSON in request body',
        details: parseError.message,
        requestId: context.awsRequestId,
      });
    }

    // Validate required fields
    if (!requestBody.model || !requestBody.messages) {
      console.error('Missing required fields in request');
      return createResponse(400, {
        error: 'Missing required fields',
        required: ['model', 'messages'],
        received: Object.keys(requestBody),
        requestId: context.awsRequestId,
      });
    }

    // Enhanced token handling - significantly increased for detailed designs
    const maxTokens = Math.min(requestBody.max_tokens || 2000, 4000);

    console.log('Enhanced Claude API request:', {
      model: requestBody.model,
      maxTokens,
      systemPromptLength: requestBody.system?.length || 0,
      messagesCount: requestBody.messages?.length || 0,
      expectedResponseSize: 'Large design JSON',
    });

    // Prepare Claude API request with streaming enabled (社内エンジニアのアドバイスに基づく)
    const claudeRequest = {
      model: requestBody.model,
      max_tokens: maxTokens,
      system: requestBody.system,
      messages: requestBody.messages,
      stream: true, // ストリーミングを有効化
    };

    // Call Claude API with streaming configuration
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 150000); // 2.5 minutes

    try {
      console.log('Making Claude API request with streaming...');
      const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
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

      if (!claudeResponse.ok) {
        console.error('Claude API error:', claudeResponse.status, claudeResponse.statusText);
        const errorText = await claudeResponse.text();
        console.error('Error details:', errorText);
        throw new Error(`Claude API error: ${claudeResponse.status} - ${errorText}`);
      }

      // ストリーミングレスポンスの処理（社内エンジニアのアドバイスに基づく）
      if (claudeResponse.body) {
        console.log('Streaming response body available');

        // ストリーミングヘッダーを設定
        return {
          statusCode: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no', // Nginxバッファリング無効
          },
          body: await processStreamingResponse(claudeResponse),
          isBase64Encoded: false,
        };
      } else {
        // フォールバック: 非ストリーミング処理
        const data = await claudeResponse.json();
        console.log('Non-streaming Claude API response received');

        const responseSize = JSON.stringify(data).length;

        return createResponse(200, {
          ...data,
          _meta: {
            requestId: context.awsRequestId,
            requestDuration: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            maxTokensUsed: maxTokens,
            responseSize,
            version: '2.0',
            infrastructure: 'Lambda Function URL + Secret Manager + Streaming',
            improvements: 'Enhanced for streaming and detailed design generation',
          },
        });
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        console.error('Request timeout after 2.5 minutes');
        return createResponse(408, {
          error: 'Request timeout',
          message: 'Claude API request took longer than 2.5 minutes',
          requestId: context.awsRequestId,
          duration: Date.now() - startTime,
          suggestion: 'Try with a shorter prompt or reduce max_tokens',
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

/**
 * Process streaming response from Claude API
 * 社内エンジニア Maki Fujiwara のアドバイスに基づく実装
 */
async function processStreamingResponse(claudeResponse) {
  try {
    const reader = claudeResponse.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    console.log('Starting to process streaming response...');

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log('Streaming response complete, total length:', fullResponse.length);
        break;
      }

      // Decode the chunk
      const chunk = decoder.decode(value, { stream: true });

      // Claude APIのストリーミングフォーマットを処理
      // フォーマット: "data: {json}\n\n" または "event: message_stop\n\n"
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonData = JSON.parse(line.slice(6)); // "data: " を除去

            // テキストコンテンツを抽出
            if (jsonData.type === 'content_block_delta' && jsonData.delta?.text) {
              fullResponse += jsonData.delta.text;
            }
          } catch (e) {
            // JSON解析エラーは無視（接続チャンクなど）
            console.log('Skipping non-JSON line:', line.substring(0, 50));
          }
        } else if (line.startsWith('event: message_stop')) {
          console.log('Received message_stop event');
          break;
        }
      }
    }

    // 完全なレスポンステキストを返す前にマークダウンをクリーニング
    console.log('Full response received, checking for markdown formatting...');

    if (fullResponse.includes('```json') || fullResponse.includes('```')) {
      console.log('Markdown formatting detected in streaming response, cleaning...');

      try {
        const cleanedJson = cleanMarkdownJson(fullResponse);

        // クリーニングされたJSONが有効か検証
        JSON.parse(cleanedJson);

        console.log('Successfully cleaned streaming response:', {
          originalLength: fullResponse.length,
          cleanedLength: cleanedJson.length,
          isValidJSON: true,
        });

        return cleanedJson;
      } catch (cleanError) {
        console.error('Failed to clean markdown from streaming response:', cleanError.message);
        console.log('Returning original streaming response as fallback');
        // クリーニングに失敗した場合は元のレスポンスを返す
      }
    }

    return fullResponse;
  } catch (error) {
    console.error('Error processing streaming response:', error);
    console.error('Error stack:', error.stack);

    // エラー時はより詳細な情報を返す
    throw new Error(`Streaming processing failed: ${error.message}`);
  }
}
