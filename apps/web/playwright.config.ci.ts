import { defineConfig } from '@playwright/test';

import baseConfig from './playwright.config';

/**
 * CI-specific Playwright configuration
 * Issue #254: E2E tests stabilization for CI environment
 *
 * This configuration extends the base configuration with CI-specific adjustments
 * to improve test reliability in GitHub Actions and Docker environments.
 */

export default defineConfig({
  ...baseConfig,

  // CI-specific timeout overrides for better stability
  timeout: 60000, // 60 seconds per test (double the local timeout)

  expect: {
    ...baseConfig.expect,
    timeout: 10000, // 10 seconds for assertions in CI
  },

  // More aggressive retries in CI
  retries: 3,

  // Reduce workers to avoid resource contention
  workers: 1,

  // Force slower, more stable execution
  use: {
    ...baseConfig.use,
    // Extended timeouts for CI
    actionTimeout: 15000,
    navigationTimeout: 30000,

    // Always capture traces in CI for debugging
    trace: 'on',

    // Always capture video in CI
    video: 'on',

    // Always capture screenshots
    screenshot: 'on',

    // Add artificial delay between actions for stability
    launchOptions: {
      slowMo: 100, // 100ms delay between actions
    },
  },

  // Reporter configuration for CI
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['html', { outputFolder: 'test-results/html', open: 'never' }],
  ],
});
