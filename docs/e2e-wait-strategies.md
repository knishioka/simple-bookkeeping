# E2Eテスト待機戦略ベストプラクティス

## 概要

このドキュメントは、Simple BookkeepingプロジェクトにおけるE2Eテストの待機戦略に関するベストプラクティスをまとめたものです。安定したテスト実行とメンテナンス性の向上を目的としています。

## 背景

Issue #109で指摘されたように、`networkidle`や`waitForTimeout`などの環境依存な待機方法は、CI環境でのテスト不安定性の原因となっていました。本ドキュメントは、より明示的で信頼性の高い待機戦略を提供します。

## 待機戦略の優先順位

以下の優先順位で待機戦略を選択してください：

1. **`waitForApiResponse()`** - APIレスポンスを直接待つ
2. **`waitForTestId()`** - data-testid属性を持つ要素を待つ
3. **`waitForSelector()`** - 明示的なセレクターで要素を待つ
4. **`waitForFunction()`** - カスタム条件を待つ
5. **`waitForURL()`** - URL変更を待つ
6. **`waitForLoadState('domcontentloaded')`** - DOM準備を待つ
7. **`waitForLoadState('load')`** - リソース読み込みを待つ
8. **`waitForLoadState('networkidle')`** - 最終手段として使用
9. ~~`waitForTimeout()`~~ - **使用禁止**

## ヘルパー関数の使用

### 基本的な使い方

```typescript
import {
  waitForApiResponse,
  waitForTestId,
  waitForPageReady,
  smartWait,
} from './helpers/wait-strategies';

// APIレスポンスを待つ
await waitForApiResponse(page, '/api/v1/accounts', {
  statusCode: 200,
  timeout: 10000,
});

// data-testid属性を持つ要素を待つ
await waitForTestId(page, 'accounts-table', {
  state: 'visible',
  timeout: 15000,
});

// ページの準備完了を待つ（複数条件）
await waitForPageReady(page, {
  waitForApi: /\/api\/v1\//,
  waitForTestId: 'dashboard-loaded',
  skipNetworkIdle: true,
});

// スマート待機（自動判定）
await smartWait(page, '/api/v1/accounts', 'auto');
```

### 特定のUIパターンに対する待機

```typescript
// Radix UI Selectコンポーネントの待機
await waitForSelectOpen(page);

// フォーム送信の待機
await waitForFormSubmit(page, 'form#journal-entry', {
  successUrl: '/dashboard/journal-entries',
  successApi: '/api/v1/journal-entries',
});

// モーダル表示の待機
await waitForModal(page, {
  testId: 'account-dialog',
});

// トーストメッセージの待機
await waitForToast(page, '保存しました');
```

## data-testid属性の命名規約

### 基本ルール

- ケバブケース（kebab-case）を使用
- 機能名-要素タイプの形式
- 例：`accounts-table`, `journal-entry-dialog`

### 標準的な命名パターン

```html
<!-- テーブル -->
<table data-testid="accounts-table">
  <!-- 入力フィールド -->
  <input data-testid="accounts-search-input" />

  <!-- ボタン -->
  <button data-testid="account-create-button">
    <!-- フィルター -->
    <select data-testid="accounts-type-filter">
      <!-- ダイアログ -->
      <div data-testid="account-dialog"></div>
    </select>
  </button>
</table>
```

### 実装例

```tsx
// コンポーネントでの実装
<Table data-testid="journal-entries-table">
  <TableHeader>
    <TableRow>
      <TableHead>日付</TableHead>
    </TableRow>
  </TableHeader>
</Table>

<Button
  onClick={handleCreate}
  data-testid="journal-entry-create-button"
>
  新規作成
</Button>

<Select
  value={selectedType}
  onValueChange={setSelectedType}
  data-testid="accounts-type-filter"
>
  <SelectTrigger data-testid="accounts-type-trigger">
    <SelectValue placeholder="科目タイプ" />
  </SelectTrigger>
</Select>
```

## デバッグユーティリティの使用

### エラー発生時の情報収集

```typescript
import {
  captureDebugScreenshot,
  capturePageHTML,
  collectErrorDetails,
} from './helpers/debug-utils';

test('example test', async ({ page }) => {
  try {
    // テストコード
  } catch (error) {
    // エラー詳細を収集
    await collectErrorDetails(page, error, 'example-test');
    throw error;
  }
});
```

### ネットワークログの記録

```typescript
import { startNetworkLogging } from './helpers/debug-utils';

test('network test', async ({ page }) => {
  const networkLogger = startNetworkLogging(page);

  await page.goto('/dashboard');

  // ログを出力
  networkLogger.print();

  // 特定のログを取得
  const logs = networkLogger.getLogs();
  const failedRequests = logs.filter((l) => l.status >= 400);
});
```

### パフォーマンス測定

```typescript
import { TestTimer } from './helpers/debug-utils';

test('performance test', async ({ page }) => {
  const timer = new TestTimer();

  timer.start('navigation');
  await page.goto('/dashboard');
  timer.end('navigation');

  timer.start('data-load');
  await waitForApiResponse(page, '/api/v1/accounts');
  timer.end('data-load');

  // タイミング情報を出力
  timer.print();
});
```

## アンチパターン

### ❌ 避けるべきパターン

```typescript
// 1. waitForTimeoutの使用
await page.waitForTimeout(2000); // ❌ 絶対に使用しない

// 2. networkidleの過度な依存
await page.waitForLoadState('networkidle'); // ❌ 最終手段としてのみ

// 3. 曖昧なセレクター
await page.waitForSelector('button'); // ❌ 具体的でない

// 4. 固定の待機時間
await new Promise((resolve) => setTimeout(resolve, 1000)); // ❌
```

### ✅ 推奨パターン

```typescript
// 1. 明示的なAPI待機
await waitForApiResponse(page, '/api/v1/accounts');

// 2. data-testidの使用
await waitForTestId(page, 'accounts-table');

// 3. 複数条件の組み合わせ
await waitForPageReady(page, {
  waitForApi: /\/api\/v1\//,
  waitForTestId: 'page-loaded',
});

// 4. リトライ付き待機
await withRetry(
  async () => {
    await page.click('[data-testid="submit-button"]');
  },
  { retries: 3, delay: 1000 }
);
```

## CI環境での考慮事項

### 環境判定

```typescript
import { isCI, isDebugMode } from './helpers/debug-utils';

if (isCI()) {
  // CI環境固有の設定
  test.setTimeout(30000);
}

if (isDebugMode()) {
  // デバッグ情報を出力
  logTestEnvironment();
}
```

### タイムアウトの調整

```typescript
// CI環境では長めのタイムアウトを設定
const timeout = isCI() ? 30000 : 15000;

await waitForTestId(page, 'dashboard-loaded', { timeout });
```

## トラブルシューティング

### 問題: 要素が見つからない

```typescript
// デバッグ情報を収集
import { debugElement } from './helpers/debug-utils';

const locator = page.locator('[data-testid="accounts-table"]');
await debugElement(locator, 'Accounts Table Debug');
```

### 問題: APIレスポンスが来ない

```typescript
// ネットワークログを確認
const networkLogger = startNetworkLogging(page);
await page.goto('/dashboard');
networkLogger.print();

// 失敗したリクエストを特定
const failed = networkLogger.getLogs().filter((l) => l.status >= 400);
console.log('Failed requests:', failed);
```

### 問題: テストが不安定

```typescript
// リトライ機能を使用
await withRetry(
  async () => {
    await page.click('[data-testid="submit-button"]');
    await waitForApiResponse(page, '/api/v1/accounts');
  },
  {
    retries: 3,
    delay: 1000,
    timeout: 30000,
  }
);
```

## 実装チェックリスト

新しいE2Eテストを作成する際は、以下をチェックしてください：

- [ ] `waitForTimeout`を使用していない
- [ ] 重要な要素にdata-testid属性を追加した
- [ ] APIレスポンスを明示的に待っている
- [ ] エラーハンドリングを実装している
- [ ] デバッグ情報を適切に出力している
- [ ] CI環境での実行を考慮している
- [ ] リトライ機能を適切に使用している

## 参考資料

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Issue #109: E2Eテストの待機戦略ベストプラクティスの実装](https://github.com/your-repo/issues/109)
- [wait-strategies.ts](../apps/web/e2e/helpers/wait-strategies.ts)
- [debug-utils.ts](../apps/web/e2e/helpers/debug-utils.ts)
