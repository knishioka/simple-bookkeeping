# デプロイメント - 学んだ教訓

このドキュメントは、VercelとRenderへのデプロイメント時に遭遇した問題と解決策をまとめたものです。

## 🎯 概要

- **Web（フロントエンド）**: Vercelにデプロイ
- **API（バックエンド）**: Renderにデプロイ
- **データベース**: Render PostgreSQL

## 🔧 Vercelデプロイメントの教訓

### 1. buildCommandの文字数制限

**問題**:

```
The `vercel.json` schema validation failed with the following message:
`buildCommand` should NOT be longer than 256 characters
```

**原因**:
Vercelのスキーマ検証で、buildCommandは256文字以内でなければならない。

**解決策**:

1. ルートの`package.json`に短縮スクリプトを作成：

```json
{
  "scripts": {
    "build:web": "pnpm --filter @simple-bookkeeping/database prisma:generate && pnpm build:packages && pnpm --filter @simple-bookkeeping/web build"
  }
}
```

2. `apps/web/vercel.json`で短縮コマンドを使用：

```json
{
  "buildCommand": "cd ../.. && pnpm build:web",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile --prod=false"
}
```

### 2. モノレポ構造での設定

**重要なポイント**:

- ルートの`vercel.json`はGitデプロイメント設定のみに使用
- 実際のビルド設定は`apps/web/vercel.json`に配置
- buildCommandは必ず`cd ../..`でモノレポルートに移動

### 3. devDependenciesの問題

**問題**: TypeScriptがプロダクションビルドで見つからない

**解決策**:

```json
"installCommand": "cd ../.. && pnpm install --frozen-lockfile --prod=false"
```

## 🔧 Renderデプロイメントの教訓

### 1. Node.js型定義エラー

**問題**:

```
error TS2688: Cannot find type definition file for 'node'.
error TS2304: Cannot find name 'global'.
error TS2580: Cannot find name 'process'.
error TS2584: Cannot find name 'console'.
```

**原因**:

- `@types/node`がdevDependenciesにあり、本番ビルドでインストールされない
- tsconfig.jsonで`"types": ["node"]`を明示的に指定していた

**解決策**:

1. **render.yamlでdevDependenciesもインストール**:

```yaml
buildCommand: pnpm install --prod=false && ...
```

2. **tsconfig.jsonから`"types": ["node"]`を削除**:

```json
{
  "compilerOptions": {
    // "types": ["node"] を削除
    // TypeScriptが自動的に@types/nodeを検出
  }
}
```

### 2. seed.tsの配置場所

**問題**: seed.tsが`src`ディレクトリにあるとビルドエラー

**解決策**:

```bash
# 正しい配置
packages/database/prisma/seed.ts

# package.jsonのseedスクリプト
"db:seed": "tsx prisma/seed.ts"
```

### 3. Prismaクライアントの生成

**重要**: buildCommandに必ず含める

```yaml
buildCommand: pnpm install --prod=false && cd packages/database && npx prisma generate && cd ../.. && ...
```

### 4. Render CLIを使用したデプロイモニタリング

**学んだこと**:

1. **サービスIDの管理**:
   - サービスIDをハードコードせず、`.render/services.json`で管理
   - `.render/`ディレクトリは`.gitignore`に追加
   - テンプレート（`.render/services.json.example`）を提供

2. **デプロイステータスの監視**:

   ```bash
   # デプロイステータスの種類
   - build_in_progress / update_in_progress: ビルド中
   - live: 稼働中
   - deactivated: 非アクティブ
   - build_failed / deploy_failed: 失敗
   - canceled: キャンセル
   ```

3. **便利なスクリプト作成**:
   - `scripts/render-status.sh`で包括的なステータスチェック
   - npmスクリプトでアクセスを簡易化
   - ヘルスチェックも含めた総合的な確認

## 📋 デプロイ前チェックリスト

### 共通

- [ ] ローカルで`pnpm build`が成功する
- [ ] `pnpm typecheck`でエラーがない
- [ ] `pnpm lint`でエラーがない
- [ ] 環境変数が正しく設定されている

### Vercel固有

- [ ] `apps/web/vercel.json`が存在する
- [ ] buildCommandが256文字以内
- [ ] outputDirectoryが相対パス（`.next`）
- [ ] `NEXT_PUBLIC_API_URL`が設定されている

### Render固有

- [ ] `render.yaml`で`--prod=false`を指定
- [ ] seed.tsがprismaディレクトリにある
- [ ] データベース接続がfromDatabaseで設定されている
- [ ] CORSのoriginが正しく設定されている
- [ ] Render CLIで前回のデプロイが成功していることを確認
- [ ] `.render/services.json`にサービスIDが設定されている

## 🚀 デプロイコマンド

### Vercel

```bash
# プレビューデプロイ
vercel

# 本番デプロイ
vercel --prod

# ログ確認
vercel logs
```

### Render

- GitHub連携で自動デプロイ
- render.yamlの設定に従って自動ビルド

#### Render CLIでのデプロイ確認

```bash
# 初回セットアップ
brew install render
render login

# デプロイ状況確認
pnpm render:status

# 詳細なデプロイ履歴
SERVICE_ID=$(cat .render/services.json | jq -r '.services.api.id')
render deploys list $SERVICE_ID -o json | jq -r '.[:10][] | "\(.createdAt) - \(.status) - \(.commit.message // "No message" | split("\n")[0])"'
```

## 💡 ベストプラクティス

1. **段階的デプロイ**
   - まずローカルでプロダクションビルドを確認
   - プレビュー環境でテスト
   - 本番環境にデプロイ

2. **エラー対応**
   - ビルドログを詳細に確認
   - ローカルで同じコマンドを実行して再現
   - 環境変数の違いに注意

3. **モノレポの注意点**
   - 依存関係の順序を意識（packages → apps）
   - workspace:\*の解決に注意
   - 共有パッケージのビルドを忘れない

## 📚 参考リンク

- [Vercel Monorepo Guide](https://vercel.com/docs/monorepos)
- [Render Node.js Deploy Guide](https://render.com/docs/deploy-node-express-app)
- [pnpm Workspace](https://pnpm.io/workspaces)
