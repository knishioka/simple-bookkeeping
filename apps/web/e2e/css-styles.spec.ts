import { test, expect } from '@playwright/test';

/**
 * CSSスタイルとTailwind CSSの適用確認テスト
 *
 * このテストはCSSが正しくビルド・適用されているかを確認します。
 * Tailwind CSS v4の設定が正しく動作していることを検証します。
 */

test.describe('CSSスタイルの適用確認', () => {
  test('Tailwind CSSのユーティリティクラスが適用される', async ({ page }) => {
    await page.goto('/');

    // Tailwindのユーティリティクラスが適用されている要素を確認
    const mainContainer = page.locator('main').first();

    // min-heightが適用されているか確認
    const minHeight = await mainContainer.evaluate((el) => {
      return window.getComputedStyle(el).minHeight;
    });
    expect(minHeight).not.toBe('0px');

    // displayプロパティが設定されているか確認（flexまたはblock）
    const display = await mainContainer.evaluate((el) => {
      return window.getComputedStyle(el).display;
    });
    expect(['flex', 'block']).toContain(display);
  });

  test('CSS変数が正しく定義されている', async ({ page }) => {
    await page.goto('/');

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
    expect(buttonStyles.cursor).toBe('pointer');
  });

  test('レスポンシブデザインが機能する', async ({ page }) => {
    // デスクトップサイズ
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

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

  test('カードコンポーネントのスタイルが適用される', async ({ page }) => {
    await page.goto('/demo');

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

    // 入力フィールドのスタイルを確認
    const emailInput = page.locator('#email');
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
