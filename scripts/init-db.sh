#!/bin/bash

# ============================================================================
# init-db.sh - Database Initialization Script
# ============================================================================
# Purpose: Complete database initialization including Prisma client generation,
#          migration execution, and seed data insertion for development
# Usage: pnpm db:init (or direct execution)
# Requirements: Database connection configured, NODE_ENV for environment check
# ============================================================================

set -e

# カラー定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Database initialization script${NC}"
echo "=============================="

# 1. Prismaクライアント生成
echo -e "\n${YELLOW}1. Generating Prisma client...${NC}"
pnpm --filter @simple-bookkeeping/database prisma:generate

# 2. マイグレーション実行
echo -e "\n${YELLOW}2. Running database migrations...${NC}"
pnpm --filter @simple-bookkeeping/database prisma:migrate:deploy

# 3. 初期データ投入（開発環境のみ）
if [ "$NODE_ENV" != "production" ]; then
    echo -e "\n${YELLOW}3. Seeding database (development)...${NC}"
    pnpm --filter @simple-bookkeeping/database db:seed
else
    echo -e "\n${YELLOW}3. Skipping seed in production${NC}"
fi

# 4. データベース接続確認
echo -e "\n${YELLOW}4. Verifying database connection...${NC}"
pnpm --filter @simple-bookkeeping/database prisma db pull --print 2>&1 | head -5

echo -e "\n${GREEN}✅ Database initialization completed successfully!${NC}"