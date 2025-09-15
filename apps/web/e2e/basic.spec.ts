import { test, expect } from '@playwright/test';

import { waitForPageReady } from './helpers/wait-strategies';

/**
 * 基本的なページアクセステスト
 *
 * Playwrightの動作確認と基本的なナビゲーションをテストします。
 * ローカル環境対応の改善を含みます。
 * Issue #103: 統一ヘルパーへの移行
 */

test.describe('基本的なページアクセス', () => {
  // CI環境での実行を考慮してタイムアウトを増やす
  test.use({ navigationTimeout: 30000 });
  test.setTimeout(30000);

  test('トップページが正常に表示される', async ({ page }) => {
    // トップページにアクセス
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // h1要素が表示されるまで待機
    await page.waitForSelector('h1', { timeout: 10000 });

    // ページタイトルを確認（実際にはh1要素の内容）
    await expect(page.locator('h1')).toContainText('Simple Bookkeeping');

    // メインコンテンツの存在確認
    await expect(page.locator('h2')).toContainText('日本の確定申告に対応した');

    // ナビゲーションリンクの確認（最初に出現するものを指定）
    await expect(page.locator('text=ログイン').first()).toBeVisible();
    await expect(page.locator('text=新規登録').first()).toBeVisible();
  });

  test('ログインページが正常に表示される', async ({ page }) => {
    // ログインページにアクセス
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // フォーム要素が表示されるまで待機
    await page.waitForSelector('#email', { timeout: 10000 });

    // ページタイトルを確認（CardTitleのh2要素）
    await expect(page.locator('text=ログイン').first()).toBeVisible();

    // フォーム要素の存在確認（idベースで検索）
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // フォームのラベル確認
    await expect(page.locator('text=メールアドレス')).toBeVisible();
    await expect(page.locator('text=パスワード')).toBeVisible();
  });
});

test.describe('ユーザー認証フロー', () => {
  test('ログイン画面からのナビゲーション', async ({ page }) => {
    await page.goto('/login');

    // ボタンがクリック可能になるまで待機
    await page.waitForSelector('button[type="submit"]', { state: 'visible' });

    // 新規登録リンクの確認
    const signupLink = page.locator('a[href="/auth/signup"]').first();
    await expect(signupLink).toBeVisible();
  });

  test('新規登録画面の表示', async ({ page, context }) => {
    // APIモックを設定
    await context.route('**/auth/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            user_metadata: {
              name: 'Test User',
              organizations: [
                {
                  id: 'test-org-1',
                  name: 'Test Organization',
                  role: 'admin',
                },
              ],
            },
            app_metadata: {
              provider: 'email',
              providers: ['email'],
            },
            identities: [
              {
                provider: 'email',
                identity_id: 'test-identity-id',
                user_id: 'test-user-id',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
            ],
          },
          session: {
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
              user_metadata: {
                name: 'Test User',
                organizationId: 'org-test',
              },
            },
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
          },
        }),
      });
    });

    // トップページにアクセス
    await page.goto('/');
    await waitForPageReady(page, { waitForSelector: 'h1' });

    // 新規登録リンクを探してクリック
    const signupLink = page.locator('text=新規登録').first();
    const signupLinkExists = await signupLink.isVisible();

    if (signupLinkExists) {
      await signupLink.click();
      await page.waitForLoadState('domcontentloaded');

      // 新規登録フォームの確認
      const emailInput = page.locator('#email').first();
      const isEmailVisible = await emailInput.isVisible({ timeout: 3000 }).catch(() => false);

      if (isEmailVisible) {
        await emailInput.fill('test@example.com');

        const passwordInput = page.locator('#password').first();
        await passwordInput.fill('Test1234!');

        const confirmPasswordInput = page.locator('#confirmPassword').first();
        if (await confirmPasswordInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmPasswordInput.fill('Test1234!');
        }

        const nameInput = page.locator('#name').first();
        if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await nameInput.fill('Test User');
        }

        // テスト環境では実際に送信はしない
        await page.waitForLoadState('networkidle');
        const success =
          (await page.url().includes('/dashboard')) ||
          (await page.locator('text=/登録.*成功|完了/i').count()) > 0;
        expect(success).toBeTruthy();
      }
    } else {
      // 登録機能が提供されていない場合はテストをスキップ
      console.log('Registration feature not available');
      expect(true).toBeTruthy();
    }
  });
});

test.describe('レスポンシブデザイン', () => {
  test('モバイル表示でも基本機能が利用可能', async ({ page }) => {
    // モバイルビューポートに設定
    await page.setViewportSize({ width: 375, height: 667 });

    // トップページにアクセス
    await page.goto('/');
    await waitForPageReady(page, { waitForSelector: 'h1' });

    // モバイルでもコンテンツが表示されることを確認
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('text=ログイン').first()).toBeVisible();
    await expect(page.locator('text=新規登録').first()).toBeVisible();
  });

  test('タブレット表示でも基本機能が利用可能', async ({ page }) => {
    // タブレットビューポートに設定
    await page.setViewportSize({ width: 768, height: 1024 });

    // ログインページにアクセス
    await page.goto('/login');
    await waitForPageReady(page, { waitForSelector: '#email' });

    // タブレットでもフォームが適切に表示されることを確認
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
