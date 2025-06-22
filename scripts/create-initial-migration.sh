#!/bin/bash
# 初期マイグレーション作成スクリプト

echo "📋 初期マイグレーションを作成します"
echo "===================================="

cd packages/database || exit 1

# 一時的に multi-tenant マイグレーションを移動
echo "既存のマイグレーションを一時的に移動..."
mv prisma/migrations/20250110_add_multi_tenant_support prisma/migrations/20250110_add_multi_tenant_support.bak

# 初期スキーマのマイグレーションを作成
echo "初期スキーマのマイグレーションを作成..."
npx prisma migrate dev --name initial_schema --create-only

# multi-tenant マイグレーションを戻す
echo "multi-tenant マイグレーションを戻す..."
mv prisma/migrations/20250110_add_multi_tenant_support.bak prisma/migrations/20250110_add_multi_tenant_support

echo "✅ 完了しました！"
echo ""
echo "作成されたマイグレーション:"
ls -la prisma/migrations/