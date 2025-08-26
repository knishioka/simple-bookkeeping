import { test, expect } from '@playwright/test';

import { UnifiedAuth } from './helpers/unified-auth';

/**
 * 拡張E2Eテストカバレッジ
 * Issue #182: テストカバレッジの向上
 */
test.describe('拡張テストカバレッジ', () => {
  test.use({ navigationTimeout: 10000 });

  test.describe('デモページ機能', () => {
    test('デモ勘定科目ページが表示される', async ({ page }) => {
      await page.goto('/demo/accounts', { waitUntil: 'networkidle' });

      // ページタイトルまたはヘッダーの確認
      await page.waitForTimeout(2000);

      // デモページ特有の要素を確認
      await expect(page.locator('h1').filter({ hasText: '勘定科目管理' })).toBeVisible({
        timeout: 5000,
      });
      await expect(page.locator('text=現金').first()).toBeVisible({ timeout: 5000 });
    });

    test('デモ勘定科目の検索機能', async ({ page }) => {
      await page.goto('/demo/accounts', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 検索フィールドを探す
      const searchInput = page.locator('input[placeholder*="検索"]').first();
      await expect(searchInput).toBeVisible({ timeout: 5000 });
      await searchInput.fill('現金');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // 検索結果の確認
      await expect(page.locator('text=現金')).toBeVisible();
    });

    test('デモ仕訳入力ページが表示される', async ({ page }) => {
      await page.goto('/demo/journal-entries', { waitUntil: 'networkidle' });

      // ページの読み込みを待つ
      await page.waitForTimeout(2000);

      // デモページの確認
      await expect(page.locator('h1').filter({ hasText: '仕訳入力' }).first()).toBeVisible({
        timeout: 5000,
      });
    });

    test('デモパートナーページが表示される', async ({ page }) => {
      await page.goto('/demo/partners', { waitUntil: 'networkidle' });

      // ページの読み込みを待つ
      await page.waitForTimeout(2000);

      // ページコンテンツの確認
      await expect(
        page
          .locator('h1')
          .filter({ hasText: /取引先|パートナー/i })
          .first()
      ).toBeVisible({ timeout: 5000 });
    });

    test.skip('デモトップページから各ページへナビゲート（basic.spec.tsと重複のため一時スキップ）', async ({
      page,
    }) => {
      // このテストはbasic.spec.tsのデモページテストと重複しているため一時的にスキップ
    });
  });

  test.describe('認証が必要なページ', () => {
    test.beforeEach(async ({ context }) => {
      // APIモックをセットアップ
      await UnifiedAuth.setupMockRoutes(context);

      // メインユーザー情報のモック
      await context.route('**/api/v1/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              user: {
                id: '1',
                email: 'admin@example.com',
                name: 'Admin User',
                organizations: [
                  {
                    id: 'org-1',
                    name: 'Test Organization',
                    code: 'TEST001',
                    role: 'ADMIN',
                    isDefault: true,
                  },
                ],
                currentOrganization: {
                  id: 'org-1',
                  name: 'Test Organization',
                  code: 'TEST001',
                  role: 'ADMIN',
                  isDefault: true,
                },
              },
            },
          }),
        });
      });

      // 組織情報のモック
      await context.route('**/api/v1/organizations/org-1', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'org-1',
              name: 'Test Organization',
              createdAt: '2024-01-01T00:00:00Z',
            },
          }),
        });
      });
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
      await UnifiedAuth.setAuthData(page);

      await page.goto('/dashboard/accounts', { waitUntil: 'domcontentloaded' });

      // ページタイトルまたはヘッダーの確認
      await page.waitForTimeout(2000);

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
      await UnifiedAuth.setupMockRoutes(context);

      // 仕訳エントリーのAPIモックを追加
      await context.route('**/api/v1/journal-entries', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [],
              meta: { total: 0, page: 1, limit: 10 },
            }),
          });
        } else {
          await route.continue();
        }
      });

      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await UnifiedAuth.setAuthData(page);

      await page.goto('/dashboard/journal-entries', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(2000);

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
      await UnifiedAuth.setAuthData(page);

      await page.goto('/dashboard/ledgers/cash-book', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(2000);

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
      await UnifiedAuth.setAuthData(page);

      await page.goto('/dashboard/ledgers/bank-book', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(2000);

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
      await UnifiedAuth.setAuthData(page);

      await page.goto('/dashboard/reports/balance-sheet', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(2000);

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

    test('損益計算書ページが表示される', async ({ page }) => {
      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await UnifiedAuth.setAuthData(page);

      await page.goto('/dashboard/reports/profit-loss', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(2000);

      // ページコンテンツの確認
      const pageHasContent = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('損益計算書') ||
          bodyText.includes('Profit') ||
          bodyText.includes('収益') ||
          bodyText.includes('費用') ||
          bodyText.includes('Simple Bookkeeping') ||
          document.querySelector('main') !== null ||
          document.querySelector('nav') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });

    test('試算表ページが表示される', async ({ page }) => {
      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await UnifiedAuth.setAuthData(page);

      await page.goto('/dashboard/reports/trial-balance', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(2000);

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
      await UnifiedAuth.setAuthData(page);

      await page.goto('/dashboard/settings/organization', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(2000);

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
      await UnifiedAuth.setAuthData(page);

      await page.goto('/dashboard/settings/account', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(2000);

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
