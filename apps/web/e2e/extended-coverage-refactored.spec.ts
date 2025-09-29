import { test, expect } from '@playwright/test';

import { UnifiedMock } from './helpers/server-actions-unified-mock';
import { DashboardPage } from './page-objects/dashboard.page';
import { LoginPage } from './page-objects/login.page';
import { ReportsPage } from './page-objects/reports.page';

/**
 * Refactored Extended E2E Test Coverage using Page Object Model
 * Issue #476: Test quality improvement with POM pattern
 */
test.describe('Extended Coverage with Page Object Model', () => {
  // Skip in CI until environment setup is complete
  test.skip(
    process.env.CI === 'true',
    'Temporarily skipped in CI - POM pattern demonstration for local development'
  );

  test.use({ navigationTimeout: 30000 });
  test.setTimeout(20000);

  test.describe('Authenticated Pages', () => {
    let loginPage: LoginPage;
    let dashboardPage: DashboardPage;
    let reportsPage: ReportsPage;

    test.beforeEach(async ({ page, context }) => {
      // Initialize page objects
      loginPage = new LoginPage(page, context);
      dashboardPage = new DashboardPage(page);
      reportsPage = new ReportsPage(page);

      // Setup mocks
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

      // Setup authentication
      await loginPage.setupAuth('admin');
    });

    test('Dashboard accounts page displays correctly', async ({ context }) => {
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

      await dashboardPage.navigateToSection('accounts');
      await dashboardPage.waitForDashboardReady();

      const hasContent = await dashboardPage.isPageContentVisible([
        '勘定科目',
        'Accounts',
        '現金',
        '売掛金',
      ]);
      expect(hasContent).toBeTruthy();

      const isNavVisible = await dashboardPage.isNavigationVisible();
      expect(isNavVisible).toBeTruthy();
    });

    test('Journal entries page displays correctly', async () => {
      await dashboardPage.navigateToSection('journal');
      await dashboardPage.waitForDashboardReady();

      const hasContent = await dashboardPage.isPageContentVisible([
        '仕訳',
        'Journal',
        '借方',
        '貸方',
      ]);
      expect(hasContent).toBeTruthy();
    });

    test.describe('Report Pages', () => {
      test('Balance sheet report displays correctly', async () => {
        await reportsPage.navigateToReport('balance-sheet');
        const isLoaded = await reportsPage.isReportLoaded('balance-sheet');
        expect(isLoaded).toBeTruthy();

        const title = await reportsPage.getReportTitle();
        expect(title).toMatch(/貸借対照表|Balance Sheet/);
      });

      test('Profit & Loss report displays correctly', async ({ context }) => {
        // Mock P&L API response
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

        await reportsPage.navigateToReport('profit-loss');
        const isLoaded = await reportsPage.isReportLoaded('profit-loss');
        expect(isLoaded).toBeTruthy();
      });

      test('Trial balance report displays correctly', async () => {
        await reportsPage.navigateToReport('trial-balance');
        const isLoaded = await reportsPage.isReportLoaded('trial-balance');
        expect(isLoaded).toBeTruthy();
      });

      test('Cash book ledger displays correctly', async () => {
        await reportsPage.navigateToReport('cash-book');
        const isLoaded = await reportsPage.isReportLoaded('cash-book');
        expect(isLoaded).toBeTruthy();
      });

      test('Bank book ledger displays correctly', async () => {
        await reportsPage.navigateToReport('bank-book');
        const isLoaded = await reportsPage.isReportLoaded('bank-book');
        expect(isLoaded).toBeTruthy();
      });
    });

    test.describe('Settings Pages', () => {
      test('Organization settings page displays correctly', async ({ page }) => {
        await page.goto('/dashboard/settings/organization', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle');

        const hasContent = await dashboardPage.isPageContentVisible([
          '組織設定',
          'Organization',
          'Settings',
        ]);
        expect(hasContent).toBeTruthy();
      });

      test('Account settings page displays correctly', async ({ page }) => {
        await page.goto('/dashboard/settings/account', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle');

        const hasContent = await dashboardPage.isPageContentVisible([
          'アカウント',
          'Account',
          'プロフィール',
          'Profile',
        ]);
        expect(hasContent).toBeTruthy();
      });
    });
  });

  test.describe('Unauthenticated Pages', () => {
    test('Login page displays correctly', async ({ page }) => {
      const loginPage = new LoginPage(page, page.context());
      await loginPage.goto();

      const hasLoginForm = await page.locator('input[type="email"]').isVisible({ timeout: 5000 });
      expect(hasLoginForm).toBeTruthy();
    });

    test('Homepage displays correctly', async ({ page }) => {
      await page.goto('/', { waitUntil: 'networkidle' });

      const hasContent = await page.locator('text=Simple Bookkeeping').isVisible({ timeout: 5000 });
      expect(hasContent).toBeTruthy();
    });
  });
});
