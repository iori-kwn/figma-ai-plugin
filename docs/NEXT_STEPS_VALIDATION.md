# 次のステップ: ストリーミング機能の検証とテスト

社内エンジニア **Maki Fujiwara** のアドバイスに基づくストリーミング実装が完了しました。
次の検証フェーズを実行してください。

## 🎯 **Phase 2: Lambda Function のデプロイと検証**

### Step 1: AWS Lambda Function の更新

1. **AWS Lambda Console にアクセス**

   - AWS コンソールで Lambda サービスを開く
   - 既存の関数を選択

2. **ストリーミング対応版をアップロード**

   ```bash
   # 作成済みのデプロイパッケージ
   lambda-streaming-enhanced-v2.1.zip
   ```

3. **関数設定の確認**
   - Runtime: Node.js 18.x
   - Timeout: 15 minutes (900 seconds)
   - Memory: 512 MB 以上推奨

### Step 2: ストリーミング機能のテスト

1. **Lambda Function URL でのヘルスチェック**

   ```bash
   curl https://45eu4yy74z3uljhe74ogyda4bm0stwqt.lambda-url.ap-northeast-1.on.aws/
   ```

   **期待されるレスポンス:**

   ```json
   {
     "status": "Lambda proxy server is running - Streaming Enhanced",
     "version": "2.1",
     "streaming": {
       "enabled": true,
       "implementation": "Maki Fujiwara guidance based"
     }
   }
   ```

2. **ストリーミング API のテスト**
   ```bash
   curl -X POST https://45eu4yy74z3uljhe74ogyda4bm0stwqt.lambda-url.ap-northeast-1.on.aws/ \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY" \
     -d '{
       "model": "claude-3-5-haiku-20241022",
       "max_tokens": 1000,
       "messages": [{"role": "user", "content": "Hello, please stream a response"}]
     }'
   ```

## 🎯 **Phase 3: Figma Plugin でのリアルタイムテスト**

### Step 1: Figma Plugin の実行

1. **Figma Desktop アプリを起動**
2. **プラグイン開発モードで実行**

   - ファイル > Plugins > Development > Import plugin from manifest...
   - `manifest.json` を選択

3. **ストリーミング機能の体験**
   - 「To Do アプリの UI」などの複雑なプロンプトを入力
   - リアルタイム進捗表示を確認
   - ストリーミング完了までの時間を測定

### Step 2: ストリーミング表示の確認項目

✅ **確認すべき動作:**

- [ ] Loading spinner の表示
- [ ] `stream-update` メッセージでのリアルタイム更新
- [ ] 進捗状況の視覚的表示
- [ ] `stream-complete` での完了通知
- [ ] エラー時の `stream-error` ハンドリング
- [ ] 最終的な Figma デザイン生成

## 🎯 **Phase 4: パフォーマンス測定**

### 測定項目

1. **ストリーミング速度**

   - 最初のチャンク受信までの時間
   - 全体の処理時間
   - チャンクサイズと頻度

2. **従来版との比較**

   - 従来の一括処理 vs ストリーミング処理
   - ユーザー体験の向上度

3. **大容量レスポンスの処理**
   - 複雑なデザインプロンプトでのテスト
   - 2MB 以上の大容量 JSON 処理

## 🎯 **Phase 5: 本格運用への準備**

### 最終チェック項目

- [ ] CloudWatch ログでのストリーミング処理確認
- [ ] Secret Manager での API キー管理動作確認
- [ ] エラーハンドリングの動作確認
- [ ] Lambda Function URL でのストリーミングヘッダー確認

### ドキュメント更新

- [ ] README.md にストリーミング機能の説明を追加
- [ ] 技術仕様書のアップデート
- [ ] トラブルシューティングガイドの作成

## 🔧 **トラブルシューティング**

### よくある問題と解決策

1. **ストリーミングが動作しない場合**

   - Lambda Function の更新確認
   - CORS ヘッダーの設定確認
   - Claude API のストリーミング設定確認

2. **UI でストリーミング表示が出ない場合**

   - ブラウザの開発者ツールでメッセージ確認
   - `onmessage` イベントハンドラーの動作確認

3. **パフォーマンスが期待値を下回る場合**
   - Lambda Function のメモリ設定を増加
   - ネットワーク接続の確認
   - Claude API の応答時間確認

## 📊 **期待される改善効果**

社内エンジニアのアドバイス実装により期待される効果：

- **ユーザー体験向上**: リアルタイム進捗表示
- **レスポンス速度向上**: ストリーミングによる体感速度改善
- **大容量対応**: 2MB 以上の複雑なデザイン処理可能
- **エラーハンドリング強化**: 詳細なストリーミングエラー対応

---

**実装完了**: ✅ Maki Fujiwara のアドバイス完全対応  
**次のアクション**: AWS Lambda Function の更新とテスト実行
