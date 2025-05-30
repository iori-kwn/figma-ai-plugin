# プロキシサーバーのデプロイ手順

このドキュメントでは、Claude API に接続するためのプロキシサーバーを Vercel にデプロイする方法を説明します。

## 前提条件

- GitHub アカウント
- Vercel アカウント

## 手順

### 1. GitHub へのリポジトリの準備

1. リポジトリを GitHub に作成してください
2. 現在のプロジェクトを GitHub にプッシュします

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <あなたのGitHubリポジトリURL>
git push -u origin main
```

### 2. Vercel へのデプロイ

1. [Vercel](https://vercel.com)にログイン
2. 「New Project」ボタンをクリック
3. 先ほど作成した GitHub リポジトリを選択
4. 基本設定はそのままで構いません（`vercel.json`ファイルが自動的に検出されます）
5. 「Deploy」ボタンをクリック

### 3. デプロイ URL の確認とコードの更新

デプロイが完了すると、Vercel からデプロイ済みの URL が提供されます。
この URL をコードに反映させる必要があります。

1. `code.ts`ファイルの以下の行を更新します：

```typescript
const proxyUrl = 'https://your-deployed-url.vercel.app/api/proxy';
```

2. `manifest.json`の`allowedDomains`にもデプロイ URL を追加します：

```json
"allowedDomains": [
  "https://api.anthropic.com",
  "https://*.anthropic.com",
  "https://your-deployed-url.vercel.app"
]
```

### 4. プラグインの再ビルド

コードを更新したら、プラグインを再ビルドしてください：

```bash
npm run build
```

### 5. 動作確認

1. Figma でプラグインを実行
2. 設定タブで API キーを設定
3. デザイン生成タブでプロンプトを入力して「デザイン生成」ボタンをクリック

## トラブルシューティング

- **デプロイの問題**: Vercel のダッシュボードでビルドログを確認してください
- **CORS 問題**: `vercel.json`と`api/proxy.js`の CORS 設定が正しいか確認してください
- **API エラー**: Anthropic API キーが有効か確認してください
- **プラグインエラー**: Figma コンソールでエラーメッセージを確認してください（Figma アプリで開発者ツールを開いて Console タブを確認）


