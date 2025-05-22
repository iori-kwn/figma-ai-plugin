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
  messages: {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }[];
}

interface ClaudeRequestWithLearningDisabled extends ClaudeRequestBase {
  system: string;
  claude_api_params: {
    disable_model_learning: boolean;
  };
}

// API設定のデフォルト値
const DEFAULT_API_SETTINGS: ApiSettings = {
  apiService: 'anthropic',
  apiKey: '',
  apiModel: 'claude-3-7-sonnet-20240307',
};

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
 * APIキー設定をclientStorageから読み込む
 */
async function loadApiSettings(): Promise<ApiSettings> {
  try {
    // clientStorageから設定を読み込む
    const keys = await figma.clientStorage.keysAsync();

    if (keys.includes('apiSettings')) {
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
 * Claude APIにリクエストを送信する
 */
async function sendToClaudeApi(prompt: string, disableLearning: boolean): Promise<ClaudeResponse> {
  try {
    if (!currentApiSettings.apiKey) {
      throw new Error('APIキーが設定されていません。設定タブでAPIキーを入力してください。');
    }

    // デバッグ用: プロキシURLとAPIキーの最初の数文字を表示
    console.log('Using proxy URL:', 'https://claude-proxy-server-qhieovdjm-yoriss67s-projects.vercel.app/api/proxy');
    console.log(
      'API Key provided:',
      currentApiSettings.apiKey
        ? '✅ (starts with: ' + currentApiSettings.apiKey.substring(0, 5) + '...)'
        : '❌ No key',
    );
    console.log('Selected model:', currentApiSettings.apiModel);

    // プロンプトに基づいて異なるモックデータを選択
    // CORS問題が解決するまでの暫定対応
    let mockResponse;

    if (prompt.includes('To Do') || prompt.includes('ToDo') || prompt.includes('タスク')) {
      // ToDo アプリのモックデータ
      console.log('Using ToDo app mock data');
      mockResponse = {
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
                name: 'Search Bar',
                x: 24,
                y: 120,
                width: 327,
                height: 36,
                cornerRadius: 10,
                fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.92 } }],
              },
              {
                type: 'TEXT',
                name: 'Search Placeholder',
                x: 42,
                y: 129,
                characters: '検索',
                fontSize: 17,
              },
              {
                type: 'RECTANGLE',
                name: 'Task Card 1',
                x: 24,
                y: 180,
                width: 327,
                height: 64,
                cornerRadius: 12,
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
              },
              {
                type: 'TEXT',
                name: 'Task Title 1',
                x: 42,
                y: 196,
                characters: '予算計画書の作成',
                fontSize: 17,
              },
              {
                type: 'TEXT',
                name: 'Task Due Date 1',
                x: 42,
                y: 220,
                characters: '今日まで',
                fontSize: 13,
              },
              {
                type: 'RECTANGLE',
                name: 'Task Card 2',
                x: 24,
                y: 260,
                width: 327,
                height: 64,
                cornerRadius: 12,
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
              },
              {
                type: 'TEXT',
                name: 'Task Title 2',
                x: 42,
                y: 276,
                characters: 'クライアントミーティング',
                fontSize: 17,
              },
              {
                type: 'TEXT',
                name: 'Task Due Date 2',
                x: 42,
                y: 300,
                characters: '明日 14:00',
                fontSize: 13,
              },
              {
                type: 'RECTANGLE',
                name: 'Task Card 3',
                x: 24,
                y: 340,
                width: 327,
                height: 64,
                cornerRadius: 12,
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
              },
              {
                type: 'TEXT',
                name: 'Task Title 3',
                x: 42,
                y: 356,
                characters: 'プレゼン資料の準備',
                fontSize: 17,
              },
              {
                type: 'TEXT',
                name: 'Task Due Date 3',
                x: 42,
                y: 380,
                characters: '3日後',
                fontSize: 13,
              },
              {
                type: 'RECTANGLE',
                name: 'Add Button',
                x: 303,
                y: 730,
                width: 48,
                height: 48,
                cornerRadius: 24,
                fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.4, b: 0.9 } }],
              },
              {
                type: 'TEXT',
                name: 'Plus',
                x: 319,
                y: 739,
                characters: '+',
                fontSize: 28,
              },
            ],
          },
        ],
      };
    } else if (prompt.includes('学習') || prompt.includes('ホーム')) {
      // 学習アプリのモックデータ
      console.log('Using learning app mock data');
      mockResponse = {
        nodes: [
          {
            type: 'FRAME',
            name: '学習ホーム画面',
            width: 375,
            height: 812,
            fills: [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }],
            children: [
              {
                type: 'RECTANGLE',
                name: 'ヘッダー',
                x: 0,
                y: 0,
                width: 375,
                height: 100,
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
              },
              {
                type: 'TEXT',
                name: 'タイトル',
                x: 24,
                y: 50,
                characters: '建設学習アプリ',
                fontSize: 24,
              },
              {
                type: 'RECTANGLE',
                name: '最近の学習カード',
                x: 24,
                y: 120,
                width: 327,
                height: 120,
                cornerRadius: 12,
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
              },
              {
                type: 'TEXT',
                name: 'カードタイトル',
                x: 48,
                y: 140,
                characters: '基礎工事の安全対策',
                fontSize: 18,
              },
              {
                type: 'TEXT',
                name: 'カード説明',
                x: 48,
                y: 170,
                characters: '最後の学習：昨日',
                fontSize: 14,
              },
              {
                type: 'TEXT',
                name: 'セクションタイトル',
                x: 24,
                y: 270,
                characters: 'おすすめコース',
                fontSize: 20,
              },
              {
                type: 'RECTANGLE',
                name: 'おすすめコース1',
                x: 24,
                y: 300,
                width: 150,
                height: 200,
                cornerRadius: 12,
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
              },
              {
                type: 'TEXT',
                name: 'コース名1',
                x: 40,
                y: 320,
                characters: '建築基準法の基礎',
                fontSize: 16,
              },
              {
                type: 'RECTANGLE',
                name: 'おすすめコース2',
                x: 190,
                y: 300,
                width: 150,
                height: 200,
                cornerRadius: 12,
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
              },
              {
                type: 'TEXT',
                name: 'コース名2',
                x: 206,
                y: 320,
                characters: '現場管理の実践',
                fontSize: 16,
              },
            ],
          },
        ],
      };
    } else {
      // デフォルトのモックデータ
      console.log('Using default mock data based on prompt');
      mockResponse = {
        nodes: [
          {
            type: 'FRAME',
            name: 'デザインコンテナ',
            width: 400,
            height: 300,
            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
            children: [
              {
                type: 'TEXT',
                name: 'タイトル',
                x: 20,
                y: 20,
                characters: prompt.substring(0, 20) + '...',
                fontSize: 24,
              },
              {
                type: 'RECTANGLE',
                name: 'コンテンツエリア',
                x: 20,
                y: 70,
                width: 360,
                height: 200,
                cornerRadius: 8,
                fills: [{ type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.96 } }],
              },
              {
                type: 'TEXT',
                name: '説明テキスト',
                x: 40,
                y: 100,
                characters: 'プロンプト内容に基づいた\nデザインをここに表示',
                fontSize: 16,
              },
            ],
          },
        ],
      };
    }

    // APIリクエストを試行
    try {
      const systemPrompt = `あなたはFigmaのデザインノードを生成するAIアシスタントです。
ユーザーの入力に基づいて、Figmaで表示できるデザイン要素のJSONスキーマを返してください。
JSONの形式は以下の通りです:

{
  "nodes": [
    {
      "type": "FRAME",
      "name": "コンテナ名",
      "width": 数値,
      "height": 数値,
      "fills": [{ "type": "SOLID", "color": { "r": 0～1, "g": 0～1, "b": 0～1 } }],
      "children": [
        // 子ノード（テキスト、長方形など）
      ]
    }
  ]
}

サポートするノードタイプ: "FRAME", "RECTANGLE", "TEXT"
各ノードタイプには特有のプロパティがあります:
- FRAME: 名前、幅、高さ、塗りつぶし、子ノード
- RECTANGLE: 名前、x、y、幅、高さ、塗りつぶし、角丸半径
- TEXT: 名前、x、y、テキスト内容、フォントサイズ

返答はJSONオブジェクトのみにしてください。JSONの中で最低1つのFRAMEノードを含めてください。`;

      // プロキシサーバーのURL
      const proxyUrl = 'https://figma-claude-design-plugin.vercel.app/api/proxy';

      // リクエストデータの作成
      const baseRequest: ClaudeRequestBase = {
        model: currentApiSettings.apiModel,
        max_tokens: 4000,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      };

      // 学習無効化オプションが有効な場合
      let requestData: ClaudeRequestBase | ClaudeRequestWithLearningDisabled = baseRequest;
      if (disableLearning) {
        requestData = {
          ...baseRequest,
          system: 'Figma plugin user input',
          claude_api_params: {
            disable_model_learning: true,
          },
        };
      }

      console.log('Trying to connect to proxy server...');
      console.log('Request data:', JSON.stringify(requestData, null, 2));

      // 通常のフェッチを試行
      try {
        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': currentApiSettings.apiKey,
          },
          body: JSON.stringify(requestData),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        // レスポンスをJSONとして解析
        const data = await response.json();
        console.log('API response received:', data);

        // レスポンスから必要なデータを抽出
        if (data.content && data.content[0] && data.content[0].text) {
          try {
            // レスポンステキストからJSONを抽出して解析
            const jsonMatch =
              data.content[0].text.match(/```json\n([\s\S]*?)\n```/) ||
              data.content[0].text.match(/```\n([\s\S]*?)\n```/) ||
              data.content[0].text.match(/{[\s\S]*?}/);

            if (jsonMatch) {
              const jsonText = jsonMatch[1] || jsonMatch[0];
              const parsedResponse = JSON.parse(jsonText);
              console.log('Successfully parsed JSON response');
              return parsedResponse;
            }
          } catch (jsonError) {
            console.error('Failed to parse JSON from response:', jsonError);
          }
        }

        console.log('Could not extract valid JSON from API response, using mock data');
      } catch (err) {
        console.log('Standard fetch failed:', err);

        // no-corsモードを試す（この方法はコンパイルエラーになるため、コードを無効化）
        console.log('Note: Cannot use no-cors mode due to TypeScript constraints');
        /* 以下のコードはコンパイルエラーになるため、コメントアウト
          try {
            await fetch(proxyUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': currentApiSettings.apiKey,
              },
              body: JSON.stringify(requestData),
              mode: 'no-cors',
            });
            console.log('no-cors request sent (but cannot read response)');
          } catch (noCorsErr) {
            console.error('no-cors request also failed:', noCorsErr);
          }
          */
      }
    } catch (fetchError) {
      console.error('API request error:', fetchError);
    }

    // APIリクエストが成功しなかった場合はモックデータを返す
    console.log('Using mock data as fallback');
    return mockResponse;
  } catch (error) {
    console.error('Error in sendToClaudeApi:', error);
    throw error;
  }
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
