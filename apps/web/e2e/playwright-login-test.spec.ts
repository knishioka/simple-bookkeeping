import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: 'demo.test.user@gmail.com',
  password: 'DemoTest123!',
};

test.describe('Demo Login Test', () => {
  test('should login successfully', async ({ page }) => {
    // コンソールエラーをキャプチャ
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // ページエラーをキャプチャ
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    // ローカル開発サーバーに接続
    await page.goto('http://localhost:3000/auth/login');

    // ログインフォームに入力
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);

    // ナビゲーションイベントを監視
    const navigationPromise = page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => null);

    // ログインボタンをクリック
    await page.click('button[type="submit"]');

    // ナビゲーション完了を待機
    const navigated = await navigationPromise;

    if (!navigated) {
      // ナビゲーションが起きなかった場合のデバッグ情報
      console.log('❌ Navigation failed');
      console.log('Current URL:', page.url());

      // コンソールエラーを出力
      if (consoleErrors.length > 0) {
        console.log('🔴 Console Errors:', consoleErrors);
      }

      // ページエラーを出力
      if (pageErrors.length > 0) {
        console.log('🔴 Page Errors:', pageErrors);
      }

      const errorMessage = await page
        .locator('[role="alert"]')
        .textContent()
        .catch(() => null);
      if (errorMessage) {
        console.log('Error message:', errorMessage);
      }

      // ページのHTMLを確認
      const bodyText = await page.locator('body').textContent();
      console.log('Page contains "ログイン":', bodyText?.includes('ログイン'));
      console.log('Page contains "Dashboard":', bodyText?.includes('Dashboard'));

      // ページのタイトルとHTML全体を確認
      const pageTitle = await page.title();
      console.log('Page title:', pageTitle);
    }

    // 最終的にエラーがあれば出力
    if (consoleErrors.length > 0) {
      console.log('\n📋 All Console Errors:');
      consoleErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }
    if (pageErrors.length > 0) {
      console.log('\n📋 All Page Errors:');
      pageErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }

    // ダッシュボードにリダイレクトされることを確認
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 5000 });

    // ダッシュボードのタイトルを確認（h2タグを使用）
    await expect(page.locator('h2')).toBeVisible();
    await expect(page.locator('h2')).toContainText(/ダッシュボード|Dashboard/);
  });
});
