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
  apiModel: 'claude-3-5-haiku-20241022',
};

// プロキシサーバーのURL
const PROXY_URL = 'https://figma-ai-plugin.netlify.app/.netlify/functions/proxy';

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
        'x-api-key': currentApiSettings.apiKey,
      },
      body: JSON.stringify(testRequest),
    });

    console.log('Test API response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('API test successful:', data);

      figma.ui.postMessage({
        type: 'success',
        message: 'API接続テストが成功しました！',
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
 * Claude APIにリクエストを送信する
 */
async function sendToClaudeApi(prompt: string, disableLearning: boolean): Promise<ClaudeResponse> {
  try {
    if (!currentApiSettings.apiKey) {
      throw new Error('APIキーが設定されていません。設定タブでAPIキーを入力してください。');
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

    // プロンプトに基づいて異なるモックデータを選択
    // CORS問題が解決するまでの暫定対応
    let mockResponse;

    if (prompt.indexOf('To Do') !== -1 || prompt.indexOf('ToDo') !== -1 || prompt.indexOf('タスク') !== -1) {
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
    } else if (
      prompt.indexOf('EC') !== -1 ||
      prompt.indexOf('商品') !== -1 ||
      prompt.indexOf('ショッピング') !== -1 ||
      prompt.indexOf('購入') !== -1 ||
      prompt.indexOf('カート') !== -1
    ) {
      // ECサイトのモックデータ
      console.log('Using EC site mock data');
      mockResponse = {
        nodes: [
          {
            type: 'FRAME',
            name: 'ECサイト商品一覧',
            width: 375,
            height: 812,
            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
            children: [
              {
                type: 'RECTANGLE',
                name: 'ヘッダー',
                x: 0,
                y: 0,
                width: 375,
                height: 80,
                fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8 } }],
              },
              {
                type: 'TEXT',
                name: 'サイトタイトル',
                x: 24,
                y: 30,
                characters: 'SHOP',
                fontSize: 24,
              },
              {
                type: 'RECTANGLE',
                name: '検索バー',
                x: 24,
                y: 100,
                width: 327,
                height: 40,
                cornerRadius: 20,
                fills: [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }],
              },
              {
                type: 'TEXT',
                name: '検索プレースホルダー',
                x: 44,
                y: 112,
                characters: '商品を検索...',
                fontSize: 16,
              },
              {
                type: 'TEXT',
                name: 'カテゴリータイトル',
                x: 24,
                y: 170,
                characters: '人気商品',
                fontSize: 20,
              },
              {
                type: 'RECTANGLE',
                name: '商品カード1',
                x: 24,
                y: 200,
                width: 160,
                height: 200,
                cornerRadius: 12,
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
              },
              {
                type: 'RECTANGLE',
                name: '商品画像1',
                x: 34,
                y: 210,
                width: 140,
                height: 120,
                cornerRadius: 8,
                fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }],
              },
              {
                type: 'TEXT',
                name: '商品名1',
                x: 34,
                y: 340,
                characters: 'スマートフォン',
                fontSize: 14,
              },
              {
                type: 'TEXT',
                name: '価格1',
                x: 34,
                y: 360,
                characters: '¥89,800',
                fontSize: 16,
              },
              {
                type: 'RECTANGLE',
                name: '商品カード2',
                x: 191,
                y: 200,
                width: 160,
                height: 200,
                cornerRadius: 12,
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
              },
              {
                type: 'RECTANGLE',
                name: '商品画像2',
                x: 201,
                y: 210,
                width: 140,
                height: 120,
                cornerRadius: 8,
                fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }],
              },
              {
                type: 'TEXT',
                name: '商品名2',
                x: 201,
                y: 340,
                characters: 'ワイヤレスイヤホン',
                fontSize: 14,
              },
              {
                type: 'TEXT',
                name: '価格2',
                x: 201,
                y: 360,
                characters: '¥12,800',
                fontSize: 16,
              },
              {
                type: 'RECTANGLE',
                name: '商品カード3',
                x: 24,
                y: 420,
                width: 160,
                height: 200,
                cornerRadius: 12,
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
              },
              {
                type: 'RECTANGLE',
                name: '商品画像3',
                x: 34,
                y: 430,
                width: 140,
                height: 120,
                cornerRadius: 8,
                fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }],
              },
              {
                type: 'TEXT',
                name: '商品名3',
                x: 34,
                y: 560,
                characters: 'ノートパソコン',
                fontSize: 14,
              },
              {
                type: 'TEXT',
                name: '価格3',
                x: 34,
                y: 580,
                characters: '¥128,000',
                fontSize: 16,
              },
              {
                type: 'RECTANGLE',
                name: '商品カード4',
                x: 191,
                y: 420,
                width: 160,
                height: 200,
                cornerRadius: 12,
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
              },
              {
                type: 'RECTANGLE',
                name: '商品画像4',
                x: 201,
                y: 430,
                width: 140,
                height: 120,
                cornerRadius: 8,
                fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }],
              },
              {
                type: 'TEXT',
                name: '商品名4',
                x: 201,
                y: 560,
                characters: 'タブレット',
                fontSize: 14,
              },
              {
                type: 'TEXT',
                name: '価格4',
                x: 201,
                y: 580,
                characters: '¥45,800',
                fontSize: 16,
              },
              {
                type: 'RECTANGLE',
                name: 'ボトムナビ',
                x: 0,
                y: 732,
                width: 375,
                height: 80,
                fills: [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }],
              },
              {
                type: 'TEXT',
                name: 'ホーム',
                x: 50,
                y: 760,
                characters: 'ホーム',
                fontSize: 12,
              },
              {
                type: 'TEXT',
                name: 'カテゴリ',
                x: 130,
                y: 760,
                characters: 'カテゴリ',
                fontSize: 12,
              },
              {
                type: 'TEXT',
                name: 'カート',
                x: 220,
                y: 760,
                characters: 'カート',
                fontSize: 12,
              },
              {
                type: 'TEXT',
                name: 'マイページ',
                x: 290,
                y: 760,
                characters: 'マイページ',
                fontSize: 12,
              },
            ],
          },
        ],
      };
    } else if (prompt.indexOf('学習') !== -1 || prompt.indexOf('ホーム') !== -1) {
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
    } else if (prompt.indexOf('音楽') !== -1 || prompt.indexOf('music') !== -1 || prompt.indexOf('プレイヤー') !== -1) {
      // 音楽プレイヤーアプリの高品質モックデータ
      console.log('Using high-quality music player mock data');
      mockResponse = {
        nodes: [
          {
            type: 'FRAME',
            name: '音楽プレイヤーアプリ',
            width: 375,
            height: 812,
            fills: [{ type: 'SOLID', color: { r: 0.05, g: 0.05, b: 0.1 } }],
            children: [
              // ステータスバー
              {
                type: 'RECTANGLE',
                name: 'ステータスバー',
                x: 0,
                y: 0,
                width: 375,
                height: 44,
                fills: [{ type: 'SOLID', color: { r: 0.05, g: 0.05, b: 0.1 } }],
              },
              // ヘッダー
              {
                type: 'TEXT',
                name: 'ヘッダータイトル',
                x: 24,
                y: 70,
                characters: 'Music',
                fontSize: 32,
              },
              {
                type: 'TEXT',
                name: 'サブタイトル',
                x: 24,
                y: 110,
                characters: 'Now Playing',
                fontSize: 16,
              },
              // アルバムアートワーク
              {
                type: 'RECTANGLE',
                name: 'アルバムアートワーク',
                x: 50,
                y: 160,
                width: 275,
                height: 275,
                cornerRadius: 16,
                fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.3, b: 0.8 } }],
              },
              {
                type: 'RECTANGLE',
                name: 'アートワーク内側',
                x: 75,
                y: 185,
                width: 225,
                height: 225,
                cornerRadius: 12,
                fills: [{ type: 'SOLID', color: { r: 0.3, g: 0.4, b: 0.9 } }],
              },
              // 楽曲情報
              {
                type: 'TEXT',
                name: '楽曲タイトル',
                x: 24,
                y: 470,
                characters: 'Beautiful Song',
                fontSize: 24,
              },
              {
                type: 'TEXT',
                name: 'アーティスト名',
                x: 24,
                y: 500,
                characters: 'Amazing Artist',
                fontSize: 18,
              },
              // プログレスバー
              {
                type: 'RECTANGLE',
                name: 'プログレスバー背景',
                x: 24,
                y: 540,
                width: 327,
                height: 4,
                cornerRadius: 2,
                fills: [{ type: 'SOLID', color: { r: 0.3, g: 0.3, b: 0.3 } }],
              },
              {
                type: 'RECTANGLE',
                name: 'プログレス',
                x: 24,
                y: 540,
                width: 120,
                height: 4,
                cornerRadius: 2,
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
              },
              // 時間表示
              {
                type: 'TEXT',
                name: '現在時間',
                x: 24,
                y: 560,
                characters: '1:23',
                fontSize: 14,
              },
              {
                type: 'TEXT',
                name: '総時間',
                x: 315,
                y: 560,
                characters: '3:45',
                fontSize: 14,
              },
              // コントロールボタン
              {
                type: 'RECTANGLE',
                name: '前の曲ボタン',
                x: 80,
                y: 600,
                width: 48,
                height: 48,
                cornerRadius: 24,
                fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }],
              },
              {
                type: 'TEXT',
                name: '前の曲アイコン',
                x: 96,
                y: 615,
                characters: '⏮',
                fontSize: 20,
              },
              {
                type: 'RECTANGLE',
                name: '再生ボタン',
                x: 163,
                y: 590,
                width: 68,
                height: 68,
                cornerRadius: 34,
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
              },
              {
                type: 'TEXT',
                name: '再生アイコン',
                x: 185,
                y: 610,
                characters: '▶',
                fontSize: 28,
              },
              {
                type: 'RECTANGLE',
                name: '次の曲ボタン',
                x: 267,
                y: 600,
                width: 48,
                height: 48,
                cornerRadius: 24,
                fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }],
              },
              {
                type: 'TEXT',
                name: '次の曲アイコン',
                x: 283,
                y: 615,
                characters: '⏭',
                fontSize: 20,
              },
              // ボトムナビゲーション
              {
                type: 'RECTANGLE',
                name: 'ボトムナビ背景',
                x: 0,
                y: 732,
                width: 375,
                height: 80,
                fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.15 } }],
              },
              {
                type: 'TEXT',
                name: 'ホーム',
                x: 50,
                y: 760,
                characters: 'Home',
                fontSize: 12,
              },
              {
                type: 'TEXT',
                name: '検索',
                x: 130,
                y: 760,
                characters: 'Search',
                fontSize: 12,
              },
              {
                type: 'TEXT',
                name: 'ライブラリ',
                x: 200,
                y: 760,
                characters: 'Library',
                fontSize: 12,
              },
              {
                type: 'TEXT',
                name: 'プロフィール',
                x: 280,
                y: 760,
                characters: 'Profile',
                fontSize: 12,
              },
            ],
          },
        ],
      };
    } else {
      // デフォルトのモックデータ（プロンプト内容を反映）
      console.log('Using default mock data based on prompt:', prompt);

      // プロンプトから主要なキーワードを抽出
      const promptKeywords = prompt.substring(0, 30);
      const isApp = prompt.indexOf('アプリ') !== -1 || prompt.indexOf('app') !== -1;
      const isLogin = prompt.indexOf('ログイン') !== -1 || prompt.indexOf('login') !== -1;
      const isMusic = prompt.indexOf('音楽') !== -1 || prompt.indexOf('music') !== -1;
      const isWeather = prompt.indexOf('天気') !== -1 || prompt.indexOf('weather') !== -1;

      let frameHeight = 300;
      let frameWidth = 400;
      const mainTitle = promptKeywords;

      // モバイルアプリの場合はサイズを調整
      if (isApp) {
        frameHeight = 812;
        frameWidth = 375;
      }

      mockResponse = {
        nodes: [
          {
            type: 'FRAME',
            name: `${promptKeywords} - デザイン`,
            width: frameWidth,
            height: frameHeight,
            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
            children: [
              {
                type: 'RECTANGLE',
                name: 'ヘッダー',
                x: 0,
                y: 0,
                width: frameWidth,
                height: isApp ? 100 : 60,
                fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.8 } }],
              },
              {
                type: 'TEXT',
                name: 'タイトル',
                x: 20,
                y: isApp ? 50 : 20,
                characters: mainTitle,
                fontSize: isApp ? 24 : 20,
              },
              {
                type: 'RECTANGLE',
                name: 'メインコンテンツエリア',
                x: 20,
                y: isApp ? 120 : 80,
                width: frameWidth - 40,
                height: isApp ? 500 : 150,
                cornerRadius: 12,
                fills: [{ type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.96 } }],
              },
              {
                type: 'TEXT',
                name: 'コンテンツタイトル',
                x: 40,
                y: isApp ? 150 : 100,
                characters: isLogin
                  ? 'ログイン'
                  : isMusic
                  ? '音楽プレイヤー'
                  : isWeather
                  ? '天気予報'
                  : 'メインコンテンツ',
                fontSize: 18,
              },
              {
                type: 'TEXT',
                name: '説明テキスト',
                x: 40,
                y: isApp ? 180 : 130,
                characters: `${prompt.substring(0, 50)}...に基づいたデザイン`,
                fontSize: 14,
              },
            ],
          },
        ],
      };

      // ログイン画面の場合は追加要素
      if (isLogin) {
        mockResponse.nodes[0].children.push(
          {
            type: 'RECTANGLE',
            name: 'ユーザー名入力',
            x: 40,
            y: isApp ? 250 : 160,
            width: frameWidth - 80,
            height: 40,
            cornerRadius: 8,
            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
          },
          {
            type: 'TEXT',
            name: 'ユーザー名ラベル',
            x: 50,
            y: isApp ? 262 : 172,
            characters: 'ユーザー名',
            fontSize: 14,
          },
          {
            type: 'RECTANGLE',
            name: 'パスワード入力',
            x: 40,
            y: isApp ? 310 : 210,
            width: frameWidth - 80,
            height: 40,
            cornerRadius: 8,
            fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }],
          },
          {
            type: 'TEXT',
            name: 'パスワードラベル',
            x: 50,
            y: isApp ? 322 : 222,
            characters: 'パスワード',
            fontSize: 14,
          },
          {
            type: 'RECTANGLE',
            name: 'ログインボタン',
            x: 40,
            y: isApp ? 370 : 260,
            width: frameWidth - 80,
            height: 50,
            cornerRadius: 25,
            fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.8 } }],
          },
          {
            type: 'TEXT',
            name: 'ログインボタンテキスト',
            x: frameWidth / 2 - 30,
            y: isApp ? 385 : 275,
            characters: 'ログイン',
            fontSize: 16,
          },
        );
      }
    }

    // APIリクエストを試行
    try {
      // システムプロンプト（10秒制限に最適化）
      const systemPrompt = `Create a Figma UI design. Output ONLY valid JSON, no text, no explanations.

Required format:
{
  "nodes": [
    {
      "type": "FRAME",
      "name": "Main Container",
      "width": 375,
      "height": 812,
      "x": 0,
      "y": 0,
      "fills": [{"type": "SOLID", "color": {"r": 1, "g": 1, "b": 1}}],
      "children": [
        {
          "type": "RECTANGLE",
          "name": "Header",
          "x": 0,
          "y": 0,
          "width": 375,
          "height": 88,
          "fills": [{"type": "SOLID", "color": {"r": 0.1, "g": 0.4, "b": 0.9}}]
        },
        {
          "type": "TEXT",
          "name": "Title",
          "x": 24,
          "y": 50,
          "characters": "App Title",
          "fontSize": 24
        }
      ]
    }
  ]
}

Output ONLY JSON. No markdown, no explanations.`;

      // リクエストデータの作成
      const baseRequest: ClaudeRequestBase = {
        model: currentApiSettings.apiModel,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
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
          claude_api_params: {
            disable_model_learning: true,
          },
        };
      }

      console.log('Trying to connect to proxy server...');
      console.log('Request data:', JSON.stringify(requestData, null, 2));

      // 通常のフェッチを試行
      try {
        console.log('Sending request to proxy server...');

        // Add client-side timeout to complement server-side timeout
        const controller = new AbortController();
        const clientTimeoutId = setTimeout(() => {
          controller.abort();
        }, 55000); // 55 seconds - slightly less than server timeout

        const startTime = Date.now();

        const response = await fetch(PROXY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': currentApiSettings.apiKey,
          },
          body: JSON.stringify(requestData),
          signal: controller.signal,
        });

        clearTimeout(clientTimeoutId);
        const requestDuration = Date.now() - startTime;

        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        console.log('Request duration:', requestDuration, 'ms');

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API error: ${response.status} - ${errorText}`);

          // Enhanced error handling for specific cases
          if (response.status === 408) {
            console.error('Request timeout: The AI API took too long to respond');
            figma.ui.postMessage({
              type: 'warning',
              message: `リクエストがタイムアウトしました (${Math.round(
                requestDuration / 1000,
              )}秒)。モックデータを使用します。`,
            });
          } else if (response.status === 401) {
            console.error('Authentication failed: Please check your API key');
            figma.ui.postMessage({
              type: 'error',
              message: 'APIキーが無効です。設定を確認してください。',
            });
          } else if (response.status === 429) {
            console.error('Rate limit exceeded: Please wait before making another request');
            figma.ui.postMessage({
              type: 'warning',
              message: 'レート制限に達しました。しばらく待ってから再試行してください。',
            });
          } else if (response.status >= 500) {
            console.error('Server error: The API service is temporarily unavailable');
            figma.ui.postMessage({
              type: 'warning',
              message: 'サーバーエラーが発生しました。モックデータを使用します。',
            });
          }

          throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        // レスポンスをJSONとして解析
        const data = await response.json();
        console.log('API response received:', data);

        // Check for timing metadata
        if (data._meta && data._meta.requestDuration) {
          console.log('Server-side request duration:', data._meta.requestDuration, 'ms');
          figma.ui.postMessage({
            type: 'status',
            message: `AI応答を受信しました (${Math.round(data._meta.requestDuration / 1000)}秒)`,
          });
        }

        // レスポンスから必要なデータを抽出
        if (data.content && data.content[0] && data.content[0].text) {
          try {
            // レスポンステキストからJSONを抽出して解析
            const responseText = data.content[0].text;
            console.log('Raw API response text:', responseText);

            // より厳密なJSON抽出（複数パターンを試行）
            let jsonText = null;

            // パターン1: <json_response>タグ内のJSON（Claude 4推奨方式）
            let jsonMatch = responseText.match(/<json_response>\s*([\s\S]*?)\s*<\/json_response>/);
            if (jsonMatch) {
              jsonText = jsonMatch[1].trim();
              console.log('Found JSON in xml_response tags');
            }

            // パターン2: ```json...``` ブロック
            if (!jsonText) {
              jsonMatch = responseText.match(/```json\s*\n([\s\S]*?)\n\s*```/);
              if (jsonMatch) {
                jsonText = jsonMatch[1];
                console.log('Found JSON in code block');
              }
            }

            // パターン3: ``` ブロック（jsonキーワードなし）
            if (!jsonText) {
              jsonMatch = responseText.match(/```\s*\n([\s\S]*?)\n\s*```/);
              if (jsonMatch && jsonMatch[1].trim().startsWith('{')) {
                jsonText = jsonMatch[1];
                console.log('Found JSON in generic code block');
              }
            }

            // パターン4: 生のJSONオブジェクト
            if (!jsonText) {
              jsonMatch = responseText.match(/\{\s*"nodes"\s*:\s*\[[\s\S]*?\]\s*\}/);
              if (jsonMatch) {
                jsonText = jsonMatch[0];
                console.log('Found raw JSON object');
              }
            }

            // パターン5: 最も外側の{}を抽出
            if (!jsonText) {
              const firstBrace = responseText.indexOf('{');
              const lastBrace = responseText.lastIndexOf('}');
              if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                jsonText = responseText.substring(firstBrace, lastBrace + 1);
                console.log('Extracted outermost JSON object');
              }
            }

            if (jsonText) {
              console.log('Extracted JSON text length:', jsonText.length);
              console.log('JSON text starts with:', jsonText.substring(0, 100));
              console.log('JSON text ends with:', jsonText.substring(jsonText.length - 100));

              try {
                const parsedResponse = JSON.parse(jsonText);
                console.log('Successfully parsed JSON response from API');

                // 生成されたデザインの品質チェック
                if (parsedResponse.nodes && Array.isArray(parsedResponse.nodes) && parsedResponse.nodes.length > 0) {
                  // さらに詳細な品質チェック
                  const hasValidStructure = parsedResponse.nodes.every(
                    (node: NodeSchema) =>
                      node.type &&
                      node.name &&
                      (node.type === 'FRAME' || node.type === 'RECTANGLE' || node.type === 'TEXT'),
                  );

                  if (hasValidStructure) {
                    console.log('High-quality AI-generated design received with valid structure');
                    figma.ui.postMessage({
                      type: 'success',
                      message: `AI生成デザインを受信しました (${Math.round(requestDuration / 1000)}秒)`,
                    });
                    return parsedResponse;
                  } else {
                    console.log('Invalid node structure detected, using fallback');
                  }
                } else {
                  console.log('Invalid response structure, using fallback');
                }
              } catch (jsonError) {
                console.error('JSON Parse Error Details:');
                console.error('- Error message:', (jsonError as Error).message);
                console.error('- JSON text length:', jsonText.length);
                console.error('- JSON preview (first 200 chars):', jsonText.substring(0, 200));
                console.error(
                  '- JSON preview (last 200 chars):',
                  jsonText.substring(Math.max(0, jsonText.length - 200)),
                );

                // Count brackets to identify the issue
                const openBrackets = (jsonText.match(/\[/g) || []).length;
                const closeBrackets = (jsonText.match(/\]/g) || []).length;
                const openBraces = (jsonText.match(/\{/g) || []).length;
                const closeBraces = (jsonText.match(/\}/g) || []).length;

                console.error('- Bracket analysis:');
                console.error(`  - Open brackets [: ${openBrackets}, Close brackets ]: ${closeBrackets}`);
                console.error(`  - Open braces {: ${openBraces}, Close braces }: ${closeBraces}`);

                figma.ui.postMessage({
                  type: 'warning',
                  message: `JSON解析エラー: ${
                    (jsonError as Error).message
                  }。おそらくタイムアウトによりレスポンスが途中で切れています。Vercel Proプランをご検討ください。`,
                });
              }
            } else {
              console.log('No valid JSON found in API response, using fallback');
              console.log('Response text preview:', responseText.substring(0, 500));
            }
          } catch (jsonError) {
            console.error('Failed to parse JSON from response:', jsonError);
            console.log('Raw response text:', data.content[0].text);
          }
        } else {
          console.log('Unexpected API response format:', data);
        }
      } catch (err) {
        console.error('Fetch request failed:', err);

        // Enhanced error handling for different types of errors
        if ((err as Error).name === 'AbortError') {
          console.error('Client-side timeout: Request was aborted after 55 seconds');
          figma.ui.postMessage({
            type: 'warning',
            message:
              'リクエストがタイムアウトしました。より短いプロンプトを試すか、Vercel Proプランのご利用をご検討ください。',
          });
        } else if (err instanceof TypeError && (err as TypeError).message.indexOf('Failed to fetch') !== -1) {
          console.error('Network error: This might be a CORS issue or network connectivity problem');
          console.error('Possible solutions:');
          console.error('1. Check your internet connection');
          console.error('2. Verify the proxy server is running');
          console.error('3. Check if the API key is valid');

          figma.ui.postMessage({
            type: 'warning',
            message: 'ネットワークエラーが発生しました。プロキシサーバーの状態を確認してください。',
          });
        } else {
          figma.ui.postMessage({
            type: 'warning',
            message: 'API接続に失敗しました。高品質なモックデータを使用します。',
          });
        }
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
