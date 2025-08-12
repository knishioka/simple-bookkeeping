#!/bin/bash

# ============================================================================
# seed-render-db.sh - Render Database Seeding Script
# ============================================================================
# Purpose: Populate Render PostgreSQL database with initial seed data
# Usage: RENDER_DATABASE_URL='postgresql://user:pass@host:port/db' ./scripts/seed-render-db.sh
# Requirements: Node.js, Prisma CLI, Render database connection string
# Note: DEPRECATED - For security, delete after use. Use API-based seeding instead.
# ============================================================================

set -e

echo "🌱 Render データベースへのシードデータ投入を開始します..."

# 環境変数の確認
if [ -z "$RENDER_DATABASE_URL" ]; then
    echo "❌ エラー: RENDER_DATABASE_URL 環境変数が設定されていません"
    echo "使用方法: RENDER_DATABASE_URL='postgresql://...' ./scripts/seed-render-db.sh"
    exit 1
fi

# 一時的に環境変数を設定してシードを実行
cd packages/database
DATABASE_URL="$RENDER_DATABASE_URL" npx prisma db seed

echo "✅ シードデータの投入が完了しました"
echo "⚠️  セキュリティのため、このスクリプトを削除することを推奨します"