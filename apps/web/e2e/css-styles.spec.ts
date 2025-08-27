import { test, expect, Page } from '@playwright/test';

/**
 * CSSスタイルとTailwind CSSの適用確認テスト
 *
 * このテストはCSSが正しくビルド・適用されているかを確認します。
 * Tailwind CSS v4の設定が正しく動作していることを検証します。
 *
 * CI環境での安定性を考慮し、CSSの読み込みを確実に待機する処理を含みます。
 * Issue #103: 統一ヘルパーへの移行
 */

// CSSが確実に読み込まれるまで待機するヘルパー関数
async function waitForCSSToLoad(page: Page) {
  // DOMコンテンツの読み込みを待機
  await page.waitForLoadState('domcontentloaded');

  // スタイルシートが読み込まれるまで待機
  await page.waitForFunction(() => {
    const stylesheets = Array.from(document.styleSheets);
    // 少なくとも1つのスタイルシートが存在し、CSSルールが含まれているか確認
    return (
      stylesheets.length > 0 &&
      stylesheets.some((sheet) => {
        try {
          return sheet.cssRules && sheet.cssRules.length > 0;
        } catch {
          // CORSエラーの場合もtrueとする（外部CSSは読み込まれている）
          return true;
        }
      })
    );
  });

  // CSS変数が定義されるまで待機
  await page.waitForFunction(() => {
    const root = document.documentElement;
    const styles = window.getComputedStyle(root);
    // 主要なCSS変数が定義されているか確認
    return styles.getPropertyValue('--background').trim() !== '';
  });

  // CI環境での安定性向上（waitForTimeoutを削除してnetworkidleに依存）
}

test.describe('CSSスタイルの適用確認', () => {
  test('CSS変数とTailwindが正しく適用されている', async ({ page }) => {
    await page.goto('/');
    await waitForCSSToLoad(page);

    // CSS変数が定義されているか確認（最も基本的な確認）
    const cssVariables = await page.evaluate(() => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);
      return {
        background: styles.getPropertyValue('--background'),
        primary: styles.getPropertyValue('--primary'),
      };
    });

    expect(cssVariables.background).toBeTruthy();
    expect(cssVariables.primary).toBeTruthy();

    // Tailwindクラスが適用されているか基本確認
    const mainContainer = page.locator('main').first();
    await expect(mainContainer).toBeVisible();
  });

  test('レスポンシブデザインが機能する', async ({ page }) => {
    // デスクトップサイズ
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await waitForCSSToLoad(page);

    // bodyまたはmain要素で確認（.containerクラスがない場合に備えて）
    const responsiveElement = page.locator('body').first();

    const desktopStyles = await responsiveElement.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        width: styles.width,
        padding: styles.padding,
      };
    });

    // モバイルサイズ
    await page.setViewportSize({ width: 375, height: 667 });
    const mobileStyles = await responsiveElement.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        width: styles.width,
        padding: styles.padding,
      };
    });

    // レスポンシブスタイルが適用されているか確認
    expect(desktopStyles.width).toBeTruthy();
    expect(mobileStyles.width).toBeTruthy();
    // モバイルとデスクトップで幅が変わることを確認
    expect(desktopStyles.width).not.toBe(mobileStyles.width);
  });

  test('CSSファイルが正しく読み込まれている', async ({ page }) => {
    await page.goto('/');
    await waitForCSSToLoad(page);

    // CSSファイルの読み込みを確認
    const cssLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.map((link) => ({
        href: link.getAttribute('href'),
        loaded: link.sheet !== null,
      }));
    });

    // 少なくとも1つのCSSファイルが読み込まれているか確認
    expect(cssLinks.length).toBeGreaterThan(0);

    // 全てのCSSファイルが正しく読み込まれているか確認
    for (const link of cssLinks) {
      expect(link.loaded).toBeTruthy();
    }
  });
});
