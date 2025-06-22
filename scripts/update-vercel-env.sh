#!/bin/bash
# Vercel environment variables update script

echo "🔄 Vercel環境変数更新スクリプト"
echo "================================"

# Check if API URL is provided
if [ -z "$1" ]; then
    echo "使用方法: ./update-vercel-env.sh <RENDER_API_URL>"
    echo "例: ./update-vercel-env.sh https://simple-bookkeeping-api.onrender.com"
    exit 1
fi

API_URL=$1
echo "Render API URL: $API_URL"
echo ""

echo "以下のコマンドを実行してVercelの環境変数を更新してください："
echo ""
echo "# 既存の環境変数を削除"
echo "vercel env rm API_URL production"
echo "vercel env rm API_URL preview"
echo "vercel env rm API_URL development"
echo ""
echo "# 新しいAPI URLを設定"
echo "echo \"$API_URL\" | vercel env add API_URL production"
echo "echo \"$API_URL\" | vercel env add API_URL preview"
echo "echo \"$API_URL\" | vercel env add API_URL development"
echo ""
echo "# 環境変数の確認"
echo "vercel env ls"
echo ""
echo "# Vercelを再デプロイ"
echo "vercel --prod"