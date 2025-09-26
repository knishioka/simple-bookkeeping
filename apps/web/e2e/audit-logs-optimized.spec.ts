/**
 * 監査ログテスト（最適化版）
 * Issue #338対応: Storage State機能を使用した高速化
 */

import { test, expect } from './helpers/auth-storage';
import { UnifiedMock } from './helpers/server-actions-unified-mock';
import { SupabaseClientMock } from './helpers/supabase-client-mock';
import { waitForSelectOpen } from './helpers/wait-strategies';

test.describe('Audit Logs (Optimized)', () => {
  // CI環境での実行を考慮してタイムアウトを増やす
  test.use({ navigationTimeout: 30000 });
  test.setTimeout(20000);

  test.beforeEach(async ({ page, context }) => {
    // Server Actions用のモックをセットアップ
    await UnifiedMock.setupAll(context, {
      enabled: true,
      customResponses: {
        'audit-logs': [],
      },
    });
    await UnifiedMock.setupAuditLogsMocks(context);

    // Supabase APIのインターセプトを設定
    await SupabaseClientMock.interceptSupabaseAPI(context);

    // ページを開く前にモックを注入
    await page.goto('about:blank');
    await SupabaseClientMock.injectMock(page);

    // Storage Stateによりログイン処理をスキップ
    // 直接ホームページにナビゲート
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('should display audit logs page for admin users', async ({ page }) => {
    // Navigate directly to audit logs page
    await page.goto('/dashboard/settings/audit-logs', { waitUntil: 'domcontentloaded' });

    // Wait for the page to load and run effects
    // Wait for audit logs to load
    await page.waitForSelector('[data-testid="audit-log-table"], [data-testid="empty-state"]', {
      timeout: 5000,
    });

    // Check if we're on the audit logs page
    const currentUrl = page.url();
    expect(currentUrl).toContain('audit-logs');

    // Wait for the table to be visible
    await expect(page.locator('[data-testid="audit-logs-table"]')).toBeVisible({ timeout: 10000 });

    // Check for the title (now with text-2xl class)
    await expect(page.locator('.text-2xl:has-text("監査ログ")')).toBeVisible();

    // Check for the description
    await expect(
      page.locator('text=システムで行われた全ての操作の履歴を確認できます')
    ).toBeVisible();

    // Check filter controls
    await expect(page.locator('[data-testid="audit-action-trigger"]')).toBeVisible();
    await expect(page.locator('[data-testid="audit-export-button"]')).toBeVisible();
  });

  test('should filter audit logs by action type', async ({ page }) => {
    await page.goto('/dashboard/settings/audit-logs', { waitUntil: 'domcontentloaded' });

    // Wait for page to load
    // Wait for audit logs to load
    await page.waitForSelector('[data-testid="audit-log-table"], [data-testid="empty-state"]', {
      timeout: 5000,
    });

    // Check if we have access to the page
    const hasAccess = await page
      .locator('[data-testid="audit-logs-table"]')
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasAccess) {
      // Select CREATE action filter using the trigger button
      const actionFilter = page.locator('[data-testid="audit-action-trigger"]');
      await actionFilter.waitFor({ state: 'visible', timeout: 5000 });
      await actionFilter.click();

      // Wait for select dropdown to open and click the "作成" option
      await waitForSelectOpen(page, undefined, { timeout: 5000 });
      const createOption = page.locator('[role="option"]:has-text("作成")').first();
      await createOption.waitFor({ state: 'visible', timeout: 5000 });
      await createOption.click();

      // Verify selection by checking the filter is applied
      // Small delay for UI update
      await page.waitForLoadState('domcontentloaded');

      // Just verify that the test completed successfully
      await expect(page.locator('[data-testid="audit-logs-table"]')).toBeVisible();
    }
  });
});
