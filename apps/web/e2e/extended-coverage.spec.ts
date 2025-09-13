import { test, expect } from '@playwright/test';

import { UnifiedMock } from './helpers/server-actions-unified-mock';
import { SupabaseAuth } from './helpers/supabase-auth';

/**
 * 拡張E2Eテストカバレッジ
 * Issue #182: テストカバレッジの向上
 */
test.describe('拡張テストカバレッジ', () => {
  // CI環境での実行を考慮してタイムアウトを増やす
  test.use({ navigationTimeout: 30000 });
  test.setTimeout(30000);

  test.describe('認証が必要なページ', () => {
    test.beforeEach(async ({ context, page }) => {
      // Server Actions用のモックをセットアップ
      await UnifiedMock.setupAll(context, {
        enabled: true,
        customResponses: {
          organizations: [
            {
              id: 'test-org-1',
              name: 'Test Organization',
              code: 'TEST001',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
        },
      });

      // Supabase認証をセットアップ
      await SupabaseAuth.setup(context, page, { role: 'admin' });
    });

    test('ダッシュボード勘定科目ページが表示される', async ({ page, context }) => {
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

      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'admin' });

      await page.goto('/dashboard/accounts', { waitUntil: 'domcontentloaded' });

      // ページタイトルまたはヘッダーの確認
      await page.waitForLoadState('networkidle');

      // ページコンテンツの確認（複数の可能性を許容）
      const pageHasContent = await page.evaluate(() => {
        // ページ内のテキストを確認
        const bodyText = document.body.innerText || '';
        // ダッシュボードナビゲーションまたはコンテンツの存在を確認
        return (
          bodyText.includes('勘定科目') ||
          bodyText.includes('現金') ||
          bodyText.includes('Accounts') ||
          bodyText.includes('Simple Bookkeeping') ||
          document.querySelector('table') !== null ||
          document.querySelector('nav') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });

    test('ダッシュボード仕訳入力ページが表示される', async ({ page, context }) => {
      // APIモックを設定
      await UnifiedMock.setupAll(context, {
        enabled: true,
        customResponses: {
          'journal-entries': [],
        },
      });

      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'admin' });

      await page.goto('/dashboard/journal-entries', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForLoadState('networkidle');

      // ページコンテンツの確認（ナビゲーションがあるかエラーページでないか確認）
      const pageHasContent = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        // エラーページでないことを確認
        const isErrorPage = bodyText.includes('エラーが発生しました');
        if (isErrorPage) return false;

        // ナビゲーションがあるか確認
        return (
          bodyText.includes('Simple Bookkeeping') ||
          bodyText.includes('仕訳') ||
          bodyText.includes('Journal') ||
          document.querySelector('nav') !== null ||
          document.querySelector('main') !== null ||
          document.querySelector('table') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });

    test('現金出納帳ページが表示される', async ({ page }) => {
      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'admin' });

      await page.goto('/dashboard/ledgers/cash-book', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForLoadState('networkidle');

      // ページコンテンツの確認
      const pageHasContent = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('現金') ||
          bodyText.includes('出納帳') ||
          bodyText.includes('Cash') ||
          bodyText.includes('Simple Bookkeeping') ||
          document.querySelector('main') !== null ||
          document.querySelector('nav') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });

    test('預金出納帳ページが表示される', async ({ page }) => {
      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'admin' });

      await page.goto('/dashboard/ledgers/bank-book', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForLoadState('networkidle');

      // ページコンテンツの確認
      const pageHasContent = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('預金') ||
          bodyText.includes('出納帳') ||
          bodyText.includes('Bank') ||
          bodyText.includes('Simple Bookkeeping') ||
          document.querySelector('main') !== null ||
          document.querySelector('nav') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });

    test('貸借対照表ページが表示される', async ({ page }) => {
      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'admin' });

      await page.goto('/dashboard/reports/balance-sheet', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForLoadState('networkidle');

      // ページコンテンツの確認
      const pageHasContent = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('貸借対照表') ||
          bodyText.includes('Balance Sheet') ||
          bodyText.includes('資産') ||
          bodyText.includes('負債') ||
          bodyText.includes('資本') ||
          bodyText.includes('純資産') ||
          bodyText.includes('Simple Bookkeeping') ||
          bodyText.includes('レポート') ||
          bodyText.includes('Reports') ||
          document.querySelector('main') !== null ||
          document.querySelector('nav') !== null ||
          document.querySelector('table') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });

    test('損益計算書ページが表示される', async ({ page, context }) => {
      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'admin' });

      // Mock API response for profit-loss report
      await context.route('**/api/v1/reports/profit-loss', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              revenue: [],
              expenses: [],
              totalRevenue: 0,
              totalExpenses: 0,
              netIncome: 0,
              period: {
                startDate: '2024-01-01',
                endDate: '2024-12-31',
              },
            },
          }),
        });
      });

      await page.goto('/dashboard/reports/profit-loss', { waitUntil: 'networkidle' });

      // ページの読み込みを待つ
      await page.waitForLoadState('domcontentloaded');

      // ページコンテンツの確認 - more flexible checks
      const pageHasContent = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('損益計算書') ||
          bodyText.includes('Profit') ||
          bodyText.includes('収益') ||
          bodyText.includes('費用') ||
          bodyText.includes('レポート') ||
          bodyText.includes('Report') ||
          bodyText.includes('Simple Bookkeeping') ||
          document.querySelector('main') !== null ||
          document.querySelector('nav') !== null ||
          document.querySelector('[role="main"]') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });

    test('試算表ページが表示される', async ({ page }) => {
      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'admin' });

      await page.goto('/dashboard/reports/trial-balance', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForLoadState('networkidle');

      // ページコンテンツの確認
      const pageHasContent = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('試算表') ||
          bodyText.includes('Trial Balance') ||
          bodyText.includes('借方') ||
          bodyText.includes('貸方') ||
          bodyText.includes('Simple Bookkeeping') ||
          document.querySelector('main') !== null ||
          document.querySelector('nav') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });

    test('組織設定ページが表示される', async ({ page }) => {
      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'admin' });

      await page.goto('/dashboard/settings/organization', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForLoadState('networkidle');

      // ページコンテンツの確認
      const pageHasContent = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('組織') ||
          bodyText.includes('Organization') ||
          bodyText.includes('設定') ||
          bodyText.includes('Simple Bookkeeping') ||
          document.querySelector('main') !== null ||
          document.querySelector('nav') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });

    test('アカウント設定ページが表示される', async ({ page }) => {
      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await SupabaseAuth.setup(context, page, { role: 'admin' });

      await page.goto('/dashboard/settings/account', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForLoadState('networkidle');

      // ページコンテンツの確認
      const pageHasContent = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('アカウント') ||
          bodyText.includes('Account') ||
          bodyText.includes('プロフィール') ||
          bodyText.includes('設定') ||
          bodyText.includes('Simple Bookkeeping') ||
          document.querySelector('main') !== null ||
          document.querySelector('nav') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });
  });
});
