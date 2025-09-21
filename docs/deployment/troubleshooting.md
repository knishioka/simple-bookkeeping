# デプロイメントトラブルシューティングガイド

このガイドでは、Vercelへのデプロイ時によく発生する問題と解決方法をまとめています。

## 目次

1. [Vercel特有の問題](#vercel特有の問題)
2. [共通の問題](#共通の問題)
3. [データベース関連](#データベース関連)
4. [環境変数関連](#環境変数関連)
5. [ローカル開発環境の問題](#ローカル開発環境の問題)
6. [テスト関連の問題](#テスト関連の問題)

## Vercel特有の問題

### 1. TypeScriptコンパイルエラー（`tsc: command not found`）

**エラー**:

```
sh: tsc: command not found
```

**原因**: TypeScriptがdevDependenciesにあるため、本番ビルドで利用できない

**解決方法**:

```json
// vercel.json
{
  "installCommand": "pnpm install --frozen-lockfile --prod=false"
}
```

### 2. outputDirectoryパスエラー

**エラー**:

```
routes-manifest.json not found
```

**原因**: モノレポルートからの相対パスが正しく解決されない

**解決方法**:

```json
// apps/web/vercel.json
{
  "outputDirectory": ".next",
  "buildCommand": "cd ../.. && pnpm build:web"
}
```

### 3. buildCommandの文字数制限

**エラー**:

```
Schema validation error: buildCommand must be shorter than 256 characters
```

**解決方法**: ルートのpackage.jsonにスクリプトを追加

```json
// package.json
{
  "scripts": {
    "build:web": "pnpm --filter @simple-bookkeeping/database prisma:generate && pnpm build:packages && pnpm --filter @simple-bookkeeping/web build"
  }
}
```

**解決方法**: buildCommandに必ず含める

```yaml
buildCommand: pnpm --filter @simple-bookkeeping/database prisma:generate && ...
```

## 共通の問題

### 1. モノレポの依存関係エラー

**エラー**:

```
Cannot resolve workspace:* dependencies
```

**解決方法**:

```bash
pnpm install --shamefully-hoist
```

### 2. TypeScript型定義が見つからない

**エラー**:

```
Cannot find module '@simple-bookkeeping/types'
```

**解決方法**:

```bash
# 全パッケージをビルド
pnpm build:packages
```

### 3. ビルド順序の問題

**エラー**:

```
Module not found: Can't resolve '@simple-bookkeeping/database'
```

**解決方法**: 依存パッケージを先にビルド

```bash
pnpm --filter './packages/*' build
pnpm --filter './apps/*' build
```

## データベース関連

### 1. マイグレーション失敗

**エラー**:

```
P3009: migrate found failed migrations
```

**解決方法**:

```bash
# 失敗したマイグレーションを修復
pnpm --filter @simple-bookkeeping/database prisma migrate resolve --applied "20240101000000_migration_name"
```

### 2. 接続エラー

**エラー**:

```
P1001: Can't reach database server
```

**解決方法**:

1. DATABASE_URLを確認
2. データベースサーバーが起動しているか確認
3. ファイアウォール設定を確認

```bash
# 接続テスト
pnpm --filter @simple-bookkeeping/database prisma db pull --print
```

### 3. スキーマ同期エラー

**エラー**:

```
The database schema is not empty
```

**解決方法**:

```bash
# 既存のスキーマをPrismaに同期
pnpm --filter @simple-bookkeeping/database prisma db pull
pnpm --filter @simple-bookkeeping/database prisma migrate dev --name init
```

## 環境変数関連

### 1. 環境変数が認識されない

**エラー**:

```
Error: SUPABASE_URL is not defined
```

**解決方法**:

```bash
# .env.localから読み込み
source .env.local

# または環境変数を直接設定
export NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

### 2. NEXT*PUBLIC*環境変数が反映されない

**エラー**: フロントエンドでSupabaseクライアントが初期化できない

**解決方法**:

1. 環境変数名が`NEXT_PUBLIC_`で始まることを確認
2. ビルド時に環境変数が設定されていることを確認
3. キャッシュをクリア

```bash
rm -rf .next
pnpm --filter @simple-bookkeeping/web build
```

### 3. Vercel環境変数の設定ミス

**解決方法**:

```bash
# Vercel CLIで確認
vercel env ls

# 環境変数を追加
vercel env add DATABASE_URL
```

## ローカル開発環境の問題

### 1. ポート競合

**エラー**:

```
Error: listen EADDRINUSE: address already in use :::3000
```

**解決方法**:

```bash
# 使用中のプロセスを確認
lsof -i :3000  # Next.js
lsof -i :54321 # Supabase Studio
lsof -i :54322 # Supabase API

# プロセスを終了
kill -9 <PID>

# Supabaseを再起動
pnpm supabase:stop
pnpm supabase:start
```

### 2. pnpm installエラー

**エラー**:

```
ERR_PNPM_PEER_DEP_ISSUES Unmet peer dependencies
```

**解決方法**:

```bash
# peerDependenciesを自動インストール
pnpm install --config.auto-install-peers=true

# またはキャッシュをクリア
pnpm store prune
pnpm install
```

### 3. TypeScriptパスエイリアスエラー

**エラー**:

```
Cannot find module '@/components/Button'
```

**解決方法**: tsconfig.jsonのパスマッピングを確認

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

## テスト関連の問題

### 1. E2Eテストタイムアウト

**エラー**:

```
Timeout of 30000ms exceeded
```

**解決方法**:

```typescript
// playwright.config.ts
export default defineConfig({
  timeout: 60000, // タイムアウトを延長
  use: {
    actionTimeout: 30000,
  },
});
```

### 2. テストデータベース接続エラー

**エラー**:

```
Error: connect ECONNREFUSED 127.0.0.1:54323
```

**解決方法**:

```bash
# Supabaseローカルサービスを起動
pnpm supabase:start

# または環境変数を設定
DATABASE_URL="postgresql://postgres:postgres@localhost:54323/postgres" pnpm test
```

### 3. Playwrightインストールエラー

**エラー**:

```
Executable doesn't exist at /Users/.../chromium
```

**解決方法**:

```bash
# ブラウザをインストール
pnpm --filter @simple-bookkeeping/web exec playwright install
```

### 4. Next.jsビルドエラー（NODE_ENV）

**エラー**:

```
⚠ You are using a non-standard "NODE_ENV" value in your environment
Error: <Html> should not be imported outside of pages/_document
```

**原因**: NODE_ENVが"development"に設定されているとNext.jsのビルドが失敗する場合がある

**解決方法**:

```bash
# NODE_ENVをクリアしてビルド
unset NODE_ENV
pnpm build

# または明示的にproductionを設定
NODE_ENV=production pnpm build
```

### 5. テスト用データベース未起動

**エラー**:

```
PrismaClientInitializationError: User was denied access on the database `(not available)`
```

**原因**: テスト用のSupabaseが起動していない

**解決方法**:

```bash
# Supabaseを起動
pnpm supabase:start

# テストデータベースをリセット
pnpm supabase:reset

# テスト実行
pnpm test
```

## デバッグのコツ

### ログの確認方法

```bash
# Vercelログ
pnpm vercel:logs build   # ビルドログ
pnpm vercel:logs runtime # ランタイムログ

```

### ビルドをローカルで再現

```bash
# Vercel環境を再現
NODE_ENV=production pnpm --filter @simple-bookkeeping/web build

```

### キャッシュのクリア

```bash
# Next.jsキャッシュ
rm -rf .next

# node_modulesとlockファイル
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Prismaキャッシュ
rm -rf node_modules/.prisma
pnpm --filter @simple-bookkeeping/database prisma:generate
```

## 問題が解決しない場合

1. [GitHub Issues](https://github.com/knishioka/simple-bookkeeping/issues)で既存のIssueを検索
2. 新しいIssueを作成（エラーメッセージ、環境、再現手順を含める）
3. [Discord/Slackコミュニティ]（もしあれば）で質問

## 関連ドキュメント

- [デプロイメント詳細ガイド](./detailed-guide.md)
- [スクリプトリファレンス](./scripts-reference.md)
- [環境変数ガイド](../ENVIRONMENT_VARIABLES.md)
- [Docker環境構築](../docker-setup.md)

```bash
pnpm --filter @simple-bookkeeping/database prisma:generate
```

### 3. seed.tsの配置場所

**問題**: seed.tsがsrcディレクトリにあるとビルドエラー

**解決方法**:

```
# 正しい配置
packages/database/prisma/seed.ts
```

## 共通の問題

### 1. モノレポの依存関係エラー

**エラー**:

```
Cannot resolve workspace:* dependencies
```

**解決方法**:

```bash
pnpm install --shamefully-hoist
```

### 2. 型定義が見つからない

**エラー**:

```
Cannot find module '@simple-bookkeeping/types'
```

**解決方法**: 全パッケージをビルド

```bash
pnpm build:packages
```

### 3. Supabase認証エラー

**症状**: Server Actionsで認証エラーが発生

**解決方法**:

```typescript
// app/actions/内のServer Actions
import { createClient } from '@/lib/supabase/server';

export async function myAction() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('認証が必要です');
  }

  // アクションの処理
}
```

## データベース関連

### 1. マイグレーションが実行されない

**解決方法**:

```bash
# Vercel のビルドコマンドに追加
pnpm db:migrate:deploy
```

### 2. Supabase接続エラー

**確認事項**:

- NEXT_PUBLIC_SUPABASE_URLが正しく設定されている
- NEXT_PUBLIC_SUPABASE_ANON_KEYが正しく設定されている
- SUPABASE_SERVICE_ROLE_KEYがサーバーサイドで設定されている

## 環境変数関連

### 1. 環境変数が読み込まれない

**確認事項**:

- プラットフォームのダッシュボードで設定
- 変数名の大文字小文字が一致
- ビルド時と実行時の環境変数の違いを理解

### 2. NEXT*PUBLIC*プレフィックス

**注意**: Next.jsでクライアント側で使用する環境変数は`NEXT_PUBLIC_`プレフィックスが必要

## デバッグのコツ

### 1. ログの確認

```bash
# Vercel
vercel logs
```

### 2. ローカルでプロダクションビルド

```bash
# 本番環境と同じビルドを実行
NODE_ENV=production pnpm build
```

### 3. 段階的なデバッグ

1. まずローカルでプロダクションビルドを確認
2. プレビューデプロイで検証
3. 本番デプロイ

## よくある解決パターン

### パターン1: devDependencies問題

```bash
# インストールコマンドに --prod=false を追加
pnpm install --frozen-lockfile --prod=false
```

### パターン2: ビルド順序問題

```bash
# 共有パッケージを先にビルド
pnpm build:packages && pnpm build:apps
```

### パターン3: パス解決問題

```bash
# モノレポルートに移動してからビルド
cd ../.. && pnpm build
```

## 緊急時の対処

### 1. デプロイのロールバック

**Vercel**:

```bash
vercel rollback
```

### 2. 環境変数の一時的な上書き

```bash
# Vercel
vercel env add VARIABLE_NAME
```

### 3. ビルドキャッシュのクリア

**Vercel**: ダッシュボードから"Redeploy"時に"Use existing Build Cache"のチェックを外す

## サポート

問題が解決しない場合は、以下を確認してください：

1. [Vercel ドキュメント](https://vercel.com/docs)
2. プロジェクトのIssueトラッカー
