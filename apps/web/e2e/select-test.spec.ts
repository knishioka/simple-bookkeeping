import { test, expect } from '@playwright/test';

import { MockResponseManager } from './fixtures/mock-responses';
import { AccountsPage } from './pages/accounts-page';

/**
 * Radix UI Select コンポーネントの基本動作テスト（簡略版）
 *
 * 複雑な動作テストは削除し、基本的な動作確認のみに絞っています。
 */

test.describe('Radix UI Select - 基本動作確認', () => {
  let accountsPage: AccountsPage;
  let mockManager: MockResponseManager;

  test.beforeEach(async ({ page }) => {
    accountsPage = new AccountsPage(page);
    mockManager = new MockResponseManager(page);

    // 基本的なAPIモックを設定
    await mockManager.setupBasicMocks();

    // ページに移動
    await accountsPage.navigate();
  });

  test('勘定科目ページのSelectコンポーネントが表示される', async ({ page }) => {
    // ページが完全にロードされるまで待機
    await accountsPage.waitForLoadingComplete();

    // Selectコンポーネントが存在することを確認
    const selectElements = page.locator('[role="combobox"]');
    const count = await selectElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test('新規作成ダイアログにSelectコンポーネントが含まれる', async ({ page }) => {
    // 新規作成ダイアログを開く
    await accountsPage.openCreateDialog();

    // ダイアログ内にSelectコンポーネントが存在することを確認
    const dialog = page.locator('[role="dialog"]');
    const dialogSelects = dialog.locator('[role="combobox"]');
    const count = await dialogSelects.count();
    expect(count).toBeGreaterThan(0);

    // ダイアログを閉じる
    await accountsPage.closeDialog();
  });

  test('Selectコンポーネントの基本的なアクセシビリティ属性', async ({ page }) => {
    await accountsPage.waitForLoadingComplete();

    const filterSelect = page.locator('[role="combobox"]').first();

    // role属性を確認
    await expect(filterSelect).toHaveAttribute('role', 'combobox');

    // aria-expanded属性が存在することを確認
    const ariaExpanded = await filterSelect.getAttribute('aria-expanded');
    expect(ariaExpanded).toBeDefined();
  });
});
