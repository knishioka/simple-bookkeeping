import { Page, Locator } from '@playwright/test';

/**
 * Radix UI Select コンポーネント操作のヘルパークラス（簡略版）
 *
 * 複雑な操作メソッドは削除し、基本的な操作のみを提供します。
 */
export class RadixSelectHelper {
  /**
   * Selectオプションを選択（基本版）
   */
  static async selectOption(
    page: Page,
    selectLocator: Locator | string,
    optionText: string,
    timeout: number = 10000
  ): Promise<void> {
    // 1. Selectロケーターの処理
    const select = typeof selectLocator === 'string' ? page.locator(selectLocator) : selectLocator;

    // 2. Selectをクリックして開く
    await select.click();

    // 3. オプションリストが表示されるまで待機
    await page.waitForSelector('[role="option"]', { timeout });

    // 4. 対象オプションを探してクリック
    const option = page.locator(`[role="option"]:has-text("${optionText}")`).first();
    await option.waitFor({ timeout });
    await option.click();

    // 5. オプションリストが閉じるまで待機
    await this.waitForOptionsClosed(page, timeout);
  }

  /**
   * 選択されている値を確認
   */
  static async verifySelection(
    page: Page,
    selectLocator: Locator | string,
    expectedText: string
  ): Promise<void> {
    const select = typeof selectLocator === 'string' ? page.locator(selectLocator) : selectLocator;

    await page.waitForTimeout(200); // 値が反映されるまで少し待機
    const actualText = await select.textContent();

    if (!actualText?.includes(expectedText)) {
      throw new Error(`Expected select to contain "${expectedText}", but got "${actualText}"`);
    }
  }

  /**
   * 利用可能なオプションを取得
   */
  static async getAvailableOptions(page: Page, selectLocator: Locator | string): Promise<string[]> {
    const select = typeof selectLocator === 'string' ? page.locator(selectLocator) : selectLocator;

    // Selectを開く
    await select.click();
    await this.waitForOptionsVisible(page);

    // オプションを取得
    const options = await page.locator('[role="option"]').allTextContents();

    // Selectを閉じる
    await page.keyboard.press('Escape');
    await this.waitForOptionsClosed(page);

    return options.map((opt) => opt.trim()).filter((opt) => opt !== '');
  }

  /**
   * オプションリストが表示されるまで待機
   */
  static async waitForOptionsVisible(page: Page, timeout: number = 5000): Promise<void> {
    await page.waitForSelector('[role="option"]', {
      state: 'visible',
      timeout,
    });
  }

  /**
   * オプションリストが閉じるまで待機
   */
  static async waitForOptionsClosed(page: Page, timeout: number = 5000): Promise<void> {
    await page
      .waitForSelector('[role="option"]', {
        state: 'hidden',
        timeout,
      })
      .catch(() => {
        // オプションが既に閉じている場合はエラーを無視
      });
  }
}

/**
 * フォーム操作のヘルパークラス（簡略版）
 */
export class FormHelper {
  /**
   * テキストフィールドに値を入力
   */
  static async fillField(page: Page, selector: Locator | string, value: string): Promise<void> {
    const field = typeof selector === 'string' ? page.locator(selector) : selector;
    await field.clear();
    await field.fill(value);
  }

  /**
   * テキストエリアに値を入力
   */
  static async fillTextarea(page: Page, selector: Locator | string, value: string): Promise<void> {
    const textarea = typeof selector === 'string' ? page.locator(selector) : selector;
    await textarea.clear();
    await textarea.fill(value);
  }

  /**
   * 数値フィールドに値を入力
   */
  static async fillNumericField(
    page: Page,
    selector: Locator | string,
    value: number
  ): Promise<void> {
    const field = typeof selector === 'string' ? page.locator(selector) : selector;
    await field.clear();
    await field.fill(value.toString());
  }

  /**
   * フォームを送信
   */
  static async submitForm(
    page: Page,
    submitButtonSelector: Locator | string,
    options?: { waitForResponse?: boolean }
  ): Promise<void> {
    const submitButton =
      typeof submitButtonSelector === 'string'
        ? page.locator(submitButtonSelector)
        : submitButtonSelector;

    if (options?.waitForResponse) {
      await Promise.all([
        page.waitForResponse((response) => response.status() === 200),
        submitButton.click(),
      ]);
    } else {
      await submitButton.click();
    }
  }
}
