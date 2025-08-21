# 💻 ローカル開発環境セットアップ

Dockerを使用せずに、ローカルマシンに直接開発環境を構築する方法を説明します。

## 📋 前提条件

- **Node.js** 18.0.0以上
- **pnpm** 8.0.0以上
- **PostgreSQL** 15以上
- **Git**

## 🔧 セットアップ手順

### 1. PostgreSQLのインストールと起動

#### macOS (Homebrew)

```bash
brew install postgresql@15
brew services start postgresql@15
```

#### Ubuntu/Debian

```bash
sudo apt-get install postgresql-15
sudo systemctl start postgresql
```

### 2. データベースの作成

```bash
createdb simple_bookkeeping
createuser -P bookkeeping  # パスワードを設定
```

### 3. プロジェクトのセットアップ

```bash
# リポジトリのクローン
git clone https://github.com/knishioka/simple-bookkeeping.git
cd simple-bookkeeping

# 依存関係のインストール
pnpm install

# 環境変数の設定
cp .env.example .env.local
```

### 4. 環境変数の設定

`.env.local`ファイルを編集して、データベース接続情報を更新：

```bash
# PostgreSQL接続文字列
DATABASE_URL="postgresql://bookkeeping:your-password@localhost:5432/simple_bookkeeping?schema=public"

# JWT設定（本番環境では必ず変更してください）
JWT_SECRET=local-dev-secret-change-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=local-dev-refresh-secret-change-in-production
JWT_REFRESH_EXPIRES_IN=30d

# APIサーバー設定
API_PORT=3001
CORS_ORIGIN=http://localhost:3000

# フロントエンド設定（重要：/api/v1を含む完全なパスを指定）
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
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
# すべてのサービスを起動
pnpm dev

# または個別に起動
pnpm --filter @simple-bookkeeping/web dev    # Webアプリ
pnpm --filter @simple-bookkeeping/api dev    # APIサーバー
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
cp .env.example .env.test.local

# テスト用データベースのセットアップ
NODE_ENV=test pnpm db:reset
```

## 🔍 動作確認

### 疎通確認

```bash
# Webアプリの確認
curl -I http://localhost:3000

# APIサーバーの確認
curl http://localhost:3001/api/v1/health
```

### デフォルト認証情報

```
Email: admin@example.com
Password: password123
```

## ⚠️ 注意事項

1. **ポート競合**: デフォルトポート(3000, 3001)が使用中の場合は、環境変数で変更可能
2. **データベース接続**: PostgreSQLが起動していることを確認
3. **環境変数**: `NEXT_PUBLIC_API_URL`には必ず`/api/v1`を含める
4. **CORS設定**: `CORS_ORIGIN`を正しく設定する

## 📚 関連ドキュメント

- [環境変数ガイド](../ENVIRONMENT_VARIABLES.md)
- [トラブルシューティング](./troubleshooting.md)
- [npmスクリプトガイド](../npm-scripts-guide.md)
