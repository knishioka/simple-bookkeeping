#!/bin/bash
# Render deployment check script

echo "🔍 Renderデプロイメント確認スクリプト"
echo "=================================="

# Check if API URL is provided
if [ -z "$1" ]; then
    echo "使用方法: ./check-render-deployment.sh <API_URL>"
    echo "例: ./check-render-deployment.sh https://simple-bookkeeping-api.onrender.com"
    exit 1
fi

API_URL=$1
echo "API URL: $API_URL"
echo ""

# Health check
echo "1. ヘルスチェック..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" "$API_URL/api/v1/health" || echo "❌ 接続エラー"
echo ""

# API info
echo "2. API情報..."
curl -s "$API_URL/api/v1/" | jq . || echo "❌ API情報を取得できません"
echo ""

# Test auth endpoint
echo "3. 認証エンドポイント確認..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" "$API_URL/api/v1/auth/login" -X POST -H "Content-Type: application/json" -d '{}' || echo "❌ 認証エンドポイントエラー"
echo ""

echo "✅ 確認完了"