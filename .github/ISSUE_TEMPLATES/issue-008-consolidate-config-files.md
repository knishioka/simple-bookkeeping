# Cleanup: Consolidate duplicate configuration files

## 🎯 概要

プロジェクト内に複数の重複した設定ファイルが存在し、どのファイルが実際に使用されているか不明確です。ESLint、Playwright、TypeScriptなどの設定ファイルを統合・整理し、保守性を向上させます。

## 🔍 現状の問題点

### 1. 重複した設定ファイル

#### ESLint設定（4箇所）

```
.eslintrc.js              # ルート設定
apps/web/.eslintrc.js     # Web用設定（重複あり）
apps/api/.eslintrc.js     # API用設定（重複あり）
packages/*/.eslintrc.js   # パッケージ個別設定（ほぼ同じ）
```

#### Playwright設定（2箇所）

```
playwright.config.ts           # メイン設定
playwright.config.optimized.ts # 最適化版（使用されていない？）
```

#### TypeScript設定（多数）

```
tsconfig.json              # ルート設定
tsconfig.base.json         # ベース設定
apps/*/tsconfig.json       # アプリ個別設定
packages/*/tsconfig.json   # パッケージ個別設定
```

### 2. 設定の不整合

- 同じルールが異なる値で定義されている
- 一部の設定ファイルが更新されていない
- 継承関係が複雑で理解しづらい

### 3. メンテナンスの問題

- ルール変更時に複数ファイルの更新が必要
- どの設定が優先されるか不明確
- 新規開発者が混乱する

## 💡 推奨される解決策

### 1. ESLint設定の統合

```javascript
// .eslintrc.base.js（ルート）
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  rules: {
    // 共通ルール
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
};

// apps/web/.eslintrc.js
module.exports = {
  extends: ['../../.eslintrc.base.js', 'next/core-web-vitals'],
  rules: {
    // Next.js特有のルール
    'react/react-in-jsx-scope': 'off',
  },
};

// apps/api/.eslintrc.js
module.exports = {
  extends: ['../../.eslintrc.base.js'],
  rules: {
    // Express特有のルール
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
```

### 2. Playwright設定の統一

```typescript
// playwright.config.ts（単一ファイル）
import { defineConfig, devices } from '@playwright/test';

const baseConfig = {
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
};

export default defineConfig({
  ...baseConfig,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // 必要に応じて他のブラウザ
  ],
});

// playwright.config.optimized.ts を削除
```

### 3. TypeScript設定の階層化

```json
// tsconfig.base.json（共通設定）
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}

// tsconfig.json（ルート）
{
  "extends": "./tsconfig.base.json",
  "references": [
    { "path": "./apps/web" },
    { "path": "./apps/api" },
    { "path": "./packages/database" },
    { "path": "./packages/types" }
  ],
  "files": [],
  "include": [],
  "exclude": ["node_modules"]
}

// apps/web/tsconfig.json（Next.js用）
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

### 4. その他の設定ファイル統合

```yaml
# .prettierrc.yml（単一ファイル）
printWidth: 100
tabWidth: 2
semi: true
singleQuote: true
trailingComma: 'es5'
bracketSpacing: true
arrowParens: 'always'
# 各ディレクトリの.prettierrcを削除
```

## 📋 アクセプタンスクライテリア

- [ ] ESLint設定が階層化され、重複が排除されている
- [ ] Playwright設定が単一ファイルに統合されている
- [ ] TypeScript設定が明確な継承関係を持っている
- [ ] 不要な設定ファイルが削除されている
- [ ] 全てのlint/型チェックが正常に動作する
- [ ] IDE（VSCode）の設定が正しく認識される
- [ ] ドキュメントに設定構造が記載されている

## 🏗️ 実装ステップ

1. **現状分析**（0.5日）
   - 各設定ファイルの使用状況確認
   - 設定値の差分分析
   - 継承関係の把握

2. **設計**（0.5日）
   - 新しい設定構造の設計
   - 継承関係の定義
   - 移行計画の作成

3. **ESLint統合**（1日）
   - ベース設定の作成
   - アプリ別設定の作成
   - 古い設定の削除

4. **TypeScript設定整理**（1日）
   - tsconfig.base.jsonの作成
   - Project Referencesの設定
   - パスマッピングの統一

5. **その他の設定統合**（0.5日）
   - Prettier設定の統一
   - Jest設定の統合
   - その他ツール設定の整理

6. **検証と文書化**（0.5日）
   - 全ツールの動作確認
   - VSCode設定の確認
   - ドキュメント作成

## ⏱️ 見積もり工数

- **総工数**: 4人日
- **優先度**: Low 🟢
- **影響度**: 開発効率とメンテナンス性

## 🏷️ ラベル

- `cleanup`
- `configuration`
- `low-priority`
- `developer-experience`

## 📊 成功指標

- 設定ファイル数: 50%削減
- 設定更新時の作業量: 70%削減
- 新規開発者のセットアップ時間: 30%短縮
- 設定の不整合: 0件

## ⚠️ リスクと考慮事項

- **IDE設定への影響**: VSCodeなどのIDEが設定を正しく認識しない可能性
- **ビルドプロセスへの影響**: 設定変更によりビルドが失敗する可能性
- **CI/CDパイプライン**: 設定パスの変更に対応が必要
- **開発者への周知**: 新しい設定構造の説明が必要

## 🗂️ 推奨ディレクトリ構造

```
.
├── .eslintrc.base.js         # ESLint共通設定
├── .prettierrc.yml           # Prettier設定（単一）
├── tsconfig.base.json        # TypeScript共通設定
├── tsconfig.json             # ルート設定（references）
├── jest.config.base.js       # Jest共通設定
├── apps/
│   ├── web/
│   │   ├── .eslintrc.js     # Next.js用拡張
│   │   ├── tsconfig.json    # Next.js用TypeScript
│   │   └── jest.config.js   # Next.js用Jest
│   └── api/
│       ├── .eslintrc.js     # Express用拡張
│       ├── tsconfig.json    # Node.js用TypeScript
│       └── jest.config.js   # API用Jest
└── packages/
    └── */
        └── tsconfig.json     # パッケージ用TypeScript
```

## 📝 VSCode設定の推奨

```json
// .vscode/settings.json
{
  "eslint.workingDirectories": [{ "mode": "auto" }],
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## 📚 参考資料

- [ESLint Configuration](https://eslint.org/docs/user-guide/configuring/)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [Monorepo Configuration Best Practices](https://monorepo.tools/)
- [Prettier Configuration](https://prettier.io/docs/en/configuration.html)
