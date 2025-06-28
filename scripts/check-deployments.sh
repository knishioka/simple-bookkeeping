#!/bin/bash

# 両プラットフォームのデプロイメント状態を確認するスクリプト

set -e

# カラー定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Checking deployment status for both platforms${NC}"
echo "================================================"
echo ""

# Render status
echo -e "${YELLOW}RENDER (API Server)${NC}"
echo "-------------------"
if [ -f "./scripts/render-api-status.sh" ]; then
    ./scripts/render-api-status.sh | tail -n +3  # Skip header
else
    echo -e "${RED}Error: render-api-status.sh not found${NC}"
fi

echo ""
echo ""

# Vercel status
echo -e "${YELLOW}VERCEL (Web Application)${NC}"
echo "------------------------"
if [ -f "./scripts/vercel-api-status.sh" ]; then
    ./scripts/vercel-api-status.sh | tail -n +3  # Skip header
else
    echo -e "${RED}Error: vercel-api-status.sh not found${NC}"
fi

echo ""
echo "================================================"
echo -e "${GREEN}Deployment check completed${NC}"