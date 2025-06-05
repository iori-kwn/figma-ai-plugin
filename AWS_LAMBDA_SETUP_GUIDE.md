# Figma プラグイン用 AWS Lambda セットアップガイド

このガイドでは、Figma プラグインで使用するプロキシサーバーを Vercel から AWS Lambda に移行する手順を詳しく説明します。非エンジニアの方でも同じ設定を再現できるよう、ステップバイステップで解説します。

## 前提条件

- AWS アカウントを持っている
- 社内エンジニアから AWS Lambda にアクセスする許可を得ている
- Claude API キーを持っている（Anthropic から取得）

## 目次

1. [AWS Lambda 関数の作成](#1-aws-lambda-関数の作成)
2. [基本設定の変更](#2-基本設定の変更)
3. [環境変数の設定](#3-環境変数の設定)
4. [プロキシコードのアップロード](#4-プロキシコードのアップロード)
5. [関数のテスト](#5-関数のテスト)
6. [Figma プラグインの設定更新](#6-figma-プラグインの設定更新)
7. [トラブルシューティング](#7-トラブルシューティング)

---

## 1. AWS Lambda 関数の作成

### 1.1 AWS コンソールにアクセス

1. AWS コンソールにログインします
2. **リージョンを「東京 (ap-northeast-1)」に変更**してください
   - 右上のリージョン選択メニューから「東京」を選択
   - 日本のユーザーに最適なパフォーマンスを提供するため

### 1.2 Lambda サービスにアクセス

1. AWS コンソールの検索バーで「Lambda」と入力
2. 「Lambda」サービスをクリック
3. 「関数の作成」ボタンをクリック

### 1.3 基本的な情報の設定

**関数作成画面で以下を設定します：**

#### ✅ 一から作成（選択済み）

- デフォルトで選択されているのでそのまま

#### ✅ 基本的な情報

- **関数名**: `figma-claude-proxy`
  - または `figma-plugin-claude-api-proxy` でも可
- **ランタイム**: `Node.js 22.x`（デフォルトのまま）
- **アーキテクチャ**: `x86_64`（デフォルトのまま）

#### ✅ アクセス権限

- **実行ロール**: `基本的な Lambda アクセス権限で新しいロールを作成`（デフォルトのまま）

### 1.4 その他の構成

**重要：この設定を忘れずに行ってください**

#### ✅ 関数 URL を有効化

1. **「関数 URL を有効化」にチェックを入れる**
2. **認証タイプ**: `NONE` を選択
3. **オリジン間リソース共有 (CORS) を設定**: **チェックを入れる**

#### ⛔ その他の項目（チェック不要）

- コード署名を有効化: チェック不要
- AWS KMS カスタマーマネージドキーによる暗号化を有効にする: チェック不要
- タグを有効化: チェック不要
- VPC を有効化: チェック不要

### 1.5 関数の作成

**「関数の作成」ボタンをクリック**

作成が完了すると、緑色の成功メッセージが表示されます。

---

## 2. 基本設定の変更

### 2.1 設定タブに移動

1. 関数が作成されたら、画面上部の **「設定」タブ** をクリック
2. 左側のメニューから **「一般設定」** をクリック

### 2.2 タイムアウトとメモリの変更

1. **「編集」ボタン** をクリック
2. 以下の設定を変更：

#### ✅ メモリ

- **現在**: 128 MB
- **変更後**: `512` MB に変更
  - Claude API への HTTP リクエスト処理のため

#### ✅ タイムアウト

- **現在**: 0 分 3 秒
- **変更後**: `1分0秒` に変更
  - Claude API の応答待機時間を確保するため

3. **「保存」ボタン** をクリック

---

## 3. 環境変数の設定

### 3.1 環境変数の追加

1. 設定タブの左側メニューから **「環境変数」** をクリック
2. **「編集」ボタン** をクリック
3. **「環境変数を追加」** をクリック

### 3.2 API キーの設定

#### ✅ 環境変数の追加

- **キー**: `ANTHROPIC_API_KEY`
- **値**: あなたの Claude API キー（sk-ant-で始まる文字列）

**⚠️ 重要**: API キーは機密情報です。他の人と共有しないでください。

4. **「保存」ボタン** をクリック

---

## 4. プロキシコードのアップロード

### 4.1 コードタブに移動

1. 画面上部の **「コード」タブ** をクリック
2. ファイルエクスプローラーで **`index.mjs`** をクリック

### 4.2 既存コードの削除

1. エディター内の **すべてのコードを選択**（Ctrl+A または Cmd+A）
2. **削除**

### 4.3 新しいコードの貼り付け

以下のコードを **すべてコピーして貼り付け** してください：

```javascript
// AWS Lambda function to proxy requests to Claude API
export const handler = async (event, context) => {
  console.log('Lambda event:', JSON.stringify(event, null, 2));

  const startTime = Date.now();

  // Extract HTTP method and headers from the Lambda event
  const method = event.requestContext?.http?.method || event.httpMethod;
  const headers = event.headers || {};
  const body = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body) : null;

  // Helper function to create Lambda response
  const createResponse = (statusCode, responseBody, additionalHeaders = {}) => {
    return {
      statusCode,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization, anthropic-version, X-Requested-With',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false',
        'Content-Type': 'application/json',
        ...additionalHeaders,
      },
      body: typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody),
    };
  };

  // Handle OPTIONS request (preflight)
  if (method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    return createResponse(200, '');
  }

  // Handle GET request for testing
  if (method === 'GET') {
    console.log('Handling GET request for proxy status check');
    return createResponse(200, {
      status: 'Lambda proxy server is running',
      timestamp: new Date().toISOString(),
      message: 'Use POST method to send requests to Claude API',
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
      maxDuration: '60 seconds',
      environment: process.env.AWS_EXECUTION_ENV || 'lambda',
    });
  }

  // Only allow POST requests for API calls
  if (method !== 'POST') {
    console.log(`Method ${method} not allowed`);
    return createResponse(405, {
      error: 'Method not allowed. Use POST for API calls or GET for status check.',
    });
  }

  try {
    console.log('Processing POST request to Claude API at', new Date().toISOString());
    console.log('Request headers:', JSON.stringify(headers, null, 2));

    // Parse request body
    let requestBody;
    try {
      requestBody = body ? JSON.parse(body) : {};
    } catch (parseError) {
      console.log('Failed to parse request body:', parseError);
      return createResponse(400, {
        error: 'Invalid JSON in request body',
        details: parseError.message,
      });
    }

    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    // Get the API key from environment variables (preferred) or request headers (fallback)
    const apiKey = process.env.ANTHROPIC_API_KEY || headers['x-api-key'];

    if (!apiKey) {
      console.log('No API key found in environment variables or request headers');
      return createResponse(400, {
        error: 'API key is required. Please set ANTHROPIC_API_KEY environment variable or provide x-api-key header.',
        hasEnvKey: !!process.env.ANTHROPIC_API_KEY,
        hasHeaderKey: !!headers['x-api-key'],
      });
    }

    console.log('API key found, making request to Claude API...');
    console.log('Using environment API key:', !!process.env.ANTHROPIC_API_KEY);

    // Validate request body
    console.log('Received request body:', JSON.stringify(requestBody, null, 2));
    console.log('Body keys:', Object.keys(requestBody || {}));
    console.log('Model:', requestBody?.model);
    console.log('Messages:', requestBody?.messages);

    if (!requestBody || !requestBody.model || !requestBody.messages) {
      console.log('Invalid request body validation failed:');
      console.log('- Has body:', !!requestBody);
      console.log('- Has model:', !!(requestBody && requestBody.model));
      console.log('- Has messages:', !!(requestBody && requestBody.messages));
      return createResponse(400, {
        error: 'Invalid request body. Required fields: model, messages',
        receivedBody: requestBody,
        validation: {
          hasBody: !!requestBody,
          hasModel: !!(requestBody && requestBody.model),
          hasMessages: !!(requestBody && requestBody.messages),
        },
      });
    }

    // Optimize Claude request - ensure max_tokens is reasonable for time constraints
    const maxTokens = Math.min(requestBody.max_tokens || 1000, 1500); // Cap at 1500 for better performance

    // Forward the request to Claude API
    const claudeRequest = {
      model: requestBody.model,
      max_tokens: maxTokens,
      system: requestBody.system,
      messages: requestBody.messages,
      // Add stream parameter if supported to get faster initial response
      stream: false,
    };

    console.log('Sending to Claude API:', JSON.stringify(claudeRequest, null, 2));
    console.log('Request start time:', startTime, 'ms since epoch');

    // Set a reasonable timeout for the Claude API request (50 seconds to leave buffer)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50 second timeout

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

      clearTimeout(timeoutId); // Clear timeout if request completes

      const requestDuration = Date.now() - startTime;
      console.log(`Claude API responded with status: ${response.status} in ${requestDuration}ms`);

      // Get the response data
      const data = await response.json();
      console.log('Claude API response received, size:', JSON.stringify(data).length, 'characters');

      if (!response.ok) {
        console.log('Claude API error:', data);
        return createResponse(response.status, {
          error: 'Claude API error',
          claudeError: data,
          status: response.status,
          requestDuration: requestDuration,
        });
      }

      console.log('Successfully received response from Claude API');
      console.log('Total request duration:', requestDuration, 'ms');

      // Return the data with CORS headers and timing info
      return createResponse(200, {
        ...data,
        _meta: {
          requestDuration: requestDuration,
          timestamp: new Date().toISOString(),
          maxTokensUsed: maxTokens,
        },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        console.error('Request timed out after 50 seconds');
        return createResponse(408, {
          error: 'Request timeout',
          message: 'Claude API request took longer than 50 seconds',
          requestDuration: Date.now() - startTime,
        });
      }

      throw fetchError; // Re-throw other fetch errors
    }
  } catch (error) {
    console.error('Error in Lambda handler:', error);
    const requestDuration = Date.now() - startTime;

    // Return error with CORS headers and timing info
    return createResponse(500, {
      error: 'An error occurred while processing your request',
      details: error.message,
      requestDuration: requestDuration,
      timestamp: new Date().toISOString(),
      // Don't include stack trace in production
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
    });
  }
};
```

### 4.4 コードのデプロイ

1. **「Deploy」ボタン** をクリック
2. 緑色の成功メッセージが表示されるまで待つ

---

## 5. 関数のテスト

### 5.1 テストの実行

1. **「Test」タブ** をクリック
2. **「Test」ボタン** をクリック
3. テストイベント作成画面が表示されます

### 5.2 テストイベントの設定

1. **Event Name**: `MyEventName`（デフォルトのまま）
2. **Template**: `Hello World`（デフォルトのまま）
3. **Event JSON**: デフォルトのまま
4. **「Save」ボタン** をクリック

### 5.3 テスト結果の確認

**✅ 成功例**:

```json
{
  "statusCode": 405,
  "body": {
    "error": "Method not allowed. Use POST for API calls or GET for status check."
  }
}
```

**この 405 エラーは正常です**。Lambda 関数が正しく動作している証拠です。

---

## 6. Figma プラグインの設定更新

### 6.1 関数 URL の確認

1. Lambda 関数の概要セクションで **関数 URL** をコピー
   - 例: `https://45eu4yy74z3uljhe74ogvda4bm0stwqt.lambda-url.ap-northeast-1.on.aws/`

### 6.2 プラグインコードの更新

#### 6.2.1 code.ts ファイルの更新

1. プロジェクトの `code.ts` ファイルを開く
2. 28 行目付近の `PROXY_URL` を変更：

**変更前**:

```typescript
const PROXY_URL = 'https://figma-plugin-yoriss67s-projects.vercel.app/api/proxy';
```

**変更後**:

```typescript
const PROXY_URL = 'https://45eu4yy74z3uljhe74ogvda4bm0stwqt.lambda-url.ap-northeast-1.on.aws/';
```

#### 6.2.2 manifest.json ファイルの更新

1. プロジェクトの `manifest.json` ファイルを開く
2. `allowedDomains` セクションを更新：

**変更前**:

```json
"allowedDomains": ["https://figma-plugin-yoriss67s-projects.vercel.app", "https://*.vercel.app"]
```

**変更後**:

```json
"allowedDomains": [
  "https://45eu4yy74z3uljhe74ogvda4bm0stwqt.lambda-url.ap-northeast-1.on.aws",
  "https://*.lambda-url.ap-northeast-1.on.aws",
  "https://figma-plugin-yoriss67s-projects.vercel.app",
  "https://*.vercel.app"
]
```

### 6.3 プラグインのビルド

1. ターミナルまたはコマンドプロンプトを開く
2. プロジェクトディレクトリに移動
3. 以下のコマンドを実行：

```bash
npm run build
```

4. エラーなく完了することを確認

---

## 7. トラブルシューティング

### 7.1 よくある問題

#### 問題: テスト時に「API key is required」エラー

**解決方法**:

- 環境変数 `ANTHROPIC_API_KEY` が正しく設定されているか確認
- API キーが `sk-ant-` で始まっているか確認

#### 問題: CORS エラーが発生

**解決方法**:

- 関数 URL 作成時に CORS を有効化したか確認
- `manifest.json` の `allowedDomains` に Lambda URL が追加されているか確認

#### 問題: タイムアウトエラー

**解決方法**:

- Lambda 関数のタイムアウトが 60 秒に設定されているか確認
- メモリが 512MB に設定されているか確認

### 7.2 設定確認チェックリスト

#### ✅ AWS Lambda 設定

- [ ] 関数名: `figma-claude-proxy`
- [ ] ランタイム: `Node.js 22.x`
- [ ] タイムアウト: 60 秒
- [ ] メモリ: 512MB
- [ ] 環境変数: `ANTHROPIC_API_KEY` が設定済み
- [ ] 関数 URL が有効化済み
- [ ] CORS が有効化済み

#### ✅ プラグインコード設定

- [ ] `code.ts` の `PROXY_URL` が更新済み
- [ ] `manifest.json` の `allowedDomains` が更新済み
- [ ] `npm run build` が成功

### 7.3 サポート

問題が解決しない場合は、社内のエンジニアに以下の情報を提供してください：

- Lambda 関数名
- エラーメッセージ
- 実行したステップ
- Lambda の CloudWatch ログ（可能な場合）

### 7.4 CORS エラーの対処法

#### 問題: CORS エラーが発生（「Access-Control-Allow-Origin header is present」エラー）

**症状**:

```
Access to fetch at 'https://xxx.lambda-url.ap-northeast-1.on.aws/' from origin 'null' has been blocked by CORS policy
```

**解決方法**:

1. **Lambda 関数 URL の CORS 設定を確認**:

   - 「設定」→「関数 URL」→「編集」
   - Allow origins: `*`
   - Allow headers: `content-type,x-amz-date,authorization,x-api-key,x-amz-security-token,anthropic-version,x-requested-with`
   - Allow methods: `GET,POST,OPTIONS,DELETE,PUT`

2. **Lambda 関数コードの CORS ヘッダーを確認**:

   - コード内で適切な CORS ヘッダーが設定されているか確認
   - OPTIONS リクエスト（プリフライト）が正しく処理されているか確認

3. **修正版コードの使用**:
   - CORS エラーが発生する場合は、強化された CORS 処理を含む修正版の Lambda コードを使用してください

---

## 完了確認

すべての設定が完了したら：

1. Figma でプラグインを再読み込み
2. Claude API キーを設定
3. テストプロンプトでデザイン生成を試行
4. 正常にデザインが生成されることを確認

**🎉 おめでとうございます！AWS Lambda への移行が完了しました！**

---

## 付録: 重要な URL とコマンド

### AWS Lambda 関数 URL

```
https://45eu4yy74z3uljhe74ogvda4bm0stwqt.lambda-url.ap-northeast-1.on.aws/
```

### ビルドコマンド

```bash
npm run build
```

### 設定ファイルの場所

- メインコード: `code.ts`
- 設定ファイル: `manifest.json`
- ビルド出力: `code.js`

---

**注意**: このガイドは特定のプロジェクト用に作成されています。他のプロジェクトで使用する場合は、関数名や URL を適切に変更してください。
