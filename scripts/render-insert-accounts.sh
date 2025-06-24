#!/bin/bash

# Render PostgreSQL に勘定科目を挿入するスクリプト

set -e

# 色の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# services.json のパス
SERVICES_FILE=".render/services.json"
SQL_FILE="scripts/insert-accounts.sql"

# services.json が存在するか確認
if [ ! -f "$SERVICES_FILE" ]; then
    echo -e "${RED}エラー: $SERVICES_FILE が見つかりません${NC}"
    exit 1
fi

# SQLファイルが存在するか確認
if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}エラー: $SQL_FILE が見つかりません${NC}"
    exit 1
fi

# データベースIDを取得
DB_ID=$(cat "$SERVICES_FILE" | jq -r '.databases.postgres.id')

if [ -z "$DB_ID" ] || [ "$DB_ID" = "null" ]; then
    echo -e "${RED}エラー: データベースIDが設定されていません${NC}"
    echo "詳細は .render/services.json を確認してください"
    exit 1
fi

echo -e "${BLUE}===============================================${NC}"
echo -e "${GREEN}標準勘定科目の挿入スクリプト${NC}"
echo -e "${BLUE}===============================================${NC}"
echo ""
echo -e "${YELLOW}データベースID: $DB_ID${NC}"
echo -e "${YELLOW}SQLファイル: $SQL_FILE${NC}"
echo ""
echo -e "${GREEN}これから87個の標準勘定科目を挿入します。${NC}"
echo -e "${YELLOW}注意: 既存のシステム勘定科目は削除されます。${NC}"
echo ""
read -p "続行しますか？ (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}キャンセルされました${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}SQLを実行しています...${NC}"

# SQLファイルを実行
render psql "$DB_ID" < "$SQL_FILE"

echo ""
echo -e "${GREEN}実行が完了しました！${NC}"
echo ""
echo -e "${BLUE}結果を確認するには以下を実行してください:${NC}"
echo "  ./scripts/render-psql.sh -c \"SELECT COUNT(*) as total FROM accounts WHERE is_system = true;\""
echo ""
echo -e "${BLUE}勘定科目の詳細を確認:${NC}"
echo "  ./scripts/render-psql.sh -c \"SELECT code, name, account_type FROM accounts WHERE is_system = true ORDER BY code;\""