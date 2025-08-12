# Refactor: Extract hardcoded values to configuration

## 🎯 概要

コードベース全体に散在するハードコーディングされた値を定数化・設定ファイル化することで、保守性と柔軟性を向上させます。特にポート番号、API URL、タイムアウト値、勘定科目コードなどが複数箇所にハードコードされています。

## 🔍 現状の問題点

### ハードコーディングされた値の一覧

#### 1. ポート番号

| 値             | 出現箇所           | 用途                      |
| -------------- | ------------------ | ------------------------- |
| 3000           | 15箇所以上         | Webアプリケーションポート |
| 3001           | 20箇所以上         | APIサーバーポート         |
| localhost:3001 | テストファイル全般 | API URL                   |

#### 2. タイムアウト値

| 値    | 出現箇所         | 用途               |
| ----- | ---------------- | ------------------ |
| 30000 | E2Eテスト全般    | テストタイムアウト |
| 5000  | APIクライアント  | APIタイムアウト    |
| 10000 | データベース接続 | 接続タイムアウト   |

#### 3. 勘定科目コード（テストデータ）

| 値     | 出現箇所       | 用途           |
| ------ | -------------- | -------------- |
| "1000" | テストファイル | 現金勘定コード |
| "3000" | テストファイル | 売上勘定コード |
| "5000" | テストファイル | 費用勘定コード |

#### 4. その他の定数

| 値         | 出現箇所         | 用途                   |
| ---------- | ---------------- | ---------------------- |
| "admin123" | テストファイル   | デフォルトパスワード   |
| 10         | ページネーション | デフォルトページサイズ |
| 100        | バリデーション   | 最大文字数             |

### 影響を受けるファイル例

```
apps/web/
├── src/lib/api.ts           # localhost:3001
├── playwright.config.ts     # baseURL: http://localhost:3000
└── e2e/*.spec.ts            # timeout: 30000

apps/api/
├── src/index.ts             # PORT = 3001
├── src/config/             # 設定が分散
└── tests/*.test.ts         # ハードコードされたテストデータ

packages/*/
└── tests/*.test.ts        # 共通のテスト定数
```

## 💡 推奨される解決策

### 1. 設定ファイルの作成

#### 共通設定（packages/config）

```typescript
// packages/config/src/constants.ts
export const PORTS = {
  WEB: process.env.WEB_PORT || 3000,
  API: process.env.API_PORT || 3001,
} as const;

export const TIMEOUTS = {
  API: 5000,
  DATABASE: 10000,
  E2E_TEST: 30000,
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;

// packages/config/src/test-constants.ts
export const TEST_ACCOUNTS = {
  CASH: { code: '1000', name: '現金' },
  SALES: { code: '3000', name: '売上' },
  EXPENSE: { code: '5000', name: '費用' },
} as const;

export const TEST_CREDENTIALS = {
  ADMIN: {
    email: 'admin@test.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'test-admin-123',
  },
} as const;
```

#### アプリケーション別設定

```typescript
// apps/web/src/config/index.ts
import { PORTS, TIMEOUTS } from '@simple-bookkeeping/config';

export const WEB_CONFIG = {
  port: PORTS.WEB,
  apiUrl: process.env.NEXT_PUBLIC_API_URL || `http://localhost:${PORTS.API}`,
  timeout: TIMEOUTS.API,
} as const;

// apps/api/src/config/index.ts
import { PORTS, TIMEOUTS } from '@simple-bookkeeping/config';

export const API_CONFIG = {
  port: PORTS.API,
  corsOrigin: process.env.CORS_ORIGIN || `http://localhost:${PORTS.WEB}`,
  dbTimeout: TIMEOUTS.DATABASE,
} as const;
```

### 2. 環境変数の整理

```bash
# .env.example
# Ports
WEB_PORT=3000
API_PORT=3001

# URLs
NEXT_PUBLIC_API_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3000

# Timeouts (ms)
API_TIMEOUT=5000
DB_CONNECTION_TIMEOUT=10000

# Test Configuration
TEST_TIMEOUT=30000
TEST_ADMIN_PASSWORD=test-admin-123
```

### 3. テスト設定の統一

```typescript
// apps/web/playwright.config.ts
import { PORTS, TIMEOUTS } from '@simple-bookkeeping/config';

export default defineConfig({
  timeout: TIMEOUTS.E2E_TEST,
  use: {
    baseURL: `http://localhost:${PORTS.WEB}`,
  },
});

// E2Eテストでの使用
import { TEST_ACCOUNTS, TEST_CREDENTIALS } from '@simple-bookkeeping/config/test';

test('should create journal entry', async ({ page }) => {
  await login(page, TEST_CREDENTIALS.ADMIN);
  await selectAccount(page, TEST_ACCOUNTS.CASH.code);
});
```

## 📋 アクセプタンスクライテリア

- [ ] 共通設定パッケージが作成されている
- [ ] ハードコードされたポート番号が全て定数化されている
- [ ] タイムアウト値が設定ファイルに集約されている
- [ ] テストデータが統一された定数を使用している
- [ ] 環境変数のサンプルファイルが更新されている
- [ ] 全テストが新しい設定で通過する
- [ ] ドキュメントに設定項目一覧が記載されている

## 🏗️ 実装ステップ

1. **設定パッケージの作成**（1日）
   - `packages/config`の作成
   - 基本的な定数の定義
   - TypeScript設定

2. **アプリケーション設定の移行**（2日）
   - Webアプリの設定移行
   - APIサーバーの設定移行
   - 環境変数の整理

3. **テスト設定の統一**（2日）
   - E2Eテストの設定移行
   - 単体テストの設定移行
   - テストデータの統一

4. **リファクタリング**（2日）
   - ハードコード値の置き換え
   - import文の更新
   - 不要な定数の削除

5. **検証とドキュメント化**（1日）
   - 全テストの実行
   - 設定ドキュメントの作成
   - .env.exampleの更新

## ⏱️ 見積もり工数

- **総工数**: 8人日
- **優先度**: Medium 🟡
- **影響度**: コードベース全体

## 🏷️ ラベル

- `refactor`
- `technical-debt`
- `medium-priority`
- `configuration`

## 📊 成功指標

- ハードコード値の削減: 90%以上
- 設定変更の容易性: 大幅改善
- 環境別設定の切り替え: 簡単化
- テストデータの一貫性: 100%

## ⚠️ リスクと考慮事項

- **影響範囲が広い**: 段階的な移行が必要
- **環境変数の管理**: 各環境での設定値の同期が必要
- **後方互換性**: 一時的に両方の値をサポートする必要があるかも
- **ビルドプロセス**: 新しいパッケージの依存関係追加

## 🔄 マイグレーション戦略

### Phase 1: 設定基盤の構築

1. configパッケージの作成
2. 基本的な定数の定義
3. 既存コードはそのまま

### Phase 2: 段階的移行

1. 新規コードから新設定を使用
2. テストファイルから順次移行
3. クリティカルでない部分から移行

### Phase 3: 完全移行

1. 全てのハードコード値を置換
2. 古い設定の削除
3. ドキュメントの更新

## 📚 参考資料

- [The Twelve-Factor App - Config](https://12factor.net/config)
- [Node.js Best Practices - Configuration](https://github.com/goldbergyoni/nodebestpractices#2-configuration)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
