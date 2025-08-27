import { test, expect } from '@playwright/test';

import { UnifiedAuth } from './helpers/unified-auth';

test.describe('Responsive Navigation', () => {
  // CI環境での実行を考慮してタイムアウトを増やす
  test.use({ navigationTimeout: 30000 });
  test.setTimeout(30000);

  test.beforeEach(async ({ page, context }) => {
    // まず適当なページを開く
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 認証設定
    await UnifiedAuth.setupMockRoutes(context);
    await UnifiedAuth.setAuthData(page);

    // 追加のAPIモック設定
    await context.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            user: {
              id: '1',
              email: 'admin@example.com',
              name: 'Admin User',
              organizations: [
                {
                  id: '1',
                  name: 'Test Organization',
                  role: 'admin',
                },
              ],
            },
            currentOrganization: {
              id: '1',
              name: 'Test Organization',
              role: 'admin',
            },
          },
        }),
      });
    });

    // ダッシュボードへ移動
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
  });

  test('デスクトップ表示でメニューが正しく表示される', async ({ page }) => {
    // デスクトップサイズに設定
    await page.setViewportSize({ width: 1280, height: 720 });

    // ページが完全に読み込まれるまで待つ
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // ナビゲーションメニューが表示されていることを確認
    await expect(page.locator('nav').locator('text=ダッシュボード').first()).toBeVisible();
    await expect(page.locator('nav').locator('text=仕訳入力').first()).toBeVisible();
    await expect(page.locator('nav').locator('text=勘定科目').first()).toBeVisible();
    await expect(page.locator('nav').locator('text=補助簿').first()).toBeVisible();
    await expect(page.locator('nav').locator('text=帳票').first()).toBeVisible();
    await expect(page.locator('nav').locator('text=設定').first()).toBeVisible();

    // ハンバーガーメニューが非表示であることを確認
    await expect(page.locator('button[aria-label="メニューを開く"]')).not.toBeVisible();
  });

  test('タブレット表示で簡略メニューが表示される', async ({ page }) => {
    // タブレットサイズに設定
    await page.setViewportSize({ width: 900, height: 600 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // ハンバーガーメニューが非表示であることを確認
    await expect(page.locator('button[aria-label="メニューを開く"]')).not.toBeVisible();

    // タブレットメニューコンテナを特定（md:flex lg:hidden のクラスを持つ要素）
    // Tailwindの md は 768px以上、lg は 1024px以上なので、900pxではこのコンテナが表示されるはず
    const tabletMenuContainer = page.locator('div.md\\:flex.lg\\:hidden').first();

    // タブレットメニューコンテナが表示されているか確認
    await expect(tabletMenuContainer).toBeVisible();

    // タブレットメニュー内の主要ナビゲーションリンクを確認
    const dashboardLink = tabletMenuContainer.locator('a[href="/dashboard"]').first();
    await expect(dashboardLink).toBeVisible();

    const journalLink = tabletMenuContainer.locator('a[href="/dashboard/journal-entries"]').first();
    await expect(journalLink).toBeVisible();

    const accountLink = tabletMenuContainer.locator('a[href="/dashboard/accounts"]').first();
    await expect(accountLink).toBeVisible();

    // ドロップダウンメニューボタンが表示されていることを確認（MoreVertical アイコン）
    // タブレットメニューコンテナ内のドロップダウンボタンを探す
    const moreButton = tabletMenuContainer
      .locator('button')
      .filter({ has: page.locator('svg') })
      .first();
    await expect(moreButton).toBeVisible();

    // ドロップダウンメニューをクリックして開く
    await moreButton.click();
    await page.waitForTimeout(300);

    // ドロップダウン内のメニュー項目を確認
    await expect(page.locator('[role="menu"]').locator('text=補助簿').first()).toBeVisible();
    await expect(page.locator('[role="menu"]').locator('text=帳票').first()).toBeVisible();
    await expect(page.locator('[role="menu"]').locator('text=設定').first()).toBeVisible();
  });

  test('モバイル表示でハンバーガーメニューが動作する', async ({ page }) => {
    // モバイルサイズに設定
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // ハンバーガーメニューボタンが表示されていることを確認
    const hamburgerButton = page.locator('button[aria-label="メニューを開く"]');
    await expect(hamburgerButton).toBeVisible();

    // デスクトップ・タブレットメニューが非表示であることを確認
    // ナビゲーション内の直接表示されているリンクを探す
    const navContainer = page.locator('nav > div > div > div').nth(1); // メニューコンテナ
    const visibleDesktopMenu = navContainer.locator('a:visible');
    const count = await visibleDesktopMenu.count();
    expect(count).toBe(0);

    // ハンバーガーメニューをクリック
    await hamburgerButton.click();

    // モバイルメニューが開くのを待つ
    await page.waitForTimeout(500);

    // モバイルメニュー内のナビゲーション項目を確認
    const mobileMenu = page.locator('[role="dialog"]');
    await expect(mobileMenu.locator('text=ダッシュボード')).toBeVisible();
    await expect(mobileMenu.locator('text=仕訳入力')).toBeVisible();
    await expect(mobileMenu.locator('text=勘定科目')).toBeVisible();
    await expect(mobileMenu.locator('text=補助簿')).toBeVisible();
    await expect(mobileMenu.locator('text=帳票')).toBeVisible();
    await expect(mobileMenu.locator('text=設定')).toBeVisible();

    // 補助簿のサブメニューを開く
    await mobileMenu.locator('text=補助簿').click();
    await page.waitForTimeout(300);
    await expect(mobileMenu.locator('text=現金出納帳')).toBeVisible();
    await expect(mobileMenu.locator('text=預金出納帳')).toBeVisible();

    // メニューを閉じる
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(mobileMenu).not.toBeVisible();
  });

  test('レスポンシブブレークポイントで正しく切り替わる', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // 1024px（lg）でデスクトップメニュー
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(300);
    // デスクトップメニューコンテナを確認
    const desktopMenu = page.locator('div.lg\\:flex').first();
    await expect(desktopMenu).toBeVisible();
    const dashboardLinkLg = desktopMenu.locator('a[href="/dashboard"]').first();
    await expect(dashboardLinkLg).toBeVisible();
    await expect(page.locator('button[aria-label="メニューを開く"]')).not.toBeVisible();

    // 1023pxでタブレットメニュー
    await page.setViewportSize({ width: 1023, height: 768 });
    await page.waitForTimeout(300);
    // タブレットメニューコンテナを確認
    const tabletMenu = page.locator('div.md\\:flex.lg\\:hidden').first();
    await expect(tabletMenu).toBeVisible();
    const dashboardLinkMd = tabletMenu.locator('a[href="/dashboard"]').first();
    await expect(dashboardLinkMd).toBeVisible();
    // ドロップダウンボタンの存在を確認
    const moreButton = tabletMenu
      .locator('button')
      .filter({ has: page.locator('svg') })
      .first();
    await expect(moreButton).toBeVisible();

    // 768px（md）でタブレットメニュー維持
    await page.setViewportSize({ width: 768, height: 600 });
    await page.waitForTimeout(300);
    const tabletMenu2 = page.locator('div.md\\:flex.lg\\:hidden').first();
    await expect(tabletMenu2).toBeVisible();
    const dashboardLinkMd2 = tabletMenu2.locator('a[href="/dashboard"]').first();
    await expect(dashboardLinkMd2).toBeVisible();

    // 767pxでモバイルメニュー
    await page.setViewportSize({ width: 767, height: 600 });
    await page.waitForTimeout(300);
    await expect(page.locator('button[aria-label="メニューを開く"]')).toBeVisible();
    // モバイルではタブレット・デスクトップメニューは非表示
    await expect(page.locator('div.md\\:flex.lg\\:hidden').first()).not.toBeVisible();
    await expect(page.locator('div.lg\\:flex').first()).not.toBeVisible();
  });

  test('メニュー項目のクリックでページ遷移する', async ({ page }) => {
    // モバイルサイズで確認
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // ハンバーガーメニューを開く
    await page.locator('button[aria-label="メニューを開く"]').click();
    await page.waitForTimeout(500);

    // 仕訳入力をクリック
    const mobileMenu = page.locator('[role="dialog"]');
    await mobileMenu.locator('text=仕訳入力').click();

    // ページ遷移を確認
    await page.waitForURL(/\/dashboard\/journal-entries/);
    await expect(page).toHaveURL(/\/dashboard\/journal-entries/);

    // メニューが閉じていることを確認
    await page.waitForTimeout(300);
    await expect(mobileMenu).not.toBeVisible();
  });
});
