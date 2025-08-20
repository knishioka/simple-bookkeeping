/**
 * Enhanced Test Utilities for E2E Tests
 * Issue #201: Performance optimization and better error messages
 */

import { Page } from '@playwright/test';
import { getTestConfig } from '@simple-bookkeeping/config';

/**
 * Custom error class for better error messages
 */
export class E2ETestError extends Error {
  constructor(
    message: string,
    public details?: {
      page?: string;
      selector?: string;
      action?: string;
      expected?: unknown;
      actual?: unknown;
      screenshot?: string;
    }
  ) {
    super(message);
    this.name = 'E2ETestError';
  }

  toString() {
    let result = `${this.name}: ${this.message}`;
    if (this.details) {
      result += '\nDetails:';
      if (this.details.page) result += `\n  Page: ${this.details.page}`;
      if (this.details.selector) result += `\n  Selector: ${this.details.selector}`;
      if (this.details.action) result += `\n  Action: ${this.details.action}`;
      if (this.details.expected) result += `\n  Expected: ${JSON.stringify(this.details.expected)}`;
      if (this.details.actual) result += `\n  Actual: ${JSON.stringify(this.details.actual)}`;
      if (this.details.screenshot) result += `\n  Screenshot: ${this.details.screenshot}`;
    }
    return result;
  }
}

/**
 * Enhanced page navigation with better error handling
 */
export async function navigateTo(
  page: Page,
  path: string,
  options: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
    timeout?: number;
    retries?: number;
  } = {}
) {
  const config = getTestConfig();
  const fullUrl = `${config.urls.web}${path}`;
  const { waitUntil = 'domcontentloaded', timeout = 10000, retries = 1 } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.goto(fullUrl, { waitUntil, timeout });

      // Check for common error indicators
      const errorElement = await page
        .locator('[role="alert"], .error-message, .text-destructive')
        .first();
      if (await errorElement.isVisible({ timeout: 100 }).catch(() => false)) {
        const errorText = await errorElement.textContent();
        throw new E2ETestError(`Page loaded with error: ${errorText}`, {
          page: fullUrl,
          actual: errorText,
        });
      }

      return; // Success
    } catch (error) {
      lastError = error as Error;

      if (attempt < retries) {
        console.warn(`Navigation attempt ${attempt} failed, retrying...`);
        await page.waitForTimeout(1000 * attempt); // Exponential backoff
      }
    }
  }

  // Take screenshot on final failure
  const screenshotPath = `test-results/navigation-error-${Date.now()}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

  throw new E2ETestError(
    `Failed to navigate to ${fullUrl} after ${retries} attempts: ${lastError?.message}`,
    {
      page: fullUrl,
      action: 'navigate',
      screenshot: screenshotPath,
    }
  );
}

/**
 * Optimized element waiting with better error messages
 */
export async function waitForElement(
  page: Page,
  selector: string,
  options: {
    state?: 'attached' | 'detached' | 'visible' | 'hidden';
    timeout?: number;
    description?: string;
  } = {}
) {
  const { state = 'visible', timeout = 5000, description } = options;
  const elementDesc = description || selector;

  try {
    const locator = page.locator(selector);
    await locator.waitFor({ state, timeout });
    return locator;
  } catch {
    // Take screenshot for debugging
    const screenshotPath = `test-results/wait-error-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

    // Get page state for debugging
    const pageUrl = page.url();
    const pageTitle = await page.title();
    const visibleText = await page
      .locator('body')
      .textContent()
      .catch(() => 'Could not get page text');

    throw new E2ETestError(`Element "${elementDesc}" not ${state} within ${timeout}ms`, {
      page: pageUrl,
      selector,
      action: `wait for ${state}`,
      actual: {
        title: pageTitle,
        textPreview: visibleText?.substring(0, 200),
      },
      screenshot: screenshotPath,
    });
  }
}

/**
 * Optimized click action with retry logic
 */
export async function clickElement(
  page: Page,
  selector: string,
  options: {
    timeout?: number;
    retries?: number;
    description?: string;
    force?: boolean;
  } = {}
) {
  const { timeout = 5000, retries = 2, description, force = false } = options;
  const elementDesc = description || selector;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const locator = page.locator(selector);

      // Wait for element to be clickable
      await locator.waitFor({ state: 'visible', timeout });

      // Scroll into view if needed
      await locator.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});

      // Click with appropriate options
      await locator.click({ force, timeout });

      return; // Success
    } catch (error) {
      lastError = error as Error;

      if (attempt < retries) {
        console.warn(`Click attempt ${attempt} failed for "${elementDesc}", retrying...`);
        await page.waitForTimeout(500 * attempt);
      }
    }
  }

  throw new E2ETestError(
    `Failed to click "${elementDesc}" after ${retries} attempts: ${lastError?.message}`,
    {
      page: page.url(),
      selector,
      action: 'click',
    }
  );
}

/**
 * Optimized form filling with validation
 */
export async function fillForm(
  page: Page,
  fields: Array<{
    selector: string;
    value: string;
    type?: 'text' | 'select' | 'checkbox' | 'radio';
    description?: string;
  }>,
  options: {
    validateAfterFill?: boolean;
    clearFirst?: boolean;
  } = {}
) {
  const { validateAfterFill = true, clearFirst = true } = options;

  for (const field of fields) {
    const { selector, value, type = 'text', description } = field;
    const fieldDesc = description || selector;

    try {
      const locator = page.locator(selector);
      await locator.waitFor({ state: 'visible', timeout: 3000 });

      switch (type) {
        case 'text':
          if (clearFirst) {
            await locator.clear();
          }
          await locator.fill(value);
          break;

        case 'select':
          await locator.selectOption(value);
          break;

        case 'checkbox':
          if (value === 'true') {
            await locator.check();
          } else {
            await locator.uncheck();
          }
          break;

        case 'radio':
          await locator.check();
          break;
      }

      // Validate the value was set correctly
      if (validateAfterFill && type === 'text') {
        const actualValue = await locator.inputValue();
        if (actualValue !== value) {
          throw new E2ETestError(`Failed to set field "${fieldDesc}" - value mismatch`, {
            selector,
            expected: value,
            actual: actualValue,
          });
        }
      }
    } catch (error) {
      if (error instanceof E2ETestError) throw error;

      throw new E2ETestError(`Failed to fill field "${fieldDesc}": ${(error as Error).message}`, {
        page: page.url(),
        selector,
        action: `fill ${type} field`,
        expected: value,
      });
    }
  }
}

/**
 * Optimized table data extraction
 */
export async function getTableData(
  page: Page,
  tableSelector: string,
  options: {
    includeHeaders?: boolean;
    timeout?: number;
  } = {}
): Promise<string[][]> {
  const { includeHeaders = true, timeout = 5000 } = options;

  try {
    const table = page.locator(tableSelector);
    await table.waitFor({ state: 'visible', timeout });

    const data: string[][] = [];

    if (includeHeaders) {
      const headers = await table.locator('thead th').allTextContents();
      if (headers.length > 0) {
        data.push(headers);
      }
    }

    const rows = await table.locator('tbody tr').all();
    for (const row of rows) {
      const cells = await row.locator('td').allTextContents();
      data.push(cells);
    }

    return data;
  } catch (error) {
    throw new E2ETestError(`Failed to extract table data: ${(error as Error).message}`, {
      page: page.url(),
      selector: tableSelector,
      action: 'extract table data',
    });
  }
}

/**
 * Performance monitoring helper
 */
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  private measures: Array<{ name: string; duration: number }> = [];

  mark(name: string) {
    this.marks.set(name, Date.now());
  }

  measure(name: string, startMark: string, endMark?: string) {
    const start = this.marks.get(startMark);
    const end = endMark ? this.marks.get(endMark) : Date.now();

    if (!start) {
      throw new Error(`Start mark "${startMark}" not found`);
    }

    const duration = (end || Date.now()) - start;
    this.measures.push({ name, duration });

    return duration;
  }

  getReport() {
    return {
      marks: Array.from(this.marks.entries()),
      measures: this.measures,
      totalDuration: this.getTotalDuration(),
      averageDuration: this.getAverageDuration(),
    };
  }

  private getTotalDuration() {
    return this.measures.reduce((sum, m) => sum + m.duration, 0);
  }

  private getAverageDuration() {
    if (this.measures.length === 0) return 0;
    return this.getTotalDuration() / this.measures.length;
  }

  logReport() {
    const report = this.getReport();
    console.log('Performance Report:');
    console.log('═══════════════════════════════════════');

    for (const measure of this.measures) {
      console.log(`${measure.name}: ${measure.duration}ms`);
    }

    console.log('───────────────────────────────────────');
    console.log(`Total: ${report.totalDuration}ms`);
    console.log(`Average: ${report.averageDuration.toFixed(2)}ms`);
    console.log('═══════════════════════════════════════');
  }
}

/**
 * Retry helper for flaky operations
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: boolean;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = true, onRetry } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts) {
        const waitTime = backoff ? delay * attempt : delay;

        if (onRetry) {
          onRetry(attempt, lastError);
        }

        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Smart wait helper that reduces unnecessary waiting
 */
export async function smartWait(
  page: Page,
  condition: () => Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    message?: string;
  } = {}
) {
  const { timeout = 5000, interval = 100, message = 'Condition not met' } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await page.waitForTimeout(interval);
  }

  throw new E2ETestError(`${message} within ${timeout}ms`, {
    page: page.url(),
    action: 'wait for condition',
  });
}

/**
 * Batch operations for better performance
 */
export async function batchOperations<T>(
  operations: Array<() => Promise<T>>,
  options: {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {}
): Promise<T[]> {
  const { concurrency = 3, onProgress } = options;
  const results: T[] = [];
  const queue = [...operations];
  let completed = 0;

  async function processQueue() {
    while (queue.length > 0) {
      const operation = queue.shift();
      if (operation) {
        const result = await operation();
        results.push(result);
        completed++;

        if (onProgress) {
          onProgress(completed, operations.length);
        }
      }
    }
  }

  // Run operations in parallel with concurrency limit
  const workers = Array(Math.min(concurrency, operations.length))
    .fill(null)
    .map(() => processQueue());

  await Promise.all(workers);

  return results;
}
