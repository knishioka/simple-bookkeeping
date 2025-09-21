# Docker環境セットアップガイド（ローカル開発用）

## 概要

このプロジェクトはSupabaseのDocker Composeを使用してローカル開発環境を構築します。Supabaseは認証、データベース、リアルタイム機能を提供する統合プラットフォームです。

> ⚠️ **重要**: このDocker設定はローカル開発専用です。本番環境へのデプロイには[Vercel](https://vercel.com)を使用してください。詳細は[デプロイメントガイド](./deployment-guide.md)を参照してください。

## 必要な環境

- Docker Desktop (Docker Engine 20.10以上)
- Docker Compose v2
- Supabase CLI (pnpm経由でインストール済み)

## セットアップ手順

### 1. 環境変数の準備

```bash
# ローカル開発用の設定ファイルをコピー
cp .env.local.example .env.local

# Supabase URLとキーは自動的に設定されます
# NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
# NEXT_PUBLIC_SUPABASE_ANON_KEY=（自動生成）
```

### 2. ポート戦略

デフォルトでは以下のポートを使用します：

- **Web (Next.js)**: 3000番ポート
- **Supabase Studio**: 54321番ポート
- **Supabase API**: 54322番ポート
- **PostgreSQL**: 54323番ポート（Supabase内部）
- **Supabase Auth**: 54324番ポート

ポートが競合する場合は、`supabase/config.toml`で変更できます。

### 3. Supabaseの起動

```bash
# Supabase CLIを使用（推奨）
pnpm supabase:start

# またはDocker Composeを直接使用
pnpm supabase:docker

# Webアプリケーションの起動（別ターミナルで）
pnpm dev
```

### 4. データベースの初期化

```bash
# マイグレーション実行
pnpm db:migrate

# シードデータの投入
pnpm db:seed

# Supabase Studioで確認
open http://localhost:54321
```

## 開発環境での使用

### ホットリロード

開発環境では、ソースコードの変更が自動的に反映されます：

```bash
# Supabaseを起動
pnpm supabase:start

# アプリケーションを開発モードで起動
pnpm dev

# Server Actionsの変更も自動反映されます
```

### ログの確認

```bash
# Supabaseのログ
pnpm supabase:logs

# 特定サービスのログ（Docker使用時）
docker logs supabase-db -f
docker logs supabase-auth -f

# アプリケーションのログはターミナルに直接表示されます
```

### PostgreSQLへのアクセス

```bash
# Supabase経由でアクセス
pnpm supabase db

# またはpsqlで直接接続
psql postgresql://postgres:postgres@localhost:54323/postgres
```

## トラブルシューティング

### ポートが既に使用されている場合

```bash
# 使用中のポートを確認
lsof -i :54321  # Supabase Studio
lsof -i :54322  # Supabase API
lsof -i :54323  # PostgreSQL

# Supabaseを停止して再起動
pnpm supabase:stop
pnpm supabase:start
```

### データベース接続エラー

```bash
# Supabaseの状態確認
pnpm supabase:status

# データベースの再作成
pnpm supabase:stop
pnpm supabase:reset  # データベースをリセット
pnpm supabase:start
```

### ビルドエラー

```bash
# Supabaseのクリーンアップ
pnpm supabase:stop
pnpm supabase:clean  # ボリューム削除

# Docker全体のクリーンアップ（必要な場合）
docker system prune -a

# 再起動
pnpm supabase:start
```

## セキュリティ上の注意

1. **Supabaseキーの管理**: 匿名キーとサービスロールキーを適切に管理
2. **環境変数の管理**: `.env.local`ファイルはGitにコミットしない
3. **Row Level Security**: データベースアクセスはRLSポリシーで制御
4. **ローカル開発用**: 開発用の認証情報を使用

## 本番環境へのデプロイ

> 🚨 **重要**: ローカルSupabase構成は開発専用です。本番環境には使用しないでください。

本番環境へのデプロイには以下の方法を推奨します：

1. **Vercel** - Next.jsアプリケーション（Server Actions含む）
2. **Supabase Cloud** - 本番用データベースと認証サービス

詳細な手順は以下のドキュメントを参照してください：

- [デプロイメントガイド](./deployment-guide.md)
- [クイックデプロイガイド](./quick-deploy-guide.md)
- [Render移行ガイド](./render-migration-guide.md)

4. データベースのバックアップ設定
