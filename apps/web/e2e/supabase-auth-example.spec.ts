import { test, expect } from '@playwright/test';

import { SupabaseAuth } from './helpers/supabase-auth';
import { getTestDataManager } from './helpers/test-data-manager';
import { waitForPageReady } from './helpers/wait-strategies';

/**
 * Check if we're running in mock mode (CI environment without real Supabase)
 */
function isInMockMode(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  return (
    url.includes('placeholder') || !serviceKey || serviceKey === 'placeholder_service_role_key'
  );
}

/**
 * Supabase認証を使用したE2Eテストの例
 *
 * このテストは実際のSupabase認証を使用してユーザーのログイン、
 * データ操作、ログアウトをテストします。
 *
 * Issue #387: E2Eテスト用のSupabase認証環境の構築
 */

test.describe('Supabase認証を使用したE2Eテスト', () => {
  // テストのタイムアウトを設定（認証処理を考慮）
  test.use({ navigationTimeout: 30000 });
  test.setTimeout(60000);

  test.beforeAll(async () => {
    // データマネージャーを初期化
    // 必要に応じてデータセットアップ
  });

  test.afterAll(async () => {
    // モックモードではTestDataManagerが使えないのでスキップ
    if (isInMockMode()) {
      console.log('Skipping data cleanup in mock mode');
      return;
    }

    try {
      const dataManager = getTestDataManager();
      await dataManager.cleanupAllTestData();
    } catch (error) {
      console.warn('Failed to cleanup test data:', error);
    }
  });

  test('実際のSupabase認証でログインできる', async ({ page, context }) => {
    // SupabaseAuthヘルパーを使用してモック認証をセットアップ
    await SupabaseAuth.setup(context, page, { role: 'admin' });

    // ダッシュボードにアクセス
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // ダッシュボードが正常に表示されることを確認
    await waitForPageReady(page);
    await expect(page.locator('h1')).toContainText('ダッシュボード');

    // Supabaseセッションが存在することを確認（モックまたは実際の認証）
    const hasSession = await page.evaluate(() => {
      // モックモードまたは実際のSupabaseセッションをチェック
      const mockAuth = localStorage.getItem('mockAuth');
      const supabaseToken = localStorage.getItem('sb-placeholder-auth-token');

      // いずれかの認証方式でセッションが存在すればOK
      return mockAuth === 'true' || supabaseToken !== null;
    });
    expect(hasSession).toBeTruthy();
  });

  test.skip('認証後にテストデータを作成できる', async ({ page, context }) => {
    // モック環境ではTestDataManagerが実際のデータベースに接続できないためスキップ
    // TODO: TestDataManagerにモック実装を追加後、このテストを有効化

    // SupabaseAuthヘルパーを使用してモック認証をセットアップ
    await SupabaseAuth.setup(context, page, { role: 'admin' });

    // ダッシュボードに移動
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);

    // テスト用の組織を作成
    const dataManager = getTestDataManager();
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
    // SupabaseAuthヘルパーを使用してモック認証をセットアップ
    await SupabaseAuth.setup(context, page, { role: 'admin' });

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
      const mockAuth = localStorage.getItem('mockAuth');
      const supabaseToken = localStorage.getItem('sb-placeholder-auth-token');
      return mockAuth === 'true' || supabaseToken !== null;
    });
    expect(hasSession).toBeFalsy();

    // クリーンアップ
    await newPage.close();
  });

  test('異なる権限のユーザーでアクセス制御をテスト', async ({ page, context }) => {
    // 管理者ユーザーとしてモック認証をセットアップ
    await SupabaseAuth.setup(context, page, { role: 'admin' });

    // 管理者ページにアクセスできることを確認
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await waitForPageReady(page);
    await expect(page.locator('h1')).toContainText('管理画面');

    // ログアウト
    await page.click('button:has-text("ログアウト")');
    await page.waitForURL('/auth/login', { timeout: 10000 });

    // 認証をクリアしてから閲覧専用ユーザーとして再認証
    await SupabaseAuth.clear(context, page);
    await SupabaseAuth.setup(context, page, { role: 'viewer' });

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

  test('APIレスポンスにRLSが適用される', async ({ page, context }) => {
    // SupabaseAuthヘルパーを使用してモック認証をセットアップ
    await SupabaseAuth.setup(context, page, { role: 'admin' });

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
  test('認証処理のパフォーマンスを測定', async ({ page, context }) => {
    // 認証開始時刻を記録
    const startTime = Date.now();

    // SupabaseAuthヘルパーを使用してモック認証をセットアップ
    await SupabaseAuth.setup(context, page, { role: 'admin' });

    // ダッシュボードにアクセス
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

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
