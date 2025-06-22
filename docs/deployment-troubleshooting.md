# デプロイメント トラブルシューティング

このドキュメントでは、Vercel/Renderデプロイメントで実際に遭遇したエラーとその解決方法を詳しく説明します。

## 🔥 よくあるエラーと解決方法

### 1. TypeScript/Node.js 関連

#### `Cannot find module '@types/xxx'`

**症状**:

```
src/index.ts(1,18): error TS7016: Could not find a declaration file for module 'cors'.
```

**原因**: 型定義がdevDependenciesにあり、本番ビルドで利用できない

**解決方法**:

```json
// apps/api/package.json
{
  "dependencies": {
    // 移動: devDependencies → dependencies
    "@types/node": "^20.19.1",
    "@types/express": "^4.17.23",
    "@types/cors": "^2.8.19",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/passport": "^1.0.17",
    "@types/passport-jwt": "^4.0.1"
  }
}
```

#### `File '@simple-bookkeeping/typescript-config/node.json' not found`

**症状**:

```
tsconfig.json(2,14): error TS6053: File '@simple-bookkeeping/typescript-config/node.json' not found.
```

**原因**: モノレポのパッケージ参照が本番で解決できない

**解決方法**:

```json
// tsconfig.json
{
  // ❌ Bad
  "extends": "@simple-bookkeeping/typescript-config/node.json",

  // ✅ Good - 相対パスを使用
  "extends": "../../packages/typescript-config/node.json"
}
```

#### テストファイルがビルドに含まれる

**症状**:

```
src/utils/__tests__/jwt.test.ts(5,1): error TS2582: Cannot find name 'describe'.
```

**解決方法**:

```json
// tsconfig.json
{
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
    "**/*.spec.ts",
    "src/**/__tests__/**",
    "src/e2e/**"
  ]
}
```

### 2. モジュール解決エラー

#### `ERR_UNSUPPORTED_DIR_IMPORT`

**症状**:

```
Error [ERR_UNSUPPORTED_DIR_IMPORT]: Directory import '/opt/render/project/src/packages/shared/src/types' is not supported
```

**原因**: ES ModulesでのディレクトリインポートがNode.jsでサポートされていない

**解決方法 1** - インデックスファイルを明示:

```typescript
// packages/shared/src/index.ts
// ❌ Bad
export * from './types';

// ✅ Good
export * from './types/index';
```

**解決方法 2** - 拡張子を明示（ESM）:

```typescript
export * from './types/index.js';
```

**解決方法 3** - CommonJSにコンパイル:

```json
// packages/shared/tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022"
  }
}
```

### 3. Prisma 関連

#### `prisma: not found`

**症状**:

```
sh: 1: prisma: not found
```

**原因**: prismaがdevDependenciesにあるか、パスが通っていない

**解決方法**:

```yaml
# render.yaml
buildCommand: |
  pnpm install &&
  cd packages/database && npx prisma generate  # npxを使用
```

#### `Cannot find module '.prisma/client'`

**解決方法**:

```bash
# ビルドコマンドに追加
cd packages/database && npx prisma generate && cd ../..
```

### 4. pnpm 関連

#### `Cannot install with "frozen-lockfile"`

**症状**:

```
ERR_PNPM_OUTDATED_LOCKFILE Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date
```

**原因**: package.jsonとpnpm-lock.yamlが同期していない

**解決方法**:

```bash
# ローカルで更新
pnpm install

# コミット
git add pnpm-lock.yaml
git commit -m "fix: Update pnpm-lock.yaml"
git push
```

### 5. Husky/Git Hooks

#### 本番環境でHuskyがインストールに失敗

**症状**:

```
.git can't be found
```

**解決方法**:

```json
// package.json
{
  "scripts": {
    // 本番環境ではHuskyをスキップ
    "prepare": "if [ \"$NODE_ENV\" != \"production\" ]; then husky install; fi"
  }
}
```

### 6. 共有パッケージのビルドエラー

#### sharedパッケージがビルドされていない

**症状**:

```
Cannot find module '@simple-bookkeeping/shared'
```

**解決方法**:

```yaml
# render.yaml - 正しいビルド順序
buildCommand: |
  pnpm install &&
  cd packages/database && npx prisma generate && cd ../.. &&
  cd packages/shared && pnpm build && cd ../.. &&  # 追加
  cd apps/api && pnpm build
```

## 🛠️ デバッグ手法

### 1. ローカルで本番環境を再現

```bash
# 完全な本番ビルドプロセスを実行
cd /project/root
pnpm install
cd packages/database && npx prisma generate && cd ../..
cd packages/shared && pnpm build && cd ../..
cd apps/api && pnpm build

# 本番モードで起動
NODE_ENV=production PORT=3003 node apps/api/dist/index.js
```

### 2. 段階的ビルド確認

```bash
# Step 1: Prismaクライアント生成
cd packages/database
npx prisma generate
ls -la ../../node_modules/.prisma/client/

# Step 2: Sharedパッケージビルド
cd ../shared
pnpm build
ls -la dist/

# Step 3: APIビルド
cd ../../apps/api
pnpm build
ls -la dist/
```

### 3. 依存関係の確認

```bash
# 実際にインストールされるパッケージを確認
NODE_ENV=production pnpm install --prod
pnpm ls --prod

# 型定義が含まれているか確認
ls node_modules/@types/
```

### 4. ビルド出力の検証

```bash
# CommonJSフォーマットか確認
head -20 packages/shared/dist/index.js

# exportされているものを確認
grep "exports" packages/shared/dist/index.js
```

## 📝 チェックリスト

デプロイ前に必ず確認：

- [ ] **型定義の配置**

  - [ ] 必要な`@types/*`はすべて`dependencies`に移動
  - [ ] `zod`などランタイムで必要なライブラリも`dependencies`に

- [ ] **ビルド設定**

  - [ ] `tsconfig.json`でテストファイルを除外
  - [ ] 相対パスでextendsを指定
  - [ ] CommonJSモジュール形式を使用

- [ ] **パッケージ設定**

  - [ ] sharedパッケージに`build`スクリプトがある
  - [ ] `main`と`types`フィールドが`dist`を指している

- [ ] **ビルドコマンド**

  - [ ] 正しい順序（database → shared → api）
  - [ ] `npx`を使用してPrismaを実行

- [ ] **環境変数**
  - [ ] `NODE_ENV=production`が設定されている
  - [ ] 本番用のprepareスクリプト

## 🎯 ベストプラクティス

### 1. 開発時から本番を意識

```json
// package.json
{
  "scripts": {
    // 本番ビルドをローカルでテスト
    "build:prod": "NODE_ENV=production pnpm build",
    "start:prod": "NODE_ENV=production node dist/index.js"
  }
}
```

### 2. CI/CDでの検証

```yaml
# .github/workflows/check.yml
- name: Production Build Test
  run: |
    NODE_ENV=production pnpm install
    pnpm build

- name: Type Check
  run: pnpm typecheck
```

### 3. エラーログの活用

```bash
# Renderログの詳細確認
# Dashboard → Logs → FilterでError/Warnを確認

# ローカルでの詳細ログ
NODE_ENV=production DEBUG=* node dist/index.js
```

### 4. 段階的デプロイ

1. まずRenderにAPIをデプロイ
2. APIが正常動作することを確認
3. Vercelにフロントエンドをデプロイ
4. 統合テストを実行

これにより、問題の切り分けが容易になります。
