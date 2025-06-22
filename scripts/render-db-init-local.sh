#!/bin/bash
# Render データベース初期化スクリプト（ローカル実行用）

echo "🔧 Render データベース初期化（ローカル実行）"
echo "============================================"
echo ""
echo "⚠️ 無料プランではShellが使えないため、ローカルから実行します"
echo ""

# Check if DATABASE_URL is provided
if [ -z "$1" ]; then
    echo "使用方法: ./render-db-init-local.sh <DATABASE_URL>"
    echo ""
    echo "DATABASE_URLの取得方法:"
    echo "1. Render Dashboardで simple-bookkeeping-api を開く"
    echo "2. Environment タブをクリック"
    echo "3. DATABASE_URL の値をコピー（Revealボタンで表示）"
    echo ""
    exit 1
fi

DATABASE_URL=$1

echo "📋 実行内容:"
echo "1. Prismaクライアントの生成"
echo "2. データベースマイグレーション"
echo "3. 初期データ（シード）の投入"
echo ""
echo "続行しますか？ (y/n)"
read -r response

if [ "$response" != "y" ]; then
    echo "キャンセルしました"
    exit 0
fi

# Export DATABASE_URL for Prisma
export DATABASE_URL="$DATABASE_URL"

# Change to database package directory
cd packages/database || exit 1

echo ""
echo "🔄 Prismaクライアントを生成中..."
pnpm prisma generate

echo ""
echo "🔄 マイグレーションを実行中..."
pnpm prisma migrate deploy

echo ""
echo "🔄 シードデータを投入中..."
pnpm prisma db seed

echo ""
echo "✅ データベース初期化が完了しました！"
echo ""
echo "📝 テストユーザー情報:"
echo "Email: test@example.com"
echo "Password: 上記のシード実行ログを確認してください"