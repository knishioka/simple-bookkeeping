#!/bin/bash

# Render PostgreSQL 接続スクリプト
# .render/services.json から設定を読み込んでpsqlに接続

set -e

# 色の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# services.json のパス
SERVICES_FILE=".render/services.json"

# services.json が存在するか確認
if [ ! -f "$SERVICES_FILE" ]; then
    echo -e "${RED}エラー: $SERVICES_FILE が見つかりません${NC}"
    exit 1
fi

# データベースIDを取得
DB_ID=$(cat "$SERVICES_FILE" | jq -r '.databases.postgres.id')

if [ -z "$DB_ID" ] || [ "$DB_ID" = "null" ]; then
    echo -e "${RED}エラー: データベースIDが設定されていません${NC}"
    echo "詳細は .render/services.json を確認してください"
    exit 1
fi

echo -e "${GREEN}Render PostgreSQL に接続しています...${NC}"
echo -e "${YELLOW}データベースID: $DB_ID${NC}"

# 引数がある場合はそのまま渡す、ない場合はインタラクティブモード
if [ $# -gt 0 ]; then
    render psql "$DB_ID" "$@"
else
    render psql "$DB_ID"
fi