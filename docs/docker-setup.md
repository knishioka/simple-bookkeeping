# Docker環境セットアップガイド

## 概要

このプロジェクトはDocker Composeを使用してコンテナ環境で動作します。ポートの競合を避けるため、環境変数による柔軟な設定が可能です。

## 必要な環境

- Docker Desktop (Docker Engine 20.10以上)
- Docker Compose v2

## セットアップ手順

### 1. 環境変数の準備

```bash
# 本番環境用の設定ファイルをコピー
cp .env.docker .env

# 必要に応じてポート番号を変更
# API_PORT=3001 (デフォルト)
# WEB_PORT=3000 (デフォルト)
```

### 2. ポート戦略

デフォルトでは以下のポートを使用します：

- **Web (Next.js)**: 3000番ポート
- **API (Express)**: 3001番ポート
- **PostgreSQL**: 内部ネットワークのみ（外部公開なし）

ポートが競合する場合は、`.env`ファイルで変更できます：

```bash
# .env
WEB_PORT=3010  # 3000が使用中の場合
API_PORT=3011  # 3001が使用中の場合
```

### 3. コンテナの起動

```bash
# プロダクション環境の起動
docker-compose up -d

# 開発環境の起動（ホットリロード有効）
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### 4. データベースの初期化

```bash
# コンテナ内でマイグレーション実行
docker-compose exec api pnpm -F @simple-bookkeeping/database db:migrate

# シードデータの投入
docker-compose exec api pnpm -F @simple-bookkeeping/database db:seed
```

## 開発環境での使用

### ホットリロード

開発環境では、ソースコードの変更が自動的に反映されます：

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### ログの確認

```bash
# 全サービスのログ
docker-compose logs -f

# 特定サービスのログ
docker-compose logs -f api
docker-compose logs -f web
```

### コンテナへのアクセス

```bash
# APIコンテナ
docker-compose exec api sh

# Webコンテナ
docker-compose exec web sh

# PostgreSQLコンテナ
docker-compose exec postgres psql -U postgres -d simple_bookkeeping
```

## トラブルシューティング

### ポートが既に使用されている場合

```bash
# 使用中のポートを確認
lsof -i :3000
lsof -i :3001

# .envファイルでポートを変更
echo "WEB_PORT=3010" >> .env
echo "API_PORT=3011" >> .env

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
3. **本番環境**: JWT_SECRETなどの秘密情報は必ず変更する

## 本番環境へのデプロイ

1. `.env`ファイルの本番用設定
2. `docker-compose.yml`のみを使用（開発用オーバーライドなし）
3. HTTPSプロキシ（nginx等）の設定
4. データベースのバックアップ設定
