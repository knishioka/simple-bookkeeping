import { defineConfig } from '@playwright/test';

import baseConfig from './playwright.config';

/**
 * Full CI-specific Playwright configuration for comprehensive testing
 * Issue #336: E2E workflow optimization - complete test suite for Docker/comprehensive runs
 *
 * This configuration extends the base configuration with CI-specific adjustments
 * to run the complete test suite with maximum stability and coverage.
 * Used for comprehensive testing on main branch and scheduled runs.
 */

export default defineConfig({
  ...baseConfig,

  // Extended timeouts for full comprehensive test suite
  timeout: 75000, // Extended for comprehensive test stability (Issue #336)

  expect: {
    ...baseConfig.expect,
    timeout: 20000, // Extended assertion timeout for comprehensive testing
  },

  // Maximum retries for comprehensive testing reliability
  retries: 3, // Keep 3 retries for maximum stability

  // Optimized workers for comprehensive Docker environment
  workers: process.env.CI ? 2 : 2, // Increased to 2 for better performance in Docker

  // Force slower, more stable execution
  use: {
    ...baseConfig.use,
    // Extended timeouts for comprehensive testing
    actionTimeout: 25000, // Extended for complex interactions
    navigationTimeout: 45000, // Full navigation timeout for comprehensive tests

    // Full capture for comprehensive testing and debugging
    trace: 'retain-on-failure', // Optimized trace capture
    video: 'retain-on-failure', // Capture video on failure only for performance
    screenshot: 'only-on-failure', // Optimized screenshot capture

    // Balanced delay for comprehensive test stability
    launchOptions: {
      slowMo: 75, // Balanced slowdown for comprehensive testing
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        // Additional flags for Docker environment stability
        '--disable-extensions',
        '--no-first-run',
        '--disable-default-apps',
      ],
    },
  },

  // Comprehensive reporting for CI
  reporter: [
    ['list', { printSteps: true }], // More verbose for comprehensive testing
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['html', { outputFolder: 'test-results/html', open: 'never' }],
    ['./e2e/utils/performance-reporter.ts'], // Enhanced performance tracking
  ],

  // Global timeout for comprehensive suite
  globalTimeout: 45 * 60 * 1000, // 45 minutes for full comprehensive testing
});
