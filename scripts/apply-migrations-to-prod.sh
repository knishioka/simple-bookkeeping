#!/bin/bash

# 本番環境にマイグレーションを適用するスクリプト
# Supabase CLIとSQL Editorの両方の方法を提供

set -e

echo "=== Supabase本番環境マイグレーション適用スクリプト ==="
echo ""

# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_REF="eksgzskroipxdwtbmkxm"

echo -e "${YELLOW}⚠️  現在、Supabase CLIからの直接接続に認証エラーが発生しています。${NC}"
echo ""
echo "以下の2つの方法から選択してください:"
echo ""

echo -e "${GREEN}Option A: Supabase SQL Editor（推奨）${NC}"
echo "1. 以下のURLを開く:"
echo "   https://supabase.com/dashboard/project/${PROJECT_REF}/sql"
echo ""
echo "2. 新しいクエリを作成し、以下のマイグレーションファイルの内容を順番に実行:"
echo "   - supabase/migrations/20240101000000_initial_schema.sql"
echo "   - supabase/migrations/20240101000001_rls_policies.sql"
echo "   - supabase/migrations/20240101000002_storage_setup.sql"
echo "   - supabase/migrations/20240101000003_realtime_setup.sql"
echo ""

echo -e "${GREEN}Option B: Supabase CLI（データベースパスワードが必要）${NC}"
echo "1. Supabaseダッシュボードでデータベースパスワードを確認/リセット:"
echo "   https://supabase.com/dashboard/project/${PROJECT_REF}/settings/database"
echo ""
echo "2. パスワードを確認したら、以下のコマンドを実行:"
echo ""
echo "   export DB_PASSWORD='your_database_password'"
echo "   supabase db push --db-url \"postgresql://postgres:\${DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres\""
echo ""

echo -e "${YELLOW}📝 どちらの方法を使用しますか？${NC}"
echo "  a) SQL Editor（推奨）"
echo "  b) CLI（パスワード必要）"
echo ""

read -p "選択 (a/b): " choice

case $choice in
  a|A)
    echo ""
    echo -e "${GREEN}SQL Editorを開きます...${NC}"
    open "https://supabase.com/dashboard/project/${PROJECT_REF}/sql"

    echo ""
    echo -e "${YELLOW}📋 以下のファイルの内容をSQL Editorで順番に実行してください:${NC}"
    echo ""

    for file in supabase/migrations/*.sql; do
      if [ -f "$file" ]; then
        echo "  - $file"
      fi
    done

    echo ""
    echo -e "${GREEN}✅ SQL Editorで各マイグレーションを実行後、成功したらお知らせください。${NC}"
    ;;

  b|B)
    echo ""
    echo -e "${YELLOW}データベースパスワードを入力してください:${NC}"
    read -sp "Password: " DB_PASSWORD
    echo ""

    echo ""
    echo -e "${GREEN}マイグレーションを適用中...${NC}"

    supabase db push --db-url "postgresql://postgres:${DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres"

    if [ $? -eq 0 ]; then
      echo ""
      echo -e "${GREEN}✅ マイグレーションの適用に成功しました！${NC}"
    else
      echo ""
      echo -e "${RED}❌ マイグレーションの適用に失敗しました。${NC}"
      echo -e "${YELLOW}Option Aを試してください。${NC}"
    fi
    ;;

  *)
    echo ""
    echo -e "${RED}無効な選択です。${NC}"
    exit 1
    ;;
esac

echo ""
