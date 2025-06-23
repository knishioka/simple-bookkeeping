import { Page, Locator, expect } from '@playwright/test';

/**
 * すべてのページオブジェクトの基底クラス
 * 共通的な操作や待機処理を提供
 */
export abstract class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * ページに移動し、ロード完了を待機
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
    await this.waitForPageLoad();
  }

  /**
   * ページのロード完了を待機
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * 要素が表示されるまで待機
   */
  async waitForElement(selector: string, timeout?: number): Promise<Locator> {
    const element = this.page.locator(selector);
    await element.waitFor({ timeout });
    return element;
  }

  /**
   * 要素が非表示になるまで待機
   */
  async waitForElementHidden(selector: string, timeout?: number): Promise<void> {
    await this.page.locator(selector).waitFor({ state: 'hidden', timeout });
  }

  /**
   * テキストを含む要素を待機
   */
  async waitForText(text: string, timeout?: number): Promise<Locator> {
    const element = this.page.locator(`text=${text}`);
    await element.waitFor({ timeout });
    return element;
  }

  /**
   * ダイアログの表示を待機
   */
  async waitForDialog(timeout?: number): Promise<Locator> {
    const dialog = this.page.locator('[role="dialog"]');
    await dialog.waitFor({ timeout });
    return dialog;
  }

  /**
   * ダイアログの非表示を待機
   */
  async waitForDialogHidden(timeout?: number): Promise<void> {
    await this.page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout });
  }

  /**
   * トーストメッセージの表示を確認
   */
  async expectToast(message: string): Promise<void> {
    await expect(this.page.locator('.toast')).toContainText(message);
  }

  /**
   * 成功メッセージの表示を確認
   */
  async expectSuccessMessage(message: string): Promise<void> {
    await expect(
      this.page
        .locator('text=作成しました, text=更新しました, text=削除しました')
        .filter({ hasText: message })
    ).toBeVisible();
  }

  /**
   * エラーメッセージの表示を確認
   */
  async expectErrorMessage(message: string): Promise<void> {
    await expect(
      this.page.locator('.error, [role="alert"]').filter({ hasText: message })
    ).toBeVisible();
  }

  /**
   * ローディング状態の終了を待機
   */
  async waitForLoadingComplete(): Promise<void> {
    // スピナーやローディングインジケータが消えるまで待機
    await this.page.waitForFunction(
      () => {
        const spinners = document.querySelectorAll('[data-testid="loading"], .loading, .spinner');
        return spinners.length === 0;
      },
      { timeout: 10000 }
    );
  }

  /**
   * 特定の時間待機（デバッグ用、本来は使用を避ける）
   */
  async wait(milliseconds: number): Promise<void> {
    await this.page.waitForTimeout(milliseconds);
  }
}
