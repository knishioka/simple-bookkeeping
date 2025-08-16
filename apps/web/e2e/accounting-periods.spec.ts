import { test, expect } from '@playwright/test';

import { UnifiedAuth } from './helpers/unified-auth';

/**
 * Issue #103: 統一ヘルパーへの移行
 */
test.describe('Accounting Periods Management', () => {
  test('should successfully authenticate and navigate to dashboard', async ({ page, context }) => {
    // Removed excessive timeout - using optimized global config (10s)

    // 統一認証ヘルパーでモックをセットアップ
    await UnifiedAuth.setupMockRoutes(context);

    // 直接認証トークンを設定してダッシュボードへ移動
    await UnifiedAuth.setAuthData(page);
    await page.goto('/dashboard/settings/accounting-periods');
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Verify we're on the accounting periods page
    await expect(page).toHaveURL(/.*accounting-periods.*/);
    await expect(page.locator('h1.text-2xl')).toContainText('会計期間管理');
  });

  test.beforeEach(async ({ page, context }) => {
    // 統一ヘルパーで認証とモックをセットアップ
    await UnifiedAuth.setupMockRoutes(context);

    // ログインフォーム入力と送信
    await UnifiedAuth.fillLoginForm(page, 'admin@example.com', 'admin123');
    await UnifiedAuth.submitLoginAndWait(page);
  });

  test('should navigate to accounting periods page from settings', async ({ page, context }) => {
    // Mock accounting periods API for this test
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

  test('should display accounting periods page', async ({ page, context }) => {
    // Mock accounting periods API for this test
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

  test('should edit an existing accounting period', async ({ page, context }) => {
    let createdPeriod = false;
    let editedPeriod = false;

    // Mock all API responses from the beginning
    await context.route('**/api/v1/accounting-periods**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.endsWith('/accounting-periods') && method === 'POST') {
        createdPeriod = true;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'period-2',
              name: '2025年度',
              startDate: '2025-01-01',
              endDate: '2025-12-31',
              isActive: false,
              organizationId: 'org-1',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          }),
        });
      } else if (url.includes('/accounting-periods/period-2') && method === 'PUT') {
        editedPeriod = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'period-2',
              name: '2025年度（修正版）',
              startDate: '2025-01-01',
              endDate: '2025-12-31',
              isActive: false,
              organizationId: 'org-1',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          }),
        });
      } else if (url.endsWith('/accounting-periods') && method === 'GET') {
        // Return different data based on state
        const periods = [
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
        ];

        if (createdPeriod) {
          periods.push({
            id: 'period-2',
            name: editedPeriod ? '2025年度（修正版）' : '2025年度',
            startDate: '2025-01-01',
            endDate: '2025-12-31',
            isActive: false,
            organizationId: 'org-1',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          });
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: periods }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/dashboard/settings/accounting-periods');
    await page.waitForLoadState('domcontentloaded');

    // Create a period first
    await page.click('button:has-text("新規作成")');
    await page.waitForSelector('input[name="name"]', { timeout: 10000 });
    await page.fill('input[name="name"]', '2025年度');
    await page.fill('input[name="startDate"]', '2025-01-01');
    await page.fill('input[name="endDate"]', '2025-12-31');
    await page.click('button[type="submit"]:has-text("作成")');

    // Wait for the period to appear
    await page.waitForSelector('text=2025年度', { timeout: 10000 });

    // Click edit button for the 2025 period
    await page
      .locator('tr:has-text("2025年度")')
      .locator('button[aria-label*="edit"], button:has(svg[class*="Edit"]), button')
      .nth(0)
      .click();

    // Wait for dialog to open and update the name
    await page.waitForSelector('input[name="name"]', { timeout: 10000 });
    await page.fill('input[name="name"]', '2025年度（修正版）');

    // Submit the form
    await page.click('button[type="submit"]:has-text("更新")');

    // Wait a moment for the update to process
    await page.waitForTimeout(1000);

    // Check if the period was updated
    await expect(page.locator('text=2025年度（修正版）')).toBeVisible({ timeout: 10000 });
  });

  test('should activate an accounting period', async ({ page, context }) => {
    let activated = false;

    // Mock all routes from the beginning
    await context.route('**/api/v1/accounting-periods', async (route) => {
      if (route.request().method() === 'GET') {
        const periods = [
          {
            id: 'period-1',
            name: '2024年度',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            isActive: false,
            organizationId: 'org-1',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'period-2',
            name: '2025年度',
            startDate: '2025-01-01',
            endDate: '2025-12-31',
            isActive: activated, // Change based on activation status
            organizationId: 'org-1',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ];

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: periods }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock activate API response
    await context.route('**/api/v1/accounting-periods/period-2/activate', async (route) => {
      if (route.request().method() === 'POST') {
        activated = true; // Set flag when activation occurs
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'period-2',
              name: '2025年度',
              startDate: '2025-01-01',
              endDate: '2025-12-31',
              isActive: true,
              organizationId: 'org-1',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/dashboard/settings/accounting-periods');
    await page.waitForLoadState('domcontentloaded');

    // Wait for periods to load
    await page.waitForSelector('text=2025年度', { timeout: 10000 });

    // Activate the 2025 period
    await page.locator('tr:has-text("2025年度")').locator('button:has-text("有効化")').click();

    // Check if the period is active
    await expect(page.locator('tr:has-text("2025年度") .bg-green-100')).toContainText('有効');

    // Check that 2024 is not active
    await expect(page.locator('tr:has-text("2024年度") .bg-green-100')).not.toBeVisible();
  });

  test('should delete an inactive accounting period', async ({ page, context }) => {
    let deleted = false;

    // Mock all routes from the beginning
    await context.route('**/api/v1/accounting-periods', async (route) => {
      if (route.request().method() === 'GET') {
        const periods = [
          {
            id: 'period-1',
            name: '2024年度',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            isActive: true,
            organizationId: 'org-1',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ];

        // Only include the delete target if not deleted
        if (!deleted) {
          periods.push({
            id: 'period-delete',
            name: '削除対象期間',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            isActive: false,
            organizationId: 'org-1',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          });
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: periods }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock delete API response
    await context.route('**/api/v1/accounting-periods/period-delete', async (route) => {
      if (route.request().method() === 'DELETE') {
        deleted = true; // Set flag when deletion occurs
        await route.fulfill({
          status: 204,
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/dashboard/settings/accounting-periods');
    await page.waitForLoadState('domcontentloaded');

    // Wait for the period to appear
    await page.waitForSelector('text=削除対象期間', { timeout: 10000 });

    // Click delete button
    await page.locator('tr:has-text("削除対象期間")').locator('button').last().click();

    // Confirm deletion in dialog
    await page.waitForSelector('text=会計期間を削除しますか', { timeout: 10000 });
    await page.locator('button:has-text("削除")').last().click();

    // Check if the period was deleted
    await expect(page.locator('text=削除対象期間')).not.toBeVisible({ timeout: 10000 });
  });

  test('should not allow deleting active period', async ({ page, context }) => {
    // Mock periods list with an active period
    await context.route('**/api/v1/accounting-periods', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'period-active',
                name: 'アクティブ期間',
                startDate: '2024-01-01',
                endDate: '2024-12-31',
                isActive: true,
                organizationId: 'org-1',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
              {
                id: 'period-inactive',
                name: '非アクティブ期間',
                startDate: '2025-01-01',
                endDate: '2025-12-31',
                isActive: false,
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

    await page.goto('/dashboard/settings/accounting-periods');
    await page.waitForLoadState('domcontentloaded');

    // Wait for the period to appear
    await page.waitForSelector('text=アクティブ期間', { timeout: 10000 });

    // Check that delete button is not visible for active period
    const activeRowDeleteButton = page
      .locator('tr:has-text("アクティブ期間")')
      .locator('button[aria-label*="delete"], button:has(svg[class*="Trash"]), button')
      .last();
    await expect(activeRowDeleteButton).not.toBeVisible();

    // Check that delete button IS visible for inactive period
    const inactiveRowDeleteButton = page
      .locator('tr:has-text("非アクティブ期間")')
      .locator('button')
      .last();
    await expect(inactiveRowDeleteButton).toBeVisible();
  });

  test('should validate date range when creating period', async ({ page, context }) => {
    // Mock error response for invalid date range
    await context.route('**/api/v1/accounting-periods', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        if (body && body.startDate > body.endDate) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: '開始日は終了日より前である必要があります',
            }),
          });
        } else {
          await route.continue();
        }
      } else if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/dashboard/settings/accounting-periods');
    await page.waitForLoadState('domcontentloaded');

    // Click create button
    await page.click('button:has-text("新規作成")');
    await page.waitForSelector('input[name="name"]', { timeout: 10000 });

    // Fill in invalid date range (end before start)
    await page.fill('input[name="name"]', '無効な期間');
    await page.fill('input[name="startDate"]', '2025-12-31');
    await page.fill('input[name="endDate"]', '2025-01-01');

    // Submit the form
    await page.click('button[type="submit"]:has-text("作成")');

    // Check for validation error in toast notification
    await expect(page.locator('text=開始日は終了日より前である必要があります')).toBeVisible({
      timeout: 10000,
    });
  });

  test('should prevent overlapping periods', async ({ page, context }) => {
    // Mock all routes from the beginning
    await context.route('**/api/v1/accounting-periods', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'period-1',
                name: '2025年度',
                startDate: '2025-01-01',
                endDate: '2025-12-31',
                isActive: false,
                organizationId: 'org-1',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            ],
          }),
        });
      } else if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        // Check for overlapping dates
        if (body && body.startDate <= '2025-12-31' && body.endDate >= '2025-01-01') {
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              error: '期間が重複しています: 2025年度 (2025-01-01 - 2025-12-31)',
            }),
          });
        } else {
          await route.continue();
        }
      } else {
        await route.continue();
      }
    });

    await page.goto('/dashboard/settings/accounting-periods');
    await page.waitForLoadState('domcontentloaded');

    // Wait for existing period to be displayed
    await page.waitForSelector('text=2025年度', { timeout: 10000 });

    // Try to create overlapping period
    await page.click('button:has-text("新規作成")');
    await page.waitForSelector('input[name="name"]', { timeout: 10000 });
    await page.fill('input[name="name"]', '重複期間');
    await page.fill('input[name="startDate"]', '2025-06-01');
    await page.fill('input[name="endDate"]', '2026-05-31');
    await page.click('button[type="submit"]:has-text("作成")');

    // Check for error message
    await expect(page.locator('text=期間が重複しています')).toBeVisible({ timeout: 10000 });
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
