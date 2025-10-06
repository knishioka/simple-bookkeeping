/**
 * 会計期間ページテスト（シンプル版 v2）
 * Issue #520: Storage State採用により認証ロジックを完全に削除
 *
 * Before: UnifiedMock.setupAll() + SupabaseAuth.setup() の複雑な2段階認証
 * After: Storage Stateによる自動認証 - テストコードから認証ロジックが消失
 */

import { test, expect } from '@playwright/test';

test.describe('会計期間ページ', () => {
  test('会計期間ページが正常に読み込まれる', async ({ page }) => {
    // Storage Stateにより既に認証済み - 直接ページに移動
    await page.goto('/dashboard/settings/accounting-periods');

    // ページが正常に表示されることを確認
    // (ログインページにリダイレクトされない)
    expect(page.url()).toContain('accounting-periods');

    // ページ内容の基本的な確認
    const bodyText = await page.locator('body').textContent();

    // ページが空でないことを確認
    expect(bodyText).toBeTruthy();
    if (bodyText) {
      expect(bodyText.length).toBeGreaterThan(0);

      // 設定関連のUIが表示されていることを確認
      const hasSettings =
        bodyText.includes('会計期間') ||
        bodyText.includes('設定') ||
        bodyText.includes('Settings') ||
        bodyText.includes('Accounting');

      expect(hasSettings).toBeTruthy();
    }
  });

  test('認証状態が維持されている', async ({ page }) => {
    // ダッシュボードに移動
    await page.goto('/dashboard');
    expect(page.url()).toContain('/dashboard');

    // 会計期間ページに移動
    await page.goto('/dashboard/settings/accounting-periods');
    expect(page.url()).toContain('accounting-periods');

    // ページ間の移動でも認証状態が維持されることを確認
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('login');
  });
});
