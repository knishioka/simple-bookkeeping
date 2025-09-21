# Supabase環境セットアップ

Simple BookkeepingプロジェクトのSupabase環境をセットアップします。

## 使用方法

```
/supabase-setup [environment]
```

### オプション

- `environment`: セットアップする環境（local/test/production）。デフォルトは `local`

## 説明

このコマンドは、指定された環境に応じてSupabaseの初期設定を行います：

1. **ローカル環境（local）**：
   - Supabase CLIの起動
   - 必要な環境変数の設定
   - データベースマイグレーションの実行
   - 初期データのシード

2. **テスト環境（test）**：
   - Docker Composeでの起動
   - テスト用データベースの準備
   - E2Eテスト用の設定

3. **本番環境（production）**：
   - 環境変数の確認
   - 接続テスト

## 実行内容

### ローカル環境セットアップ

```bash
# Supabase CLIの確認
supabase --version || npm install -g supabase

# 既存のSupabaseプロセスを停止
pnpm supabase:stop 2>/dev/null || true

# Supabaseを起動
pnpm supabase:start

# 起動確認（最大30秒待機）
for i in {1..30}; do
  if curl -s http://localhost:54321/rest/v1/ > /dev/null; then
    echo "✅ Supabaseが正常に起動しました"
    break
  fi
  echo "⏳ Supabaseの起動を待っています... ($i/30)"
  sleep 1
done

# 環境変数の設定
export NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
export NEXT_PUBLIC_SUPABASE_ANON_KEY=$(pnpm supabase status --output json | jq -r '.anon_key')
export SUPABASE_SERVICE_ROLE_KEY=$(pnpm supabase status --output json | jq -r '.service_role_key')

# データベースマイグレーション
pnpm db:migrate

# 初期データのシード
pnpm db:seed

# Studioの起動
echo "📊 Supabase Studioを開いています..."
open http://localhost:54323

echo "🎉 ローカル環境のセットアップが完了しました！"
echo ""
echo "接続情報:"
echo "- API URL: http://localhost:54321"
echo "- Studio URL: http://localhost:54323"
echo ""
echo "開発を開始するには: pnpm dev"
```

### テスト環境セットアップ

```bash
# Docker Composeで起動
pnpm supabase:docker

# データベースリセット
pnpm supabase db reset

# テスト用シードデータ
pnpm db:seed:test

echo "🧪 テスト環境の準備が完了しました"
echo "E2Eテストを実行: pnpm test:e2e"
```

### 本番環境確認

```bash
# 環境変数の確認
required_vars=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
)

echo "🔍 環境変数を確認しています..."
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ $var が設定されていません"
    exit 1
  else
    echo "✅ $var: 設定済み"
  fi
done

# 接続テスト
echo "🔗 Supabaseへの接続をテストしています..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/")
if [ "$response" = "200" ]; then
  echo "✅ Supabaseに正常に接続できました"
else
  echo "❌ Supabaseへの接続に失敗しました (HTTP $response)"
  exit 1
fi

echo "🚀 本番環境の確認が完了しました"
```

## トラブルシューティング

### ポートが既に使用されている場合

```bash
# 既存のSupabaseプロセスを確認
lsof -i :54321
lsof -i :54323

# プロセスを停止
pnpm supabase:stop

# Dockerコンテナを確認
docker ps | grep supabase

# コンテナを停止
docker compose -f docker-compose.supabase.yml down
```

### データベース接続エラー

```bash
# Supabaseのステータス確認
pnpm supabase status

# ログ確認
pnpm supabase db logs

# データベースリセット（注意：データが削除されます）
pnpm supabase db reset
```

## 関連コマンド

- `/supabase-debug` - デバッグ情報の表示
- `/migration-check` - 移行状態の確認
