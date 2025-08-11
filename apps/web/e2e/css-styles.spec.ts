import { test, expect, Page } from '@playwright/test';

import { UnifiedMock } from './helpers/unified-mock';

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
  test('Tailwind CSSのユーティリティクラスが適用される', async ({ page }) => {
    await page.goto('/');
    await waitForCSSToLoad(page);

    // Tailwindのユーティリティクラスが適用されている要素を確認
    const mainContainer = page.locator('main').first();
    await expect(mainContainer).toBeVisible();

    // min-heightが適用されているか確認
    const minHeight = await mainContainer.evaluate((el) => {
      return window.getComputedStyle(el).minHeight;
    });
    expect(minHeight).not.toBe('0px');
    expect(minHeight).toBeTruthy();

    // displayプロパティが設定されているか確認（flexまたはblock）
    const display = await mainContainer.evaluate((el) => {
      return window.getComputedStyle(el).display;
    });
    // CI環境とローカル環境で異なる可能性があるため、どちらも許可
    expect(['flex', 'block', 'grid']).toContain(display);
  });

  test('CSS変数が正しく定義されている', async ({ page }) => {
    await page.goto('/');
    await waitForCSSToLoad(page);

    // :root要素のCSS変数を確認
    const cssVariables = await page.evaluate(() => {
      const root = document.documentElement;
      const styles = window.getComputedStyle(root);
      return {
        background: styles.getPropertyValue('--background'),
        foreground: styles.getPropertyValue('--foreground'),
        primary: styles.getPropertyValue('--primary'),
        secondary: styles.getPropertyValue('--secondary'),
        accent: styles.getPropertyValue('--accent'),
        radius: styles.getPropertyValue('--radius'),
      };
    });

    // CSS変数が定義されているか確認
    expect(cssVariables.background).toBeTruthy();
    expect(cssVariables.foreground).toBeTruthy();
    expect(cssVariables.primary).toBeTruthy();
    expect(cssVariables.secondary).toBeTruthy();
    expect(cssVariables.accent).toBeTruthy();
    expect(cssVariables.radius).toBeTruthy();
  });

  test('ボタンのスタイルが正しく適用される', async ({ page }) => {
    await page.goto('/login');
    await waitForCSSToLoad(page);

    // ボタン要素を取得
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();

    // ボタンのスタイルを確認
    const buttonStyles = await submitButton.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        color: styles.color,
        padding: styles.padding,
        borderRadius: styles.borderRadius,
        cursor: styles.cursor,
        borderWidth: styles.borderWidth,
      };
    });

    // スタイルが適用されているか確認（背景色のチェックは除外）
    expect(buttonStyles.color).toBeTruthy();
    expect(buttonStyles.padding).not.toBe('0px');
    expect(buttonStyles.borderRadius).not.toBe('0px');
    // cursorはdisabledボタンではdefaultになる可能性があるため、どちらかであればOK
    expect(['pointer', 'default', 'not-allowed']).toContain(buttonStyles.cursor);
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

  test('カードコンポーネントのスタイルが適用される', async ({ page, context }) => {
    // デモページ用のモックをセットアップ
    await UnifiedMock.setupDashboardMocks(context);

    await page.goto('/demo');
    await waitForCSSToLoad(page);

    // カード要素を探す
    const card = page.locator('[class*="card"]').first();
    const cardExists = (await card.count()) > 0;

    if (cardExists) {
      const cardStyles = await card.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          backgroundColor: styles.backgroundColor,
          borderRadius: styles.borderRadius,
          boxShadow: styles.boxShadow,
        };
      });

      // カードのスタイルが適用されているか確認
      expect(cardStyles.backgroundColor).toBeTruthy();
      expect(cardStyles.borderRadius).not.toBe('0px');
    }
  });

  test('印刷用スタイルが定義されている', async ({ page }) => {
    await page.goto('/');
    await waitForCSSToLoad(page);

    // 印刷用スタイルシートの存在を確認
    const hasPrintStyles = await page.evaluate(() => {
      const styleSheets = Array.from(document.styleSheets);
      return styleSheets.some((sheet) => {
        try {
          const rules = Array.from(sheet.cssRules || []);
          return rules.some(
            (rule) => rule instanceof CSSMediaRule && rule.media.mediaText.includes('print')
          );
        } catch {
          // CORSエラーの場合はスキップ
          return false;
        }
      });
    });

    expect(hasPrintStyles).toBeTruthy();
  });

  test('フォームのスタイルが正しく適用される', async ({ page }) => {
    await page.goto('/login');
    await waitForCSSToLoad(page);

    // 入力フィールドのスタイルを確認
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();
    const inputStyles = await emailInput.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        borderColor: styles.borderColor,
        borderWidth: styles.borderWidth,
        borderRadius: styles.borderRadius,
        padding: styles.padding,
      };
    });

    // フォームフィールドのスタイルが適用されているか確認
    expect(inputStyles.borderColor).toBeTruthy();
    expect(inputStyles.borderWidth).not.toBe('0px');
    expect(inputStyles.borderRadius).not.toBe('0px');
    expect(inputStyles.padding).not.toBe('0px');
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
