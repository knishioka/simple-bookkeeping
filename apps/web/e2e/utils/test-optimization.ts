import { Page } from '@playwright/test';

/**
 * Test optimization utilities
 * Implements performance improvements from Issue #476
 */

/**
 * Wait for page to be interactive (faster than networkidle)
 * Only waits for DOM to be ready, not for all network requests
 */
export async function waitForPageInteractive(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  // Wait for any critical elements if needed
  await page.waitForSelector('body', { timeout: 5000 });
}

/**
 * Fast navigation helper
 * Avoids waiting for networkidle which can be slow
 */
export async function fastNavigate(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

/**
 * Check if element exists without waiting
 * Returns immediately if element is not present
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  return page
    .locator(selector)
    .count()
    .then((count) => count > 0);
}

/**
 * Fast text content check
 * Checks if any of the provided texts exist on the page
 */
export async function pageHasText(page: Page, texts: string[]): Promise<boolean> {
  const bodyText = await page.textContent('body');
  if (!bodyText) return false;

  return texts.some((text) => bodyText.includes(text));
}

/**
 * Optimized wait for API response
 * Only waits for specific API calls, not all network activity
 */
export async function waitForAPI(
  page: Page,
  urlPattern: string | RegExp,
  timeout = 5000
): Promise<void> {
  await page.waitForResponse(urlPattern, { timeout }).catch(() => {
    // Ignore timeout, API might have been called before we started waiting
  });
}

/**
 * Batch element visibility checks
 * More efficient than checking elements one by one
 */
export async function checkElementsVisible(page: Page, selectors: string[]): Promise<boolean> {
  const results = await Promise.all(
    selectors.map((selector) =>
      page
        .locator(selector)
        .isVisible({ timeout: 1000 })
        .catch(() => false)
    )
  );
  return results.some((result) => result);
}

/**
 * Performance metrics helper
 * Tracks test execution time for optimization
 */
export class TestTimer {
  private startTime: number;
  private marks: Map<string, number>;

  constructor() {
    this.startTime = Date.now();
    this.marks = new Map();
  }

  mark(name: string): void {
    this.marks.set(name, Date.now() - this.startTime);
  }

  getDuration(name?: string): number {
    if (name && this.marks.has(name)) {
      const markTime = this.marks.get(name);
      return markTime ?? 0;
    }
    return Date.now() - this.startTime;
  }

  getReport(): string {
    const total = this.getDuration();
    const marks = Array.from(this.marks.entries())
      .map(([name, time]) => `  ${name}: ${time}ms`)
      .join('\n');
    return `Total: ${total}ms\n${marks}`;
  }
}
