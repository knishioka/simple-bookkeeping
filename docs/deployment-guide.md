# デプロイメントガイド

## 事前準備

### 1. 環境変数の準備

以下の環境変数を設定する必要があります：

#### Render APIサービス

```env
# Database (Renderで自動設定)
DATABASE_URL="自動で設定されます"

# JWT (自動生成または手動設定)
JWT_SECRET="render.yamlで自動生成"
JWT_REFRESH_SECRET="render.yamlで自動生成"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"

# API設定
NODE_ENV=production

# CORS設定
CORS_ORIGIN="https://your-vercel-app.vercel.app"
```

#### Vercel Frontend

```env
# API URL
API_URL="https://your-app-api.onrender.com"

# その他の設定
NEXT_PUBLIC_APP_NAME="Simple Bookkeeping"
```

### 2. データベースの準備

Renderデプロイ後、Dashboardのシェルから：

```bash
# Prismaマイグレーションの実行
cd packages/database
pnpm prisma migrate deploy

# 初期データの投入（必要に応じて）
pnpm prisma db seed
```

### 3. ローカルでのビルド確認

```bash
# 全体のビルド
pnpm build

# 個別のビルド
pnpm --filter @simple-bookkeeping/web build
pnpm --filter @simple-bookkeeping/api build
```

**注意**: Renderでは`render.yaml`に定義されたビルドコマンドが自動的に実行されます。

## デプロイ方法

### 方法1: Vercel + Render (推奨)

この方法では、フロントエンドをVercelに、APIサーバーとデータベースをRenderにデプロイします。

#### ステップ1: RenderでのAPIサーバーとデータベースのデプロイ

1. **Renderアカウント作成**

   - [Render.com](https://render.com)でアカウントを作成
   - GitHubアカウントを連携

2. **Blueprintデプロイ**

   - "New +" → "Blueprint" を選択
   - GitHubリポジトリを選択
   - `render.yaml`が自動的に検出される
   - "Apply" をクリック

3. **環境変数の確認**
   - CORS_ORIGINをVercelのURLに更新
   - JWTシークレットが自動生成されていることを確認

#### ステップ2: データベースの初期化

デプロイ完了後、Render Dashboardから：

1. "simple-bookkeeping-api" サービスを選択
2. "Shell" タブを開く
3. 以下のコマンドを実行：

```bash
cd packages/database
pnpm prisma migrate deploy
pnpm prisma db seed
```

#### ステップ3: Vercelでのフロントエンドデプロイ

1. **Vercelアカウント作成**

   - [Vercel.com](https://vercel.com)でアカウントを作成
   - GitHubと連携

2. **プロジェクトインポート**

   - "Import Project" をクリック
   - GitHubリポジトリを選択

3. **ビルド設定**

   - Framework Preset: `Next.js`
   - Root Directory: `apps/web`
   - Build Command: デフォルトのまま
   - Output Directory: デフォルトのまま

4. **環境変数の設定**

   ```
   API_URL=https://simple-bookkeeping-api.onrender.com
   ```

   (RenderのURLに合わせて変更)

5. "Deploy" をクリック

### 方法2: VPSへのデプロイ（上級者向け）

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

### 方法3: ローカル開発用Docker

**重要**: Docker構成はローカル開発専用です。本番環境ではRenderを使用してください。

```bash
# ローカル開発環境の起動
docker-compose up -d

# ログの確認
docker-compose logs -f

# 停止
docker-compose down
```

詳細は[Dockerセットアップガイド](./docker-setup.md)を参照してください。

## セキュリティ対策

### 1. 環境変数の管理

- 本番環境の環境変数は絶対にGitにコミットしない
- Render Dashboardで環境変数を管理
- Vercel Dashboardで環境変数を管理
- Gitleaksを使用したpre-commitフックで機密情報の漏洩を防止

### 2. HTTPSとセキュリティヘッダー

- RenderとVercelではHTTPSが自動的に有効化
- APIサーバーでHelmet.jsを使用してセキュリティヘッダーを設定
- CORS設定で許可されたオリジンのみを指定

### 3. バックアップ戦略

#### Render無料プランの場合

```bash
# Renderシェルから手動バックアップ
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

#### Render有料プランの場合

- 自動バックアップが有効
- ポイントインタイムリカバリも利用可能

### 4. 監視とログ

- Render Dashboard: リアルタイムログとメトリクス
- Vercel Dashboard: 関数の実行ログとパフォーマンス
- エラー監視（Sentry等）の統合を推奨

## トラブルシューティング

### Renderデプロイメントの問題

#### 1. APIサーバーが起動しない

- Render Dashboardでビルドログを確認
- 環境変数が正しく設定されているか確認
- Node.jsバージョンが`render.yaml`で指定されているか確認

#### 2. データベース接続エラー

- DATABASE_URLが自動的に設定されているか確認
- PostgreSQLサービスがActiveか確認
- マイグレーションが実行されているか確認

#### 3. CORSエラー

- CORS_ORIGINがVercelのURLと完全に一致しているか確認
- プロトコル（https://）を含めて設定

### Vercelデプロイメントの問題

#### 1. APIエンドポイントに接続できない

- API_URL環境変数が正しく設定されているか確認
- Render無料プランの場合、スリープからの復帰を待つ

#### 2. ビルドエラー

- pnpmのバージョンを確認
- 依存関係のインストールエラーを確認

## 運用のベストプラクティス

### 1. CI/CDの設定

- GitHubとRender/Vercelの連携による自動デプロイ
- mainブランチへのプッシュで自動デプロイ
- GitHub Actionsでテストを自動実行

### 2. モニタリング

- **Render**: Dashboardでリアルタイムメトリクス
- **Vercel**: Analyticsでパフォーマンス監視
- **エラー監視**: SentryやRollbarを統合
- **アップタイム監視**: UptimeRobotで外部監視

### 3. スケーリング戦略

- **Render**:
  - 水平スケーリング（インスタンス数の調整）
  - 垂直スケーリング（スペックの変更）
- **Vercel**: エッジロケーションで自動スケーリング

### 4. 定期メンテナンス

- 依存関係の更新（`pnpm update`）
- セキュリティパッチの適用
- データベースの最適化
- ログのアーカイブ

### 5. コスト最適化

- Render無料プランからの移行タイミング
- リソース使用量の監視
- 不要なサービスの削除

## 関連ドキュメント

- [クイックデプロイガイド](./quick-deploy-guide.md) - 初心者向け簡易ガイド
- [Render移行ガイド](./render-migration-guide.md) - Renderへの詳細な移行手順
- [Dockerセットアップ](./docker-setup.md) - ローカル開発環境
