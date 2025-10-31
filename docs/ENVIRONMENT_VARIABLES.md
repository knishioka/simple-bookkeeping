# 環境変数設定ガイド

このドキュメントは、Simple Bookkeepingプロジェクトで使用される環境変数について説明します。

## 🎯 環境別設定表

| 環境   | プロファイルファイル                     | 選択方法                              | Supabase URL                      |
| ------ | ---------------------------------------- | ------------------------------------- | --------------------------------- |
| 開発   | `env/secrets/supabase.local.env`         | `scripts/env-manager.sh switch local` | http://localhost:54321            |
| テスト | `.env.test`                              | Playwright / CI が直接読み込み        | http://localhost:54321            |
| 本番   | `env/secrets/supabase.prod.env` (direnv) | `scripts/env-manager.sh switch prod`  | https://[project-ref].supabase.co |
| 本番   | Vercel Environment Variables             | Vercel Dashboard                      | https://[project-ref].supabase.co |

`scripts/env-manager.sh` が `.env.local` を該当プロファイルへシンボリックリンクします。  
direnv は `env/secrets/common.env` → `.env.local` → `env/secrets/vercel.env` の順に読み込み、CLI と Next.js へ環境変数を提供します。

## 🔑 必須環境変数（Supabase）

### 1. Supabase接続設定

```bash
# Supabase API URL（必須）
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321

# Supabase Anonymous Key（必須）
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Supabase Service Role Key（サーバーサイドのみ・必須）
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 2. データベース接続

```bash
# PostgreSQL接続URL（Prisma用）
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# ダイレクト接続URL（マイグレーション用）
DIRECT_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

## 📦 開発プロファイル（`env/secrets/supabase.local.env`）

`env/templates/supabase.local.env.example` をコピーして作成します。

```bash
ENV_PROFILE=local
ENV_SUPABASE=local

NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# (任意) CLI/Prisma 用の直接接続 URL
SUPABASE_DB_URL=postgresql://postgres:postgres@localhost:54322/postgres

LOG_LEVEL=debug
```

## 🪄 共通設定（`env/secrets/common.env`）

非機密なデフォルト値をまとめます。`env/templates/common.env.example` をベースにしてください。

```bash
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
WEB_PORT=3000
API_PORT=3001
ENABLE_SWAGGER=true
LOG_LEVEL=info
```

## 🧪 テスト環境設定（.env.test）

```bash
# ===========================================
# Supabase設定（テスト用）
# ===========================================
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
SUPABASE_SERVICE_ROLE_KEY=test-service-role-key

# ===========================================
# データベース設定（テスト用）
# ===========================================
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/test_db
DIRECT_URL=postgresql://postgres:postgres@localhost:54322/test_db

# ===========================================
# Next.js設定
# ===========================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=test

# ===========================================
# E2Eテスト設定
# ===========================================
TEST_MODE=fast
E2E_TEST_TIMEOUT=30000
```

## 🚀 本番環境設定

### ローカルで本番 Supabase に接続する場合

`env/templates/supabase.prod.env.example` を `env/secrets/supabase.prod.env` にコピーし、本番プロジェクトの値を設定します。  
切り替えは `scripts/env-manager.sh switch prod` を使用します。

```bash
ENV_PROFILE=local-with-production-supabase
ENV_SUPABASE=production

NEXT_PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key
```

### Vercelデプロイ時の設定

Vercel Dashboard > Settings > Environment Variables で以下を設定：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]?pgbouncer=true
DIRECT_URL=postgresql://[user]:[password]@[host]:[port]/[database]
NEXT_PUBLIC_APP_URL=https://simple-bookkeeping.vercel.app
NODE_ENV=production
RATE_LIMIT_ENABLED=true
CORS_ORIGIN=https://simple-bookkeeping.vercel.app
```

## ⚠️ 廃止済み環境変数（削除予定）

以下の環境変数は**Express.js API削除**に伴い廃止されました：

## 🔧 環境変数の取得方法

### ローカル開発環境

```bash
# Supabase CLIを起動
pnpm supabase:start

# 環境変数を取得
pnpm supabase status

# 出力された値を env/secrets/supabase.local.env に設定
# API URL: http://localhost:54321
# anon key: eyJ...
# service_role key: eyJ...
```

### 本番環境

1. [Supabase Dashboard](https://app.supabase.com)にログイン
2. プロジェクトを選択
3. Settings > API から以下を取得：
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

## 🛡️ セキュリティ注意事項

### 絶対に公開してはいけない環境変数

- `SUPABASE_SERVICE_ROLE_KEY` - **最重要機密**
- `DATABASE_URL` - データベース接続情報
- `DIRECT_URL` - ダイレクト接続情報

### クライアントサイドで使用可能

- `NEXT_PUBLIC_*` プレフィックスがついた環境変数のみ
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

## 📝 環境変数チェックリスト

開発開始前に以下を確認：

- [ ] `.env.local`ファイルが存在する
- [ ] Supabase関連の環境変数がすべて設定されている
- [ ] `pnpm supabase:start`でローカルSupabaseが起動している
- [ ] `DATABASE_URL`が正しく設定されている
- [ ] 廃止済み環境変数（JWT_SECRET等）を使用していない

## 🐛 トラブルシューティング

### Supabase接続エラー

```bash
# 環境変数の確認
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# Supabaseステータス確認
pnpm supabase status

# 接続テスト
curl http://localhost:54321/rest/v1/
```

### データベース接続エラー

```bash
# PostgreSQL接続テスト
psql $DATABASE_URL -c "SELECT 1"

# Prismaスキーマ検証
pnpm db:generate
```

### 環境変数が読み込まれない

```bash
# .env.localの確認
cat .env.local

# Next.jsの再起動
pnpm dev

# キャッシュクリア
rm -rf .next
pnpm dev
```

## 🔗 関連ドキュメント

- [Supabaseガイドライン](./ai-guide/supabase-guidelines.md)
- [CLAUDE.md](../CLAUDE.md)
- [デプロイメントガイド](./deployment/README.md)

---

_最終更新: 2025年9月_
