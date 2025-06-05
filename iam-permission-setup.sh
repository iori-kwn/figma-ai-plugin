#!/bin/bash

# 既存Lambda関数のIAM権限にSecret Manager読み取り権限を追加

echo "🔐 既存Lambda関数にSecret Manager権限を追加します"

LAMBDA_FUNCTION_NAME="figma-claude-proxy"
REGION="ap-northeast-1"
SECRET_NAME="figma-claude-api-key"

echo "📋 設定情報:"
echo "  - Lambda関数名: $LAMBDA_FUNCTION_NAME"
echo "  - リージョン: $REGION"
echo "  - Secret名: $SECRET_NAME"

# 既存のLambda関数のロール名を取得
echo ""
echo "1️⃣ Lambda関数の実行ロールを確認中..."

ROLE_ARN=$(aws lambda get-function \
    --function-name $LAMBDA_FUNCTION_NAME \
    --query 'Configuration.Role' \
    --output text 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "❌ Lambda関数 '$LAMBDA_FUNCTION_NAME' が見つかりません"
    echo "   関数名を確認してください"
    exit 1
fi

# ロール名を抽出
ROLE_NAME=$(echo $ROLE_ARN | sed 's|.*/||')
echo "✅ 実行ロール: $ROLE_NAME"
echo "   ARN: $ROLE_ARN"

# Secret Manager権限ポリシーを追加
echo ""
echo "2️⃣ Secret Manager読み取り権限を追加中..."

aws iam put-role-policy \
    --role-name $ROLE_NAME \
    --policy-name SecretManagerReadPolicy \
    --policy-document "{
        \"Version\": \"2012-10-17\",
        \"Statement\": [
            {
                \"Effect\": \"Allow\",
                \"Action\": \"secretsmanager:GetSecretValue\",
                \"Resource\": \"arn:aws:secretsmanager:$REGION:*:secret:$SECRET_NAME*\"
            }
        ]
    }"

if [ $? -eq 0 ]; then
    echo "✅ Secret Manager読み取り権限を追加しました"
else
    echo "❌ 権限の追加に失敗しました"
    exit 1
fi

echo ""
echo "3️⃣ 権限確認中..."

# 追加されたポリシーを確認
aws iam get-role-policy \
    --role-name $ROLE_NAME \
    --policy-name SecretManagerReadPolicy \
    --query 'PolicyDocument' \
    --output json

echo ""
echo "✅ IAM権限の設定が完了しました！"
echo ""
echo "📋 次のステップ:"
echo "1. aws-setup-script.sh を実行してSecret ManagerにAPIキーを保存"
echo "2. lambda-enhanced-update.zip をLambda関数にアップロード"
echo "3. 環境変数 SECRET_NAME=figma-claude-api-key を設定"
echo ""
echo "💡 手動でも設定可能:"
echo "   AWS Console → Lambda → $LAMBDA_FUNCTION_NAME → Configuration → Permissions"
echo "   → 実行ロール → Add permissions → Create inline policy" 