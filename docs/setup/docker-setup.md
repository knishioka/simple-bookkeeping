# Docker環境セットアップガイド（ローカル開発用）

## 概要

このプロジェクトはDocker Composeを使用してコンテナ環境で動作します。ポートの競合を避けるため、環境変数による柔軟な設定が可能です。

> ⚠️ **重要**: このDocker設定はローカル開発専用です。本番環境へのデプロイには[Render.com](https://render.com)を使用してください。詳細は[デプロイメントガイド](./deployment-guide.md)を参照してください。

## 必要な環境

- Docker Desktop (Docker Engine 20.10以上)
- Docker Compose v2

## セットアップ手順

### 1. 環境変数の準備

```bash
# ローカル開発用の設定ファイルをコピー
cp .env.docker .env

# 必要に応じてポート番号を変更
# API_PORT=3001 (デフォルト)
# WEB_PORT=3000 (デフォルト)
```

### 2. ポート戦略

デフォルトでは以下のポートを使用します：

- **Web (Next.js)**: 3000番ポート（ローカル実行）
- **PostgreSQL**: 5432番ポート

ポートが競合する場合は、`.env`ファイルで変更できます：

```bash
# .env
DB_PORT=5433  # 5432が使用中の場合
```

### 3. データベースの起動

```bash
# PostgreSQLコンテナの起動
docker-compose up -d

# Webアプリケーションの起動（別ターミナルで）
pnpm dev
```

### 4. データベースの初期化

```bash
# マイグレーション実行
pnpm --filter @simple-bookkeeping/database db:migrate

# シードデータの投入
pnpm --filter @simple-bookkeeping/database db:seed
```

## 開発環境での使用

### ホットリロード

開発環境では、ソースコードの変更が自動的に反映されます：

```bash
# データベースコンテナを起動
docker-compose up -d

# アプリケーションを開発モードで起動
pnpm dev
```

### ログの確認

```bash
# PostgreSQLのログ
docker-compose logs -f postgres

# アプリケーションのログはターミナルに直接表示されます
```

### PostgreSQLコンテナへのアクセス

```bash
# PostgreSQLコンテナ
docker-compose exec postgres psql -U postgres -d simple_bookkeeping
```

## トラブルシューティング

### ポートが既に使用されている場合

```bash
# 使用中のポートを確認
lsof -i :5432

# .envファイルでポートを変更
echo "DB_PORT=5433" >> .env

# コンテナを再起動
docker-compose down
docker-compose up -d
```

### データベース接続エラー

```bash
# PostgreSQLの状態確認
docker-compose ps postgres
docker-compose logs postgres

# データベースの再作成
docker-compose down -v  # ボリュームも削除
docker-compose up -d
```

### ビルドエラー

```bash
# キャッシュをクリアして再ビルド
docker-compose build --no-cache

# 全てをクリーンアップ
docker-compose down -v
docker system prune -a
docker-compose up -d --build
```

## セキュリティ上の注意

1. **PostgreSQLポートの非公開**: データベースは内部ネットワークのみでアクセス可能
2. **環境変数の管理**: `.env`ファイルはGitにコミットしない
3. **ローカル開発用**: 開発用の認証情報を使用

## 本番環境へのデプロイ

> 🚨 **重要**: Docker構成はローカル開発専用です。本番環境には使用しないでください。

本番環境へのデプロイには以下の方法を推奨します：

1. **Render.com** - APIサーバーとPostgreSQLデータベース
2. **Vercel** - Next.jsフロントエンド

詳細な手順は以下のドキュメントを参照してください：

- [デプロイメントガイド](./deployment-guide.md)
- [クイックデプロイガイド](./quick-deploy-guide.md)
- [Render移行ガイド](./render-migration-guide.md)

4. データベースのバックアップ設定
