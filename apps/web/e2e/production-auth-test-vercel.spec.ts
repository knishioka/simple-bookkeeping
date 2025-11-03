import { test, expect } from '@playwright/test';

import { describeProductionAuth } from './utils/production-test-guard';

/**
 * Vercel Production Authentication Test
 *
 * このテストは本番環境（Vercel）のSupabaseで新規会員登録とログインをテストします。
 */

describeProductionAuth('Vercel Production Authentication Test', () => {
  // ランダムなテストユーザー情報を生成
  const timestamp = Date.now();
  const testUser = {
    name: `Test User ${timestamp}`,
    email: `test-user-${timestamp}@example.com`,
    password: `TestPassword123!${timestamp}`,
    organizationName: `Test Organization ${timestamp}`,
  };

  const PROD_URL = 'https://simple-bookkeeping-jp.vercel.app';

  test('should successfully sign up a new user in production', async ({ page }) => {
    console.log('🧪 Testing signup with:', testUser.email);
    console.log('🌍 Testing on:', PROD_URL);

    // 新規会員登録ページに移動
    await page.goto(`${PROD_URL}/auth/signup`);

    // ページが完全に読み込まれるまで待機
    await page.waitForLoadState('networkidle');

    // フォームの表示を確認
    await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible();

    // 登録フォームに入力
    await page.fill('input[name="organizationName"]', testUser.organizationName);
    await page.fill('input[name="name"]', testUser.name);
    await page.fill('input[name="email"], input[type="email"]', testUser.email);

    // パスワードフィールドを順番に入力
    const passwordFields = await page.locator('input[type="password"]').all();
    await passwordFields[0].fill(testUser.password); // パスワード
    await passwordFields[1].fill(testUser.password); // パスワード（確認）

    // 送信ボタンをクリック
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();

    // リダイレクトまたは成功メッセージを待機
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // URLを確認
    const currentUrl = page.url();
    console.log('✅ After signup, URL:', currentUrl);

    // エラーメッセージが表示されていないことを確認
    const errorMessage = page.locator('text=/error|失敗|エラー/i');
    const hasError = await errorMessage.isVisible().catch(() => false);

    if (hasError) {
      const errorText = await errorMessage.textContent();
      console.error('❌ Error message found:', errorText);
    }

    expect(hasError).toBe(false);

    // 登録成功の確認
    const isSuccessful =
      currentUrl.includes('/dashboard') ||
      currentUrl.includes('/confirm') ||
      currentUrl.includes('/verify');

    expect(isSuccessful).toBe(true);

    console.log('✅ Signup test completed successfully');
  });

  test('should successfully login with the created user', async ({ page }) => {
    console.log('🧪 Testing login with:', testUser.email);

    // ログインページに移動
    await page.goto(`${PROD_URL}/auth/login`);

    // ページが完全に読み込まれるまで待機
    await page.waitForLoadState('networkidle');

    // ログインフォームの表示を確認
    await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible();

    // ログインフォームに入力
    await page.fill('input[name="email"], input[type="email"]', testUser.email);
    await page.fill('input[name="password"], input[type="password"]', testUser.password);

    // ログインボタンをクリック
    const loginButton = page.locator('button[type="submit"]').first();
    await loginButton.click();

    // リダイレクトを待機
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // URLを確認
    const currentUrl = page.url();
    console.log('✅ After login, URL:', currentUrl);

    // エラーメッセージが表示されていないことを確認
    const errorMessage = page.locator('text=/error|失敗|エラー|invalid|incorrect/i');
    const hasError = await errorMessage.isVisible().catch(() => false);

    if (hasError) {
      const errorText = await errorMessage.textContent();
      console.error('❌ Error message found:', errorText);
    }

    expect(hasError).toBe(false);

    // ダッシュボードにリダイレクトされたことを確認
    expect(currentUrl).toContain('/dashboard');

    console.log('✅ Login test completed successfully');
    console.log('ℹ️ Test user created:', testUser.email);
    console.log('ℹ️ Remember to delete this user from production database if needed');
  });
});
