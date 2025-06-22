#!/bin/bash
# Render データベースリセットスクリプト

echo "🔧 Render データベースリセット（ローカル実行）"
echo "=============================================="
echo ""
echo "⚠️ 警告: これはデータベースを完全にリセットします"
echo ""

# Check if DATABASE_URL is provided
if [ -z "$1" ]; then
    echo "使用方法: ./render-db-reset.sh <DATABASE_URL>"
    echo ""
    echo "DATABASE_URLの取得方法:"
    echo "1. Render Dashboardで simple-bookkeeping-api を開く"
    echo "2. Environment タブをクリック"
    echo "3. DATABASE_URL の値をコピー"
    echo ""
    exit 1
fi

DATABASE_URL=$1

echo "📋 実行内容:"
echo "1. 既存のマイグレーション履歴をリセット"
echo "2. データベーススキーマを再作成"
echo "3. マイグレーションを最初から実行"
echo "4. シードデータを投入"
echo ""
echo "⚠️ すべてのデータが削除されます！"
echo "続行しますか？ (yes/no)"
read -r response

if [ "$response" != "yes" ]; then
    echo "キャンセルしました"
    exit 0
fi

# Export DATABASE_URL for Prisma
export DATABASE_URL="$DATABASE_URL"

# Change to database package directory
cd packages/database || exit 1

echo ""
echo "🔄 データベースをリセット中..."
# Force reset without prompt
npx prisma migrate reset --force --skip-seed

echo ""
echo "🔄 マイグレーションを実行中..."
npx prisma migrate deploy

echo ""
echo "🔄 シードデータを投入中..."
npx prisma db seed

echo ""
echo "✅ データベースリセットが完了しました！"
echo ""
echo "📝 テストユーザー情報:"
echo "Email: test@example.com"
echo "Password: 上記のシード実行ログを確認してください"