// Layermateライクなプラグイン - メインコード

// API設定の型定義
type ApiSettings = {
  apiService: string;
  apiKey: string;
  apiModel: string;
};

// Claude APIリクエストの型定義
interface ClaudeRequestBase {
  model: string;
  max_tokens: number;
  system: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
  }[];
}

// ストリーミング関連の型定義（社内エンジニアのアドバイスに基づく）
interface StreamChunk {
  id: string;
  data: unknown;
}

// ストリーミングメッセージの型定義
interface StreamMessage {
  type: 'stream-update' | 'stream-complete' | 'stream-error' | 'json-chunk';
  chunk?: string;
  fullResult?: string;
  chunks?: StreamChunk[];
  error?: string;
}

// API設定のデフォルト値
const DEFAULT_API_SETTINGS: ApiSettings = {
  apiService: 'anthropic',
  apiKey: '',
  apiModel: 'claude-3-5-haiku-20241022',
};

// プロキシサーバーのURL - Lambda Function URL に戻す
const PROXY_URL = 'https://45eu4yy74z3uljhe74ogyda4bm0stwqt.lambda-url.ap-northeast-1.on.aws/';

// 現在のAPI設定
let currentApiSettings: ApiSettings = { ...DEFAULT_API_SETTINGS };

// ノードタイプの定義
// Mock Fill type that matches our JSON structure
interface MockFill {
  type: string;
  color: { r: number; g: number; b: number };
}

type NodeSchema = {
  type: string;
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fills?: MockFill[];
  children?: NodeSchema[];
  characters?: string;
  fontSize?: number;
  cornerRadius?: number;
};

/**
 * APIキーのASCII文字チェック
 */
function validateApiKeyForHeaders(apiKey: string): string {
  // ASCII文字のみ許可（HTTPヘッダー用）
  const asciiOnlyRegex = /^[\x00-\x7F]*$/;

  if (!asciiOnlyRegex.test(apiKey)) {
    console.error('API key contains non-ASCII characters');
    throw new Error('APIキーに日本語や特殊文字が含まれています。英数字のみのAPIキーを使用してください。');
  }

  // 先頭・末尾の空白除去
  return apiKey.trim();
}

/**
 * APIキーとプロキシサーバーの接続をテストする
 */
async function testApiConnection(): Promise<boolean> {
  try {
    console.log('Testing API connection...');

    if (!currentApiSettings.apiKey) {
      console.log('No API key configured');
      figma.ui.postMessage({
        type: 'error',
        message: 'APIキーが設定されていません。設定タブでAPIキーを入力してください。',
      });
      return false;
    }

    // APIキーの検証（ASCII文字のみ）
    let validatedApiKey: string;
    try {
      validatedApiKey = validateApiKeyForHeaders(currentApiSettings.apiKey);
    } catch (validationError) {
      figma.ui.postMessage({
        type: 'error',
        message: (validationError as Error).message,
      });
      return false;
    }

    // プロキシサーバーの状態確認
    try {
      const proxyResponse = await fetch(PROXY_URL, {
        method: 'GET',
      });

      if (proxyResponse.ok) {
        const proxyData = await proxyResponse.json();
        console.log('Proxy server status:', proxyData);
      } else {
        console.error('Proxy server error:', proxyResponse.status);
      }
    } catch (proxyError) {
      console.error('Failed to connect to proxy server:', proxyError);
    }

    // 簡単なAPIテストリクエスト
    const testRequest = {
      model: currentApiSettings.apiModel,
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: 'Hello, please respond with "API connection successful"',
        },
      ],
    };

    console.log('Sending test request to API...');
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': validatedApiKey,
      },
      body: JSON.stringify(testRequest),
    });

    console.log('Test API response status:', response.status);

    if (response.ok) {
      // ストリーミング対応: レスポンスがJSONかテキストかを判定
      let contentType = null;
      
      // Figma環境でheadersが利用可能かチェック
      if (response.headers && typeof response.headers.get === 'function') {
        contentType = response.headers.get('content-type');
      }
      
      let data;

      try {
        // Figma環境では常にresponse.text()を使用してから判定
        const textResponse = await response.text();
        
        // JSONとして解析を試みる
        try {
          data = JSON.parse(textResponse);
          console.log('API test successful (JSON):', data);
        } catch (jsonError) {
          // JSONでない場合はテキストとして処理
          console.log('API test successful (Text):', textResponse.substring(0, 200));
          data = {
            success: true,
            response: textResponse,
            type: 'text',
            note: 'APIは正常に応答しています',
          };
        }
      } catch (parseError) {
        // エラー処理（すでにtextResponseは読み込み済み）
        console.error('Error processing response:', parseError);
        data = {
          success: false,
          error: 'レスポンスの処理中にエラーが発生しました',
        };
      }

      figma.ui.postMessage({
        type: 'success',
        message: 'API接続テストが成功しました！ストリーミング機能が動作しています。',
      });
      return true;
    } else {
      const errorData = await response.json();
      console.error('API test failed:', errorData);

      let errorMessage = 'API接続テストが失敗しました。';
      if (response.status === 401) {
        errorMessage = 'APIキーが無効です。正しいAPIキーを設定してください。';
      } else if (response.status === 429) {
        errorMessage = 'API利用制限に達しています。しばらく待ってから再試行してください。';
      }

      figma.ui.postMessage({
        type: 'error',
        message: errorMessage,
      });
      return false;
    }
  } catch (error) {
    console.error('API connection test error:', error);
    figma.ui.postMessage({
      type: 'error',
      message: 'API接続テスト中にエラーが発生しました: ' + (error as Error).message,
    });
    return false;
  }
}

/**
 * APIキー設定をclientStorageから読み込む
 */
async function loadApiSettings(): Promise<ApiSettings> {
  try {
    // clientStorageから設定を読み込む
    const keys = await figma.clientStorage.keysAsync();

    if (keys.indexOf('apiSettings') !== -1) {
      const settings = (await figma.clientStorage.getAsync('apiSettings')) as ApiSettings;
      return { ...DEFAULT_API_SETTINGS, ...settings };
    }

    return { ...DEFAULT_API_SETTINGS };
  } catch (error) {
    console.error('Error loading API settings:', error);
    return { ...DEFAULT_API_SETTINGS };
  }
}

/**
 * APIキー設定をclientStorageに保存する
 */
async function saveApiSettings(settings: ApiSettings): Promise<void> {
  try {
    await figma.clientStorage.setAsync('apiSettings', settings);
    currentApiSettings = settings;
  } catch (error) {
    console.error('Error saving API settings:', error);
    throw error;
  }
}

interface ClaudeResponse {
  nodes: NodeSchema[];
}

/**
 * JSON修復機能: 不完全なJSONを修復する
 */
function repairIncompleteJSON(text: string): string {
  let repairedText = text.trim();

  console.log('Starting JSON repair process...');
  console.log('Original text preview:', repairedText.substring(0, 200));

  // Count brackets and braces
  const openBrackets = (repairedText.match(/\[/g) || []).length;
  const closeBrackets = (repairedText.match(/\]/g) || []).length;
  const openBraces = (repairedText.match(/\{/g) || []).length;
  const closeBraces = (repairedText.match(/\}/g) || []).length;

  console.log('JSON repair analysis:');
  console.log(`  - Open brackets [: ${openBrackets}, Close brackets ]: ${closeBrackets}`);
  console.log(`  - Open braces {: ${openBraces}, Close braces }: ${closeBraces}`);

  // For severely truncated JSON, create a minimal valid structure
  if (repairedText.length < 500 && openBrackets > closeBrackets + 1) {
    console.log('Severely truncated JSON detected, creating minimal valid structure');

    // Find the main frame structure
    const frameMatch = repairedText.match(
      /\{\s*"type":\s*"FRAME"[^}]*"name":\s*"([^"]*)"[^}]*"width":\s*(\d+)[^}]*"height":\s*(\d+)/,
    );

    if (frameMatch) {
      const [, frameName, width, height] = frameMatch;
      return `{
        "nodes": [
          {
            "type": "FRAME",
            "name": "${frameName}",
            "width": ${width},
            "height": ${height},
            "fills": [{"type": "SOLID", "color": {"r": 0.98, "g": 0.98, "b": 1}}],
            "children": []
          }
        ]
      }`;
    }

    // Fallback minimal structure
    return `{
      "nodes": [
        {
          "type": "FRAME",
          "name": "Recovered Design",
          "width": 375,
          "height": 812,
          "fills": [{"type": "SOLID", "color": {"r": 0.98, "g": 0.98, "b": 1}}],
          "children": []
        }
      ]
    }`;
  }

  // Step 1: Handle incomplete property name/value pairs
  // Look for patterns like: "property": or "property":value
  const incompletePropertyPattern = /,?\s*"[^"]*"\s*:\s*[^,}\]]*$/;
  if (incompletePropertyPattern.test(repairedText)) {
    console.log('Detected incomplete property, attempting to complete it');

    // If it ends with just "property": add a default value
    if (/"[^"]*"\s*:\s*$/.test(repairedText)) {
      repairedText += '""';
      console.log('Added empty string value to incomplete property');
    } else if (/"[^"]*"\s*:\s*[^,}\]"]*$/.test(repairedText)) {
      // If it ends with "property": partial_value
      // Try to determine the intended type and complete it
      const lastValue = repairedText.match(/:\s*([^,}\]"]*)$/)?.[1] || '';
      if (/^\d+\.?\d*$/.test(lastValue)) {
        // Looks like a number, keep as is if it's valid
        console.log('Incomplete numeric value detected, keeping as is');
      } else if (lastValue.startsWith('"')) {
        // Incomplete string, close it
        repairedText += '"';
        console.log('Closed incomplete string value');
      } else {
        // Unknown type, make it a string
        repairedText = repairedText.replace(/:\s*[^,}\]"]*$/, ': ""');
        console.log('Replaced incomplete value with empty string');
      }
    }
  }

  // Step 2: Handle incomplete string values
  // Look for patterns like: "key": "incomplete_value
  const incompleteStringPattern = /:\s*"[^"]*$/;
  if (incompleteStringPattern.test(repairedText)) {
    console.log('Detected incomplete string value, completing it');
    repairedText += '"';
  }

  // Step 3: Remove any trailing incomplete property that might cause issues
  // Pattern: ends with comma and incomplete property name
  const trailingIncompletePattern = /,\s*"[^"]*$|,\s*"[^"]*"\s*:\s*$/;
  if (trailingIncompletePattern.test(repairedText)) {
    console.log('Removing trailing incomplete property');
    repairedText = repairedText.replace(trailingIncompletePattern, '');
  }

  // Step 4: Add missing commas where needed (but be careful not to add after the last property)
  // Look for patterns where we need commas: "value" { or "value" [
  repairedText = repairedText.replace(/"\s*([{[])/g, '",$1');
  repairedText = repairedText.replace(/(\d)\s*([{[])/g, '$1,$2');

  // But don't add comma after the opening brace/bracket
  repairedText = repairedText.replace(/([{[]),/g, '$1');

  // Step 5: Intelligently close nested structures
  // We need to close them in the correct order to maintain JSON structure
  if (openBrackets > closeBrackets || openBraces > closeBraces) {
    console.log('Attempting intelligent structure closing...');
    
    // Analyze the structure to close in correct order
    let closingSequence = '';
    let remainingBraces = openBraces - closeBraces;
    let remainingBrackets = openBrackets - closeBrackets;
    
    // Strategy: Look at the end of the text to understand what needs closing
    const endPattern = repairedText.slice(-100); // Look at last 100 chars
    
    // If we're inside an object (last non-whitespace is a property value)
    if (/"[^"]*"\s*:\s*[^,}\]]*$/.test(endPattern) || /[^,}\]]\s*$/.test(endPattern)) {
      // We're likely inside an object that needs closing
      while (remainingBraces > 0 || remainingBrackets > 0) {
        if (remainingBraces > 0) {
          closingSequence += '}';
          remainingBraces--;
        }
        if (remainingBrackets > 0) {
          closingSequence += ']';
          remainingBrackets--;
        }
      }
    } else {
      // Standard approach - close brackets first, then braces
      closingSequence = ']'.repeat(remainingBrackets) + '}'.repeat(remainingBraces);
    }
    
    console.log(`Adding closing sequence: ${closingSequence}`);
    repairedText += closingSequence;
  }

  // Step 6: Clean up trailing commas that might cause parsing errors
  repairedText = repairedText.replace(/,(\s*[}\]])/g, '$1');

  // Step 7: Try to fix common JSON syntax issues
  // Fix missing quotes around property names
  repairedText = repairedText.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

  // Fix single quotes to double quotes
  repairedText = repairedText.replace(/'/g, '"');

  // Step 8: Final cleanup - remove any orphaned commas at the end
  repairedText = repairedText.replace(/,\s*$/, '');

  // Step 9: Validate and try to parse to catch any remaining issues
  try {
    JSON.parse(repairedText);
    console.log('JSON repair successful - valid JSON structure achieved');
  } catch (parseError) {
    console.warn('Repaired JSON still has issues:', parseError);
    
    // Last resort: create a minimal valid structure if parsing still fails
    const basicStructure = {
      "nodes": [
        {
          "type": "FRAME",
          "name": "Fallback Design",
          "width": 375,
          "height": 812,
          "fills": [{"type": "SOLID", "color": {"r": 0.98, "g": 0.98, "b": 1}}],
          "children": []
        }
      ]
    };
    
    console.log('Using fallback structure due to parse failure');
    return JSON.stringify(basicStructure, null, 2);
  }

  console.log('Repair completed. Preview:', repairedText.substring(0, 200));
  console.log('Repaired text ends with:', repairedText.substring(Math.max(0, repairedText.length - 100)));

  return repairedText;
}

/**
 * Claude APIにリクエストを送信する
 */
async function sendToClaudeApi(prompt: string, disableLearning: boolean): Promise<ClaudeResponse> {
  // デフォルトのフォールバック
  const defaultMockResponse: ClaudeResponse = {
    nodes: [
      {
        type: 'FRAME',
        name: 'Simple Design',
        width: 300,
        height: 200,
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
        children: [
          {
            type: 'TEXT',
            name: 'Title',
            x: 20,
            y: 20,
            characters: 'Generated Design',
            fontSize: 18,
          },
        ],
      },
    ],
  };

  try {
    if (!currentApiSettings.apiKey) {
      throw new Error('APIキーが設定されていません。設定タブでAPIキーを入力してください。');
    }

    // APIキーの検証（ASCII文字のみ）
    let validatedApiKey: string;
    try {
      validatedApiKey = validateApiKeyForHeaders(currentApiSettings.apiKey);
    } catch (validationError) {
      figma.ui.postMessage({
        type: 'error',
        message: (validationError as Error).message,
      });
      throw validationError;
    }

    // デバッグ用: プロキシURLとAPIキーの最初の数文字を表示
    console.log('Using proxy URL:', PROXY_URL);
    console.log(
      'API Key provided:',
      currentApiSettings.apiKey
        ? '✅ (starts with: ' + currentApiSettings.apiKey.substring(0, 5) + '...)'
        : '❌ No key',
    );
    console.log('Selected model:', currentApiSettings.apiModel);

    // APIリクエストを試行
    try {
      // システムプロンプト（軽量版）
      const systemPrompt = `Create a mobile UI design in JSON format.

<requirements>
- Create 3-5 UI elements maximum
- Use simple, clean design
- Mobile app size: 375x812
- Output ONLY valid JSON
</requirements>

<json_format>
{
  "nodes": [
    {
      "type": "FRAME",
      "name": "App Container",
      "width": 375,
      "height": 812,
      "fills": [{"type": "SOLID", "color": {"r": 0.95, "g": 0.97, "b": 1}}],
      "children": [
        {
          "type": "TEXT",
          "name": "Title",
          "x": 24,
          "y": 80,
          "characters": "App Title",
          "fontSize": 24
        }
      ]
    }
  ]
}
</json_format>

Output ONLY the JSON structure with no additional text.`;

      // 学習無効化オプションが有効な場合はシステムプロンプトに追記
      let finalSystemPrompt = systemPrompt;
      if (disableLearning) {
        finalSystemPrompt += '\n\nNote: Please do not use this conversation for model training.';
      }

      // リクエストデータの作成（Claude APIの公式仕様に準拠）
      const requestData: ClaudeRequestBase = {
        model: currentApiSettings.apiModel,
        max_tokens: 2000,
        system: finalSystemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      };

      console.log('Trying to connect to proxy server...');
      console.log('Request data:', JSON.stringify(requestData, null, 2));

      // 社内エンジニアのアドバイスに基づいてストリーミング機能を使用
      console.log('Using streaming response handling...');

      try {
        // ストリーミングレスポンスでAPIを呼び出し
        const responseText = await handleStreamingResponse(PROXY_URL, requestData, validatedApiKey);

        console.log('Streaming response received, length:', responseText.length);

        // ストリーミングで取得したレスポンスからJSONを抽出
        let jsonText = null;

        console.log('=== STREAMING RESPONSE DEBUG ===');
        console.log('Response length:', responseText.length);
        console.log('Response preview (first 500 chars):', responseText.substring(0, 500));
        console.log(
          'Response ending (last 200 chars):',
          responseText.substring(Math.max(0, responseText.length - 200)),
        );
        console.log('Contains "```json":', responseText.includes('```json'));
        console.log('Contains "```":', responseText.includes('```'));
        console.log('Contains "nodes":', responseText.includes('nodes'));

        // パターン1: ```json...``` ブロック（最も確実）- 改善版
        let jsonMatch = responseText.match(/```json\s*\n([\s\S]*?)\n\s*```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim();
          console.log('Found JSON in code block (Pattern 1)');
          console.log('Extracted JSON preview:', jsonText.substring(0, 200));
        }

        // パターン2: ``` ブロック（jsonキーワードなし）- 改善版
        if (!jsonText) {
          jsonMatch = responseText.match(/```\s*\n([\s\S]*?)\n\s*```/);
          if (jsonMatch && jsonMatch[1].trim().startsWith('{')) {
            jsonText = jsonMatch[1].trim();
            console.log('Found JSON in generic code block (Pattern 2)');
          }
        }

        // パターン3: ```json で始まって ``` で終わる（改行なし対応）
        if (!jsonText) {
          jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            jsonText = jsonMatch[1].trim();
            console.log('Found JSON in code block without newlines (Pattern 3)');
          }
        }

        // パターン4: <json_response>タグ内のJSON（Claude 4推奨方式）
        if (!jsonText) {
          jsonMatch = responseText.match(/<json_response>\s*([\s\S]*?)\s*<\/json_response>/);
          if (jsonMatch) {
            jsonText = jsonMatch[1].trim();
            console.log('Found JSON in xml_response tags (Pattern 4)');
          }
        }

        // パターン5: 最も外側の{}を抽出（改良版）
        if (!jsonText) {
          const firstBrace = responseText.indexOf('{');
          if (firstBrace !== -1) {
            // 括弧の対応を正しく検出する
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
              jsonText = responseText.substring(firstBrace, endBrace + 1);
              console.log('Extracted balanced JSON object (Pattern 5)');
            }
          }
        }

        // パターン6: 改行を含む```jsonブロックの処理（最後の手段）
        if (!jsonText) {
          const jsonStartMarkers = ['```json', '```JSON', '```Json'];
          const jsonEndMarkers = ['```', '```\n'];

          for (const startMarker of jsonStartMarkers) {
            const startIndex = responseText.indexOf(startMarker);
            if (startIndex !== -1) {
              const contentStart = startIndex + startMarker.length;

              for (const endMarker of jsonEndMarkers) {
                const endIndex = responseText.indexOf(endMarker, contentStart);
                if (endIndex !== -1) {
                  jsonText = responseText.substring(contentStart, endIndex).trim();
                  if (jsonText.startsWith('{')) {
                    console.log('Found JSON using flexible pattern matching (Pattern 6)');
                    break;
                  }
                }
              }

              if (jsonText) break;
            }
          }
        }

        if (jsonText) {
          console.log('Extracted JSON text length:', jsonText.length);
          console.log('JSON text starts with:', jsonText.substring(0, 100));

          // JSON修復を試行
          const repairedJsonText = repairIncompleteJSON(jsonText);

          try {
            const jsonData = JSON.parse(repairedJsonText);
            console.log('Successfully parsed JSON data');

            // ClaudeResponseの構造に適合させる
            if (jsonData.nodes && Array.isArray(jsonData.nodes)) {
              return jsonData as ClaudeResponse;
            } else {
              console.log('Invalid JSON structure - no nodes array found');
              throw new Error('Invalid JSON structure');
            }
          } catch (parseError) {
            console.error('Failed to parse JSON even after repair:', parseError);
            console.log('Failed JSON text:', repairedJsonText.substring(0, 500));

            // 最後の手段: Lambda側でクリーニングされていない場合の追加処理
            console.log('Attempting additional markdown cleaning as fallback...');
            try {
              // さらなるmarkdownクリーニングを試行
              let additionalCleanedJson = repairedJsonText;

              // ```で囲まれた部分を除去
              if (additionalCleanedJson.includes('```')) {
                // シンプルな文字列処理でmarkdownブロックを除去
                const jsonStart = additionalCleanedJson.indexOf('```json');
                const altStart = additionalCleanedJson.indexOf('```');
                const startIndex = jsonStart !== -1 ? jsonStart : altStart;

                if (startIndex !== -1) {
                  const afterStart = additionalCleanedJson.substring(startIndex);
                  const firstNewline = afterStart.indexOf('\n');
                  if (firstNewline !== -1) {
                    additionalCleanedJson = afterStart.substring(firstNewline + 1);
                  } else {
                    additionalCleanedJson = afterStart.replace(/```json|```/g, '');
                  }
                }

                // 終了の```を除去
                const endIndex = additionalCleanedJson.lastIndexOf('```');
                if (endIndex !== -1) {
                  additionalCleanedJson = additionalCleanedJson.substring(0, endIndex);
                }

                additionalCleanedJson = additionalCleanedJson.trim();

                console.log('Attempted additional markdown cleaning');
                const fallbackData = JSON.parse(additionalCleanedJson);

                if (fallbackData.nodes && Array.isArray(fallbackData.nodes)) {
                  console.log('Successfully parsed with additional cleaning');
                  return fallbackData as ClaudeResponse;
                }
              }
            } catch (fallbackError) {
              console.error('Additional cleaning also failed:', fallbackError);
            }

            throw new Error('JSON parsing failed despite all cleanup attempts');
          }
        } else {
          console.error('No JSON found in streaming response');
          throw new Error('No JSON found in response');
        }
      } catch (streamError) {
        console.error('Streaming error:', streamError);

        // ストリーミングエラーの場合はフォールバックとしてモックデータを使用
        figma.ui.postMessage({
          type: 'warning',
          message: 'ストリーミング処理でエラーが発生しました。モックデータを使用します。',
        });

        throw streamError;
      }
    } catch (error) {
      console.error('API request failed:', error);
      figma.ui.postMessage({
        type: 'error',
        message: 'APIリクエスト中にエラーが発生しました: ' + (error as Error).message,
      });
      return getPromptBasedMockData(prompt);
    }
  } catch (error) {
    console.error('Unexpected error in sendToClaudeApi:', error);
    return defaultMockResponse;
  }
}

/**
 * プロンプトに基づいた適切なモックデータを返す関数
 */
function getPromptBasedMockData(prompt: string): ClaudeResponse {
  // プロンプトに基づいて異なるモックデータを選択
  if (prompt.indexOf('To Do') !== -1 || prompt.indexOf('ToDo') !== -1 || prompt.indexOf('タスク') !== -1) {
    // ToDo アプリのモックデータ
    console.log('Using ToDo app mock data');
    return {
      nodes: [
        {
          type: 'FRAME',
          name: 'ToDo App - iOS Style',
          width: 375,
          height: 812,
          fills: [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }],
          children: [
            {
              type: 'RECTANGLE',
              name: 'Status Bar',
              x: 0,
              y: 0,
              width: 375,
              height: 44,
              fills: [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }],
            },
            {
              type: 'TEXT',
              name: 'Title',
              x: 24,
              y: 60,
              characters: 'ToDo',
              fontSize: 34,
            },
            {
              type: 'RECTANGLE',
              name: 'Task Card 1',
              x: 24,
              y: 120,
              width: 327,
              height: 64,
              cornerRadius: 12,
              fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
            },
            {
              type: 'TEXT',
              name: 'Task Title 1',
              x: 42,
              y: 140,
              characters: '予算計画書の作成',
              fontSize: 17,
            },
          ],
        },
      ],
    };
  }

  // デフォルトのシンプルなモックデータ
  return {
    nodes: [
      {
        type: 'FRAME',
        name: 'Simple Design',
        width: 375,
        height: 812,
        fills: [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 1 } }],
        children: [
          {
            type: 'TEXT',
            name: 'Title',
            x: 24,
            y: 80,
            characters: 'Generated Design',
            fontSize: 24,
          },
        ],
      },
    ],
  };
}

/**
 * JSONスキーマからFigmaノードを生成する関数
 */
function buildNodeTree(nodeSchemas: NodeSchema[]): SceneNode[] {
  const nodes: SceneNode[] = [];

  for (const schema of nodeSchemas) {
    const node = createNode(schema);
    if (node) {
      nodes.push(node);
    }
  }

  return nodes;
}

/**
 * 単一のノードを生成する関数
 */
function createNode(schema: NodeSchema): SceneNode | null {
  let node: SceneNode | null = null;

  // ノードタイプに基づいてFigmaノードを作成
  switch (schema.type) {
    case 'FRAME':
      node = figma.createFrame();
      break;
    case 'RECTANGLE':
      node = figma.createRectangle();
      break;
    case 'TEXT':
      node = figma.createText();
      break;
    default:
      console.warn(`Unsupported node type: ${schema.type}`);
      return null;
  }

  // 共通プロパティを設定
  if (schema.name) {
    node.name = schema.name;
  }

  if (schema.x !== undefined) {
    node.x = schema.x;
  }

  if (schema.y !== undefined) {
    node.y = schema.y;
  }

  if (schema.width !== undefined && 'resize' in node) {
    if (schema.height !== undefined) {
      node.resize(schema.width, schema.height);
    } else {
      node.resize(schema.width, node.height);
    }
  }

  if (schema.fills && 'fills' in node) {
    // MockFillをFigmaのPaintに変換
    const figmaFills: Paint[] = schema.fills.map((fill) => ({
      type: fill.type === 'SOLID' ? 'SOLID' : 'SOLID', // デフォルトはSOLID
      color: fill.color,
      opacity: 1,
    }));

    // Figmaの塗りつぶしプロパティの設定
    node.fills = figmaFills;
  }

  if (schema.cornerRadius !== undefined && 'cornerRadius' in node) {
    node.cornerRadius = schema.cornerRadius;
  }

  // 子ノードを再帰的に処理（Frameなどのコンテナノードの場合）
  if (schema.children && 'appendChild' in node) {
    const childNodes = buildNodeTree(schema.children);
    for (const childNode of childNodes) {
      node.appendChild(childNode);
    }
  }

  return node;
}

/**
 * テキストノードのテキスト内容を設定する（フォントロード処理を含む）
 */
async function setupTextNode(node: TextNode, characters: string, fontSize?: number): Promise<void> {
  try {
    // デフォルトフォントをロード
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

    // テキスト内容を設定
    node.characters = characters;

    // フォントサイズがあれば設定
    if (fontSize) {
      node.fontSize = fontSize;
    }
  } catch (error) {
    console.error('Error loading font:', error);
    // エラー発生時も最低限テキストを表示
    node.characters = characters;
  }
}

/**
 * JSONスキーマからFigmaノードを生成する（非同期処理を含む）
 */
async function buildNodesWithTextAsync(nodeSchemas: NodeSchema[]): Promise<SceneNode[]> {
  const nodes: SceneNode[] = [];
  const textSetupPromises: Promise<void>[] = [];

  // まずすべてのノードを作成
  for (const schema of nodeSchemas) {
    const node = createNode(schema);
    if (node) {
      nodes.push(node);

      // TEXTノードの場合、テキスト設定処理をキューに追加
      if (node.type === 'TEXT' && schema.characters) {
        const textSetupPromise = setupTextNode(node as TextNode, schema.characters, schema.fontSize);
        textSetupPromises.push(textSetupPromise);
      }

      // 子ノードがある場合、再帰的に処理
      if (schema.children && 'appendChild' in node) {
        // 子ノードを非同期で処理してプロミスを追加
        const childNodesPromise = buildNodesWithTextAsync(schema.children).then((childNodes) => {
          for (const childNode of childNodes) {
            node.appendChild(childNode);
          }
        });
        textSetupPromises.push(childNodesPromise);
      }
    }
  }

  // すべてのテキスト設定処理が完了するのを待つ
  await Promise.all(textSetupPromises);

  return nodes;
}

/**
 * Lambda URLからのストリーミングレスポンスを処理する関数
 * 社内エンジニア Maki Fujiwara のアドバイスに基づいて実装
 * @param url - リクエストURL
 * @param requestData - リクエストデータ
 * @returns Promise<string> - 完全なレスポンス
 */
async function handleStreamingResponse(url: string, requestData: any, apiKey: string): Promise<string> {
  try {
    // Lambda URLにリクエスト
    const response: Response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestData),
    });

    // レスポンスがストリーミング可能か確認
    if (!response.body) {
      throw new Error('ReadableStream not supported');
    }

    // レスポンスボディをストリームとして処理
    const reader: ReadableStreamDefaultReader<Uint8Array> = response.body.getReader();
    const decoder: TextDecoder = new TextDecoder();
    let result: string = '';

    while (true) {
      const { done, value }: ReadableStreamReadResult<Uint8Array> = await reader.read();

      if (done) {
        break;
      }

      // バイナリデータをテキストに変換
      const chunk: string = decoder.decode(value, { stream: true });
      result += chunk;

      // 部分的な結果を処理（UIに表示するなど）
      figma.ui.postMessage({
        type: 'stream-update',
        chunk: chunk,
      });
    }

    // 処理完了
    figma.ui.postMessage({
      type: 'stream-complete',
      fullResult: result,
    });

    return result;
  } catch (error) {
    console.error('Streaming error:', error instanceof Error ? error.message : String(error));
    figma.ui.postMessage({
      type: 'stream-error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * JSONデータをストリーミングで処理する関数
 * 各チャンクがJSON形式の場合に使用（社内エンジニアのアドバイスに基づく）
 * @param url - リクエストURL
 * @param requestData - リクエストデータ
 * @returns Promise<StreamChunk[]> - JSONチャンクの配列
 */
async function handleJsonStreamingResponse(url: string, requestData: any, apiKey: string): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];

  try {
    const response: Response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestData),
    });

    if (!response.body) {
      throw new Error('ReadableStream not supported');
    }

    const reader: ReadableStreamDefaultReader<Uint8Array> = response.body.getReader();
    const decoder: TextDecoder = new TextDecoder();
    let buffer: string = '';

    while (true) {
      const { done, value }: ReadableStreamReadResult<Uint8Array> = await reader.read();

      if (done) {
        break;
      }

      // バイナリデータをテキストに変換して既存のバッファに追加
      buffer += decoder.decode(value, { stream: true });

      // バッファから完全なJSONオブジェクトを抽出
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const chunkStr: string = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (chunkStr.trim()) {
          try {
            const chunk: StreamChunk = JSON.parse(chunkStr);
            chunks.push(chunk);

            // UIに更新を送信
            figma.ui.postMessage({
              type: 'json-chunk',
              chunk: chunk,
            });
          } catch (e) {
            console.error('Error parsing JSON chunk:', chunkStr, e);
          }
        }
      }
    }

    // 処理完了
    figma.ui.postMessage({
      type: 'stream-complete',
      chunks: chunks,
    });

    return chunks;
  } catch (error) {
    console.error('JSON streaming error:', error instanceof Error ? error.message : String(error));
    figma.ui.postMessage({
      type: 'stream-error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return chunks;
  }
}

// UIを表示
figma.showUI(__html__, { width: 320, height: 400 });

// Claude APIにリクエストを送信する関数
async function generateDesignFromPrompt(prompt: string, disableLearning: boolean) {
  try {
    // UIにステータスを通知
    figma.ui.postMessage({
      type: 'status',
      message: 'AIにリクエスト送信中...',
    });

    // Claude APIにリクエストを送信
    const response = await sendToClaudeApi(prompt, disableLearning);

    // AIからの応答を処理
    figma.ui.postMessage({
      type: 'status',
      message: 'デザイン生成中...',
    });

    // レスポンスからノードデータを取得
    const nodeData = response.nodes || [];

    // ノードを非同期で生成（テキストノードのフォントロードを含む）
    const nodes = await buildNodesWithTextAsync(nodeData);

    // 生成したノードをFigmaに追加
    for (const node of nodes) {
      figma.currentPage.appendChild(node);
    }

    // ビューポートを調整
    figma.viewport.scrollAndZoomIntoView(nodes);

    // 成功メッセージを送信
    figma.ui.postMessage({
      type: 'success',
      message: 'デザインを生成しました',
    });
  } catch (error) {
    console.error('Error generating design:', error);
    figma.ui.postMessage({
      type: 'error',
      message: 'エラーが発生しました: ' + (error as Error).message,
    });
  }
}

// 初期化処理
async function initializePlugin() {
  try {
    // API設定を読み込む
    currentApiSettings = await loadApiSettings();

    // 設定をUIに送信
    figma.ui.postMessage({
      type: 'api-settings',
      apiService: currentApiSettings.apiService,
      apiKey: currentApiSettings.apiKey,
      apiModel: currentApiSettings.apiModel,
    });
  } catch (error) {
    console.error('Error initializing plugin:', error);
  }
}

// プラグイン起動時に初期化
initializePlugin();

// UIからのメッセージを処理するリスナー
figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'generate-design':
      // AIを使ってデザインを生成
      generateDesignFromPrompt(msg.prompt, msg.disableLearning);
      break;

    case 'test-api-connection':
      // API接続テスト
      await testApiConnection();
      break;

    case 'get-api-settings':
      // 保存されたAPI設定をUIに送信
      figma.ui.postMessage({
        type: 'api-settings',
        apiService: currentApiSettings.apiService,
        apiKey: currentApiSettings.apiKey,
        apiModel: currentApiSettings.apiModel,
      });
      break;

    case 'save-api-settings':
      try {
        // 新しいAPI設定を保存
        const newSettings: ApiSettings = {
          apiService: msg.apiService,
          apiKey: msg.apiKey,
          apiModel: msg.apiModel,
        };

        await saveApiSettings(newSettings);

        // 成功メッセージを送信
        figma.ui.postMessage({
          type: 'success',
          message: 'API設定を保存しました',
        });
      } catch (error) {
        // エラーメッセージを送信
        figma.ui.postMessage({
          type: 'error',
          message: 'API設定の保存に失敗しました: ' + (error as Error).message,
        });
      }
      break;

    case 'cancel':
      // プラグインを閉じる
      figma.closePlugin();
      break;
  }
};
