import { test, expect } from '@playwright/test';

import { setupTestData, cleanupTestData } from './helpers/test-setup';

test.describe('Accounting Periods Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestData();

    // Login as admin
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL('/dashboard');
  });

  test.afterEach(async () => {
    await cleanupTestData();
  });

  test('should navigate to accounting periods page from settings', async ({ page }) => {
    // Navigate to settings
    await page.goto('/dashboard/settings');

    // Click on accounting periods link
    await page.click('text=会計期間');

    // Should navigate to accounting periods page
    await expect(page).toHaveURL('/dashboard/settings/accounting-periods');
    await expect(page.locator('h1')).toContainText('会計期間管理');
  });

  test('should create a new accounting period', async ({ page }) => {
    await page.goto('/dashboard/settings/accounting-periods');

    // Click create button
    await page.click('button:has-text("新規作成")');

    // Fill in the form
    await page.fill('input[name="name"]', '2025年度');
    await page.fill('input[name="startDate"]', '2025-01-01');
    await page.fill('input[name="endDate"]', '2025-12-31');

    // Submit the form
    await page.click('button:has-text("作成")');

    // Check if the period was created
    await expect(page.locator('text=2025年度')).toBeVisible();
    await expect(page.locator('text=2025/01/01')).toBeVisible();
    await expect(page.locator('text=2025/12/31')).toBeVisible();
  });

  test('should edit an existing accounting period', async ({ page }) => {
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

  test('should activate an accounting period', async ({ page }) => {
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

  test('should delete an inactive accounting period', async ({ page }) => {
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

  test('should not allow deleting active period', async ({ page }) => {
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

  test('should validate date range when creating period', async ({ page }) => {
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

  test('should prevent overlapping periods', async ({ page }) => {
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

  test('should show empty state when no periods exist', async ({ page }) => {
    await page.goto('/dashboard/settings/accounting-periods');

    // Check for empty state message
    await expect(page.locator('text=会計期間が登録されていません')).toBeVisible();

    // Check for create button in empty state
    await expect(page.locator('button:has-text("最初の会計期間を作成")')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await page.goto('/dashboard/settings/accounting-periods');

    // Intercept API call and return error
    await page.route('/api/v1/accounting-periods', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Reload the page
    await page.reload();

    // Check for error toast
    await expect(page.locator('text=会計期間の取得に失敗しました')).toBeVisible();
  });
});
