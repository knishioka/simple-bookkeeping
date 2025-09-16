# 🔧 トラブルシューティングガイド

開発環境で発生する一般的な問題と解決方法をまとめています。

## 🗄️ データベース関連

### 接続エラー

**エラー**: `Can't reach database server at 'localhost:5432'`

**解決方法**:

```bash
# PostgreSQLが起動しているか確認
pg_isready -h localhost -p 5432

# Dockerを使用している場合
docker compose ps
docker compose restart postgres

# ローカルインストールの場合（macOS）
brew services restart postgresql@15

# ローカルインストールの場合（Ubuntu/Debian）
sudo systemctl restart postgresql
```

### Prismaクライアントエラー

**エラー**: `Cannot find module '.prisma/client'`

**解決方法**:

```bash
# Prismaクライアントを再生成
pnpm --filter @simple-bookkeeping/database prisma:generate

# それでも解決しない場合
rm -rf node_modules/.prisma
pnpm install
pnpm --filter @simple-bookkeeping/database prisma:generate
```

## 🔐 認証関連

### 401 Unauthorized エラー

**原因**: JWTトークンが無効または期限切れ

**解決方法**:

```javascript
// ブラウザのコンソールで実行
localStorage.clear();
// その後、再度ログイン
```

### CORS エラー

**エラー**: `Access to fetch at 'http://localhost:3001' from origin 'http://localhost:3000' has been blocked by CORS policy`

**解決方法**:

```bash
# .envファイルでCORS_ORIGINを確認
CORS_ORIGIN=http://localhost:3000

# APIサーバーを再起動
pnpm --filter @simple-bookkeeping/api dev
```

## 🌐 ポート関連

### ポート競合

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

## 📦 パッケージ関連

### インポートエラー

**エラー**: `Cannot find module '@/...'`

**解決方法**:

```bash
# tsconfig.jsonのパスマッピングを確認
# @/ は src/ ディレクトリを指すはず

# パッケージを再ビルド
pnpm build:packages
```

### 型エラー

**エラー**: `Type 'X' is not assignable to type 'Y'`

**解決方法**:

```bash
# 共通型定義パッケージを確認
pnpm --filter @simple-bookkeeping/types build

# TypeScriptの型チェック
pnpm typecheck
```

## 🧪 テスト関連

### E2Eテストエラー

**エラー**: `Cannot find element`

**解決方法**:

```bash
# UIモードで確認
pnpm --filter web test:e2e:ui

# テストサーバーが起動しているか確認
pnpm dev

# テスト用環境変数を確認
cat .env.test.local
```

### テストデータベースエラー

**解決方法**:

```bash
# テスト用データベースをリセット
NODE_ENV=test pnpm db:reset

# テスト用マイグレーション実行
NODE_ENV=test pnpm db:migrate
```

## 📝 ログの確認方法

### アプリケーションログ

```bash
# APIサーバーのログ
tail -f apps/api/logs/combined.log

# エラーログのみ
tail -f apps/api/logs/error.log
```

### Dockerログ

```bash
# すべてのサービスのログ
docker compose logs -f

# 特定のサービスのログ
docker compose logs -f api
docker compose logs -f postgres
```

## 🔄 リセット手順

### 完全リセット

```bash
# Dockerを使用している場合
docker compose down -v
rm -rf node_modules
pnpm install
docker compose up -d
pnpm db:init

# ローカル環境の場合
dropdb simple_bookkeeping
createdb simple_bookkeeping
rm -rf node_modules
pnpm install
pnpm db:init
```

### キャッシュクリア

```bash
# Next.jsキャッシュ
rm -rf apps/web/.next

# Turboキャッシュ
rm -rf .turbo

# node_modulesとlockファイル
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## 💡 よくある質問

### Q: ビルドが遅い

A: 以下を試してください：

```bash
# Turboキャッシュを活用
pnpm build --filter=@simple-bookkeeping/web --cache

# 並列数を調整
pnpm build --concurrency=2
```

### Q: メモリ不足エラー

A: Node.jsのメモリ制限を増やす：

```bash
NODE_OPTIONS="--max-old-space-size=4096" pnpm build
```

### Q: Windowsでのパス問題

A: WSL2の使用を推奨します。または：

```bash
# Git Bashを使用
# パスセパレータに注意
```

## 🆘 さらなるサポート

上記で解決しない場合：

1. [GitHub Issues](https://github.com/knishioka/simple-bookkeeping/issues)で検索
2. 新しいIssueを作成（エラーログを含める）
3. [開発者向けドキュメント](../CLAUDE.md)を確認
