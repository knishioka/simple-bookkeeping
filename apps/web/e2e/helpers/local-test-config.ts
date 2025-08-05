/**
 * Local development test configuration helpers
 * Provides utilities and configurations optimized for local development environment
 */

import { Page } from '@playwright/test';

/**
 * Local development specific timeouts
 */
export const LOCAL_TIMEOUTS = {
  navigation: 30000, // 30 seconds for page navigation
  action: 15000, // 15 seconds for actions
  assertion: 10000, // 10 seconds for assertions
  apiCall: 20000, // 20 seconds for API calls
};

/**
 * Wait for API to be ready in local environment
 * Sometimes the API server takes a moment to respond in local dev
 */
export async function waitForApiReady(page: Page): Promise<void> {
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const response = await page.request.get('http://localhost:3001/api/v1/', {
        timeout: 5000,
      });

      if (response.ok()) {
        console.log('API is ready');
        return;
      }
    } catch (error) {
      console.log(`API not ready yet, retry ${retries + 1}/${maxRetries}`);
    }

    retries++;
    await page.waitForTimeout(2000); // Wait 2 seconds before retry
  }

  throw new Error('API server is not responding');
}

/**
 * Login helper with retry logic for local environment
 */
export async function loginWithRetry(
  page: Page,
  email: string,
  password: string,
  maxRetries = 3
): Promise<void> {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await page.goto('/login', {
        waitUntil: 'networkidle',
        timeout: LOCAL_TIMEOUTS.navigation,
      });

      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');

      // Wait for navigation with proper timeout
      await page.waitForURL('/dashboard', {
        timeout: LOCAL_TIMEOUTS.navigation,
      });

      // Verify we're logged in
      await page.waitForSelector('[data-testid="user-menu"]', {
        timeout: LOCAL_TIMEOUTS.assertion,
      });

      console.log('Login successful');
      return;
    } catch (error) {
      console.log(`Login attempt ${retries + 1} failed:`, error);
      retries++;

      if (retries < maxRetries) {
        // Clear any stored tokens
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });

        // Wait before retry
        await page.waitForTimeout(2000);
      }
    }
  }

  throw new Error(`Failed to login after ${maxRetries} attempts`);
}

/**
 * Wait for React/Next.js hydration to complete
 */
export async function waitForHydration(page: Page): Promise<void> {
  // Wait for React root to be present
  await page.waitForSelector('#__next', { state: 'attached' });

  // Wait for any loading indicators to disappear
  const loadingSelectors = ['[data-testid="loading"]', '.loading', '[aria-busy="true"]'];

  for (const selector of loadingSelectors) {
    const elements = await page.$$(selector);
    if (elements.length > 0) {
      await page
        .waitForSelector(selector, {
          state: 'hidden',
          timeout: LOCAL_TIMEOUTS.assertion,
        })
        .catch(() => {
          // Ignore if selector doesn't exist
        });
    }
  }

  // Additional wait for hydration to complete
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500); // Small additional buffer
}

/**
 * Configuration for local database seeding
 */
export const LOCAL_TEST_DATA = {
  defaultUser: {
    email: 'admin@example.com',
    password: 'password123',
  },
  testOrganization: {
    name: 'テスト組織',
    code: 'TEST001',
  },
};

/**
 * Network condition simulation for local testing
 */
export async function simulateSlowNetwork(page: Page): Promise<void> {
  // Simulate 3G network
  await page.context().route('**/*', (route) => {
    setTimeout(() => route.continue(), 100); // Add 100ms delay
  });
}

/**
 * Clear all application data for clean test state
 */
export async function clearApplicationData(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();

    // Clear all cookies
    document.cookie.split(';').forEach((c) => {
      document.cookie = c
        .replace(/^ +/, '')
        .replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
    });

    // Clear IndexedDB if used
    if ('indexedDB' in window) {
      indexedDB.databases().then((databases) => {
        databases.forEach((db) => {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        });
      });
    }
  });
}

/**
 * Helper to handle Radix UI Select components in local environment
 */
export async function selectRadixOption(
  page: Page,
  triggerSelector: string,
  optionText: string
): Promise<void> {
  // Click the trigger with retry
  let clicked = false;
  for (let i = 0; i < 3; i++) {
    try {
      await page.click(triggerSelector, { timeout: 5000 });
      clicked = true;
      break;
    } catch (error) {
      console.log(`Retry clicking select trigger: ${i + 1}`);
      await page.waitForTimeout(1000);
    }
  }

  if (!clicked) {
    throw new Error(`Failed to click select trigger: ${triggerSelector}`);
  }

  // Wait for content to be visible
  await page.waitForSelector('[role="listbox"]', {
    state: 'visible',
    timeout: LOCAL_TIMEOUTS.assertion,
  });

  // Small delay for animation
  await page.waitForTimeout(300);

  // Click the option
  await page.click(`[role="option"]:has-text("${optionText}")`, {
    timeout: LOCAL_TIMEOUTS.action,
  });

  // Wait for select to close
  await page.waitForSelector('[role="listbox"]', {
    state: 'hidden',
    timeout: LOCAL_TIMEOUTS.assertion,
  });
}

/**
 * Environment-specific test skip helper
 */
interface TestInfo {
  skip(condition: boolean, description: string): void;
}

export function skipInCI(testInfo: TestInfo): boolean {
  if (process.env.CI && testInfo) {
    testInfo.skip(true, 'Skipping in CI environment');
    return true;
  }
  return false;
}

export function skipInLocal(testInfo: TestInfo): boolean {
  if (!process.env.CI && testInfo) {
    testInfo.skip(true, 'Skipping in local environment');
    return true;
  }
  return false;
}
