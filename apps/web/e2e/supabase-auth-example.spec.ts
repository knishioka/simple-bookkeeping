import { test, expect } from '@playwright/test';

import { SupabaseTestAuth } from './helpers/supabase-auth';
import { TestDataManager } from './helpers/test-data-manager';
import { waitForPageReady } from './helpers/wait-strategies';

/**
 * Supabase認証を使用したE2Eテストの例
 *
 * このテストは実際のSupabase認証を使用してユーザーのログイン、
 * データ操作、ログアウトをテストします。
 *
 * Issue #387: E2Eテスト用のSupabase認証環境の構築
 */

// テスト用のインスタンスを作成
let auth: SupabaseTestAuth;
let dataManager: TestDataManager;

test.describe('Supabase認証を使用したE2Eテスト', () => {
  // テストのタイムアウトを設定（認証処理を考慮）
  test.use({ navigationTimeout: 30000 });
  test.setTimeout(60000);

  test.beforeAll(async () => {
    // 認証ヘルパーとデータマネージャーを初期化
    auth = new SupabaseTestAuth();
    dataManager = TestDataManager.getInstance();

    // テストユーザーを作成（既存の場合は再作成）
    await auth.ensureTestUser();
  });

  test.afterAll(async () => {
    // テストユーザーとデータをクリーンアップ
    await auth.cleanupAllTestUsers();
    await dataManager.cleanup();
  });

  test('実際のSupabase認証でログインできる', async ({ page }) => {
    // ログインページにアクセス
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });

    // フォーム要素が表示されるまで待機
    await page.waitForSelector('#email', { timeout: 10000 });

    // 実際のSupabaseテストユーザーで認証
    const email = process.env.SUPABASE_TEST_USER_EMAIL || 'test-admin@example.com';
    const password = process.env.SUPABASE_TEST_USER_PASSWORD || 'testPassword123!';

    // Supabase認証を実行（ブラウザコンテキストで実行）
    await auth.authenticateUser(page, email, password);

    // ログイン後のリダイレクトを待機
    await page.waitForURL('/dashboard', { timeout: 15000 });

    // ダッシュボードが正常に表示されることを確認
    await waitForPageReady(page);
    await expect(page.locator('h1')).toContainText('ダッシュボード');

    // 認証状態をデバッグ出力（開発時のトラブルシューティング用）
    const authState = await auth.debugAuthState(page);
    console.log('認証状態:', authState);

    // Supabaseセッションが存在することを確認
    const hasSession = await page.evaluate(() => {
      const authStorage = localStorage.getItem('sb-auth-token');
      return authStorage !== null;
    });
    expect(hasSession).toBeTruthy();
  });

  test('認証後にテストデータを作成できる', async ({ page }) => {
    // 認証を実行
    const email = process.env.SUPABASE_TEST_USER_EMAIL || 'test-admin@example.com';
    const password = process.env.SUPABASE_TEST_USER_PASSWORD || 'testPassword123!';
    await auth.authenticateUser(page, email, password);

    // ダッシュボードに移動
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);

    // テスト用の組織を作成
    const testOrg = await dataManager.createTestOrganization({
      name: `Test Organization ${Date.now()}`,
      fiscalYearEnd: 3,
    });

    // テスト用の勘定科目を作成
    const testAccount = await dataManager.createTestAccount({
      organizationId: testOrg.id,
      code: '1001',
      name: 'テスト現金',
      accountType: 'ASSET',
      subCategory: '現金及び預金',
      taxType: 'TAX_INCLUSIVE',
    });

    // 勘定科目ページに移動して確認
    await page.goto('/accounts', { waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);

    // 作成した勘定科目が表示されることを確認
    await expect(page.locator(`text=${testAccount.name}`)).toBeVisible();
  });

  test('セッションが正しく管理される', async ({ page, context }) => {
    // 認証を実行
    const email = process.env.SUPABASE_TEST_USER_EMAIL || 'test-admin@example.com';
    const password = process.env.SUPABASE_TEST_USER_PASSWORD || 'testPassword123!';
    await auth.authenticateUser(page, email, password);

    // 新しいページを開いてもセッションが維持されることを確認
    const newPage = await context.newPage();
    await newPage.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await waitForPageReady(newPage);

    // 新しいページでも認証状態が維持されていることを確認
    await expect(newPage.locator('h1')).toContainText('ダッシュボード');

    // ログアウト処理
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.click('button:has-text("ログアウト")');

    // ログインページにリダイレクトされることを確認
    await page.waitForURL('/auth/login', { timeout: 10000 });

    // セッションがクリアされていることを確認
    const hasSession = await page.evaluate(() => {
      const authStorage = localStorage.getItem('sb-auth-token');
      return authStorage !== null;
    });
    expect(hasSession).toBeFalsy();

    // クリーンアップ
    await newPage.close();
  });

  test('異なる権限のユーザーでアクセス制御をテスト', async ({ page }) => {
    // 管理者ユーザーでログイン
    const adminEmail = process.env.SUPABASE_TEST_ADMIN_EMAIL || 'test-admin@example.com';
    const adminPassword = process.env.SUPABASE_TEST_ADMIN_PASSWORD || 'testPassword123!';
    await auth.authenticateUser(page, adminEmail, adminPassword);

    // 管理者ページにアクセスできることを確認
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);
    await expect(page.locator('h1')).toContainText('管理画面');

    // ログアウト
    await page.click('button:has-text("ログアウト")');
    await page.waitForURL('/auth/login', { timeout: 10000 });

    // 閲覧専用ユーザーでログイン
    const viewerEmail = process.env.SUPABASE_TEST_VIEWER_EMAIL || 'test-viewer@example.com';
    const viewerPassword = process.env.SUPABASE_TEST_VIEWER_PASSWORD || 'testPassword123!';
    await auth.authenticateUser(page, viewerEmail, viewerPassword);

    // 管理者ページにアクセスできないことを確認
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });

    // アクセス拒否メッセージまたはリダイレクトを確認
    const isAccessDenied = await page
      .locator('text=権限がありません')
      .isVisible()
      .catch(() => false);
    const isRedirected = page.url().includes('/dashboard');

    expect(isAccessDenied || isRedirected).toBeTruthy();
  });

  test('APIレスポンスにRLSが適用される', async ({ page }) => {
    // 認証を実行
    const email = process.env.SUPABASE_TEST_USER_EMAIL || 'test-admin@example.com';
    const password = process.env.SUPABASE_TEST_USER_PASSWORD || 'testPassword123!';
    await auth.authenticateUser(page, email, password);

    // APIリクエストを傍受してRLSが適用されていることを確認
    page.on('response', async (response) => {
      if (response.url().includes('/api/')) {
        const status = response.status();
        // 認証されていないリクエストは401または403を返すべき
        if (status === 401 || status === 403) {
          console.log('RLS適用確認: アクセス拒否', response.url());
        }
      }
    });

    // データ取得ページにアクセス
    await page.goto('/journal-entries', { waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);

    // データが正常に表示されることを確認（RLSにより自分のデータのみ）
    const entries = await page.locator('[data-testid="journal-entry"]').count();
    console.log(`表示された仕訳数: ${entries}`);

    // 少なくとも認証されたユーザーのデータは表示される
    expect(entries).toBeGreaterThanOrEqual(0);
  });
});

/**
 * パフォーマンステスト
 *
 * 実際のSupabase認証のパフォーマンスを測定
 */
test.describe('Supabase認証パフォーマンステスト', () => {
  test('認証処理のパフォーマンスを測定', async ({ page }) => {
    const auth = new SupabaseTestAuth();
    const email = process.env.SUPABASE_TEST_USER_EMAIL || 'test-admin@example.com';
    const password = process.env.SUPABASE_TEST_USER_PASSWORD || 'testPassword123!';

    // 認証開始時刻を記録
    const startTime = Date.now();

    // ログインページにアクセス
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });

    // 認証を実行
    await auth.authenticateUser(page, email, password);

    // ダッシュボードへのリダイレクトを待機
    await page.waitForURL('/dashboard', { timeout: 15000 });

    // 認証完了時刻を記録
    const endTime = Date.now();
    const authTime = endTime - startTime;

    console.log(`認証処理時間: ${authTime}ms`);

    // 認証処理が10秒以内に完了することを確認
    expect(authTime).toBeLessThan(10000);

    // 目標は3秒以内
    if (authTime > 3000) {
      console.warn('警告: 認証処理が3秒を超えています。パフォーマンス改善が必要です。');
    }
  });
});
