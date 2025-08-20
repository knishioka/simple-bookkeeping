import { test, expect } from '@playwright/test';

/**
 * 仕訳入力のE2Eテスト
 * Issue #182: スキップされているテストの有効化とカバレッジ向上
 */
test.describe('仕訳入力テスト（デモページ）', () => {
  test.use({ navigationTimeout: 10000 });

  test('デモ仕訳入力ページが表示される', async ({ page }) => {
    await page.goto('/demo/journal-entries', { waitUntil: 'networkidle' });

    // ページタイトルの確認
    await expect(page.locator('h1').filter({ hasText: '仕訳入力' }).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('仕訳フォームの基本要素が存在する', async ({ page }) => {
    await page.goto('/demo/journal-entries', { waitUntil: 'networkidle' });

    // 新規作成ボタンの確認
    const createButton = page.locator('button').filter({ hasText: '新規作成' }).first();
    await expect(createButton).toBeVisible({ timeout: 5000 });
  });

  test('デモ仕訳テーブルが表示される', async ({ page }) => {
    await page.goto('/demo/journal-entries', { waitUntil: 'networkidle' });

    // テーブルの確認
    await expect(page.locator('table').first()).toBeVisible({ timeout: 5000 });
  });
});
