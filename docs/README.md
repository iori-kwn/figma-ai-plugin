# Figma + Claude AI デザインプラグイン

この Figma プラグインは、ユーザーの入力プロンプトに基づいて Claude を使用してデザイン要素を生成します。

## 主な機能

- プロンプトベースのデザイン生成: テキスト説明から自動的にデザイン要素を生成
- デザイン生成と設定の 2 つのタブインターフェース
- 複数の Claude モデルサポート（Claude 3.5 Sonnet, Claude 3.7 Sonnet, Claude 3 Opus, Claude 3 Sonnet）
- ユーザー指定の API キーを使用（開発者側のコスト負担なし）
- モデル学習からのユーザーデータ除外オプション

## セットアップ手順

### プロキシサーバーのデプロイ

Figma のセキュリティポリシーの制限のため、Claude API への直接アクセスはできません。そのため、プロキシサーバーを使用します。

1. Vercel アカウントを作成（まだない場合）: https://vercel.com
2. リポジトリを GitHub にプッシュする
3. Vercel ダッシュボードから新しいプロジェクトを作成し、このリポジトリを選択
4. デプロイ設定は自動検出されるはずです（vercel.json の設定により）
5. デプロイが完了したら、デプロイ URL をメモします（例: `https://your-proxy-server.vercel.app`）

### プラグインコードの更新

1. `code.ts`ファイル内のプロキシ URL を、デプロイした Vercel URL に更新します：

```typescript
const proxyUrl = 'https://your-proxy-server.vercel.app/api/proxy';
```

2. `manifest.json`の allowedDomains リストにプロキシサーバーの URL を追加します：

```json
"allowedDomains": [
  "https://api.anthropic.com",
  "https://*.anthropic.com",
  "https://your-proxy-server.vercel.app"
]
```

### プラグインのビルド

1. 必要な依存関係をインストールします：

```
npm install
```

2. プラグインをビルドします：

```
npm run build
```

## 使用方法

1. Figma でプラグインをインストールします
2. 設定タブに移動して、Claude API キーを入力します
3. デザイン生成タブで、生成したいデザインの説明を入力します
4. 「デザイン生成」ボタンをクリックすると、指定された説明に基づいてデザイン要素が生成されます

## 技術的注意事項

- プラグインは Figma Plugin API を使用して、テキスト、長方形、フレームなどのデザイン要素を生成します
- CORS の問題を解決するために、Vercel のサーバーレス関数をプロキシとして使用しています
- API キーはユーザーのローカルストレージ（clientStorage）に保存され、サーバーには送信されません

## トラブルシューティング

- **API エラー**: API キーが正しく設定されているか確認してください
- **プラグインが応答しない**: Figma を再起動するか、プラグインを再インストールしてみてください
- **デザインが正しく生成されない**: より詳細なプロンプトを使用してみてください

## ライセンス

[ライセンス情報をここに記載]

Below are the steps to get your plugin running. You can also find instructions at:

https://www.figma.com/plugin-docs/plugin-quickstart-guide/

This plugin template uses Typescript and NPM, two standard tools in creating JavaScript applications.

First, download Node.js which comes with NPM. This will allow you to install TypeScript and other
libraries. You can find the download link here:

https://nodejs.org/en/download/

Next, install TypeScript using the command:

npm install -g typescript

Finally, in the directory of your plugin, get the latest type definitions for the plugin API by running:

npm install --save-dev @figma/plugin-typings

If you are familiar with JavaScript, TypeScript will look very familiar. In fact, valid JavaScript code
is already valid Typescript code.

TypeScript adds type annotations to variables. This allows code editors such as Visual Studio Code
to provide information about the Figma API while you are writing code, as well as help catch bugs
you previously didn't notice.

For more information, visit https://www.typescriptlang.org/

Using TypeScript requires a compiler to convert TypeScript (code.ts) into JavaScript (code.js)
for the browser to run.

We recommend writing TypeScript code using Visual Studio code:

1. Download Visual Studio Code if you haven't already: https://code.visualstudio.com/.
2. Open this directory in Visual Studio Code.
3. Compile TypeScript to JavaScript: Run the "Terminal > Run Build Task..." menu item,
   then select "npm: watch". You will have to do this again every time
   you reopen Visual Studio Code.

That's it! Visual Studio Code will regenerate the JavaScript file every time you save.
