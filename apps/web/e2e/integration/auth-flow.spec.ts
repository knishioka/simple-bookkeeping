import { test, expect } from '@playwright/test';

/**
 * 認証フローの統合テスト
 *
 * JWT認証、組織切り替え、セッション管理などの
 * 複雑な認証フローをテストします。
 */

test.describe('認証フロー統合テスト', () => {
  test.describe('JWTトークン管理', () => {
    test('トークン有効期限切れ時の自動更新', async ({ page, context }) => {
      // 1. ログイン
      await page.goto('/login');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // ダッシュボードへ遷移
      await expect(page).toHaveURL('/dashboard');

      // 2. トークンを強制的に期限切れにする（実際のテストではモックを使用）
      await context.addCookies([
        {
          name: 'auth-token',
          value: 'expired-token',
          domain: 'localhost',
          path: '/',
          expires: Date.now() / 1000 - 3600, // 1時間前に期限切れ
        },
      ]);

      // 3. APIリクエストを発生させる操作
      await page.goto('/dashboard/accounts');

      // 4. 自動的にリフレッシュされることを確認
      // （実際の実装では401応答後にリフレッシュトークンで更新）
      await expect(page.locator('table')).toBeVisible();

      // 5. 新しいトークンが設定されていることを確認
      const cookies = await context.cookies();
      const authToken = cookies.find((c) => c.name === 'auth-token');
      expect(authToken).toBeDefined();
      expect(authToken?.expires).toBeGreaterThan(Date.now() / 1000);
    });

    test('リフレッシュトークンも期限切れの場合はログイン画面へ', async ({ page, context }) => {
      // 両方のトークンを期限切れに設定
      await context.addCookies([
        {
          name: 'auth-token',
          value: 'expired-token',
          domain: 'localhost',
          path: '/',
          expires: Date.now() / 1000 - 3600,
        },
        {
          name: 'refresh-token',
          value: 'expired-refresh-token',
          domain: 'localhost',
          path: '/',
          expires: Date.now() / 1000 - 3600,
        },
      ]);

      // 保護されたページへアクセス
      await page.goto('/dashboard');

      // ログイン画面へリダイレクトされることを確認
      await expect(page).toHaveURL('/login');
      await expect(page.locator('text=セッションが期限切れです')).toBeVisible();
    });
  });

  test.describe('組織切り替え', () => {
    test('複数組織間の切り替えとデータ分離', async ({ page }) => {
      // 前提: 複数組織に所属するユーザーでログイン
      await page.goto('/login');
      await page.fill('input[name="email"]', 'multi-org@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // 1. 組織Aのデータを確認
      await page.goto('/dashboard/accounts');
      const org1Accounts = await page.locator('table tbody tr').count();

      // 2. 組織切り替え
      await page.click('button[aria-label="組織切り替え"]');
      await page.click('text=組織B');

      // ページがリロードされるまで待機
      await page.waitForLoadState('networkidle');

      // 3. 組織Bのデータが表示されることを確認
      const org2Accounts = await page.locator('table tbody tr').count();

      // 異なるデータが表示されることを確認
      expect(org1Accounts).not.toBe(org2Accounts);

      // 4. APIコールに正しい組織IDが含まれることを確認
      const [request] = await Promise.all([
        page.waitForRequest((req) => req.url().includes('/api/v1/accounts')),
        page.reload(),
      ]);

      expect(request.headers()['x-organization-id']).toBe('org-b-id');
    });

    test('組織切り替え時の権限変更', async ({ page }) => {
      // 組織Aでは管理者、組織Bでは閲覧者の場合
      await page.goto('/login');
      await page.fill('input[name="email"]', 'role-test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // 組織A（管理者）での操作
      await page.goto('/dashboard/accounts');
      await expect(page.locator('button:has-text("新規作成")')).toBeVisible();

      // 組織Bに切り替え
      await page.click('button[aria-label="組織切り替え"]');
      await page.click('text=組織B（閲覧のみ）');
      await page.waitForLoadState('networkidle');

      // 閲覧権限のみなので作成ボタンが表示されない
      await expect(page.locator('button:has-text("新規作成")')).not.toBeVisible();
    });
  });

  test.describe('セッション管理', () => {
    test('長時間操作なしでのセッションタイムアウト', async ({ page, context: _context }) => {
      // ログイン
      await page.goto('/login');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // セッションタイムアウトをシミュレート（実際は30分など）
      await page.evaluate(() => {
        // localStorageのセッション情報を削除
        localStorage.removeItem('session-expires');
      });

      // 操作を行うとセッションタイムアウトのモーダルが表示される
      await page.click('button:has-text("新規作成")');

      const modal = page.locator('[role="dialog"]:has-text("セッションタイムアウト")');
      await expect(modal).toBeVisible();

      // 再ログインボタンをクリック
      await page.click('button:has-text("再ログイン")');
      await expect(page).toHaveURL('/login');
    });

    test('複数タブでのセッション同期', async ({ browser }) => {
      const context = await browser.newContext();
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      // タブ1でログイン
      await page1.goto('/login');
      await page1.fill('input[name="email"]', 'test@example.com');
      await page1.fill('input[name="password"]', 'password123');
      await page1.click('button[type="submit"]');
      await expect(page1).toHaveURL('/dashboard');

      // タブ2でも自動的にログイン状態になる
      await page2.goto('/dashboard');
      await expect(page2).toHaveURL('/dashboard');

      // タブ1でログアウト
      await page1.click('button[aria-label="ユーザーメニュー"]');
      await page1.click('text=ログアウト');
      await expect(page1).toHaveURL('/login');

      // タブ2も自動的にログアウトされる（BroadcastChannel API使用）
      await page2.waitForTimeout(1000); // 同期待機
      await page2.reload();
      await expect(page2).toHaveURL('/login');

      await context.close();
    });
  });

  test.describe('認証エラーハンドリング', () => {
    test('不正なトークンでのアクセス拒否', async ({ page, context }) => {
      // 不正なトークンを設定
      await context.addCookies([
        {
          name: 'auth-token',
          value: 'invalid-jwt-token',
          domain: 'localhost',
          path: '/',
        },
      ]);

      // 保護されたページへアクセス
      await page.goto('/dashboard');

      // ログイン画面へリダイレクト
      await expect(page).toHaveURL('/login');
      await expect(page.locator('text=認証エラー')).toBeVisible();
    });

    test('同時ログイン制限', async ({ browser }) => {
      // 最初のセッション
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();

      await page1.goto('/login');
      await page1.fill('input[name="email"]', 'single-session@example.com');
      await page1.fill('input[name="password"]', 'password123');
      await page1.click('button[type="submit"]');
      await expect(page1).toHaveURL('/dashboard');

      // 2つ目のセッション
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();

      await page2.goto('/login');
      await page2.fill('input[name="email"]', 'single-session@example.com');
      await page2.fill('input[name="password"]', 'password123');
      await page2.click('button[type="submit"]');

      // 2つ目のセッションは成功
      await expect(page2).toHaveURL('/dashboard');

      // 最初のセッションは無効化される
      await page1.reload();
      await expect(page1).toHaveURL('/login');
      await expect(page1.locator('text=別の場所からログインされました')).toBeVisible();

      await context1.close();
      await context2.close();
    });
  });
});
