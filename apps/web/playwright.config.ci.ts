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
  timeout: 60000, // Restored to 60s for full test suite stability (Issue #326)

  expect: {
    ...baseConfig.expect,
    timeout: 15000, // 15 seconds for assertions in CI (increased for Docker)
  },

  // More aggressive retries in CI
  retries: 3, // Restored to 3 for better reliability with full suite (Issue #326)

  // Use 1 worker in CI to avoid resource contention
  workers: process.env.CI ? 1 : 2,

  // Force slower, more stable execution
  use: {
    ...baseConfig.use,
    // Extended timeouts for CI/Docker environment
    actionTimeout: 15000, // Reduced from 20000 for faster failure (Issue #317)
    navigationTimeout: 30000, // Reduced from 45000 for faster feedback (Issue #317)

    // Always capture traces in CI for debugging
    trace: 'on',

    // Always capture video in CI
    video: 'on',

    // Always capture screenshots
    screenshot: 'on',

    // Add artificial delay between actions for stability
    launchOptions: {
      slowMo: 50, // Reduced from 100ms to balance speed and stability
    },
  },

  // Reporter configuration for CI
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['html', { outputFolder: 'test-results/html', open: 'never' }],
    ['./e2e/utils/performance-reporter.ts'], // Issue #326: Performance tracking
  ],
});
