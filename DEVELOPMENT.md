# 開発環境セットアップガイド

このガイドでは、Simple Bookkeepingプロジェクトのローカル開発環境をセットアップする方法を説明します。

## 目次

- [必要条件](#必要条件)
- [クイックスタート](#クイックスタート)
- [詳細セットアップ](#詳細セットアップ)
  - [Dockerを使用したセットアップ](#dockerを使用したセットアップ)
  - [Dockerを使用しないセットアップ](#dockerを使用しないセットアップ)
- [環境変数の設定](#環境変数の設定)
- [データベースのセットアップ](#データベースのセットアップ)
- [開発サーバーの起動](#開発サーバーの起動)
- [認証フローについて](#認証フローについて)
- [テストの実行](#テストの実行)
- [トラブルシューティング](#トラブルシューティング)
- [よくある質問](#よくある質問)

## 必要条件

以下のツールがインストールされている必要があります：

- **Node.js** 18.0.0以上
- **pnpm** 8.0.0以上
- **PostgreSQL** 15以上（Dockerを使用しない場合）
- **Docker & Docker Compose**（推奨、オプション）

### ツールのインストール

```bash
# Node.jsのインストール（asdfを使用）
asdf install nodejs 18.17.0
asdf global nodejs 18.17.0

# pnpmのインストール
npm install -g pnpm

# Dockerのインストール（macOS）
brew install --cask docker
```

## クイックスタート

最も簡単にセットアップを完了するには、以下のコマンドを実行します：

```bash
# リポジトリのクローン
git clone https://github.com/your-org/simple-bookkeeping.git
cd simple-bookkeeping

# セットアップスクリプトの実行
chmod +x scripts/setup-local.sh
./scripts/setup-local.sh

# 開発サーバーの起動
pnpm dev
```

セットアップスクリプトは以下を自動的に行います：

- 依存関係のインストール
- 環境変数ファイルの作成
- データベースのセットアップ（Dockerを使用する場合）
- データベースマイグレーションの実行
- 初期データのシード

## 詳細セットアップ

### Dockerを使用したセットアップ

Docker Composeを使用すると、PostgreSQLを含むすべての依存サービスを簡単に起動できます。

1. **環境変数ファイルの準備**

   ```bash
   cp .env.example .env
   ```

2. **Dockerコンテナの起動**

   ```bash
   # 開発用Docker Compose設定を使用
   docker compose -f docker compose.local.yml up -d
   ```

3. **データベースの初期化**

   ```bash
   # コンテナが起動するまで待機
   sleep 10

   # マイグレーションの実行
   pnpm db:migrate

   # 初期データのシード
   pnpm db:seed
   ```

4. **開発サーバーの起動**
   ```bash
   pnpm dev
   ```

### Dockerを使用しないセットアップ

1. **PostgreSQLのインストールと起動**

   ```bash
   # macOS (Homebrew)
   brew install postgresql@15
   brew services start postgresql@15

   # Ubuntu/Debian
   sudo apt-get install postgresql-15
   sudo systemctl start postgresql
   ```

2. **データベースの作成**

   ```bash
   createdb simple_bookkeeping
   createuser -P bookkeeping  # パスワードを設定
   ```

3. **環境変数の設定**

   ```bash
   cp .env.example .env
   # .envファイルを編集してDATABASE_URLを更新
   # DATABASE_URL="postgresql://bookkeeping:your-password@localhost:5432/simple_bookkeeping?schema=public"
   ```

4. **依存関係のインストールとセットアップ**

   ```bash
   pnpm install
   pnpm db:migrate
   pnpm db:seed
   pnpm build:packages
   ```

5. **開発サーバーの起動**
   ```bash
   pnpm dev
   ```

## 環境変数の設定

### 重要な環境変数

プロジェクトでは以下の環境変数を使用します：

#### データベース関連

```bash
# PostgreSQL接続文字列
DATABASE_URL="postgresql://bookkeeping:bookkeeping@localhost:5432/simple_bookkeeping?schema=public"
```

#### API関連

```bash
# APIサーバーのポート
API_PORT=3001

# JWT設定（本番環境では必ず変更してください）
JWT_SECRET=local-dev-secret-change-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=local-dev-refresh-secret-change-in-production
JWT_REFRESH_EXPIRES_IN=30d

# CORS設定
CORS_ORIGIN=http://localhost:3000
```

#### フロントエンド関連

```bash
# APIのURL（重要：/api/v1を含む完全なパスを指定）
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

### 環境変数ファイルの使い分け

- `.env` - ローカル開発環境の設定
- `.env.local` - ローカル環境固有の設定（Gitで無視される）
- `.env.example` - 環境変数のテンプレート（リポジトリに含まれる）

## データベースのセットアップ

### マイグレーション

```bash
# マイグレーションの実行
pnpm db:migrate

# マイグレーションの作成（スキーマ変更時）
pnpm db:migrate:dev
```

### シードデータ

```bash
# 初期データの投入
pnpm db:seed

# データベースのリセット（開発環境のみ）
pnpm db:reset
```

### Prisma Studio

データベースの内容を視覚的に確認・編集できます：

```bash
pnpm db:studio
```

## 開発サーバーの起動

### すべてのサービスを起動

```bash
# APIとWebアプリを同時に起動
pnpm dev
```

### 個別にサービスを起動

```bash
# Webアプリのみ
pnpm --filter @simple-bookkeeping/web dev

# APIサーバーのみ
pnpm --filter @simple-bookkeeping/api dev
```

### Dockerで起動

```bash
# すべてのサービスをDockerで起動
docker compose -f docker compose.local.yml up

# バックグラウンドで起動
docker compose -f docker compose.local.yml up -d

# ログの確認
docker compose -f docker compose.local.yml logs -f
```

## 認証フローについて

### デフォルトの認証情報

開発環境では以下のアカウントが利用可能です：

```
Email: admin@example.com
Password: password123
```

### 認証フローの動作

1. **ログイン処理**
   - `/api/v1/auth/login`にPOSTリクエスト
   - JWTトークンとリフレッシュトークンを受け取る
   - トークンはlocalStorageに保存

2. **認証状態の維持**
   - APIリクエスト時に自動的にAuthorizationヘッダーを付与
   - トークンの有効期限が切れた場合は自動的にリフレッシュ

3. **ログアウト処理**
   - `/api/v1/auth/logout`にPOSTリクエスト
   - localStorageからトークンを削除

### ローカル環境での注意点

- CORSが正しく設定されていることを確認（`CORS_ORIGIN`環境変数）
- `NEXT_PUBLIC_API_URL`に完全なパス（`/api/v1`を含む）を設定

## テストの実行

### 単体テスト

```bash
# すべてのテストを実行
pnpm test

# 特定のパッケージのテスト
pnpm --filter @simple-bookkeeping/api test

# ウォッチモード
pnpm test:watch

# カバレッジ付き
pnpm test:coverage
```

### E2Eテスト

```bash
# Playwrightのインストール（初回のみ）
pnpm playwright install

# E2Eテストの実行
pnpm test:e2e

# UIモードで実行（デバッグ用）
pnpm test:e2e:ui

# 特定のテストファイルのみ実行
pnpm test:e2e basic.spec.ts
```

### E2Eテストのローカル環境対応

E2Eテストをローカル環境で実行する際の注意点：

1. **環境変数の設定**

   ```bash
   # .env.test.local
   NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
   ```

2. **テストデータの準備**

   ```bash
   # テスト用データベースのセットアップ
   NODE_ENV=test pnpm db:reset
   ```

3. **並列実行の無効化**（必要に応じて）
   ```bash
   # playwright.config.tsで workers: 1 に設定
   ```

## トラブルシューティング

### よくある問題と解決方法

#### 1. データベース接続エラー

**エラー**: `Can't reach database server at 'localhost:5432'`

**解決方法**:

```bash
# PostgreSQLが起動しているか確認
docker compose -f docker compose.local.yml ps

# または
pg_isready -h localhost -p 5432

# 再起動
docker compose -f docker compose.local.yml restart postgres
```

#### 2. 認証エラー（401 Unauthorized）

**原因**: JWTトークンが無効または期限切れ

**解決方法**:

```bash
# localStorageをクリア（ブラウザのコンソールで実行）
localStorage.clear()

# 再度ログイン
```

#### 3. CORS エラー

**エラー**: `Access to fetch at 'http://localhost:3001' from origin 'http://localhost:3000' has been blocked by CORS policy`

**解決方法**:

```bash
# .envファイルでCORS_ORIGINを確認
CORS_ORIGIN=http://localhost:3000

# APIサーバーを再起動
```

#### 4. Prisma クライアントエラー

**エラー**: `Cannot find module '.prisma/client'`

**解決方法**:

```bash
# Prismaクライアントを再生成
pnpm --filter @simple-bookkeeping/database prisma:generate
```

#### 5. ポート競合

**エラー**: `Error: listen EADDRINUSE: address already in use :::3000`

**解決方法**:

```bash
# 使用中のポートを確認
lsof -i :3000
lsof -i :3001

# プロセスを終了
kill -9 <PID>

# または環境変数でポートを変更
WEB_PORT=3002 API_PORT=3003 pnpm dev
```

### ログの確認

#### アプリケーションログ

```bash
# APIサーバーのログ
tail -f apps/api/logs/combined.log

# エラーログのみ
tail -f apps/api/logs/error.log
```

#### Dockerログ

```bash
# すべてのサービスのログ
docker compose -f docker compose.local.yml logs -f

# 特定のサービスのログ
docker compose -f docker compose.local.yml logs -f api
docker compose -f docker compose.local.yml logs -f postgres
```

## よくある質問

### Q: 本番環境との違いは？

A: ローカル開発環境では以下の点が異なります：

- JWT_SECRETなどのセキュリティ設定が開発用の値
- データベースのパスワードが簡易的
- ホットリロードが有効
- デバッグログが詳細

### Q: データベースをリセットしたい

A: 以下のコマンドでリセットできます：

```bash
# Dockerを使用している場合
docker compose -f docker compose.local.yml down -v
docker compose -f docker compose.local.yml up -d
pnpm db:migrate
pnpm db:seed

# Dockerを使用していない場合
pnpm db:reset
```

### Q: 新しい機能を開発する際の流れは？

A: 以下の手順を推奨します：

1. 新しいブランチを作成
2. 必要に応じてデータベーススキーマを変更
3. マイグレーションを作成・実行
4. APIエンドポイントを実装
5. フロントエンドを実装
6. テストを作成
7. ローカルで動作確認

### Q: VSCodeの推奨設定は？

A: プロジェクトルートに`.vscode/settings.json`を作成：

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

## 関連ドキュメント

- [CLAUDE.md](./CLAUDE.md) - AIコーディングガイドライン
- [npm-scripts-guide.md](./docs/npm-scripts-guide.md) - 利用可能なnpmスクリプト一覧
- [SYSTEM-ARCHITECTURE.md](./SYSTEM-ARCHITECTURE.md) - システムアーキテクチャ
- [e2e-test-implementation.md](./docs/e2e-test-implementation.md) - E2Eテストの実装ガイド

## サポート

問題が解決しない場合は、以下の方法でサポートを受けてください：

1. GitHubのIssueを作成
2. プロジェクトのSlackチャンネルで質問
3. ドキュメントの改善提案をPull Requestで送信
