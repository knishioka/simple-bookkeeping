import { test, expect } from '@playwright/test';

import { UnifiedAuth } from './helpers/unified-auth';

/**
 * 拡張E2Eテストカバレッジ
 * Issue #182: テストカバレッジの向上
 */
test.describe('拡張テストカバレッジ', () => {
  test.use({ navigationTimeout: 10000 });

  test.beforeEach(async ({ page, context }) => {
    // 統一ヘルパーで認証とモックをセットアップ
    await UnifiedAuth.setupMockRoutes(context);
    await UnifiedAuth.setAuthData(page);
  });

  test.describe('勘定科目管理', () => {
    test('勘定科目ページが表示される', async ({ page, context }) => {
      // Mock accounts API
      await context.route('**/api/v1/accounts', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              { id: '1', code: '1000', name: '現金', accountType: 'ASSET', isActive: true },
              { id: '2', code: '2000', name: '売掛金', accountType: 'ASSET', isActive: true },
            ],
            meta: { total: 2 },
          }),
        });
      });

      await page.goto('/dashboard/accounts', { waitUntil: 'domcontentloaded' });

      // ページタイトルまたはヘッダーの確認
      await page.waitForTimeout(1000);
      const pageHasContent =
        (await page
          .locator('h1, h2')
          .filter({ hasText: /勘定科目/i })
          .count()) > 0 || (await page.locator('text=現金').count()) > 0;
      expect(pageHasContent).toBeTruthy();
    });

    test('勘定科目の検索機能', async ({ page, context }) => {
      // Mock accounts API
      await context.route('**/api/v1/accounts**', async (route) => {
        const url = new URL(route.request().url());
        const search = url.searchParams.get('search');

        let accounts = [
          { id: '1', code: '1000', name: '現金', accountType: 'ASSET', isActive: true },
          { id: '2', code: '2000', name: '売掛金', accountType: 'ASSET', isActive: true },
          { id: '3', code: '3000', name: '売上高', accountType: 'REVENUE', isActive: true },
        ];

        if (search) {
          accounts = accounts.filter((a) => a.name.includes(search) || a.code.includes(search));
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: accounts,
            meta: { total: accounts.length },
          }),
        });
      });

      await page.goto('/dashboard/accounts', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // 検索フィールドを探す
      const searchInput = page.locator('input[placeholder*="検索"], input[type="search"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('現金');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);

        // 検索結果の確認
        await expect(page.locator('text=現金')).toBeVisible();
      }
    });
  });

  test.describe('仕訳入力管理', () => {
    test('仕訳入力ページが表示される', async ({ page, context }) => {
      // Mock journal entries API
      await context.route('**/api/v1/journal-entries', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: '1',
                entryDate: '2024-01-15',
                description: '売上計上',
                totalAmount: 100000,
                status: 'posted',
                lines: [
                  { accountId: '1', debitAmount: 100000, creditAmount: 0 },
                  { accountId: '2', debitAmount: 0, creditAmount: 100000 },
                ],
              },
            ],
            meta: { total: 1, page: 1, perPage: 20 },
          }),
        });
      });

      await page.goto('/dashboard/journal-entries', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // ページコンテンツの確認
      const pageHasContent =
        (await page.locator('h1, h2').filter({ hasText: /仕訳/i }).count()) > 0 ||
        (await page.locator('text=売上計上').count()) > 0 ||
        (await page.locator('table').count()) > 0;
      expect(pageHasContent).toBeTruthy();
    });
  });

  test.describe('元帳管理', () => {
    test('現金出納帳ページが表示される', async ({ page }) => {
      await page.goto('/dashboard/ledgers/cash-book', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // ページコンテンツの確認
      const pageHasContent =
        (await page.locator('h1, h2').filter({ hasText: /現金/i }).count()) > 0 ||
        (await page.locator('text=現金出納帳').count()) > 0;
      expect(pageHasContent).toBeTruthy();
    });

    test('預金出納帳ページが表示される', async ({ page }) => {
      await page.goto('/dashboard/ledgers/bank-book', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // ページコンテンツの確認
      const pageHasContent =
        (await page.locator('h1, h2').filter({ hasText: /預金/i }).count()) > 0 ||
        (await page.locator('text=預金出納帳').count()) > 0;
      expect(pageHasContent).toBeTruthy();
    });
  });

  test.describe('レポート機能', () => {
    test('貸借対照表ページが表示される', async ({ page }) => {
      await page.goto('/dashboard/reports/balance-sheet', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // ページコンテンツの確認
      const pageHasContent =
        (await page
          .locator('h1, h2')
          .filter({ hasText: /貸借対照表/i })
          .count()) > 0 || (await page.locator('text=Balance Sheet').count()) > 0;
      expect(pageHasContent).toBeTruthy();
    });

    test('損益計算書ページが表示される', async ({ page }) => {
      await page.goto('/dashboard/reports/profit-loss', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // ページコンテンツの確認
      const pageHasContent =
        (await page
          .locator('h1, h2')
          .filter({ hasText: /損益計算書/i })
          .count()) > 0 || (await page.locator('text=Profit').count()) > 0;
      expect(pageHasContent).toBeTruthy();
    });

    test('試算表ページが表示される', async ({ page }) => {
      await page.goto('/dashboard/reports/trial-balance', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // ページコンテンツの確認
      const pageHasContent =
        (await page
          .locator('h1, h2')
          .filter({ hasText: /試算表/i })
          .count()) > 0 || (await page.locator('text=Trial Balance').count()) > 0;
      expect(pageHasContent).toBeTruthy();
    });
  });

  test.describe('設定管理', () => {
    test('組織設定ページが表示される', async ({ page }) => {
      await page.goto('/dashboard/settings/organization', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // ページコンテンツの確認
      const pageHasContent =
        (await page.locator('h1, h2').filter({ hasText: /組織/i }).count()) > 0 ||
        (await page.locator('text=Organization').count()) > 0;
      expect(pageHasContent).toBeTruthy();
    });

    test('アカウント設定ページが表示される', async ({ page }) => {
      await page.goto('/dashboard/settings/account', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // ページコンテンツの確認
      const pageHasContent =
        (await page
          .locator('h1, h2')
          .filter({ hasText: /アカウント/i })
          .count()) > 0 || (await page.locator('text=Account').count()) > 0;
      expect(pageHasContent).toBeTruthy();
    });
  });

  test.describe('デモ機能', () => {
    test('デモ仕訳入力ページのフォーム操作', async ({ page }) => {
      await page.goto('/demo/journal-entries', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // フォーム要素の確認
      const hasForm =
        (await page.locator('input, select, textarea').count()) > 0 ||
        (await page.locator('button').count()) > 0;
      expect(hasForm).toBeTruthy();
    });

    test('デモ取引先ページが表示される', async ({ page }) => {
      await page.goto('/demo/partners', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // ページコンテンツの確認
      const pageHasContent =
        (await page
          .locator('h1, h2')
          .filter({ hasText: /取引先/i })
          .count()) > 0 ||
        (await page.locator('text=Partner').count()) > 0 ||
        (await page.locator('table').count()) > 0;
      expect(pageHasContent).toBeTruthy();
    });
  });
});
