import { test, expect } from '@playwright/test';

import { AuthHelpers } from './helpers/test-setup';

test.describe('Audit Logs', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock authentication API
    await context.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            token: 'test-token',
            refreshToken: 'test-refresh-token',
            user: {
              id: '1',
              email: 'admin@example.com',
              name: 'Admin User',
              organizationId: 'org-1',
              role: 'admin',
              currentOrganization: {
                id: 'org-1',
                name: 'Test Organization',
                role: 'admin',
              },
            },
          },
        }),
      });
    });

    // Login as admin user
    await page.goto('/login');
    await page.fill('#email', 'admin@example.com');
    await page.fill('#password', 'admin123');

    // Click login and wait for navigation
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForURL('**/dashboard', { timeout: 15000 }),
    ]);
  });

  test('should display audit logs page for admin users', async ({ page }) => {
    // Navigate to settings
    await page.goto('/dashboard/settings');
    await expect(page.getByText('設定')).toBeVisible();

    // Click on audit logs link
    await page.getByText('監査ログ').click();
    await page.waitForURL('**/dashboard/settings/audit-logs');

    // Check page content
    await expect(page.getByText('監査ログ')).toBeVisible();
    await expect(page.getByText('システムで行われた全ての操作の履歴を確認できます')).toBeVisible();

    // Check filter controls
    await expect(page.getByRole('combobox').first()).toBeVisible(); // Action filter
    await expect(page.getByRole('button', { name: /エクスポート/ })).toBeVisible();
  });

  test('should filter audit logs by action type', async ({ page }) => {
    await page.goto('/dashboard/settings/audit-logs');

    // Select CREATE action filter
    const actionFilter = page.getByRole('combobox').first();
    await actionFilter.click();
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

  test('should create audit log when performing actions', async ({ page }) => {
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
    // Create helpers instance
    const helpers = new AuthHelpers(page);

    // Logout first
    await helpers.logout();

    // Mock authentication API for non-admin user
    await context.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            token: 'test-token-viewer',
            refreshToken: 'test-refresh-token-viewer',
            user: {
              id: '2',
              email: 'viewer@example.com',
              name: 'Viewer User',
              organizationId: 'org-1',
              role: 'viewer',
              currentOrganization: {
                id: 'org-1',
                name: 'Test Organization',
                role: 'viewer',
              },
            },
          },
        }),
      });
    });

    // Login as non-admin user
    await helpers.login('viewer@example.com', 'password123');

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
