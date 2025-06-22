import { test, expect } from '@playwright/test';

import { AppHelpers } from './helpers/test-setup';

/**
 * 基本的なページアクセステスト
 *
 * Playwrightの動作確認と基本的なナビゲーションをテストします。
 */

test.describe('基本的なページアクセス', () => {
  test('トップページが正常に表示される', async ({ page }) => {
    const helpers = new AppHelpers(page);

    // トップページにアクセス
    await page.goto('/');
    await helpers.waitForPageLoad();

    // ページタイトルを確認（実際にはh1要素の内容）
    await expect(page.locator('h1')).toContainText('Simple Bookkeeping');

    // メインコンテンツの存在確認
    await expect(page.locator('h2')).toContainText('日本の確定申告に対応した');

    // ナビゲーションリンクの確認（最初に出現するものを指定）
    await expect(page.locator('text=ログイン').first()).toBeVisible();
    await expect(page.locator('text=新規登録').first()).toBeVisible();
  });

  test('ログインページが正常に表示される', async ({ page }) => {
    const helpers = new AppHelpers(page);

    // ログインページにアクセス
    await page.goto('/login');
    await helpers.waitForPageLoad();

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

  test('デモページが正常に表示される', async ({ page }) => {
    const helpers = new AppHelpers(page);

    // デモページにアクセス
    await page.goto('/demo');
    await helpers.waitForPageLoad();

    // デモページのコンテンツ確認
    await expect(page.locator('h1')).toContainText('機能デモ');

    // デモ機能へのボタン確認（ボタンテキストを使用）
    await expect(page.locator('text=勘定科目管理のデモを見る')).toBeVisible();
    await expect(page.locator('text=仕訳入力のデモを見る')).toBeVisible();
  });

  test('デモ勘定科目ページが正常に表示される', async ({ page }) => {
    const helpers = new AppHelpers(page);

    // デモ勘定科目ページにアクセス
    await page.goto('/demo/accounts');
    await helpers.waitForPageLoad();

    // ページタイトル確認
    await expect(page.locator('h1')).toContainText('勘定科目管理');

    // 基本的なUI要素の確認
    await expect(page.locator('text=新規作成')).toBeVisible();
    await expect(page.locator('input[placeholder*="検索"]')).toBeVisible();

    // デフォルトの勘定科目が表示されていることを確認
    await expect(page.locator('text=現金')).toBeVisible();
    await expect(page.locator('text=普通預金')).toBeVisible();
  });

  test('デモ仕訳入力ページが正常に表示される', async ({ page }) => {
    const helpers = new AppHelpers(page);

    // デモ仕訳入力ページにアクセス
    await page.goto('/demo/journal-entries');
    await helpers.waitForPageLoad();

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
  test('モバイル表示でも基本機能が利用可能', async ({ page }) => {
    // モバイルビューポートに設定
    await page.setViewportSize({ width: 375, height: 667 });

    const helpers = new AppHelpers(page);

    // デモページにアクセス
    await page.goto('/demo');
    await helpers.waitForPageLoad();

    // モバイルでもコンテンツが表示されることを確認
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('text=勘定科目管理のデモを見る')).toBeVisible();
    await expect(page.locator('text=仕訳入力のデモを見る')).toBeVisible();
  });

  test('タブレット表示でも基本機能が利用可能', async ({ page }) => {
    // タブレットビューポートに設定
    await page.setViewportSize({ width: 768, height: 1024 });

    const helpers = new AppHelpers(page);

    // デモ勘定科目ページにアクセス
    await page.goto('/demo/accounts');
    await helpers.waitForPageLoad();

    // タブレットでもテーブルが適切に表示されることを確認
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('text=新規作成')).toBeVisible();
  });
});
