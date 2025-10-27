#!/bin/bash

# Vercel環境変数設定スクリプト
# Supabaseプロジェクト再開後に実行

set -e

echo "=== Vercel本番環境変数設定スクリプト ==="
echo ""

# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Supabaseプロジェクト情報
PROJECT_REF="eksgzskroipxdwtbmkxm"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"

echo -e "${YELLOW}📋 Supabaseダッシュボードから以下のキーを取得してください:${NC}"
echo "   URL: https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api"
echo ""
echo "   1. anon public key"
echo "   2. service_role secret key"
echo ""

# 既存の環境変数を削除
echo -e "${YELLOW}🗑️  既存の環境変数を削除中...${NC}"

vercel env rm NEXT_PUBLIC_SUPABASE_URL production --yes 2>/dev/null || true
vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY production --yes 2>/dev/null || true
vercel env rm SUPABASE_SERVICE_ROLE_KEY production --yes 2>/dev/null || true

echo -e "${GREEN}✅ 削除完了${NC}"
echo ""

# 新しい環境変数を設定
echo -e "${YELLOW}📝 新しい環境変数を設定中...${NC}"
echo ""

# NEXT_PUBLIC_SUPABASE_URL
echo -e "${GREEN}1. NEXT_PUBLIC_SUPABASE_URL を設定${NC}"
echo "   値: ${SUPABASE_URL}"
echo "${SUPABASE_URL}" | vercel env add NEXT_PUBLIC_SUPABASE_URL production

# NEXT_PUBLIC_SUPABASE_ANON_KEY
echo ""
echo -e "${GREEN}2. NEXT_PUBLIC_SUPABASE_ANON_KEY を設定${NC}"
echo -e "${YELLOW}   ダッシュボードから anon public key をコピーして貼り付けてください:${NC}"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production

# SUPABASE_SERVICE_ROLE_KEY
echo ""
echo -e "${GREEN}3. SUPABASE_SERVICE_ROLE_KEY を設定${NC}"
echo -e "${YELLOW}   ダッシュボードから service_role secret key をコピーして貼り付けてください:${NC}"
vercel env add SUPABASE_SERVICE_ROLE_KEY production

echo ""
echo -e "${GREEN}✅ 環境変数の設定が完了しました${NC}"
echo ""
echo -e "${YELLOW}📦 次のステップ: 本番環境を再デプロイ${NC}"
echo "   コマンド: vercel --prod"
echo ""
