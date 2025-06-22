# CLI デプロイメントガイド（Vercel + Render）

このガイドでは、Vercel CLIとRenderを使用したデプロイメントの詳細な手順と、実際に遭遇したエラーの解決方法を説明します。

## 📋 目次

- [概要](#概要)
- [CLI ツールのセットアップ](#cli-ツールのセットアップ)
- [Render デプロイメント](#render-デプロイメント)
- [Vercel デプロイメント](#vercel-デプロイメント)
- [よくあるエラーと解決方法](#よくあるエラーと解決方法)
- [デプロイメントのコツ](#デプロイメントのコツ)

## 概要

### アーキテクチャ

```
GitHub Repository
    ├── Vercel (Frontend)
    │   └── apps/web (Next.js)
    └── Render (Backend)
        ├── apps/api (Express.js)
        └── PostgreSQL Database
```

### なぜ Render CLI ではなく render.yaml を使うのか

Render CLIは現在以下の制限があります：

- Blueprint（render.yaml）のデプロイをサポートしていない
- 環境変数の一括設定が困難
- デプロイステータスの確認が限定的

そのため、`render.yaml` + GitHub連携を推奨します。

## CLI ツールのセットアップ

### 1. 必要なツールのインストール

```bash
# Vercel CLI
npm install -g vercel

# pnpm（プロジェクトで使用）
npm install -g pnpm

# Gitleaks（セキュリティチェック）
brew install gitleaks  # macOS
# または
curl -sSfL https://raw.githubusercontent.com/gitleaks/gitleaks/master/scripts/install.sh | sh -s -- -b /usr/local/bin
```

### 2. 認証

```bash
# Vercel
vercel login

# GitHub（Renderとの連携用）
gh auth login  # GitHub CLIを使用する場合
```

## Render デプロイメント

### 1. render.yaml の作成

```yaml
services:
  - type: web
    name: simple-bookkeeping-api
    runtime: node
    plan: free # 無料プランを明示的に指定
    buildCommand: |
      pnpm install && 
      cd packages/database && npx prisma generate && cd ../.. &&
      cd packages/shared && pnpm build && cd ../.. &&
      cd apps/api && pnpm build
    startCommand: cd apps/api && node dist/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: simple-bookkeeping-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: JWT_REFRESH_SECRET
        generateValue: true
      - key: JWT_EXPIRES_IN
        value: 7d
      - key: JWT_REFRESH_EXPIRES_IN
        value: 30d
      - key: CORS_ORIGIN
        value: https://your-app.vercel.app

databases:
  - name: simple-bookkeeping-db
    plan: free
    databaseName: simple_bookkeeping
    user: simple_bookkeeping_user
```

### 2. 重要な設定ポイント

#### ビルドコマンドの順序

```bash
# 正しい順序
1. pnpm install              # 依存関係のインストール
2. prisma generate           # Prismaクライアント生成
3. shared package build      # 共有パッケージのビルド
4. api build                 # APIのビルド
```

#### パッケージ間の依存関係

```json
// apps/api/package.json
{
  "dependencies": {
    // 型定義は本番環境でも必要
    "@types/node": "^20.19.1",
    "@types/express": "^4.17.23",
    "@types/cors": "^2.8.19",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/passport": "^1.0.17",
    "@types/passport-jwt": "^4.0.1",
    // ランタイム依存
    "zod": "^3.25.67" // devDependenciesではなくdependenciesに
  }
}
```

### 3. デプロイ手順

```bash
# 1. コミット前の確認
gitleaks detect --source . --verbose

# 2. GitHubへプッシュ
git add render.yaml
git commit -m "feat: Add Render deployment configuration"
git push origin main

# 3. Render Dashboardでデプロイ
# - New+ → Blueprint
# - GitHubリポジトリを選択
# - render.yamlが自動検出される
# - Apply
```

### 4. データベース初期化（ローカルから）

Render無料プランではShellアクセスが制限されるため：

```bash
# Render DashboardからDATABASE_URLをコピー
export DATABASE_URL="postgresql://user:pass@host:5432/db?ssl=require"

# ローカルからマイグレーション実行
cd packages/database
npx prisma migrate deploy
npx prisma db seed
```

## Vercel デプロイメント

### 1. プロジェクトリンク

```bash
# プロジェクトルートで実行
vercel link

# 既存プロジェクトがある場合はリセット
rm -rf .vercel
vercel link
```

### 2. 環境変数の設定

```bash
# 既存の環境変数を確認
vercel env ls

# 古い環境変数を削除
echo "y" | vercel env rm API_URL production
echo "y" | vercel env rm NEXT_PUBLIC_API_URL production

# 新しい環境変数を追加
echo "https://simple-bookkeeping-api.onrender.com" | vercel env add API_URL production
echo "https://simple-bookkeeping-api.onrender.com" | vercel env add NEXT_PUBLIC_API_URL production

# 確認
vercel env ls
```

### 3. vercel.json の設定

```json
{
  "buildCommand": "pnpm install && pnpm --filter @simple-bookkeeping/database db:generate && pnpm --filter @simple-bookkeeping/web build",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install",
  "framework": "nextjs"
}
```

### 4. デプロイ

```bash
# GitHubプッシュで自動デプロイ
git push

# または手動デプロイ（非推奨）
vercel --prod
```

## よくあるエラーと解決方法

### 1. TypeScript ビルドエラー

#### エラー: `Cannot find module '@simple-bookkeeping/typescript-config/node.json'`

**原因**: モノレポでのパッケージ参照が本番環境で解決できない

**解決策**:

```json
// tsconfig.json
{
  // ❌ Bad
  "extends": "@simple-bookkeeping/typescript-config/node.json",

  // ✅ Good
  "extends": "../../packages/typescript-config/node.json"
}
```

#### エラー: 型定義が見つからない

**原因**: 型定義がdevDependenciesにある

**解決策**:

```bash
# package.jsonで型定義をdependenciesに移動
"dependencies": {
  "@types/node": "^20.19.1",
  "@types/express": "^4.17.23",
  // その他の@types/*
}
```

### 2. ESモジュールエラー

#### エラー: `ERR_UNSUPPORTED_DIR_IMPORT`

**原因**: ディレクトリインポートがNode.jsでサポートされていない

**解決策**:

```typescript
// packages/shared/src/index.ts

// ❌ Bad（開発時は動くが本番で失敗）
export * from './types';

// ✅ Good
export * from './types/index';

// または、拡張子を明示（ESモジュール）
export * from './types/index.js';
```

### 3. Prisma エラー

#### エラー: `Cannot find module '.prisma/client'`

**解決策**:

```yaml
# render.yaml
buildCommand: |
  pnpm install &&
  cd packages/database && npx prisma generate && cd ../..
```

### 4. pnpm-lock.yaml エラー

#### エラー: `Cannot install with "frozen-lockfile"`

**原因**: lockfileが最新でない

**解決策**:

```bash
# ローカルで依存関係を更新
pnpm install

# コミット&プッシュ
git add pnpm-lock.yaml
git commit -m "fix: Update pnpm-lock.yaml"
git push
```

### 5. Husky エラー（本番環境）

#### エラー: `husky install failed`

**解決策**:

```json
// package.json
{
  "scripts": {
    // ❌ Bad
    "prepare": "husky install",

    // ✅ Good
    "prepare": "if [ \"$NODE_ENV\" != \"production\" ]; then husky install; fi"
  }
}
```

## デプロイメントのコツ

### 1. ローカルでの事前検証

```bash
# Renderと同じビルドプロセスを再現
cd /path/to/project
pnpm install
cd packages/database && npx prisma generate && cd ../..
cd packages/shared && pnpm build && cd ../..
cd apps/api && pnpm build

# 本番モードでテスト
PORT=3003 NODE_ENV=production node apps/api/dist/index.js

# APIテスト
curl http://localhost:3003/api/v1/
```

### 2. 段階的なデバッグ

```bash
# 1. まずsharedパッケージのビルドを確認
cd packages/shared && pnpm build

# 2. ビルド結果を確認
ls -la dist/

# 3. CommonJSフォーマットを確認
cat dist/index.js | head -20
```

### 3. 環境変数の管理

```bash
# .env.example を常に最新に保つ
cp .env .env.example
sed -i 's/=.*/=your_value_here/' .env.example

# Gitleaksで確認
gitleaks detect --source . --verbose
```

### 4. デプロイ前チェックリスト

- [ ] `pnpm build` がローカルで成功する
- [ ] TypeScriptエラーがない（`pnpm typecheck`）
- [ ] ESLintエラーがない（`pnpm lint`）
- [ ] テストが通る（`pnpm test`）
- [ ] 環境変数が正しく設定されている
- [ ] pnpm-lock.yamlが最新
- [ ] 機密情報が含まれていない

### 5. Render無料プランの制限対策

#### スリープモード対策

```bash
# UptimeRobotなどでpingを設定
https://simple-bookkeeping-api.onrender.com/api/v1/health
```

#### データベース90日制限対策

```bash
# 定期バックアップスクリプト
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_$DATE.sql

# cronで毎週実行
0 0 * * 0 /path/to/backup.sh
```

### 6. モニタリング

```bash
# Vercelログ
vercel logs --follow

# APIヘルスチェック
watch -n 60 'curl -s https://simple-bookkeeping-api.onrender.com/api/v1/ | jq'
```

## まとめ

成功のポイント：

1. **型定義をdependenciesに**: 本番環境でも型定義が必要
2. **正しいビルド順序**: 依存関係を考慮した順序でビルド
3. **ESモジュール対応**: インデックスファイルを明示的に指定
4. **ローカルテスト**: デプロイ前に本番環境を再現
5. **段階的デバッグ**: エラーが出たら一つずつ解決

これらのポイントを押さえれば、スムーズにデプロイできます。
