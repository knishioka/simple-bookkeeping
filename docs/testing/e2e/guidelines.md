# E2Eテストガイドライン

## 📚 概要

このドキュメントは、Simple BookkeepingプロジェクトのE2Eテスト実装における標準的なパターンとベストプラクティスをまとめたものです。Issue #95の改善内容を反映しています。

## 🎯 目的

- E2Eテストの一貫性と保守性の向上
- テスト実行時間の短縮（30%以上の改善を目標）
- テスト失敗時のデバッグ効率化
- CI/CD環境での安定性向上

## 🏗️ アーキテクチャ

### ディレクトリ構造

```
apps/web/e2e/
├── helpers/              # 共通ヘルパー
│   ├── unified-auth.ts   # 統一認証ヘルパー
│   ├── unified-mock.ts   # 統一モックマネージャー
│   ├── test-setup.ts     # テストセットアップ
│   └── radix-select-helper.ts # Radix UI専用ヘルパー
├── fixtures/             # テストデータ
│   ├── test-data.ts      # 共通テストデータ
│   └── mock-responses.ts # モックレスポンス
├── snapshots/            # スナップショット
├── global-setup.ts       # グローバルセットアップ
├── global-teardown.ts    # グローバルティアダウン
└── *.spec.ts            # テストファイル
```

## 🔐 認証処理の統一

### 推奨パターン

```typescript
import { test, expect } from '@playwright/test';
import { UnifiedAuth } from './helpers/unified-auth';

test.describe('認証が必要なテスト', () => {
  test.beforeEach(async ({ page, context }) => {
    // 統一認証ヘルパーを使用
    await UnifiedAuth.setup(context, page, { role: 'admin' });
  });

  test('管理者機能のテスト', async ({ page }) => {
    await page.goto('/dashboard/admin');
    // テスト実装
  });
});
```

### ロール別セットアップ

```typescript
// 管理者としてセットアップ
await UnifiedAuth.setupAsAdmin(context, page);

// 経理担当者としてセットアップ
await UnifiedAuth.setupAsAccountant(context, page);

// 閲覧者としてセットアップ
await UnifiedAuth.setupAsViewer(context, page);
```

### 認証状態の確認

```typescript
// 認証状態を確認
const isAuthenticated = await UnifiedAuth.isAuthenticated(page);

// 現在のユーザー情報を取得
const user = await UnifiedAuth.getCurrentUser(page);

// 権限を確認
const hasPermission = await UnifiedAuth.hasPermission(page, 'accounts:write');
```

## 🎭 モック戦略

### 全モックセットアップ（推奨）

```typescript
import { test, expect } from '@playwright/test';
import { UnifiedMock } from './helpers/unified-mock';

test.describe('モックを使用したテスト', () => {
  test.beforeEach(async ({ context }) => {
    // 全てのAPIをモック
    await UnifiedMock.setupAll(context, {
      enabled: true,
      delay: 0, // 遅延なし
      errorRate: 0, // エラーなし
    });
  });

  test('正常系のテスト', async ({ page }) => {
    // モックされたAPIを使用してテスト
  });
});
```

### 特定エンドポイントのみモック

```typescript
// 特定のエンドポイントのみモック
await UnifiedMock.setupSpecificMocks(context, ['auth', 'accounts']);

// カスタムレスポンスを設定
UnifiedMock.customizeResponse('accounts', [{ id: '1', name: '現金', balance: 100000 }]);
```

### エラーケースのテスト

```typescript
test('エラーハンドリング', async ({ context, page }) => {
  await UnifiedMock.setupAll(context, {
    errorRate: 0.5, // 50%の確率でエラー
  });

  // エラー処理のテスト
});
```

## ⚡ パフォーマンス最適化

### 1. タイムアウトの最適化

```typescript
// playwright.config.ts での設定
export default defineConfig({
  timeout: 20000, // 20秒（デフォルト30秒から短縮）
  expect: { timeout: 5000 }, // 5秒（デフォルト10秒から短縮）
  use: {
    actionTimeout: 10000, // 10秒
    navigationTimeout: 15000, // 15秒
  },
});
```

### 2. 並列実行の活用

```typescript
// テストの並列実行を有効化
test.describe.parallel('並列実行可能なテスト', () => {
  test('テスト1', async ({ page }) => {
    /* ... */
  });
  test('テスト2', async ({ page }) => {
    /* ... */
  });
});
```

### 3. 不要な待機の削除

```typescript
// ❌ Bad: 固定時間の待機
await page.waitForTimeout(3000);

// ✅ Good: 要素の出現を待つ
await page.waitForSelector('[data-testid="element"]');
```

### 4. セレクタの最適化

```typescript
// ❌ Bad: 複雑なセレクタ
await page.click('div.container > ul > li:nth-child(3) > button');

// ✅ Good: data-testid を使用
await page.click('[data-testid="submit-button"]');
```

## 🐛 デバッグテクニック

### 1. デバッグモードの活用

```bash
# デバッグモードでテスト実行
DEBUG=pw:api pnpm test:e2e

# ヘッドレスモードを無効化
pnpm test:e2e --headed

# 特定のテストのみ実行
pnpm test:e2e audit-logs.spec.ts
```

### 2. トレースの活用

```typescript
// 失敗時のトレースを保存
use: {
  trace: 'retain-on-failure',
}
```

### 3. スクリーンショットとビデオ

```typescript
// 失敗時のスクリーンショットを保存
use: {
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
}
```

## 📝 テストの書き方

### 基本テンプレート

```typescript
import { test, expect } from '@playwright/test';
import { UnifiedAuth } from './helpers/unified-auth';
import { UnifiedMock } from './helpers/unified-mock';

test.describe('機能名', () => {
  // セットアップ
  test.beforeEach(async ({ page, context }) => {
    // 認証設定
    await UnifiedAuth.setup(context, page);

    // モック設定
    await UnifiedMock.setupAll(context);

    // ページ遷移
    await page.goto('/target-page');
  });

  // クリーンアップ
  test.afterEach(async ({ page }) => {
    // 必要に応じてクリーンアップ
    await UnifiedAuth.clear(page);
  });

  test('正常系: 機能が動作する', async ({ page }) => {
    // Arrange: 準備
    const testData = {
      /* ... */
    };

    // Act: 実行
    await page.fill('[data-testid="input"]', testData.value);
    await page.click('[data-testid="submit"]');

    // Assert: 検証
    await expect(page.getByText('成功')).toBeVisible();
  });

  test('異常系: エラーが表示される', async ({ page }) => {
    // エラーケースのテスト
  });
});
```

### Radix UI Selectの操作

```typescript
import { RadixSelectHelper } from './helpers/radix-select-helper';

test('Select操作', async ({ page }) => {
  const helper = new RadixSelectHelper(page);

  // Selectを開いて選択
  await helper.selectOption('[data-testid="account-select"]', '現金');

  // 値を確認
  const value = await helper.getSelectedValue('[data-testid="account-select"]');
  expect(value).toBe('現金');
});
```

## 🚀 CI/CD環境での実行

### GitHub Actions設定

```yaml
- name: Run E2E tests
  run: |
    # 依存関係のインストール
    pnpm install --frozen-lockfile

    # Playwrightのインストール
    pnpm exec playwright install --with-deps

    # テスト実行
    pnpm test:e2e
  env:
    CI: true
```

### 環境変数

```bash
# CI環境で設定すべき環境変数
CI=true
NODE_ENV=test
BASE_URL=http://localhost:3000
API_URL=http://localhost:3001
```

## 📊 パフォーマンス目標

### 実行時間の目標

- 単体テスト: 5秒以内
- 統合テスト: 15秒以内
- フルテストスイート: 5分以内

### 安定性の目標

- テスト成功率: 95%以上
- フレーキーテスト率: 5%以下

## 🔄 マイグレーションガイド

### 既存テストの移行手順

1. **認証処理の統一**

   ```typescript
   // Before
   await page.evaluate(() => {
     localStorage.setItem('token', 'test-token');
   });

   // After
   await UnifiedAuth.setup(context, page);
   ```

2. **モック処理の統一**

   ```typescript
   // Before
   await context.route('**/api/v1/accounts', async (route) => {
     // カスタムモック
   });

   // After
   await UnifiedMock.setupAll(context);
   ```

3. **タイムアウトの最適化**

   ```typescript
   // Before
   await page.waitForTimeout(5000);

   // After
   await page.waitForSelector('[data-testid="loaded"]');
   ```

## 📚 参考資料

- [Playwright公式ドキュメント](https://playwright.dev/)
- [E2Eテスト実装ドキュメント](./e2e-test-implementation.md)
- [ユーザーストーリーテストガイド](./user-story-testing-guide.md)

## 🔧 トラブルシューティング

### よくある問題と解決策

#### 1. Radix UI Selectが開かない

```typescript
// 解決策: 明示的な待機とクリック
const trigger = page.locator('[data-testid="select-trigger"]');
await trigger.waitFor({ state: 'visible' });
await trigger.click();
await page.waitForSelector('[role="option"]');
```

#### 2. 認証が失敗する

```typescript
// 解決策: 認証状態をクリアしてから再設定
await UnifiedAuth.clear(page);
await UnifiedAuth.setup(context, page);
```

#### 3. モックが適用されない

```typescript
// 解決策: モックをページナビゲーション前に設定
await UnifiedMock.setupAll(context); // 先にモック設定
await page.goto('/'); // その後ナビゲーション
```

## 📈 継続的改善

このガイドラインは継続的に改善されます。問題や改善提案がある場合は、GitHubのIssueで報告してください。

---

_最終更新: 2024年1月_
_Issue #95: E2Eテストインフラの改善と安定化_
