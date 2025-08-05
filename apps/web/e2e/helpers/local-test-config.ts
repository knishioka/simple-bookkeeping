/**
 * Local development test configuration
 * Minimal helpers using Playwright's built-in features
 */

import { Page } from '@playwright/test';

/**
 * Local development timeouts (using Playwright defaults where possible)
 */
export const LOCAL_TIMEOUTS = {
  navigation: 30000, // Playwright default
  action: 15000,
  assertion: 10000,
};

/**
 * Wait for API using Playwright's built-in features
 */
export async function waitForApiReady(page: Page): Promise<void> {
  // Simply wait for the API health check endpoint
  await page.waitForResponse(
    (response) => response.url().includes('/api/v1') && response.status() === 200,
    { timeout: 10000 }
  );
}

/**
 * Wait for hydration using Playwright's built-in waitForLoadState
 */
export async function waitForHydration(page: Page): Promise<void> {
  // Playwright's networkidle is usually sufficient for Next.js apps
  await page.waitForLoadState('networkidle');
}
