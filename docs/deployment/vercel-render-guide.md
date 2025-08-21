# Vercel/Renderデプロイメントガイド

本プロジェクトはRender（APIサーバー）とVercel（Webアプリ）の両方にデプロイできるよう設計されています。

## 🚀 クイックデプロイ

### Vercel（Webアプリ）

- mainブランチへのpushで自動デプロイ
- 設定ファイル: `apps/web/vercel.json`

### Render（APIサーバー）

- mainブランチへのpushで自動デプロイ
- 設定ファイル: `render.yaml`

## 📦 ビルド設定

### package.jsonのスクリプト

```json
// ルートのpackage.json
{
  "scripts": {
    "build": "turbo run build",
    "build:packages": "turbo run build --filter='./packages/*'",
    "build:apps": "turbo run build --filter='./apps/*'",
    "build:web": "pnpm --filter @simple-bookkeeping/database prisma:generate && pnpm build:packages && pnpm --filter @simple-bookkeeping/web build"
  }
}
```

### 環境変数の分離

```bash
# Render用（APIサーバー）
DATABASE_URL=postgresql://...
JWT_SECRET=...
NODE_ENV=production
PORT=3001

# Vercel用（Webアプリ）
NEXT_PUBLIC_API_URL=https://your-api.onrender.com
```

## 🔧 プラットフォーム別設定

### Vercel設定（apps/web/vercel.json）

```json
{
  "buildCommand": "cd ../.. && pnpm build:web",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile --prod=false"
}
```

### Render設定（render.yaml）

```yaml
services:
  - type: web
    name: simple-bookkeeping-api
    runtime: node
    plan: free
    buildCommand: pnpm install --prod=false && cd packages/database && npx prisma generate && cd ../.. && pnpm --filter @simple-bookkeeping/api build
    startCommand: cd apps/api && node dist/index.js
```

## ⚠️ よくある問題と解決策

### Vercel特有の問題

#### TypeScriptコンパイルエラー

```bash
# ❌ エラーが発生する設定
"installCommand": "pnpm install --frozen-lockfile"

# ✅ 解決策：devDependenciesも含める
"installCommand": "pnpm install --frozen-lockfile --prod=false"
```

#### Prismaクライアント生成エラー

```bash
# ✅ buildCommandに必ず含める
pnpm --filter @simple-bookkeeping/database prisma:generate
```

### Render特有の問題

#### Node.js型定義エラー

```bash
# ✅ 解決策：devDependenciesもインストール
buildCommand: pnpm install --prod=false && ...
```

## 📊 デプロイメント監視

```bash
# 両プラットフォームの状態を一度に確認
pnpm deploy:check

# Renderの状態確認
pnpm render:status
pnpm render:logs runtime

# Vercelの状態確認
pnpm vercel:status
pnpm vercel:logs build
```

## ✅ デプロイ前のチェックリスト

- [ ] ローカルで`pnpm build`が成功する
- [ ] 環境変数が各プラットフォームに設定されている
- [ ] データベースマイグレーションが完了している
- [ ] CORSの設定が正しい（APIサーバー）
- [ ] APIのURLが正しく設定されている（Webアプリ）
- [ ] TypeScriptのdevDependenciesが本番でも利用可能（`--prod=false`）
- [ ] Vercelの場合、apps/web/vercel.jsonが存在する
- [ ] Prismaクライアント生成がbuildCommandに含まれている

## 関連ドキュメント

- [詳細デプロイメントガイド](./detailed-guide.md)
- [トラブルシューティング](./troubleshooting.md)
- [環境変数ガイド](../ENVIRONMENT_VARIABLES.md)
