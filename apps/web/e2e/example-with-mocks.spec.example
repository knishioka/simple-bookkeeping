/**
 * Example E2E test using the centralized mock management system
 * Issue #201: Demonstrates simplified mock usage
 */

import { test, expect } from '@playwright/test';

import { UnifiedAuth } from './helpers/unified-auth';
import { applyStandardMocks, createMockScenario, mockApiError } from './mocks/api';

test.describe('Example: Using Centralized Mocks', () => {
  test('should load dashboard with basic mock data', async ({ page, context }) => {
    // Apply standard mocks with basic scenario
    const scenario = createMockScenario('basic');
    await applyStandardMocks(context, scenario);

    // Setup authentication
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await UnifiedAuth.setAuthData(page);

    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toContainText('ダッシュボード');
  });

  test('should handle empty data scenario', async ({ page, context }) => {
    // Apply standard mocks with empty scenario
    const scenario = createMockScenario('empty');
    await applyStandardMocks(context, scenario);

    // Setup authentication
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await UnifiedAuth.setAuthData(page);

    // Navigate to accounts page
    await page.goto('/dashboard/accounts');

    // Should show empty state
    await expect(page.locator('text=勘定科目が登録されていません')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page, context }) => {
    // Apply standard mocks
    await applyStandardMocks(context);

    // Mock an API error for journal entries
    await mockApiError(context, '**/api/v1/journal-entries', 'server');

    // Setup authentication
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await UnifiedAuth.setAuthData(page);

    // Navigate to journal entries page
    await page.goto('/dashboard/journal-entries');

    // Should show error message
    await expect(page.locator('[role="alert"]')).toContainText('エラーが発生しました');
  });

  test('should work with complex data scenario', async ({ page, context }) => {
    // Apply standard mocks with complex scenario
    const scenario = createMockScenario('complex');
    await applyStandardMocks(context, scenario);

    // Setup authentication
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await UnifiedAuth.setAuthData(page);

    // Navigate to accounts page
    await page.goto('/dashboard/accounts');

    // Should show all accounts
    await expect(page.locator('table tbody tr')).toHaveCount(5);
  });

  test('should allow custom user roles', async ({ page, context }) => {
    // Apply mocks with viewer role
    await applyStandardMocks(context, {
      user: {
        id: '2',
        email: 'viewer@example.com',
        name: 'Viewer User',
        role: 'viewer',
        permissions: ['accounts:read', 'journal:read'],
      },
    });

    // Setup authentication as viewer
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await UnifiedAuth.setAuthData(page, { role: 'viewer' });

    // Navigate to accounts page
    await page.goto('/dashboard/accounts');

    // Create button should not be visible for viewer
    await expect(page.locator('button:has-text("新規作成")')).not.toBeVisible();
  });
});
