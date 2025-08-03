#!/bin/bash

# 完全ビルドチェックスクリプト
# push前にVercelとRenderの両方のビルドが成功することを確認

echo "🚀 Running full build checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track errors
ERRORS=0

# Check Web app build (Vercel)
echo -e "${YELLOW}🔨 Building Web application (Vercel)...${NC}"
if pnpm --filter @simple-bookkeeping/web build; then
    echo -e "${GREEN}✅ Web app build successful${NC}"
else
    echo -e "${RED}❌ Web app build failed!${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check API server build (Render)
echo -e "\n${YELLOW}🔨 Building API server (Render)...${NC}"
if pnpm --filter @simple-bookkeeping/api build; then
    echo -e "${GREEN}✅ API server build successful${NC}"
else
    echo -e "${RED}❌ API server build failed!${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check shared packages build
echo -e "\n${YELLOW}🔨 Building shared packages...${NC}"
if pnpm build:packages; then
    echo -e "${GREEN}✅ Shared packages build successful${NC}"
else
    echo -e "${RED}❌ Shared packages build failed!${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Summary
echo -e "\n${YELLOW}========================================${NC}"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All builds passed successfully!${NC}"
    echo -e "${GREEN}Safe to push to production.${NC}"
    exit 0
else
    echo -e "${RED}❌ $ERRORS build(s) failed!${NC}"
    echo -e "${RED}Please fix the errors before pushing.${NC}"
    echo -e "\n${YELLOW}Tips:${NC}"
    echo "- Run 'pnpm build' to see all errors"
    echo "- Check TypeScript errors with 'pnpm typecheck'"
    echo "- Verify dependencies with 'pnpm check:deps'"
    exit 1
fi