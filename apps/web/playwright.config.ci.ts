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
  timeout: 45000, // Reduced from 60s to 45s for faster failure detection (Issue #317)

  expect: {
    ...baseConfig.expect,
    timeout: 15000, // 15 seconds for assertions in CI (increased for Docker)
  },

  // More aggressive retries in CI
  retries: 2, // Reduced from 3 to 2 for faster feedback (Issue #317)

  // Use 2 workers for better parallelization while avoiding contention
  workers: 2,

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
  ],
});
