# 環境変数ガイド

このドキュメントでは、Simple Bookkeepingプロジェクトで使用する環境変数について詳しく説明します。

## 目次

- [クイックスタート](#クイックスタート)
- [環境変数ファイルの使い分け](#環境変数ファイルの使い分け)
- [必須環境変数](#必須環境変数)
- [オプション環境変数](#オプション環境変数)
- [環境別の設定例](#環境別の設定例)
- [トラブルシューティング](#トラブルシューティング)
- [セキュリティ](#セキュリティ)

## クイックスタート

### 1. 環境変数ファイルのセットアップ

```bash
# .env.exampleをコピーして.env.localを作成
cp .env.example .env.local

# .env.localを編集して必要な値を設定
# 特に重要な設定:
# - DATABASE_URL: データベース接続文字列
# - NEXT_PUBLIC_API_URL: APIのベースURL（必ず/api/v1を含める）
```

### 2. 環境変数の確認

```bash
# APIサーバー側の環境変数確認
cd apps/api && node -e "console.log('DATABASE_URL:', process.env.DATABASE_URL)"

# フロントエンド側の環境変数確認
cd apps/web && node -e "console.log('API_URL:', process.env.NEXT_PUBLIC_API_URL)"

# 環境変数のバリデーション（実装後）
pnpm env:validate
```

## 環境変数ファイルの使い分け

| ファイル名         | 用途               | Git管理 | 優先度   | 説明                                   |
| ------------------ | ------------------ | ------- | -------- | -------------------------------------- |
| `.env.example`     | サンプル設定       | ✅      | -        | すべての環境変数のテンプレートと説明   |
| `.env`             | 共通のデフォルト値 | ❌      | 低       | すべての環境で共通のデフォルト値       |
| `.env.local`       | ローカル開発用     | ❌      | **最高** | 個人のローカル開発環境の設定           |
| `.env.development` | 開発環境用         | ✅      | 中       | 開発環境共通の設定                     |
| `.env.production`  | 本番環境用         | ❌      | 中       | 本番環境の設定（絶対にコミットしない） |
| `.env.test`        | テスト用           | ✅      | 中       | テスト実行時の設定                     |

### 環境変数の優先順位（Next.js）

1. `process.env`に直接設定された値
2. `.env.$(NODE_ENV).local`（例: `.env.production.local`）
3. `.env.local`（本番環境では読み込まれない）
4. `.env.$(NODE_ENV)`（例: `.env.production`）
5. `.env`

## 必須環境変数

### データベース設定

#### `DATABASE_URL`

- **説明**: PostgreSQLデータベースへの接続文字列
- **形式**: `postgresql://[user]:[password]@[host]:[port]/[database]?schema=[schema]`
- **例**:

  ```
  # ローカル開発（Docker使用）
  DATABASE_URL="postgresql://bookkeeping:bookkeeping@localhost:5432/simple_bookkeeping?schema=public"

  # 本番環境
  DATABASE_URL="postgresql://prod_user:secure_password@db.example.com:5432/prod_db?schema=public"
  ```

### APIサーバー設定

#### `API_PORT` （削除済み）

Express.js APIの廃止により、この環境変数は不要になりました。

#### `JWT_SECRET`

- **説明**: JWT署名用の秘密鍵
- **重要**: 本番環境では必ず変更する
- **生成方法**: `openssl rand -base64 32`
- **最小長**: 32文字

#### `JWT_REFRESH_SECRET`

- **説明**: リフレッシュトークン用の秘密鍵
- **重要**: `JWT_SECRET`とは異なる値を設定
- **生成方法**: `openssl rand -base64 32`

### フロントエンド設定

#### `NEXT_PUBLIC_API_URL` （削除済み）

Express.js APIの廃止により、この環境変数は不要になりました。
API機能はNext.jsのServer Actionsで提供されます。

## オプション環境変数

### Node.js環境設定

#### `NODE_ENV`

- **説明**: アプリケーションの実行環境
- **値**: `development` | `production` | `test`
- **デフォルト**: `development`

#### `LOG_LEVEL`

- **説明**: ログ出力レベル
- **値**: `debug` | `info` | `warn` | `error`
- **デフォルト**: `info`

### セキュリティ設定

#### `CORS_ORIGIN`

- **説明**: CORS許可オリジン
- **形式**: カンマ区切りで複数指定可能
- **例**: `"http://localhost:3000,https://app.example.com"`

#### `JWT_EXPIRES_IN`

- **説明**: アクセストークンの有効期限
- **デフォルト**: `7d`
- **形式**: 数値 + 単位（s, m, h, d）

#### `JWT_REFRESH_EXPIRES_IN`

- **説明**: リフレッシュトークンの有効期限
- **デフォルト**: `30d`

### キャッシュ設定

#### `REDIS_URL`

- **説明**: Redis接続URL（キャッシュ機能使用時）
- **形式**: `redis://[user]:[password]@[host]:[port]/[database]`
- **例**: `redis://localhost:6379`

### デプロイメント監視

#### `VERCEL_TOKEN`

- **説明**: Vercel APIアクセストークン
- **用途**: デプロイメント状態の確認
- **取得**: https://vercel.com/account/tokens

#### `RENDER_API_KEY`

- **説明**: Render APIキー
- **用途**: デプロイメント状態の確認
- **取得**: https://dashboard.render.com/u/settings

## 環境別の設定例

### ローカル開発環境（.env.local）

```bash
# データベース（ローカルDocker）
DATABASE_URL="postgresql://bookkeeping:bookkeeping@localhost:5432/simple_bookkeeping?schema=public"

# API設定
API_PORT=3001
NODE_ENV=development
JWT_SECRET=local-dev-secret-key
JWT_REFRESH_SECRET=local-dev-refresh-secret
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=debug

# フロントエンド
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 開発ツール
ENABLE_SWAGGER=true
```

### テスト環境（.env.test）

```bash
# テスト用データベース（インメモリまたはテスト専用DB）
DATABASE_URL="postgresql://test:test@localhost:5432/test_db?schema=public"

# テスト用設定
NODE_ENV=test
JWT_SECRET=test-secret
JWT_REFRESH_SECRET=test-refresh-secret
LOG_LEVEL=error

# API URL
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

### 本番環境（.env.production）

```bash
# 本番データベース（実際の値は環境に応じて設定）
DATABASE_URL="postgresql://prod_user:${DB_PASSWORD}@prod-db.example.com:5432/production_db?schema=public"

# セキュリティ設定
NODE_ENV=production
JWT_SECRET=${JWT_SECRET_PROD}  # 環境変数から取得
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET_PROD}
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=https://app.example.com
LOG_LEVEL=warn

# 本番API
NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
NEXT_PUBLIC_APP_URL=https://app.example.com

# 本番では無効化
ENABLE_SWAGGER=false
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. APIへの接続ができない

**症状**: フロントエンドからAPIにリクエストを送信するとエラーになる

**確認事項**:

- `NEXT_PUBLIC_API_URL`が正しく設定されているか
- URLに`/api/v1`が含まれているか
- APIサーバーが起動しているか（`pnpm --filter api dev`）
- CORSの設定が正しいか

```bash
# 確認コマンド
echo $NEXT_PUBLIC_API_URL  # http://localhost:3001/api/v1 と表示されるべき
curl $NEXT_PUBLIC_API_URL/health  # APIのヘルスチェック
```

#### 2. データベース接続エラー

**症状**: `PrismaClientInitializationError`などのエラー

**確認事項**:

- PostgreSQLが起動しているか
- `DATABASE_URL`の形式が正しいか
- データベースが存在するか
- ユーザー権限が適切か

```bash
# PostgreSQL接続テスト
psql $DATABASE_URL -c "SELECT 1"

# Prismaの接続テスト
pnpm --filter database prisma db push --skip-generate
```

#### 3. JWT認証エラー

**症状**: ログインはできるが、その後のリクエストが401エラー

**確認事項**:

- `JWT_SECRET`が設定されているか
- APIとフロントエンドで同じ`JWT_SECRET`を使用しているか
- トークンの有効期限が切れていないか

#### 4. 環境変数が読み込まれない

**症状**: `undefined`が返される

**確認事項**:

- ファイル名が正しいか（`.env.local`など）
- Next.jsの場合、`NEXT_PUBLIC_`プレフィックスが付いているか
- サーバーを再起動したか
- `.env.local`が`.gitignore`に含まれているか（セキュリティ）

```bash
# 環境変数の確認
pnpm env:validate  # バリデーションスクリプト実行
```

## セキュリティ

### 環境変数のベストプラクティス

1. **機密情報の管理**
   - `.env.local`と`.env.production`は絶対にGitにコミットしない
   - `.gitignore`に必ず含める
   - 機密情報は環境変数管理サービス（Vercel、Render等）で設定

2. **秘密鍵の生成**

   ```bash
   # 安全なランダム文字列の生成
   openssl rand -base64 32

   # または
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

3. **アクセス制限**
   - 本番環境の環境変数は必要最小限の人のみアクセス可能にする
   - 定期的に秘密鍵をローテーションする

4. **環境変数の分離**
   - 開発環境と本番環境で異なる値を使用
   - テスト環境では専用のダミー値を使用

### 環境変数のチェックリスト

- [ ] `.env.local`を作成した
- [ ] `DATABASE_URL`を正しく設定した
- [ ] `NEXT_PUBLIC_API_URL`に`/api/v1`を含めた
- [ ] JWT秘密鍵を安全な値に変更した
- [ ] `.env.local`が`.gitignore`に含まれている
- [ ] 本番環境用の環境変数を別途管理している
- [ ] CORSの設定が適切である
- [ ] ログレベルが環境に応じて設定されている

## 関連ドキュメント

- [README.md](../README.md) - プロジェクトの概要
- [CLAUDE.md](../CLAUDE.md) - 開発ガイドライン
- [deployment/detailed-guide.md](./deployment/detailed-guide.md) - デプロイメントガイド
- [npm-scripts-guide.md](./npm-scripts-guide.md) - npmスクリプトガイド
