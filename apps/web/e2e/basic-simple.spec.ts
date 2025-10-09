/**
 * 基本的なページアクセステスト（シンプル版）
 * Issue #520: Storage State採用により大幅に簡略化
 *
 * Before: 195行の複雑な認証ロジック
 * After: 約50行のシンプルなテスト
 *
 * Storage Stateにより自動的に認証済み状態でテスト開始
 */

import { test, expect } from '@playwright/test';

test.describe('基本的なページアクセス', () => {
  test('トップページが正常に表示される', async ({ page }) => {
    // Storage Stateにより既に認証済み - シンプルに移動するだけ
    await page.goto('/');

    // ページタイトルを確認
    await expect(page.locator('h1')).toContainText('Simple Bookkeeping');

    // メインコンテンツの存在確認
    await expect(page.locator('h2')).toContainText('日本の確定申告に対応した');
  });

  test('ログインページが正常に表示される', async ({ page }) => {
    await page.goto('/auth/login');

    // ページタイトルを確認
    await expect(page.locator('text=ログイン').first()).toBeVisible();

    // フォーム要素の存在確認
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('認証済みユーザーはダッシュボードにアクセスできる', async ({ page }) => {
    // Storage State により既に認証済み
    await page.goto('/dashboard');

    // ダッシュボードが表示されることを確認
    // (リダイレクトされずにアクセスできる)
    expect(page.url()).toContain('/dashboard');
  });
});

test.describe('レスポンシブデザイン', () => {
  test('モバイル表示でも基本機能が利用可能', async ({ page }) => {
    // モバイルビューポートに設定
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    // モバイルでもコンテンツが表示されることを確認
    await expect(page.locator('h1')).toBeVisible();
  });

  test('タブレット表示でも基本機能が利用可能', async ({ page }) => {
    // タブレットビューポートに設定
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/auth/login');

    // タブレットでもフォームが適切に表示されることを確認
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
