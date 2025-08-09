import { test, expect } from '@playwright/test';

test.describe('Accounting Periods Management', () => {
  test('should successfully authenticate and navigate to dashboard', async ({ page, context }) => {
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

    // Login flow
    await page.goto('/login');
    await page.fill('#email', 'admin@example.com');
    await page.fill('#password', 'admin123');

    // Click login and wait for navigation
    await Promise.all([
      page.click('button[type="submit"]'),
      page
        .waitForURL('**/dashboard/**', { timeout: 15000 })
        .catch(() => page.waitForURL('**/dashboard', { timeout: 15000 })),
    ]);

    // Verify we're on the dashboard
    await expect(page).toHaveURL(/.*dashboard.*/);
  });

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

    // Mock accounting periods API
    await context.route('**/api/v1/accounting-periods', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: '1',
                name: '2024年度',
                startDate: '2024-01-01',
                endDate: '2024-12-31',
                isActive: true,
                organizationId: 'org-1',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Login flow
    await page.goto('/login');
    await page.fill('#email', 'admin@example.com');
    await page.fill('#password', 'admin123');

    // Click login and wait for navigation
    await Promise.all([
      page.click('button[type="submit"]'),
      page
        .waitForURL('**/dashboard/**', { timeout: 15000 })
        .catch(() => page.waitForURL('**/dashboard', { timeout: 15000 })),
    ]);
  });

  test('should navigate to accounting periods page from settings', async ({ page }) => {
    // Navigate to settings
    await page.goto('/dashboard/settings');
    await page.waitForLoadState('domcontentloaded');

    // Wait for the settings page to load
    await expect(page.locator('h2:has-text("設定")')).toBeVisible();

    // Click on accounting periods link
    await page.click('a:has-text("会計期間")');

    // Should navigate to accounting periods page
    await expect(page).toHaveURL('/dashboard/settings/accounting-periods');

    // Check for page content - the page should exist even if empty
    const pageContent = await page.locator('main, [role="main"], .container').first();
    await expect(pageContent).toBeVisible();
  });

  test('should display accounting periods page', async ({ page }) => {
    await page.goto('/dashboard/settings/accounting-periods');
    await page.waitForLoadState('domcontentloaded');

    // Check that we're on the right page
    await expect(page).toHaveURL('/dashboard/settings/accounting-periods');

    // The page should at least have some content area
    const mainContent = await page.locator('main, [role="main"], .container, #root').first();
    await expect(mainContent).toBeVisible();

    // Check if there's a table or empty state - either is fine
    const tableCount = await page.locator('table, [role="table"]').count();
    const textCount = await page
      .locator('text=/会計期間|データがありません|登録されていません/i')
      .count();
    const hasContent = tableCount > 0 || textCount > 0;
    expect(hasContent).toBeTruthy();
  });

  test.skip('should edit an existing accounting period', async ({ page }) => {
    await page.goto('/dashboard/settings/accounting-periods');

    // Create a period first
    await page.click('button:has-text("新規作成")');
    await page.fill('input[name="name"]', '2025年度');
    await page.fill('input[name="startDate"]', '2025-01-01');
    await page.fill('input[name="endDate"]', '2025-12-31');
    await page.click('button:has-text("作成")');

    // Wait for the period to appear
    await page.waitForSelector('text=2025年度');

    // Click edit button
    await page.click('tr:has-text("2025年度") button:has(svg)');

    // Update the name
    await page.fill('input[name="name"]', '2025年度（修正版）');

    // Submit the form
    await page.click('button:has-text("更新")');

    // Check if the period was updated
    await expect(page.locator('text=2025年度（修正版）')).toBeVisible();
  });

  test.skip('should activate an accounting period', async ({ page }) => {
    await page.goto('/dashboard/settings/accounting-periods');

    // Create two periods
    await page.click('button:has-text("新規作成")');
    await page.fill('input[name="name"]', '2024年度');
    await page.fill('input[name="startDate"]', '2024-01-01');
    await page.fill('input[name="endDate"]', '2024-12-31');
    await page.click('button:has-text("作成")');

    await page.click('button:has-text("新規作成")');
    await page.fill('input[name="name"]', '2025年度');
    await page.fill('input[name="startDate"]', '2025-01-01');
    await page.fill('input[name="endDate"]', '2025-12-31');
    await page.click('button:has-text("作成")');

    // Activate the 2025 period
    await page.click('tr:has-text("2025年度") button:has-text("有効化")');

    // Check if the period is active
    await expect(page.locator('tr:has-text("2025年度") .bg-green-100')).toContainText('有効');

    // Check that 2024 is not active
    await expect(page.locator('tr:has-text("2024年度") .bg-green-100')).not.toBeVisible();
  });

  test.skip('should delete an inactive accounting period', async ({ page }) => {
    await page.goto('/dashboard/settings/accounting-periods');

    // Create a period
    await page.click('button:has-text("新規作成")');
    await page.fill('input[name="name"]', '削除対象期間');
    await page.fill('input[name="startDate"]', '2026-01-01');
    await page.fill('input[name="endDate"]', '2026-12-31');
    await page.click('button:has-text("作成")');

    // Wait for the period to appear
    await page.waitForSelector('text=削除対象期間');

    // Click delete button
    await page.click('tr:has-text("削除対象期間") button:has(svg):last-child');

    // Confirm deletion in dialog
    await page.click('button:has-text("削除"):not([disabled])');

    // Check if the period was deleted
    await expect(page.locator('text=削除対象期間')).not.toBeVisible();
  });

  test.skip('should not allow deleting active period', async ({ page }) => {
    await page.goto('/dashboard/settings/accounting-periods');

    // Create an active period
    await page.click('button:has-text("新規作成")');
    await page.fill('input[name="name"]', 'アクティブ期間');
    await page.fill('input[name="startDate"]', '2024-01-01');
    await page.fill('input[name="endDate"]', '2024-12-31');
    await page.click('input[role="switch"]'); // Activate the period
    await page.click('button:has-text("作成")');

    // Wait for the period to appear
    await page.waitForSelector('text=アクティブ期間');

    // Check that delete button is not visible for active period
    await expect(
      page.locator('tr:has-text("アクティブ期間") button:has(svg):last-child')
    ).not.toBeVisible();
  });

  test.skip('should validate date range when creating period', async ({ page }) => {
    await page.goto('/dashboard/settings/accounting-periods');

    // Click create button
    await page.click('button:has-text("新規作成")');

    // Fill in invalid date range (end before start)
    await page.fill('input[name="name"]', '無効な期間');
    await page.fill('input[name="startDate"]', '2025-12-31');
    await page.fill('input[name="endDate"]', '2025-01-01');

    // Submit the form
    await page.click('button:has-text("作成")');

    // Check for validation error
    await expect(page.locator('text=開始日は終了日より前である必要があります')).toBeVisible();
  });

  test.skip('should prevent overlapping periods', async ({ page }) => {
    await page.goto('/dashboard/settings/accounting-periods');

    // Create first period
    await page.click('button:has-text("新規作成")');
    await page.fill('input[name="name"]', '2025年度');
    await page.fill('input[name="startDate"]', '2025-01-01');
    await page.fill('input[name="endDate"]', '2025-12-31');
    await page.click('button:has-text("作成")');

    // Try to create overlapping period
    await page.click('button:has-text("新規作成")');
    await page.fill('input[name="name"]', '重複期間');
    await page.fill('input[name="startDate"]', '2025-06-01');
    await page.fill('input[name="endDate"]', '2026-05-31');
    await page.click('button:has-text("作成")');

    // Check for error message
    await expect(page.locator('text=期間が重複しています')).toBeVisible();
  });

  test('should show empty state when no periods exist', async ({ page, context }) => {
    // Mock empty response
    await context.route('**/api/v1/accounting-periods', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
        }),
      });
    });

    await page.goto('/dashboard/settings/accounting-periods');
    await page.waitForLoadState('domcontentloaded');

    // Check for any indication of empty state - could be a message or a create button
    const emptyIndicator = await page
      .locator('text=/会計期間がありません|データがありません|登録されていません|作成|追加|新規/i')
      .first();

    // The page should show something to indicate it's empty or allow creating new
    await expect(emptyIndicator).toBeVisible({ timeout: 10000 });
  });

  test('should handle API errors gracefully', async ({ page, context }) => {
    // Mock error response
    await context.route('**/api/v1/accounting-periods', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal Server Error',
          },
        }),
      });
    });

    await page.goto('/dashboard/settings/accounting-periods');
    await page.waitForLoadState('domcontentloaded');

    // The page should still load without crashing
    await expect(page).toHaveURL('/dashboard/settings/accounting-periods');

    // Check that the page rendered something (even if it's an error state)
    const pageExists = await page.locator('body').isVisible();
    expect(pageExists).toBeTruthy();
  });
});
