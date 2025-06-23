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

### Vercel CLIでのデプロイ確認

**Vercel CLIの特徴：**

- JSON出力オプションがない（表形式のみ）
- `vercel list`でデプロイメント一覧を確認
- `vercel inspect <url>`で詳細確認
- `vercel logs`でビルドログ確認

**Vercel REST APIの活用（推奨）：**

Vercel CLIの制限を回避するため、REST APIを直接使用：

1. **APIトークンの取得**

   ```bash
   # https://vercel.com/account/tokens でトークンを作成
   # .env.localに保存
   VERCEL_TOKEN=your-token-here
   ```

2. **APIエンドポイント**
   - Base URL: `https://api.vercel.com`
   - Deployments: `/v6/deployments`
   - 認証: `Authorization: Bearer <token>`

3. **スクリプトの機能**
   - `scripts/vercel-api-status.sh`
   - JSON形式でデプロイメント情報を取得
   - ステータスによる色分け表示
   - デプロイメント統計の表示
   - Production URLのヘルスチェック

```bash
# API版のVercelデプロイ状況確認
pnpm vercel:api-status

# 両プラットフォームの確認（API版）
pnpm deploy:check
```

**APIの利点：**

- 詳細なデプロイメント情報の取得
- プログラマティックな処理が可能
- CI/CDパイプラインでの活用
- 統計情報の集計

## 🔗 VercelとRenderの連携設定

### CORS設定とAPI URL更新の手順

**問題**: VercelのフロントエンドからRenderのAPIにアクセスする際のCORSエラー

```
Access to fetch at 'https://api-url' from origin 'https://frontend-url' has been blocked by CORS policy
```

### 1. Vercel環境変数の更新（API経由）

**既存のトークンを利用**:

```bash
# macOSの場合、Vercel CLIトークンは以下に保存
TOKEN=$(cat ~/Library/Application\ Support/com.vercel.cli/auth.json | jq -r '.token')
PROJECT_ID=$(cat .vercel/project.json | jq -r '.projectId')
TEAM_ID=$(cat .vercel/project.json | jq -r '.orgId')
```

**環境変数の更新**:

```bash
# 既存の環境変数を削除
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "https://api.vercel.com/v9/projects/$PROJECT_ID/env/<env-id>?teamId=$TEAM_ID"

# 新しい環境変数を追加
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.vercel.com/v10/projects/$PROJECT_ID/env?teamId=$TEAM_ID" \
  -d '{
    "key": "NEXT_PUBLIC_API_URL",
    "value": "https://simple-bookkeeping-api.onrender.com/api/v1",
    "type": "plain",
    "target": ["production"]
  }'
```

### 2. Render CORS設定の更新（API経由）

**Render APIキーの取得**:

```bash
# Render CLIの設定ファイルから取得
API_KEY=$(cat ~/.render/cli.yaml | grep "key:" | awk '{print $2}')
SERVICE_ID=$(cat .render/services.json | jq -r '.services.api.id')
```

**現在の環境変数を取得**:

```bash
curl -s -H "Authorization: Bearer $API_KEY" \
  "https://api.render.com/v1/services/$SERVICE_ID/env-vars" | jq
```

**環境変数の更新（全置換方式）**:

```bash
# 注意: Render APIは全ての環境変数を置き換えるため、
# 既存の環境変数も含めて全て送信する必要がある
curl -X PUT \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  "https://api.render.com/v1/services/$SERVICE_ID/env-vars" \
  -d '[
    {
      "key": "NODE_ENV",
      "value": "production"
    },
    {
      "key": "DATABASE_URL",
      "value": "postgresql://..."
    },
    {
      "key": "CORS_ORIGIN",
      "value": "https://your-app.vercel.app,https://another-url.vercel.app,http://localhost:3000"
    }
    // 他の環境変数も全て含める
  ]'
```

**デプロイのトリガー**:

```bash
# 環境変数の変更は自動デプロイされないため、手動でトリガー
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.render.com/v1/services/$SERVICE_ID/deploys" \
  -d '{"clearCache": "do_not_clear"}'
```

### 3. 循環依存の解決

**問題**: `@simple-bookkeeping/shared`パッケージがPrisma型を再エクスポートしようとしてビルドエラー

```
error TS2307: Cannot find module '@simple-bookkeeping/database' or its corresponding type declarations.
```

**解決策**:

- sharedパッケージからPrisma型の再エクスポートを削除
- 各パッケージで必要なPrisma型は直接`@simple-bookkeeping/database`からインポート

### 4. トラブルシューティングのコツ

**CORSヘッダーの確認**:

```bash
curl -I -X OPTIONS https://your-api.onrender.com/api/v1/auth/login \
  -H "Origin: https://your-frontend.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
```

正常な場合のレスポンス:

```
access-control-allow-origin: https://your-frontend.vercel.app
access-control-allow-methods: GET,HEAD,PUT,PATCH,POST,DELETE
access-control-allow-credentials: true
```

### 5. デプロイ後の確認手順

1. **API側（Render）の確認**:

   ```bash
   pnpm render:status
   # ステータスが"live"になるまで待つ
   ```

2. **Frontend側（Vercel）の確認**:

   ```bash
   pnpm vercel:api-status
   # 最新のProduction URLを確認
   ```

3. **統合テスト**:
   - ブラウザでVercel URLにアクセス
   - ログイン機能をテスト
   - ブラウザの開発者ツールでCORSエラーがないことを確認

### 6. セキュリティ上の注意

- **APIキーの管理**:
  - Render APIキー: `~/.render/cli.yaml`に保存
  - Vercel Token: `~/Library/Application Support/com.vercel.cli/auth.json`に保存
  - これらのファイルは絶対にコミットしない

- **CORS設定**:
  - 本番環境では`*`を使用しない
  - 具体的なドメインを指定する
  - 開発環境用に`http://localhost:3000`も含める

## 📚 参考リンク

- [Vercel Monorepo Guide](https://vercel.com/docs/monorepos)
- [Render Node.js Deploy Guide](https://render.com/docs/deploy-node-express-app)
- [pnpm Workspace](https://pnpm.io/workspaces)
- [Render CLI Documentation](https://render.com/docs/cli)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)
