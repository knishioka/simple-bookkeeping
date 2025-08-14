/**
 * Efficient wait strategies for E2E tests
 * Issue #129: Optimize E2E test timeouts and execution speed
 */

import { Page } from '@playwright/test';
import { TIMEOUTS } from '@simple-bookkeeping/config';

/**
 * Wait for API response with shorter timeout
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  options?: {
    method?: string;
    status?: number;
    timeout?: number;
  }
): Promise<void> {
  const timeout = options?.timeout ?? TIMEOUTS.TEST_API_RESPONSE;

  await page.waitForResponse(
    (response) => {
      const matchesUrl =
        typeof urlPattern === 'string'
          ? response.url().includes(urlPattern)
          : urlPattern.test(response.url());

      const matchesMethod = !options?.method || response.request().method() === options.method;
      const matchesStatus = !options?.status || response.status() === options.status;

      return matchesUrl && matchesMethod && matchesStatus;
    },
    { timeout }
  );
}

/**
 * Wait for element to be stable (no changes for specified duration)
 */
export async function waitForElementStable(
  page: Page,
  selector: string,
  options?: {
    stableTime?: number;
    timeout?: number;
  }
): Promise<void> {
  const stableTime = options?.stableTime ?? 100;
  const timeout = options?.timeout ?? TIMEOUTS.TEST_ELEMENT;

  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout });

  // Wait for element content to be stable
  let previousContent = await element.textContent();
  let stableCount = 0;
  const checkInterval = 50;
  const checksNeeded = Math.ceil(stableTime / checkInterval);

  while (stableCount < checksNeeded) {
    await page.waitForTimeout(checkInterval);
    const currentContent = await element.textContent();

    if (currentContent === previousContent) {
      stableCount++;
    } else {
      stableCount = 0;
      previousContent = currentContent;
    }
  }
}

/**
 * Wait for data table to load
 */
export async function waitForTableData(
  page: Page,
  tableSelector: string,
  options?: {
    minRows?: number;
    timeout?: number;
  }
): Promise<void> {
  const minRows = options?.minRows ?? 1;
  const timeout = options?.timeout ?? TIMEOUTS.TEST_ELEMENT;

  // Wait for table to be visible
  await page.locator(tableSelector).waitFor({ state: 'visible', timeout });

  // Wait for rows to appear
  await page.waitForFunction(
    ({ selector, min }) => {
      const table = document.querySelector(selector);
      if (!table) return false;

      const rows = table.querySelectorAll('tbody tr');
      return rows.length >= min;
    },
    { selector: tableSelector, min: minRows },
    { timeout }
  );
}

/**
 * Wait for form to be ready for interaction
 */
export async function waitForFormReady(
  page: Page,
  formSelector: string,
  options?: {
    timeout?: number;
  }
): Promise<void> {
  const timeout = options?.timeout ?? TIMEOUTS.TEST_ELEMENT;

  // Wait for form to be visible
  const form = page.locator(formSelector);
  await form.waitFor({ state: 'visible', timeout });

  // Wait for all form inputs to be enabled
  await page.waitForFunction(
    (selector) => {
      const form = document.querySelector(selector);
      if (!form) return false;

      const inputs = form.querySelectorAll('input, select, textarea, button');
      return Array.from(inputs).every((input) => {
        const element = input as HTMLInputElement;
        return !element.disabled && !element.readOnly;
      });
    },
    formSelector,
    { timeout }
  );
}

/**
 * Wait for navigation to complete with optimized timeout
 */
export async function waitForNavigation(
  page: Page,
  options?: {
    url?: string | RegExp;
    timeout?: number;
  }
): Promise<void> {
  const timeout = options?.timeout ?? TIMEOUTS.TEST_NAVIGATION;

  if (options?.url) {
    await page.waitForURL(options.url, { timeout });
  } else {
    await page.waitForLoadState('domcontentloaded', { timeout });
  }
}

/**
 * Smart wait that combines multiple strategies
 */
export async function smartWait(
  page: Page,
  conditions: {
    selector?: string;
    url?: string | RegExp;
    apiEndpoint?: string;
    loadState?: 'load' | 'domcontentloaded' | 'networkidle';
  },
  options?: {
    timeout?: number;
  }
): Promise<void> {
  const timeout = options?.timeout ?? TIMEOUTS.TEST_ELEMENT;
  const promises: Promise<any>[] = [];

  if (conditions.selector) {
    promises.push(page.locator(conditions.selector).waitFor({ state: 'visible', timeout }));
  }

  if (conditions.url) {
    promises.push(page.waitForURL(conditions.url, { timeout }));
  }

  if (conditions.apiEndpoint) {
    promises.push(
      page.waitForResponse((response) => response.url().includes(conditions.apiEndpoint), {
        timeout,
      })
    );
  }

  if (conditions.loadState) {
    promises.push(page.waitForLoadState(conditions.loadState, { timeout }));
  }

  if (promises.length > 0) {
    await Promise.race(promises);
  }
}

/**
 * Wait for debounced input
 */
export async function waitForDebounce(page: Page, debounceTime: number = 300): Promise<void> {
  // Use networkidle for debounced API calls
  await Promise.race([
    page.waitForLoadState('networkidle', { timeout: debounceTime + 500 }),
    page.waitForTimeout(debounceTime),
  ]);
}
