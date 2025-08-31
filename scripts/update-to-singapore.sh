#!/bin/bash

# ============================================================================
# update-to-singapore.sh - Render Singapore Region Migration Helper
# ============================================================================
# Purpose: Guide migration of Render services from Oregon to Singapore region
# Usage: ./scripts/update-to-singapore.sh
# Requirements: RENDER_API_KEY env var, render CLI, existing .render/services.json
# Note: Manual guidance script - does not perform actual migration, only provides steps
# ============================================================================

set -e

# カラー定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Render Singapore Migration Helper${NC}"
echo "=================================="

# 1. 現在の設定をバックアップ
if [ -f ".render/services.json" ]; then
    echo -e "\n${YELLOW}1. Backing up current configuration...${NC}"
    cp .render/services.json .render/services.json.oregon.backup
    echo "✅ Configuration backed up to .render/services.json.oregon.backup"
fi

# 2. 環境変数の確認
echo -e "\n${YELLOW}2. Checking environment variables...${NC}"
if [ -z "$RENDER_API_KEY" ]; then
    echo -e "${RED}❌ RENDER_API_KEY is not set${NC}"
    echo "Please set your Render API key:"
    echo "export RENDER_API_KEY=rnd_xxxxxxxxxxxx"
else
    echo "✅ RENDER_API_KEY is set"
fi

# 3. 削除前の最終確認
echo -e "\n${YELLOW}3. Before deleting services:${NC}"
echo "- [ ] Database backup completed?"
echo "- [ ] All important data exported?"
echo "- [ ] Team members notified?"

echo -e "\n${YELLOW}4. Next steps:${NC}"
echo "1. Delete existing services from Render dashboard"
echo "2. Deploy new services:"
echo "   ${GREEN}render blueprint deploy render-singapore.yaml${NC}"
echo "3. Update .render/services.json with new service IDs"
echo "4. Update Vercel environment variable:"
echo "   # NEXT_PUBLIC_API_URL は削除されました（Express.js API廃止）"
echo "   Value: https://simple-bookkeeping-api-sg.onrender.com"

echo -e "\n${YELLOW}5. After migration:${NC}"
echo "- Test API endpoints"
echo "- Verify database connection"
echo "- Update any webhooks or integrations"
echo "- Monitor logs for errors"
