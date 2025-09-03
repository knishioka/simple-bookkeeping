import { defineConfig } from '@playwright/test';

import baseConfig from './playwright.config';

/**
 * Fast E2E configuration for quick feedback in CI
 * Issue #336: E2E workflow optimization - role separation approach
 *
 * This configuration is optimized for speed and runs essential tests only.
 * It's designed to provide fast feedback on PRs (target: 3-5 minutes total).
 */

export default defineConfig({
  ...baseConfig,

  // Fast execution timeouts
  timeout: 30000, // Reduced from 60s for faster feedback

  expect: {
    ...baseConfig.expect,
    timeout: 8000, // Reduced from 15s for faster assertions
  },

  // Minimal retries for speed
  retries: process.env.CI ? 1 : 0, // Only 1 retry in CI for speed

  // Optimized worker count for parallel execution
  workers: process.env.CI ? 4 : '50%', // More workers in CI for sharding

  // Force faster, less stable execution for essential tests only
  use: {
    ...baseConfig.use,
    // Reduced timeouts for faster execution
    actionTimeout: 8000, // Reduced from 15000
    navigationTimeout: 15000, // Reduced from 30000

    // Minimal capturing for speed
    trace: 'off', // No traces for fast tests
    video: 'off', // No videos for fast tests
    screenshot: 'only-on-failure', // Only on failure

    // No artificial delays for speed
    launchOptions: {
      slowMo: 0, // No delays for fast tests
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images', // Skip image loading for speed
        '--disable-javascript-harmony-shipping',
      ],
    },
  },

  // Minimal reporting for speed
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  // Override projects for fast execution - chromium only
  projects: [
    {
      name: 'chromium-fast',
      use: {
        ...(baseConfig.projects && baseConfig.projects[0] ? baseConfig.projects[0].use : {}),
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-images',
            '--disable-javascript-harmony-shipping',
            '--no-first-run',
            '--disable-default-apps',
            '--disable-popup-blocking',
            '--disable-translate',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
          ],
        },
      },
      // Only run essential tests (exclude slow and integration tests)
      testIgnore: [
        '**/*slow*',
        '**/*integration*',
        '**/accounting-periods.spec.ts', // Move to comprehensive suite
        '**/extended-coverage.spec.ts', // Move to comprehensive suite
      ],
    },
  ],

  // Keep webServer config from base but with faster startup
  webServer: baseConfig.webServer
    ? {
        ...baseConfig.webServer,
        timeout: 30000, // Reduced timeout for faster startup
      }
    : undefined,
});
