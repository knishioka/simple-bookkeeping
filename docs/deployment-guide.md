# デプロイメントガイド

## 事前準備

### 1. 環境変数の準備
以下の環境変数を設定する必要があります：

#### API側 (.env)
```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_REFRESH_SECRET="your-super-secret-refresh-key"
JWT_EXPIRES_IN="1h"
JWT_REFRESH_EXPIRES_IN="7d"

# API設定
API_PORT=3001
NODE_ENV=production

# CORS設定
CORS_ORIGIN="https://your-frontend-domain.com"
```

#### Frontend側 (.env.local)
```env
# API URL
NEXT_PUBLIC_API_URL="https://your-api-domain.com/api/v1"

# その他の設定
NEXT_PUBLIC_APP_NAME="Simple Bookkeeping"
```

### 2. データベースの準備
```bash
# Prismaマイグレーションの実行
pnpm --filter @simple-bookkeeping/database prisma:migrate:prod

# 初期データの投入（必要に応じて）
pnpm --filter @simple-bookkeeping/database db:seed
```

### 3. ビルドの確認
```bash
# 全体のビルド
pnpm build

# 個別のビルド
pnpm --filter @simple-bookkeeping/web build
pnpm --filter @simple-bookkeeping/api build
```

## デプロイ方法

### 方法1: Vercel + Supabase (推奨)

#### 1. Supabaseのセットアップ
1. [Supabase](https://supabase.com)でアカウント作成
2. 新しいプロジェクトを作成
3. Database URLを取得
4. SQLエディタでスキーマを実行：
```bash
# ローカルでスキーマを生成
pnpm --filter @simple-bookkeeping/database prisma:generate
```

#### 2. バックエンドAPI (Railway.appまたはRender.com)
1. [Railway](https://railway.app)または[Render](https://render.com)でアカウント作成
2. GitHubリポジトリを接続
3. 環境変数を設定
4. ビルドコマンドを設定：
```
cd apps/api && npm install && npm run build
```
5. スタートコマンドを設定：
```
cd apps/api && npm start
```

#### 3. フロントエンド (Vercel)
1. [Vercel](https://vercel.com)でアカウント作成
2. GitHubリポジトリをインポート
3. ビルド設定：
   - Framework Preset: Next.js
   - Root Directory: `apps/web`
   - Build Command: `cd ../.. && pnpm install && pnpm --filter @simple-bookkeeping/web build`
   - Output Directory: `apps/web/.next`
4. 環境変数を設定

### 方法2: VPSへのデプロイ

#### 1. サーバーの準備
```bash
# Ubuntu 22.04 LTSの場合
sudo apt update
sudo apt upgrade -y

# 必要なソフトウェアのインストール
sudo apt install -y nodejs npm nginx postgresql postgresql-contrib
sudo npm install -g pnpm pm2

# Node.jsのバージョン管理（nvm）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

#### 2. PostgreSQLのセットアップ
```bash
# PostgreSQLにログイン
sudo -u postgres psql

# データベースとユーザーの作成
CREATE USER bookkeeping WITH PASSWORD 'your-password';
CREATE DATABASE simple_bookkeeping OWNER bookkeeping;
GRANT ALL PRIVILEGES ON DATABASE simple_bookkeeping TO bookkeeping;
\q
```

#### 3. アプリケーションのデプロイ
```bash
# コードのクローン
git clone https://github.com/your-username/simple-bookkeeping.git
cd simple-bookkeeping

# 依存関係のインストール
pnpm install

# 環境変数の設定
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# 各ファイルを編集して適切な値を設定

# データベースのマイグレーション
pnpm --filter @simple-bookkeeping/database prisma:migrate:prod

# ビルド
pnpm build

# PM2でアプリケーションを起動
pm2 start apps/api/dist/index.js --name bookkeeping-api
pm2 start npm --name bookkeeping-web -- start --prefix apps/web
pm2 save
pm2 startup
```

#### 4. Nginxの設定
```nginx
# /etc/nginx/sites-available/simple-bookkeeping
server {
    listen 80;
    server_name your-domain.com;

    # フロントエンド
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Nginxの設定を有効化
sudo ln -s /etc/nginx/sites-available/simple-bookkeeping /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 5. SSL証明書の設定（Let's Encrypt）
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 方法3: Dockerを使用したデプロイ

#### 1. Docker Composeファイルの修正
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: bookkeeping
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: simple_bookkeeping
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      DATABASE_URL: postgresql://bookkeeping:${DB_PASSWORD}@postgres:5432/simple_bookkeeping
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      NODE_ENV: production
    depends_on:
      - postgres
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: https://api.your-domain.com
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api
      - web
    restart: unless-stopped

volumes:
  postgres_data:
```

#### 2. デプロイコマンド
```bash
# 本番環境用のビルドと起動
docker-compose -f docker-compose.prod.yml up -d

# ログの確認
docker-compose -f docker-compose.prod.yml logs -f

# 再起動
docker-compose -f docker-compose.prod.yml restart
```

## セキュリティ対策

### 1. 環境変数の管理
- 本番環境の環境変数は絶対にGitにコミットしない
- AWS Secrets Manager、HashiCorp Vault等を使用

### 2. ファイアウォールの設定
```bash
# UFWを使用した基本的な設定
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

### 3. 定期的なバックアップ
```bash
# PostgreSQLのバックアップスクリプト
#!/bin/bash
BACKUP_DIR="/backup/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump -U bookkeeping simple_bookkeeping > "$BACKUP_DIR/backup_$TIMESTAMP.sql"

# 古いバックアップの削除（30日以上）
find $BACKUP_DIR -name "backup_*.sql" -mtime +30 -delete
```

### 4. 監視とログ
- PM2のログ監視
- Nginxのアクセスログ
- PostgreSQLのスローログ
- アプリケーションエラーログ

## トラブルシューティング

### 1. ポート競合
```bash
# 使用中のポートを確認
sudo lsof -i :3000
sudo lsof -i :3001
```

### 2. メモリ不足
```bash
# PM2のメモリ制限設定
pm2 start app.js --max-memory-restart 1G
```

### 3. データベース接続エラー
- DATABASE_URLの形式を確認
- PostgreSQLのログを確認
- ファイアウォール設定を確認

## 運用のベストプラクティス

1. **CI/CDの設定**
   - GitHub Actionsでの自動デプロイ
   - テスト自動実行

2. **モニタリング**
   - Datadogやその他のAPMツール
   - エラー監視（Sentry等）

3. **スケーリング**
   - ロードバランサーの設定
   - データベースのレプリケーション

4. **定期メンテナンス**
   - セキュリティアップデート
   - パフォーマンスチューニング