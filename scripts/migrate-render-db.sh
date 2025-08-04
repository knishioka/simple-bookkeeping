#!/bin/bash

# Renderデータベースのマイグレーション実行スクリプト
# 使用方法: DATABASE_URL='<External_Connection_URL>' ./scripts/migrate-render-db.sh

set -e

echo "🔄 Renderデータベースのマイグレーションを開始します..."

# 環境変数の確認
if [ -z "$DATABASE_URL" ]; then
    echo "❌ エラー: DATABASE_URL 環境変数が設定されていません"
    echo "使用方法: DATABASE_URL='postgresql://...' ./scripts/migrate-render-db.sh"
    exit 1
fi

# Prismaディレクトリに移動
cd packages/database

# マイグレーションの実行
echo "📦 Prismaクライアントを生成中..."
npx prisma generate

echo "🚀 マイグレーションを実行中..."
npx prisma migrate deploy

echo "✅ マイグレーションが完了しました！"

# シードデータの投入（オプション）
read -p "シードデータを投入しますか？ (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🌱 シードデータを投入中..."
    npx prisma db seed
    echo "✅ シードデータの投入が完了しました！"
fi