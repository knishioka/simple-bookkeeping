# デプロイメントトラブルシューティングガイド

このガイドでは、Vercel（フロントエンド）とRender（バックエンド）へのデプロイ時によく発生する問題と解決方法をまとめています。

## 目次

1. [Vercel特有の問題](#vercel特有の問題)
2. [Render特有の問題](#render特有の問題)
3. [共通の問題](#共通の問題)
4. [データベース関連](#データベース関連)
5. [環境変数関連](#環境変数関連)

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

## Render特有の問題

### 1. Node.js型定義エラー

**エラー**:

```
Cannot find type definition file for 'node'
Cannot find name 'global'
```

**解決方法**:

```yaml
# render.yaml
buildCommand: pnpm install --prod=false && ...
```

### 2. Prismaクライアント生成エラー

**エラー**:

```
Cannot find module '.prisma/client'
```

**解決方法**: buildCommandに必ず含める

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

### 3. CORS エラー

**症状**: フロントエンドからAPIにアクセスできない

**解決方法**:

```typescript
// apps/api/src/index.ts
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);
```

## データベース関連

### 1. マイグレーションが実行されない

**解決方法**:

```bash
# Render のビルドコマンドに追加
pnpm --filter @simple-bookkeeping/database prisma:migrate:deploy
```

### 2. 接続エラー

**確認事項**:

- DATABASE_URLが正しく設定されている
- SSL設定が適切（`?sslmode=require`）
- ファイアウォール/IP制限の確認

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

# Render
render logs $SERVICE_ID
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

**Render**:

- ダッシュボードから以前のデプロイメントを選択して"Deploy"

### 2. 環境変数の一時的な上書き

```bash
# Vercel
vercel env add VARIABLE_NAME

# Render
render env set VARIABLE_NAME=value
```

### 3. ビルドキャッシュのクリア

**Vercel**: ダッシュボードから"Redeploy"時に"Use existing Build Cache"のチェックを外す

**Render**: 新しいコミットをプッシュするか、手動デプロイ

## サポート

問題が解決しない場合は、以下を確認してください：

1. [Vercel ドキュメント](https://vercel.com/docs)
2. [Render ドキュメント](https://render.com/docs)
3. プロジェクトのIssueトラッカー
