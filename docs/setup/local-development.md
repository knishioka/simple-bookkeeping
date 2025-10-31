# 💻 ローカル開発環境セットアップ

Supabaseを使用したローカル開発環境の構築方法を説明します。

## 📋 前提条件

- **Node.js** 18.0.0以上
- **pnpm** 8.0.0以上
- **Supabase CLI** または **Docker**
- **Git**

## 🔧 セットアップ手順

### 1. Supabase CLIのインストール

#### macOS (Homebrew)

```bash
brew install supabase/tap/supabase
```

#### npm/pnpm

```bash
pnpm install -g supabase
```

### 2. Supabaseの起動

```bash
# Supabaseローカル開発環境を起動
supabase start

# またはDocker Composeを使用
pnpm supabase:docker
```

### 3. プロジェクトのセットアップ

```bash
# リポジトリのクローン
git clone https://github.com/knishioka/simple-bookkeeping.git
cd simple-bookkeeping

# 依存関係のインストール
pnpm install

# direnv/環境変数の初期化
direnv allow  # 初回のみ

mkdir -p env/secrets
cp env/templates/common.env.example env/secrets/common.env
cp env/templates/supabase.local.env.example env/secrets/supabase.local.env
cp env/templates/vercel.env.example env/secrets/vercel.env
scripts/env-manager.sh switch local
# または
# scripts/env-manager.sh bootstrap && scripts/env-manager.sh switch local
```

### 4. 環境変数の設定

`env/secrets/supabase.local.env` を編集して、Supabase接続情報を設定：

```bash
# Supabase接続設定（ローカル開発用）
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# データベース接続（Prisma用）
SUPABASE_DB_URL=postgresql://postgres:postgres@localhost:54322/postgres?schema=public

# direnv が SUPABASE_DB_URL を DATABASE_URL として自動エクスポートします
```

### 5. データベースの初期化

```bash
# Prismaクライアントの生成
pnpm --filter @simple-bookkeeping/database prisma:generate

# マイグレーションの実行
pnpm db:migrate

# 初期データの投入
pnpm db:seed

# パッケージのビルド
pnpm build:packages
```

### 6. 開発サーバーの起動

```bash
# Supabaseが起動していることを確認
supabase status

# Next.js開発サーバーを起動
pnpm dev

# または個別に起動
pnpm --filter @simple-bookkeeping/web dev    # Webアプリ
```

## 🗂️ データベース管理

### Prisma Studio

データベースの内容を視覚的に確認・編集：

```bash
pnpm db:studio
```

### マイグレーション

```bash
# マイグレーションの実行
pnpm db:migrate

# マイグレーションの作成（スキーマ変更時）
pnpm db:migrate:dev

# データベースのリセット（開発環境のみ）
pnpm db:reset
```

## 🧪 テスト環境

### E2Eテスト用の設定

```bash
# テスト用環境変数ファイル作成
cp .env.test.local.example .env.test.local

# テスト用データベースのセットアップ
NODE_ENV=test pnpm db:reset
```

## 🔍 動作確認

### 疎通確認

```bash
# Webアプリの確認
curl -I http://localhost:3000

# Supabaseの確認
curl http://localhost:54321/health
```

### デフォルト認証情報

```
Email: admin@example.com
Password: password123
```

## ⚠️ 注意事項

1. **ポート競合**: デフォルトポート(3000)が使用中の場合は、`env/secrets/common.env` の `WEB_PORT` を変更
2. **データベース接続**: Supabaseが起動していることを確認
3. **環境変数**: Supabase関連の環境変数を正しく設定

## 📚 関連ドキュメント

- [環境変数ガイド](../ENVIRONMENT_VARIABLES.md)
- [トラブルシューティング](./troubleshooting.md)
- [npmスクリプトガイド](../npm-scripts-guide.md)
