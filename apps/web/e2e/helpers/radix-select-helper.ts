import { type Page, type Locator } from '@playwright/test';

/**
 * Helper class for interacting with Radix UI Select components in E2E tests
 */
export class RadixSelectHelper {
  /**
   * Select an option from a Radix UI Select component
   * @param page - Playwright page object
   * @param selectLocator - Locator for the select trigger or string selector
   * @param optionText - Text of the option to select
   * @param timeout - Maximum time to wait for operations (default: 10000ms)
   */
  static async selectOption(
    page: Page,
    selectLocator: Locator | string,
    optionText: string,
    timeout: number = 10000
  ): Promise<void> {
    const select = typeof selectLocator === 'string' ? page.locator(selectLocator) : selectLocator;

    // 1. Click the select trigger to open the dropdown
    await select.click();

    // 2. Wait for the options list to be visible
    await page.waitForSelector('[role="option"]', { timeout });

    // 3. Add a small delay to ensure the dropdown is fully rendered
    await page.waitForTimeout(500);

    // 4. Find and click the target option
    const option = page.locator(`[role="option"]:has-text("${optionText}")`).first();
    await option.waitFor({ state: 'visible', timeout });
    await option.click();

    // 5. Wait for the dropdown to close
    await this.waitForOptionsClosed(page, timeout);
  }

  /**
   * Wait for the options list to be closed
   * @param page - Playwright page object
   * @param timeout - Maximum time to wait (default: 5000ms)
   */
  static async waitForOptionsClosed(page: Page, timeout: number = 5000): Promise<void> {
    try {
      // Wait for all option elements to be hidden or detached
      await page.waitForSelector('[role="option"]', { state: 'hidden', timeout });
    } catch {
      // Options might be removed from DOM entirely, which is also fine
    }
  }

  /**
   * Verify that a specific value is selected in the Radix UI Select
   * @param page - Playwright page object
   * @param selectLocator - Locator for the select trigger
   * @param expectedText - Expected text in the select value
   */
  static async verifySelection(
    page: Page,
    selectLocator: Locator | string,
    expectedText: string
  ): Promise<boolean> {
    const select = typeof selectLocator === 'string' ? page.locator(selectLocator) : selectLocator;
    const selectValue = select.locator('[data-radix-select-value], .select-value, span').first();

    try {
      await selectValue.waitFor({ state: 'visible', timeout: 5000 });
      const text = await selectValue.textContent();
      return text?.includes(expectedText) ?? false;
    } catch {
      return false;
    }
  }

  /**
   * Get all available options from a Radix UI Select
   * @param page - Playwright page object
   * @param selectLocator - Locator for the select trigger
   * @returns Array of option texts
   */
  static async getOptions(page: Page, selectLocator: Locator | string): Promise<string[]> {
    const select = typeof selectLocator === 'string' ? page.locator(selectLocator) : selectLocator;

    // Open the dropdown
    await select.click();

    // Wait for options to be visible
    await page.waitForSelector('[role="option"]', { timeout: 5000 });

    // Get all option texts
    const options = await page.locator('[role="option"]').allTextContents();

    // Close the dropdown by pressing Escape
    await page.keyboard.press('Escape');
    await this.waitForOptionsClosed(page);

    return options;
  }

  /**
   * Select an option by index
   * @param page - Playwright page object
   * @param selectLocator - Locator for the select trigger
   * @param index - Zero-based index of the option to select
   */
  static async selectByIndex(
    page: Page,
    selectLocator: Locator | string,
    index: number
  ): Promise<void> {
    const select = typeof selectLocator === 'string' ? page.locator(selectLocator) : selectLocator;

    // Open the dropdown
    await select.click();

    // Wait for options to be visible
    await page.waitForSelector('[role="option"]', { timeout: 10000 });

    // Select the option by index
    const option = page.locator('[role="option"]').nth(index);
    await option.click();

    // Wait for dropdown to close
    await this.waitForOptionsClosed(page);
  }
}
