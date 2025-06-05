#!/bin/bash

# AWS API Gateway + Lambda + Secret Manager セットアップスクリプト
# 実行前に AWS CLI が設定されていることを確認してください

echo "🚀 Figma Claude プロキシ - API Gateway セットアップ開始"

# 変数設定
REGION="ap-northeast-1"
SECRET_NAME="figma-claude-api-key"
LAMBDA_FUNCTION_NAME="figma-claude-proxy-v2"
API_NAME="figma-claude-api"

echo "📋 設定情報:"
echo "  - リージョン: $REGION"
echo "  - Secret名: $SECRET_NAME"
echo "  - Lambda関数名: $LAMBDA_FUNCTION_NAME"
echo "  - API Gateway名: $API_NAME"

# Claude APIキーの入力
echo ""
echo "🔑 Claude APIキーを入力してください:"
read -s CLAUDE_API_KEY

if [ -z "$CLAUDE_API_KEY" ]; then
    echo "❌ APIキーが入力されていません。終了します。"
    exit 1
fi

echo ""
echo "1️⃣ Secret Manager にAPIキーを保存中..."

# Secret Manager にAPIキーを保存
SECRET_ARN=$(aws secretsmanager create-secret \
    --region $REGION \
    --name $SECRET_NAME \
    --description "Claude API key for Figma plugin" \
    --secret-string "{\"api-key\":\"$CLAUDE_API_KEY\"}" \
    --query 'ARN' \
    --output text 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "✅ Secret Manager に APIキーを保存しました"
    echo "   ARN: $SECRET_ARN"
else
    # 既存のSecretを更新
    echo "🔄 既存のSecretを更新中..."
    SECRET_ARN=$(aws secretsmanager update-secret \
        --region $REGION \
        --secret-id $SECRET_NAME \
        --secret-string "{\"api-key\":\"$CLAUDE_API_KEY\"}" \
        --query 'ARN' \
        --output text)
    
    if [ $? -eq 0 ]; then
        echo "✅ Secret Manager のAPIキーを更新しました"
        echo "   ARN: $SECRET_ARN"
    else
        echo "❌ Secret Manager の操作に失敗しました"
        exit 1
    fi
fi

echo ""
echo "2️⃣ Lambda 実行ロールを作成中..."

# IAM ロール作成
ROLE_ARN=$(aws iam create-role \
    --role-name $LAMBDA_FUNCTION_NAME-execution-role \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "lambda.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }' \
    --query 'Role.Arn' \
    --output text 2>/dev/null)

if [ $? -ne 0 ]; then
    # 既存のロールのARNを取得
    ROLE_ARN=$(aws iam get-role \
        --role-name $LAMBDA_FUNCTION_NAME-execution-role \
        --query 'Role.Arn' \
        --output text)
fi

echo "✅ IAM ロール: $ROLE_ARN"

# 基本Lambda実行ポリシーをアタッチ
aws iam attach-role-policy \
    --role-name $LAMBDA_FUNCTION_NAME-execution-role \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Secret Manager読み取りポリシーを作成
aws iam put-role-policy \
    --role-name $LAMBDA_FUNCTION_NAME-execution-role \
    --policy-name SecretManagerReadPolicy \
    --policy-document "{
        \"Version\": \"2012-10-17\",
        \"Statement\": [
            {
                \"Effect\": \"Allow\",
                \"Action\": [
                    \"secretsmanager:GetSecretValue\"
                ],
                \"Resource\": \"$SECRET_ARN\"
            }
        ]
    }"

echo "✅ IAM ポリシーを設定しました"

echo ""
echo "🔧 次のステップ:"
echo "1. 新しいLambda関数コードをデプロイ"
echo "2. API Gateway を作成・設定"
echo "3. CloudWatch ログ設定"
echo ""
echo "📋 設定値をメモしてください:"
echo "SECRET_ARN=$SECRET_ARN"
echo "ROLE_ARN=$ROLE_ARN"
echo "REGION=$REGION" 