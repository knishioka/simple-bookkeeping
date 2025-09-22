import { test, expect } from '@playwright/test';

/**
 * Production環境のE2Eスモークテスト
 *
 * 注意事項:
 * - 読み取り専用操作のみ実施
 * - Viewer権限のテストアカウントを使用
 * - 破壊的操作は絶対に行わない
 * - 実行回数制限あり（1日最大3回）
 *
 * @tag smoke
 */

// Production URLを環境変数から取得（デフォルト値あり）
const PROD_URL = process.env.PROD_URL || 'https://simple-bookkeeping-mu.vercel.app';

test.describe('@smoke Production Smoke Tests', () => {
  test.describe.configure({ mode: 'serial' }); // テストを順番に実行

  test.beforeEach(async ({ page }) => {
    // Production URLにナビゲート
    await page.goto(PROD_URL);
  });

  test('ホームページが正しく表示される', async ({ page }) => {
    // タイトルの確認
    await expect(page).toHaveTitle(/Simple Bookkeeping/);

    // ログイン画面への導線が存在することを確認
    const loginLink = page.locator('a[href*="/login"], button:has-text("ログイン")').first();
    await expect(loginLink).toBeVisible({ timeout: 10000 });
  });

  test('ログイン画面が正しく表示される', async ({ page }) => {
    // ログイン画面に移動
    await page.goto(`${PROD_URL}/login`);

    // ログインフォームの要素が存在することを確認
    await expect(page.locator('input[type="email"], input[name*="email"]').first()).toBeVisible();
    await expect(
      page.locator('input[type="password"], input[name*="password"]').first()
    ).toBeVisible();
    await expect(
      page.locator('button[type="submit"], button:has-text("ログイン")').first()
    ).toBeVisible();

    // パスワードリセットリンクの確認
    const resetLink = page.locator('a:has-text("パスワードを忘れた"), a[href*="reset"]').first();
    await expect(resetLink).toBeVisible();
  });

  test('基本的なナビゲーションが機能する', async ({ page }) => {
    // 各公開ページへのアクセス確認
    const publicPages = [
      { path: '/', expectedText: ['Simple Bookkeeping', 'ログイン'] },
      { path: '/login', expectedText: ['ログイン', 'メールアドレス', 'パスワード'] },
      { path: '/signup', expectedText: ['新規登録', 'メールアドレス', 'パスワード'] },
    ];

    for (const { path, expectedText } of publicPages) {
      await page.goto(`${PROD_URL}${path}`);

      // ページが正常に読み込まれたことを確認
      await page.waitForLoadState('networkidle');

      // 期待されるテキストが表示されることを確認
      for (const text of expectedText) {
        const locator = page.locator(`text=${text}`).first();
        await expect(locator).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('エラーページが適切に処理される', async ({ page }) => {
    // 存在しないページにアクセス
    await page.goto(`${PROD_URL}/non-existent-page-${Date.now()}`, {
      waitUntil: 'domcontentloaded',
    });

    // 404エラーまたはリダイレクトが発生することを確認
    // Note: Vercelの設定によっては404ページまたはホームへのリダイレクトが発生する
    const pageContent = await page.textContent('body');

    // エラーページまたはホームページの内容が表示されることを確認
    expect(pageContent).toBeTruthy();
    expect(pageContent?.length).toBeGreaterThan(0);
  });

  // 認証が必要なテスト（環境変数が設定されている場合のみ実行）
  test.describe('認証フロー', () => {
    // スキップ条件：認証情報が未設定の場合
    test.skip(
      !process.env.PROD_TEST_EMAIL || !process.env.PROD_TEST_PASSWORD,
      'Production test credentials not configured'
    );

    test('Viewer権限でのログインが可能', async ({ page }) => {
      const email = process.env.PROD_TEST_EMAIL || '';
      const password = process.env.PROD_TEST_PASSWORD || '';

      // ログイン画面に移動
      await page.goto(`${PROD_URL}/login`);

      // 認証情報を入力
      await page.locator('input[type="email"], input[name*="email"]').first().fill(email);
      await page.locator('input[type="password"], input[name*="password"]').first().fill(password);

      // ログインボタンをクリック
      await page.locator('button[type="submit"], button:has-text("ログイン")').first().click();

      // ダッシュボードへのリダイレクトを待つ
      await page.waitForURL(/dashboard|home/, { timeout: 30000 });

      // ログイン成功の確認（ダッシュボードページの要素を確認）
      const dashboardElement = page
        .locator('[data-testid="dashboard"], h1:has-text("ダッシュボード"), nav')
        .first();
      await expect(dashboardElement).toBeVisible({ timeout: 10000 });

      // ログアウトリンクが表示されることを確認（ログイン成功の証拠）
      const logoutElement = page
        .locator('button:has-text("ログアウト"), a:has-text("ログアウト")')
        .first();
      await expect(logoutElement).toBeVisible();
    });

    test('ログイン後の主要ページアクセス（読み取り専用）', async ({ page }) => {
      const email = process.env.PROD_TEST_EMAIL || '';
      const password = process.env.PROD_TEST_PASSWORD || '';

      // ログイン
      await page.goto(`${PROD_URL}/login`);
      await page.locator('input[type="email"], input[name*="email"]').first().fill(email);
      await page.locator('input[type="password"], input[name*="password"]').first().fill(password);
      await page.locator('button[type="submit"], button:has-text("ログイン")').first().click();
      await page.waitForURL(/dashboard|home/, { timeout: 30000 });

      // 主要ページへのナビゲーション確認（読み取りのみ）
      const protectedPages = [
        { name: 'ダッシュボード', urlPattern: /dashboard/ },
        { name: '仕訳', urlPattern: /journal|entries/ },
        { name: '勘定科目', urlPattern: /accounts/ },
        { name: 'レポート', urlPattern: /reports/ },
      ];

      for (const { name, urlPattern } of protectedPages) {
        // ナビゲーションメニューからリンクを探す
        const navLink = page
          .locator(`nav a:has-text("${name}"), nav button:has-text("${name}")`)
          .first();

        if (await navLink.isVisible()) {
          await navLink.click();

          // URLパターンの確認（ページが正しく遷移したことを確認）
          await expect(page).toHaveURL(urlPattern, { timeout: 10000 });

          // ページコンテンツが読み込まれたことを確認
          await page.waitForLoadState('networkidle');

          // コンテンツが表示されていることを確認
          const mainContent = page.locator('main, [role="main"], #app').first();
          await expect(mainContent).toBeVisible();
        }
      }
    });
  });
});

// ヘルパー関数：実行回数制限のチェック（将来の実装用）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function checkExecutionLimit(): Promise<boolean> {
  // TODO: 実行回数制限の実装
  // - ローカルまたはリモートストレージで実行回数を追跡
  // - MAX_DAILY_RUNS環境変数と比較
  // - 制限を超えた場合はfalseを返す
  return true;
}

// テストのタイムアウト設定（Production環境は遅い可能性があるため）
test.use({
  // Production環境用の長めのタイムアウト
  actionTimeout: 30000,
  navigationTimeout: 30000,
});
