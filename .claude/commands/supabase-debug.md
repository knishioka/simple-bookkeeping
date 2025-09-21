# Supabaseデバッグ

Supabase関連の問題をデバッグし、詳細情報を表示します。

## 使用方法

```
/supabase-debug [area]
```

### オプション

- `area`: デバッグ対象の領域（status/auth/db/realtime/all）。デフォルトは `all`

## 説明

このコマンドは、Supabase関連の様々な情報を収集し、問題の診断に役立つデバッグ情報を提供します。

## デバッグ内容

### 全体ステータス確認（all）

```bash
echo "🔍 Supabaseデバッグ情報を収集しています..."
echo "=========================================="

# 1. Supabase CLIステータス
echo -e "\n📊 Supabase Status:"
pnpm supabase status

# 2. 環境変数確認
echo -e "\n🔐 環境変数:"
env | grep SUPABASE | sed 's/=.*/=<REDACTED>/'
env | grep NEXT_PUBLIC_SUPABASE | sed 's/=.*/=<REDACTED>/'

# 3. Docker状態
echo -e "\n🐳 Docker Containers:"
docker ps | grep -E "(supabase|postgres)" || echo "No Supabase containers running"

# 4. ポート使用状況
echo -e "\n🔌 Port Status:"
for port in 54321 54322 54323 54324 54325 54326; do
  if lsof -i :$port > /dev/null 2>&1; then
    echo "✅ Port $port: In use"
  else
    echo "❌ Port $port: Available"
  fi
done

# 5. 接続テスト
echo -e "\n🔗 Connection Tests:"
urls=(
  "http://localhost:54321/rest/v1/"
  "http://localhost:54323/"
)

for url in "${urls[@]}"; do
  response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
  if [ "$response" = "200" ] || [ "$response" = "302" ]; then
    echo "✅ $url: OK (HTTP $response)"
  else
    echo "❌ $url: Failed (HTTP $response)"
  fi
done

# 6. データベース情報
echo -e "\n💾 Database Info:"
pnpm supabase db remote list 2>/dev/null || echo "No remote databases configured"

# 7. マイグレーション状態
echo -e "\n📝 Migration Status:"
pnpm supabase migration list 2>/dev/null || echo "No migrations found"

# 8. ログの最後の10行
echo -e "\n📋 Recent Logs:"
pnpm supabase db logs --tail 10 2>/dev/null || echo "No logs available"

echo -e "\n=========================================="
echo "デバッグ情報の収集が完了しました"
```

### 認証デバッグ（auth）

```bash
echo "🔐 認証デバッグ情報"
echo "===================="

# JWT設定確認
echo -e "\nJWT Configuration:"
pnpm supabase inspect auth

# 認証プロバイダー確認
echo -e "\nAuth Providers:"
curl -s http://localhost:54321/auth/v1/settings | jq '.'

# セッション情報
echo -e "\nActive Sessions:"
# Supabase Studioでの確認を推奨
echo "👉 詳細はSupabase Studio (http://localhost:54323) で確認してください"
echo "   Authentication > Users セクションを参照"
```

### データベースデバッグ（db）

```bash
echo "💾 データベースデバッグ情報"
echo "=========================="

# 接続情報
echo -e "\nConnection String:"
echo "postgresql://postgres:postgres@localhost:54322/postgres"

# テーブル一覧
echo -e "\nTables:"
pnpm supabase db remote list-tables

# RLSポリシー確認
echo -e "\nRLS Policies:"
psql postgresql://postgres:postgres@localhost:54322/postgres -c "
  SELECT schemaname, tablename, policyname, permissive, cmd, qual
  FROM pg_policies
  WHERE schemaname = 'public'
  LIMIT 10;
"

# インデックス情報
echo -e "\nIndexes:"
psql postgresql://postgres:postgres@localhost:54322/postgres -c "
  SELECT tablename, indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
  LIMIT 10;
"

# 現在の接続数
echo -e "\nActive Connections:"
psql postgresql://postgres:postgres@localhost:54322/postgres -c "
  SELECT count(*) as connection_count
  FROM pg_stat_activity
  WHERE state = 'active';
"
```

### リアルタイムデバッグ（realtime）

```bash
echo "⚡ リアルタイムデバッグ情報"
echo "=========================="

# Realtime設定確認
echo -e "\nRealtime Configuration:"
curl -s http://localhost:54321/realtime/v1/ | jq '.'

# Publication確認
echo -e "\nPublications:"
psql postgresql://postgres:postgres@localhost:54322/postgres -c "
  SELECT * FROM pg_publication;
"

# Replication Slots
echo -e "\nReplication Slots:"
psql postgresql://postgres:postgres@localhost:54322/postgres -c "
  SELECT slot_name, plugin, slot_type, active
  FROM pg_replication_slots;
"

# WebSocketステータス
echo -e "\nWebSocket Status:"
curl -s http://localhost:54321/realtime/v1/websocket | head -1
```

## エラー別対処法

### 「Supabase is not running」エラー

```bash
# Supabaseを起動
pnpm supabase:start

# 起動確認
pnpm supabase status
```

### 「Connection refused」エラー

```bash
# Dockerが起動しているか確認
docker info

# Dockerを起動（Mac）
open -a Docker

# Supabaseコンテナを再起動
pnpm supabase:stop
pnpm supabase:start
```

### 「RLS policy violation」エラー

```bash
# RLSポリシーを一時的に無効化（開発時のみ）
psql $DATABASE_URL -c "ALTER TABLE your_table DISABLE ROW LEVEL SECURITY;"

# ポリシーを確認
psql $DATABASE_URL -c "SELECT * FROM pg_policies WHERE tablename = 'your_table';"
```

## 出力例

```
🔍 Supabaseデバッグ情報を収集しています...
==========================================

📊 Supabase Status:
Supabase URL: http://localhost:54321
Supabase Anon Key: eyJ...
Database URL: postgresql://postgres:postgres@localhost:54322/postgres

🔐 環境変数:
NEXT_PUBLIC_SUPABASE_URL=<REDACTED>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<REDACTED>

🐳 Docker Containers:
CONTAINER ID   IMAGE                    STATUS
abc123def456   supabase/postgres:15     Up 10 minutes
789ghi012jkl   supabase/studio:latest   Up 10 minutes

🔌 Port Status:
✅ Port 54321: In use
✅ Port 54322: In use
✅ Port 54323: In use

🔗 Connection Tests:
✅ http://localhost:54321/rest/v1/: OK (HTTP 200)
✅ http://localhost:54323/: OK (HTTP 302)

==========================================
デバッグ情報の収集が完了しました
```

## 関連コマンド

- `/supabase-setup` - Supabase環境のセットアップ
- `/migration-check` - 移行状態の確認
