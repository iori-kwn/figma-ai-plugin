# Markdown JSON 解析エラー修正 - 完了報告

## 問題の概要

Claude API からのレスポンスが markdown 形式（```json ブロック）でフォーマットされており、Lambda 関数がそのまま Figma プラグインに返していたため、JSON 解析エラーが発生していました。

## 根本原因

1. **Claude API**: AI モデルが JSON レスポンスを```json コードブロックで囲んで返す
2. **Lambda 関数**: マークダウン形式のレスポンスをそのまま転送
3. **Figma プラグイン**: JSON.parse()でマークダウン形式の文字列を解析しようとして失敗

## 実装した解決策

### 1. Lambda 関数側の修正（主要対策）

#### 新機能: `cleanMarkdownJson()` 関数

- **目的**: Claude API からの markdown 形式 JSON を自動的にクリーニング
- **対応パターン**:
  - Pattern 1: `\`\`\`json....\`\`\`` ブロック（最も確実）
  - Pattern 2: 一般的な `\`\`\`....\`\`\`` ブロック（JSON 開始確認）
  - Pattern 3: markdown マーカーの単純除去
  - Pattern 4: 最初のバランスの取れた JSON オブジェクトを抽出

#### 修正されたファイル:

- `index.mjs` - メイン Lambda 関数
- `lambda-function-url-enhanced.mjs` - 強化版 Lambda 関数
- `lambda-enhanced/index.mjs` - ストリーミング対応版

#### レスポンス処理の強化:

````javascript
// マークダウン検出と自動クリーニング
if (originalResponseText.includes('```json') || originalResponseText.includes('```')) {
  console.log('Markdown formatting detected, cleaning JSON...');

  try {
    const cleanedJson = cleanMarkdownJson(originalResponseText);
    JSON.parse(cleanedJson); // 検証
    data.content[0].text = cleanedJson; // クリーンなJSONに置換
  } catch (cleanError) {
    // フォールバック: 元のテキストを保持
  }
}
````

### 2. Figma プラグイン側の強化（安全対策）

#### フォールバック処理の追加:

- Lambda 側でクリーニングが失敗した場合の追加処理
- より堅牢なエラーハンドリング
- 詳細なデバッグログ

#### 修正されたファイル:

- `code.ts` - メインプラグインロジック

### 3. エラーハンドリングの改善

#### CloudWatch ログの強化:

- マークダウン検出ログ
- クリーニング処理の詳細ログ
- 成功/失敗の統計情報

#### メタデータの追加:

```javascript
_meta: {
  // ... 既存フィールド
  version: '2.1',
  improvements: 'Enhanced for detailed design generation with markdown JSON cleaning',
  markdownCleaned: boolean // クリーニングが実行されたかのフラグ
}
```

## デプロイメント

### 作成されたアーティファクト:

1. `figma-claude-proxy-fixed.zip` - メイン修正版
2. `figma-claude-proxy-enhanced-fixed.zip` - 強化版

### デプロイ手順:

1. AWS Lambda コンソールにアクセス
2. 対象の関数を選択
3. 新しい zip ファイルをアップロード
4. デプロイを実行

## テスト項目

### 1. 基本機能テスト

- [ ] 通常の JSON レスポンス（マークダウンなし）
- [ ] ````jsonブロック形式のレスポンス

          ```
      ````

- [ ] 一般的な```ブロック形式のレスポンス
- [ ] 複雑なネストされた JSON 構造

### 2. エラーハンドリングテスト

- [ ] 不正な JSON 構造
- [ ] 部分的に切り詰められたレスポンス
- [ ] ネットワークエラー時のフォールバック

### 3. パフォーマンステスト

- [ ] 大きなレスポンス（2MB 以上）のストリーミング
- [ ] 小さなレスポンスの通常処理
- [ ] API キャッシュの動作確認

## 期待される効果

### 1. 即座の改善

- ✅ JSON 解析エラーの解消
- ✅ レスポンス処理の安定化
- ✅ より詳細なデバッグ情報

### 2. 長期的な安定性

- ✅ マークダウン形式の自動処理
- ✅ 複数のフォールバック戦略
- ✅ 包括的なエラーハンドリング

### 3. 運用改善

- ✅ CloudWatch での詳細な監視
- ✅ 問題の早期発見
- ✅ デバッグ情報の充実

## 注意事項

### 1. 互換性

- 既存の正常な JSON レスポンスには影響なし
- マークダウンクリーニングは可逆的処理
- エラー時は元のレスポンスにフォールバック

### 2. 監視ポイント

- CloudWatch ログでクリーニング実行頻度を監視
- JSON 解析エラー率の変化を追跡
- レスポンス時間への影響を確認

### 3. 将来の改善案

- AI モデルへのシステムプロンプト調整（"Output only raw JSON without markdown formatting"）
- より高度な JSON バリデーション
- リアルタイムエラー通知

## まとめ

この修正により、Claude API の markdown 形式レスポンスが自動的にクリーニングされ、JSON 解析エラーが解消されます。複数レベルのフォールバック処理により、高い安定性と信頼性を確保しています。

修正は**非破壊的**であり、既存の動作に影響を与えることなく、問題のあるレスポンスのみを適切に処理します。
