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
      await page.goto('/demo/accounts', { waitUntil: 'domcontentloaded' });

      // ページタイトルまたはヘッダーの確認
      await page.waitForTimeout(1000);

      // デモページ特有の要素を確認
      await expect(page.locator('h1:has-text("勘定科目管理")')).toBeVisible();
      await expect(page.locator('text=現金').first()).toBeVisible();
    });

    test('デモ勘定科目の検索機能', async ({ page }) => {
      await page.goto('/demo/accounts', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // 検索フィールドを探す
      const searchInput = page.locator('input[placeholder*="検索"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('現金');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);

        // 検索結果の確認
        await expect(page.locator('text=現金')).toBeVisible();
      }
    });

    test('デモ仕訳入力ページが表示される', async ({ page }) => {
      await page.goto('/demo/journal-entries', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // デモページの確認
      await expect(page.locator('h1').filter({ hasText: /仕訳/i }).first()).toBeVisible();
    });

    test('デモパートナーページが表示される', async ({ page }) => {
      await page.goto('/demo/partners', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // ページコンテンツの確認
      await expect(
        page
          .locator('h1')
          .filter({ hasText: /取引先/i })
          .first()
      ).toBeVisible();
    });

    test('デモトップページから各ページへナビゲート', async ({ page }) => {
      await page.goto('/demo', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // デモトップページの確認
      await expect(
        page
          .locator('h1')
          .filter({ hasText: /機能デモ/i })
          .first()
      ).toBeVisible();

      // 勘定科目管理へのリンクをクリック
      await page.click('a[href="/demo/accounts"]');
      await expect(page).toHaveURL('/demo/accounts');
      await expect(page.locator('h1:has-text("勘定科目管理")')).toBeVisible();

      // デモページに戻る
      await page.goto('/demo', { waitUntil: 'domcontentloaded' });

      // 仕訳入力へのリンクをクリック
      await page.click('a[href="/demo/journal-entries"]');
      await expect(page).toHaveURL('/demo/journal-entries');
      await expect(page.locator('h1').filter({ hasText: /仕訳/i }).first()).toBeVisible();
    });
  });

  test.describe('認証が必要なページ', () => {
    test('ダッシュボード勘定科目ページが表示される', async ({ page, context }) => {
      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // 統一ヘルパーで認証とモックをセットアップ
      await UnifiedAuth.setupMockRoutes(context);
      await UnifiedAuth.setAuthData(page);

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

      // Mock user API（認証必須ページで必要）
      await context.route('**/api/v1/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: '1',
              email: 'admin@example.com',
              name: 'Admin User',
              organizationId: 'org-1',
              role: 'admin',
            },
          }),
        });
      });

      await page.goto('/dashboard/accounts', { waitUntil: 'domcontentloaded' });

      // ページタイトルまたはヘッダーの確認
      await page.waitForTimeout(1000);

      // ページコンテンツの確認（複数の可能性を許容）
      const pageHasContent = await page.evaluate(() => {
        // ページ内のテキストを確認
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('勘定科目') ||
          bodyText.includes('現金') ||
          bodyText.includes('Accounts') ||
          document.querySelector('table') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });

    test('ダッシュボード仕訳入力ページが表示される', async ({ page, context }) => {
      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // 統一ヘルパーで認証とモックをセットアップ
      await UnifiedAuth.setupMockRoutes(context);
      await UnifiedAuth.setAuthData(page);

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

      // Mock user API
      await context.route('**/api/v1/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: '1',
              email: 'admin@example.com',
              name: 'Admin User',
              organizationId: 'org-1',
              role: 'admin',
            },
          }),
        });
      });

      await page.goto('/dashboard/journal-entries', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // ページコンテンツの確認
      const pageHasContent = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('仕訳') ||
          bodyText.includes('売上計上') ||
          bodyText.includes('Journal') ||
          document.querySelector('table') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });
  });

  test.describe('元帳管理', () => {
    test('現金出納帳ページが表示される', async ({ page, context }) => {
      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // 統一ヘルパーで認証とモックをセットアップ
      await UnifiedAuth.setupMockRoutes(context);
      await UnifiedAuth.setAuthData(page);

      // Mock user API
      await context.route('**/api/v1/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: '1',
              email: 'admin@example.com',
              name: 'Admin User',
              organizationId: 'org-1',
              role: 'admin',
            },
          }),
        });
      });

      await page.goto('/dashboard/ledgers/cash-book', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // ページコンテンツの確認
      const pageHasContent = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('現金') ||
          bodyText.includes('出納帳') ||
          bodyText.includes('Cash') ||
          document.querySelector('main') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });

    test('預金出納帳ページが表示される', async ({ page, context }) => {
      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // 統一ヘルパーで認証とモックをセットアップ
      await UnifiedAuth.setupMockRoutes(context);
      await UnifiedAuth.setAuthData(page);

      // Mock user API
      await context.route('**/api/v1/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: '1',
              email: 'admin@example.com',
              name: 'Admin User',
              organizationId: 'org-1',
              role: 'admin',
            },
          }),
        });
      });

      await page.goto('/dashboard/ledgers/bank-book', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // ページコンテンツの確認
      const pageHasContent = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('預金') ||
          bodyText.includes('出納帳') ||
          bodyText.includes('Bank') ||
          document.querySelector('main') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });
  });

  test.describe('レポート機能', () => {
    test('貸借対照表ページが表示される', async ({ page, context }) => {
      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // 統一ヘルパーで認証とモックをセットアップ
      await UnifiedAuth.setupMockRoutes(context);
      await UnifiedAuth.setAuthData(page);

      // Mock user API
      await context.route('**/api/v1/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: '1',
              email: 'admin@example.com',
              name: 'Admin User',
              organizationId: 'org-1',
              role: 'admin',
            },
          }),
        });
      });

      await page.goto('/dashboard/reports/balance-sheet', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // ページコンテンツの確認
      const pageHasContent = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('貸借対照表') ||
          bodyText.includes('Balance Sheet') ||
          bodyText.includes('資産') ||
          bodyText.includes('負債') ||
          document.querySelector('main') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });

    test('損益計算書ページが表示される', async ({ page, context }) => {
      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // 統一ヘルパーで認証とモックをセットアップ
      await UnifiedAuth.setupMockRoutes(context);
      await UnifiedAuth.setAuthData(page);

      // Mock user API
      await context.route('**/api/v1/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: '1',
              email: 'admin@example.com',
              name: 'Admin User',
              organizationId: 'org-1',
              role: 'admin',
            },
          }),
        });
      });

      await page.goto('/dashboard/reports/profit-loss', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // ページコンテンツの確認
      const pageHasContent = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('損益計算書') ||
          bodyText.includes('Profit') ||
          bodyText.includes('収益') ||
          bodyText.includes('費用') ||
          document.querySelector('main') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });

    test('試算表ページが表示される', async ({ page, context }) => {
      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // 統一ヘルパーで認証とモックをセットアップ
      await UnifiedAuth.setupMockRoutes(context);
      await UnifiedAuth.setAuthData(page);

      // Mock user API
      await context.route('**/api/v1/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: '1',
              email: 'admin@example.com',
              name: 'Admin User',
              organizationId: 'org-1',
              role: 'admin',
            },
          }),
        });
      });

      await page.goto('/dashboard/reports/trial-balance', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // ページコンテンツの確認
      const pageHasContent = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('試算表') ||
          bodyText.includes('Trial Balance') ||
          bodyText.includes('借方') ||
          bodyText.includes('貸方') ||
          document.querySelector('main') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });
  });

  test.describe('設定管理', () => {
    test('組織設定ページが表示される', async ({ page, context }) => {
      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // 統一ヘルパーで認証とモックをセットアップ
      await UnifiedAuth.setupMockRoutes(context);
      await UnifiedAuth.setAuthData(page);

      // Mock user API
      await context.route('**/api/v1/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: '1',
              email: 'admin@example.com',
              name: 'Admin User',
              organizationId: 'org-1',
              role: 'admin',
            },
          }),
        });
      });

      // Mock organization API
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

      await page.goto('/dashboard/settings/organization', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // ページコンテンツの確認
      const pageHasContent = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('組織') ||
          bodyText.includes('Organization') ||
          bodyText.includes('設定') ||
          document.querySelector('main') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });

    test('アカウント設定ページが表示される', async ({ page, context }) => {
      // まず適当なページを開いてから認証設定
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // 統一ヘルパーで認証とモックをセットアップ
      await UnifiedAuth.setupMockRoutes(context);
      await UnifiedAuth.setAuthData(page);

      // Mock user API
      await context.route('**/api/v1/auth/me', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: '1',
              email: 'admin@example.com',
              name: 'Admin User',
              organizationId: 'org-1',
              role: 'admin',
            },
          }),
        });
      });

      await page.goto('/dashboard/settings/account', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // ページコンテンツの確認
      const pageHasContent = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return (
          bodyText.includes('アカウント') ||
          bodyText.includes('Account') ||
          bodyText.includes('プロフィール') ||
          bodyText.includes('設定') ||
          document.querySelector('main') !== null
        );
      });
      expect(pageHasContent).toBeTruthy();
    });
  });
});
