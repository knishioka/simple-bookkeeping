import { test, expect } from '@playwright/test';

/**
 * 仕訳入力のE2Eテスト
 * Issue #182: スキップされているテストの有効化とカバレッジ向上
 */
test.describe('仕訳入力テスト（デモページ）', () => {
  test.use({ navigationTimeout: 10000 });

  test('デモ仕訳入力ページが表示される', async ({ page }) => {
    await page.goto('/demo/journal-entries', { waitUntil: 'domcontentloaded' });

    // ページの読み込みを待つ
    await page.waitForTimeout(1000);

    // ページタイトルの確認
    await expect(page.locator('h1').filter({ hasText: /仕訳/i }).first()).toBeVisible();
  });

  test('仕訳フォームの基本要素が存在する', async ({ page }) => {
    await page.goto('/demo/journal-entries', { waitUntil: 'domcontentloaded' });

    // ページの読み込みを待つ
    await page.waitForTimeout(1000);

    // フォーム要素の確認
    const hasFormElements = (await page.locator('input, select, textarea, button').count()) > 0;
    expect(hasFormElements).toBeTruthy();
  });

  test('デモ仕訳テーブルが表示される', async ({ page }) => {
    await page.goto('/demo/journal-entries', { waitUntil: 'domcontentloaded' });

    // ページの読み込みを待つ
    await page.waitForTimeout(1000);

    // テーブルまたはリストの確認
    const hasTableOrList = (await page.locator('table, [role="table"], .list').count()) > 0;
    expect(hasTableOrList).toBeTruthy();
  });
});
