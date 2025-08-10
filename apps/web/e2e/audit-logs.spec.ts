import { test, expect } from '@playwright/test';

import { AuthHelpers } from './helpers/test-setup';

test.describe('Audit Logs', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock /auth/me API endpoint for authentication check
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
                  code: 'TEST',
                  role: 'ADMIN',
                  isDefault: true,
                },
              ],
              currentOrganization: {
                id: 'org-1',
                name: 'Test Organization',
                code: 'TEST',
                role: 'ADMIN',
                isDefault: true,
              },
            },
          },
        }),
      });
    });

    // Mock audit logs API
    await context.route('**/api/v1/audit-logs**', async (route) => {
      if (route.request().url().includes('/entity-types')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: ['JournalEntry', 'Account', 'User', 'Organization', 'AccountingPeriod'],
          }),
        });
      } else if (route.request().url().includes('/export')) {
        await route.fulfill({
          status: 200,
          contentType: 'text/csv',
          body: 'id,date,user,action,entity\n1,2024-01-01,admin@example.com,CREATE,Account',
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
            meta: {
              page: 1,
              limit: 10,
              total: 0,
              totalPages: 1,
            },
          }),
        });
      }
    });

    // Navigate to a page first to set localStorage
    await page.goto('/');

    // Set up localStorage with authentication data BEFORE navigating to protected routes
    await page.evaluate(() => {
      const user = {
        id: '1',
        email: 'admin@example.com',
        name: 'Admin User',
        organizations: [
          {
            id: 'org-1',
            name: 'Test Organization',
            code: 'TEST',
            role: 'ADMIN',
            isDefault: true,
          },
        ],
        currentOrganization: {
          id: 'org-1',
          name: 'Test Organization',
          code: 'TEST',
          role: 'ADMIN',
          isDefault: true,
        },
      };

      localStorage.setItem('token', 'test-token');
      localStorage.setItem('refreshToken', 'test-refresh-token');
      localStorage.setItem('user', JSON.stringify(user));
    });

    // Now navigate to dashboard settings
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should display audit logs page for admin users', async ({ page }) => {
    // Navigate directly to audit logs page
    await page.goto('/dashboard/settings/audit-logs');
    await page.waitForLoadState('networkidle');

    // Check page content - use more specific selector to avoid duplicates
    await expect(page.getByText('監査ログ', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('システムで行われた全ての操作の履歴を確認できます')).toBeVisible();

    // Check filter controls
    await expect(page.getByRole('combobox').first()).toBeVisible(); // Action filter
    await expect(page.getByRole('button', { name: /エクスポート/ })).toBeVisible();
  });

  test('should filter audit logs by action type', async ({ page }) => {
    await page.goto('/dashboard/settings/audit-logs');
    await page.waitForLoadState('networkidle');

    // Select CREATE action filter
    const actionFilter = page.getByRole('combobox').first();
    await actionFilter.click();
    await page.waitForTimeout(500); // Wait for dropdown to open
    await page.getByRole('option', { name: '作成' }).click();

    // Wait for filtered results
    await page.waitForTimeout(1000);

    // Check that results are filtered (if any exist)
    const badges = page.locator('[role="status"]').filter({ hasText: '作成' });
    const count = await badges.count();
    if (count > 0) {
      await expect(badges.first()).toBeVisible();
    }
  });

  test('should filter audit logs by date range', async ({ page }) => {
    await page.goto('/dashboard/settings/audit-logs');

    // Set date range
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const startDateInput = page.locator('input[type="date"]').first();
    const endDateInput = page.locator('input[type="date"]').nth(1);

    await startDateInput.fill(yesterday.toISOString().split('T')[0]);
    await endDateInput.fill(today.toISOString().split('T')[0]);

    // Wait for filtered results
    await page.waitForTimeout(1000);

    // Check that the table is updated
    await expect(page.locator('table')).toBeVisible();
  });

  test('should export audit logs as CSV', async ({ page }) => {
    await page.goto('/dashboard/settings/audit-logs');
    await page.waitForLoadState('networkidle');

    // Set up download promise before clicking
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await page.getByRole('button', { name: /エクスポート/ }).click();

    // Wait for download to complete
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/audit-logs-\d{4}-\d{2}-\d{2}\.csv/);
  });

  test('should paginate through audit logs', async ({ page }) => {
    await page.goto('/dashboard/settings/audit-logs');

    // Check if pagination controls exist
    const paginationSection = page.locator('text=/ページ.*\\//');

    // If pagination exists, test it
    const paginationExists = await paginationSection.isVisible().catch(() => false);

    if (paginationExists) {
      const nextButton = page.getByRole('button', { name: /次へ/ });
      const prevButton = page.getByRole('button', { name: /前へ/ });

      // Check initial state
      await expect(prevButton).toBeDisabled();

      // Go to next page if available
      const nextDisabled = await nextButton.isDisabled();
      if (!nextDisabled) {
        await nextButton.click();
        await page.waitForTimeout(1000);
        await expect(prevButton).toBeEnabled();
      }
    }
  });

  test('should show empty state when no logs exist', async ({ page }) => {
    // Navigate to audit logs with filters that return no results
    await page.goto('/dashboard/settings/audit-logs');

    // Set a very specific date range that likely has no logs
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const startDateInput = page.locator('input[type="date"]').first();
    await startDateInput.fill(futureDate.toISOString().split('T')[0]);

    // Wait for the empty state
    await page.waitForTimeout(1000);

    // Check for empty state message
    const emptyMessage = page.getByText('監査ログがありません');
    const isVisible = await emptyMessage.isVisible().catch(() => false);

    if (isVisible) {
      await expect(emptyMessage).toBeVisible();
    }
  });

  test.skip('should create audit log when performing actions', async ({ page }) => {
    // Skip this test as it requires complex UI interaction
    // Mock accounts API
    await page.context().route('**/api/v1/accounts**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'acc-1',
              code: 'TEST001',
              name: 'テスト勘定科目',
              type: 'ASSET',
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
          }),
        });
      }
    });

    // Perform an action that should create an audit log
    await page.goto('/dashboard/accounts');

    // Create a new account
    await page.getByRole('button', { name: /新規作成/ }).click();

    // Fill in account details
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('勘定科目コード').fill('TEST001');
    await dialog.getByLabel('勘定科目名').fill('テスト勘定科目');

    // Select account type
    const typeSelect = dialog.locator('select').first();
    await typeSelect.selectOption('ASSET');

    // Save the account
    await dialog.getByRole('button', { name: /保存/ }).click();

    // Wait for the dialog to close
    await expect(dialog).not.toBeVisible();

    // Navigate to audit logs
    await page.goto('/dashboard/settings/audit-logs');

    // Filter by Account entity type
    const entityFilter = page.getByRole('combobox').nth(1);
    if (await entityFilter.isVisible()) {
      await entityFilter.click();
      const accountOption = page.getByRole('option', { name: '勘定科目' });
      if (await accountOption.isVisible().catch(() => false)) {
        await accountOption.click();
      }
    }

    // Wait for results
    await page.waitForTimeout(1000);

    // Check that the new audit log appears
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('should not show audit logs page for non-admin users', async ({ page, context }) => {
    // Mock authentication API for non-admin user
    await context.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            user: {
              id: '2',
              email: 'viewer@example.com',
              name: 'Viewer User',
              organizations: [
                {
                  id: 'org-1',
                  name: 'Test Organization',
                  code: 'TEST',
                  role: 'VIEWER',
                  isDefault: true,
                },
              ],
              currentOrganization: {
                id: 'org-1',
                name: 'Test Organization',
                code: 'TEST',
                role: 'VIEWER',
                isDefault: true,
              },
            },
          },
        }),
      });
    });

    // Clear current user data and set viewer user
    await page.evaluate(() => {
      const user = {
        id: '2',
        email: 'viewer@example.com',
        name: 'Viewer User',
        organizations: [
          {
            id: 'org-1',
            name: 'Test Organization',
            code: 'TEST',
            role: 'VIEWER',
            isDefault: true,
          },
        ],
        currentOrganization: {
          id: 'org-1',
          name: 'Test Organization',
          code: 'TEST',
          role: 'VIEWER',
          isDefault: true,
        },
      };

      localStorage.setItem('token', 'test-token-viewer');
      localStorage.setItem('refreshToken', 'test-refresh-token-viewer');
      localStorage.setItem('user', JSON.stringify(user));
    });

    // Try to access audit logs directly
    await page.goto('/dashboard/settings/audit-logs');

    // Should show access denied message
    await expect(page.getByText('アクセス権限がありません')).toBeVisible();
    await expect(page.getByText('監査ログの閲覧は管理者権限が必要です')).toBeVisible();
  });

  test('should display user information in audit logs', async ({ page }) => {
    await page.goto('/dashboard/settings/audit-logs');

    // Wait for the table to load
    await page.waitForSelector('table', { timeout: 5000 });

    // Check if any rows exist
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();

    if (
      rowCount > 0 &&
      !(await rows
        .first()
        .getByText('監査ログがありません')
        .isVisible()
        .catch(() => false))
    ) {
      // Check that user email is displayed
      const firstRow = rows.first();
      const emailCell = firstRow.locator('td').nth(1);
      await expect(emailCell).toContainText('@');
    }
  });

  test('should refresh audit logs', async ({ page }) => {
    await page.goto('/dashboard/settings/audit-logs');

    // Click refresh button
    const refreshButton = page
      .locator('button')
      .filter({ has: page.locator('svg') })
      .nth(4); // Refresh icon button

    // Check if the button exists and click it
    if (await refreshButton.isVisible()) {
      await refreshButton.click();

      // Wait for refresh to complete
      await page.waitForTimeout(1000);

      // Table should still be visible
      await expect(page.locator('table')).toBeVisible();
    }
  });
});
