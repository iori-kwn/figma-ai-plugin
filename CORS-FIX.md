# CORS Issue Fix Documentation

このドキュメントでは、Claude API を使用した Figma プラグインの CORS 問題解決策について説明します。

## 修正内容の概要

1. **Vercel 設定ファイルの修正**:

   - `vercel.json`での CORS ヘッダー設定を強化
   - HTTP メソッドとヘッダーの許可を拡張

2. **プロキシサーバーの改善**:

   - `api/proxy.js`での CORS ヘッダー処理を一貫して適用
   - node-fetch 追加で Fetch API 対応を強化
   - ESM 対応のためのコンソールログ改善

3. **コードの一貫性確保**:

   - すべてのファイルでプロキシ URL を統一
   - `manifest.json`とコードでの参照先を一致

4. **デプロイ手順の簡素化**:
   - `deploy.sh`スクリプト追加でデプロイプロセスを自動化

## 修正したファイル

1. **vercel.json**:

   - CORS ヘッダーをより包括的に設定
   - `OPTIONS`メソッドへの対応を明示的に追加

2. **api/proxy.js**:

   - node-fetch パッケージをインポート
   - CORS ヘッダーを全レスポンスタイプに一貫して適用
   - コンソールログ処理を改善

3. **package.json**:

   - node-fetch 依存関係を追加

4. **code.ts**:
   - プロキシ URL を`https://figma-claude-design-plugin.vercel.app/api/proxy`に統一

## 使用方法

1. **プロジェクトのビルド**:

   ```
   npm install
   npm run build
   ```

2. **Vercel へのデプロイ**:

   ```
   ./deploy.sh --deploy
   ```

   または

   ```
   vercel --prod
   ```

3. **API キーの設定**:
   プラグイン設定画面で Claude API キーを設定

4. **動作確認**:
   - Figma でプラグインを開く
   - プロンプトを入力してデザイン生成を実行
   - コンソールログでリクエスト/レスポンス状況を確認

## 注意点

1. デプロイ後の URL が`manifest.json`と`code.ts`で一致していることを確認
2. トラブルシューティングのためにブラウザの開発者ツールでネットワークタブを確認
3. CORS エラーが続く場合は、ブラウザキャッシュをクリアして再試行
