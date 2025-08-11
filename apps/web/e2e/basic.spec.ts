import { test, expect } from '@playwright/test';

import { UnifiedMock } from './helpers/unified-mock';
import { waitForPageReady, smartWait } from './helpers/wait-strategies';

/**
 * 基本的なページアクセステスト
 *
 * Playwrightの動作確認と基本的なナビゲーションをテストします。
 * ローカル環境対応の改善を含みます。
 * Issue #103: 統一ヘルパーへの移行
 */

test.describe('基本的なページアクセス', () => {
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

  test('デモページが正常に表示される', async ({ page, context }) => {
    // デモページ用のモックをセットアップ
    await UnifiedMock.setupDashboardMocks(context);

    // デモページにアクセス
    await page.goto('/demo');
    await waitForPageReady(page, { waitForSelector: 'h1' });

    // デモページのコンテンツ確認
    await expect(page.locator('h1')).toContainText('機能デモ');

    // デモ機能へのボタン確認（ボタンテキストを使用）
    await expect(page.locator('text=勘定科目管理のデモを見る')).toBeVisible();
    await expect(page.locator('text=仕訳入力のデモを見る')).toBeVisible();
  });

  test('デモ勘定科目ページが正常に表示される', async ({ page, context }) => {
    // 勘定科目用のモックをセットアップ
    await UnifiedMock.setupAccountsMocks(context);

    // デモ勘定科目ページにアクセス
    await page.goto('/demo/accounts');
    await waitForPageReady(page, { waitForSelector: 'h1', skipNetworkIdle: true });

    // ページタイトル確認
    await expect(page.locator('h1')).toContainText('勘定科目管理');

    // 基本的なUI要素の確認
    await expect(page.locator('text=新規作成')).toBeVisible();
    await expect(page.locator('input[placeholder*="検索"]')).toBeVisible();

    // デフォルトの勘定科目が表示されていることを確認
    await expect(page.locator('text=現金')).toBeVisible();
    await expect(page.locator('text=普通預金')).toBeVisible();
  });

  test('デモ仕訳入力ページが正常に表示される', async ({ page, context }) => {
    // 仕訳用のモックをセットアップ
    await UnifiedMock.setupJournalMocks(context);

    // デモ仕訳入力ページにアクセス
    await page.goto('/demo/journal-entries');
    await page.waitForLoadState('networkidle');

    // ページタイトル確認
    await expect(page.locator('h1')).toContainText('仕訳入力');

    // 基本的なUI要素の確認
    await expect(page.locator('text=新規作成')).toBeVisible();
    await expect(page.locator('input[placeholder*="検索"]')).toBeVisible();

    // 仕訳一覧テーブルの確認
    await expect(page.locator('table')).toBeVisible();
  });

  test('存在しないページで404エラーが表示される', async ({ page }) => {
    // 存在しないページにアクセス
    await page.goto('/nonexistent-page');

    // 404状態またはNext.jsの404ページを確認
    const isNotFound =
      (await page.locator('text=404').isVisible()) ||
      (await page.locator('text=Not Found').isVisible()) ||
      (await page.locator('text=This page could not be found').isVisible());

    expect(isNotFound).toBeTruthy();
  });
});

test.describe('レスポンシブデザイン', () => {
  test('モバイル表示でも基本機能が利用可能', async ({ page, context }) => {
    // モバイルビューポートに設定
    await page.setViewportSize({ width: 375, height: 667 });

    // デモページ用のモックをセットアップ
    await UnifiedMock.setupDashboardMocks(context);

    // デモページにアクセス
    await page.goto('/demo');
    await waitForPageReady(page, { waitForSelector: 'h1' });

    // モバイルでもコンテンツが表示されることを確認
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('text=勘定科目管理のデモを見る')).toBeVisible();
    await expect(page.locator('text=仕訳入力のデモを見る')).toBeVisible();
  });

  test('タブレット表示でも基本機能が利用可能', async ({ page, context }) => {
    // タブレットビューポートに設定
    await page.setViewportSize({ width: 768, height: 1024 });

    // 勘定科目用のモックをセットアップ
    await UnifiedMock.setupAccountsMocks(context);

    // デモ勘定科目ページにアクセス
    await page.goto('/demo/accounts');
    await waitForPageReady(page, { waitForSelector: 'h1', skipNetworkIdle: true });

    // タブレットでもテーブルが適切に表示されることを確認
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('text=新規作成')).toBeVisible();
  });
});
