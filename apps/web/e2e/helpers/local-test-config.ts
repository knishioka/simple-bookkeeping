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
 * Wait for API using Playwright's built-in features (improved)
 * Issue #25 fix: Better API readiness check
 */
export async function waitForApiReady(page: Page): Promise<void> {
  // Improved API readiness check with multiple conditions
  try {
    await Promise.race([
      // Try to wait for API health check endpoint
      page.waitForResponse((response) => response.url().includes('/api/v1') && response.ok(), {
        timeout: 10000,
      }),
      // Or wait for any successful API response
      page.waitForResponse(
        (response) => response.url().includes('localhost:3001') && response.ok(),
        { timeout: 10000 }
      ),
      // Or just wait for network idle state
      page.waitForLoadState('networkidle', { timeout: 10000 }),
    ]);
  } catch (error) {
    // If API is not ready, continue anyway (tests may use mocks)
    console.warn('API readiness check timed out, continuing with tests');
  }
}

/**
 * Wait for hydration using Playwright's built-in waitForLoadState
 */
export async function waitForHydration(page: Page): Promise<void> {
  // Playwright's networkidle is usually sufficient for Next.js apps
  await page.waitForLoadState('networkidle');
}
