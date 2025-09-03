import { defineConfig } from '@playwright/test';

import baseConfig from './playwright.config.js';

/**
 * Comprehensive E2E configuration for thorough validation
 * Issue #336: E2E workflow optimization - role separation approach
 *
 * This configuration runs comprehensive tests on main branch only.
 * It includes all tests including slow and integration tests for full validation.
 */

export default defineConfig({
  ...baseConfig,

  // Extended timeouts for comprehensive testing
  timeout: 45000, // Longer timeout for complex tests

  expect: {
    ...baseConfig.expect,
    timeout: 20000, // Extended assertion timeout for complex interactions
  },

  // More aggressive retries for comprehensive testing
  retries: 3, // Full retry support for comprehensive validation

  // Balanced workers for comprehensive testing
  workers: process.env.CI ? 3 : 2, // Optimized for Docker environment

  // Comprehensive capture settings
  use: {
    ...baseConfig.use,
    // Extended timeouts for comprehensive testing
    actionTimeout: 20000,
    navigationTimeout: 45000,

    // Full tracing and capturing for debugging
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',

    // Moderate slowdown for stability in complex scenarios
    launchOptions: {
      slowMo: 100, // Some delay for complex interactions
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
      ],
    },
  },

  // Comprehensive reporting
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['html', { outputFolder: 'test-results/html', open: 'never' }],
    ['./e2e/utils/performance-reporter.ts'], // Performance tracking
  ],

  // Comprehensive project configuration - all browsers
  projects: [
    // Main comprehensive testing project
    {
      name: 'chromium-comprehensive',
      use: {
        ...(baseConfig.projects && baseConfig.projects[0] ? baseConfig.projects[0].use : {}),
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
          ],
        },
      },
      // Include all tests for comprehensive validation
      testMatch: '**/*.spec.ts',
    },

    // Cross-browser testing for comprehensive validation
    {
      name: 'firefox-comprehensive',
      use: {
        ...(baseConfig.projects?.find((p) => p.name === 'firefox')?.use || {}),
      },
      testMatch: ['**/basic.spec.ts', '**/journal-entries.spec.ts', '**/simple-entry.spec.ts'],
    },

    // Mobile testing for responsive validation
    {
      name: 'mobile-comprehensive',
      use: {
        ...(baseConfig.projects?.find((p) => p.name === 'mobile-chrome')?.use || {}),
      },
      testMatch: ['**/responsive-navigation.spec.ts', '**/basic.spec.ts'],
    },

    // API authentication testing
    {
      name: 'api-auth-comprehensive',
      use: {
        ...(baseConfig.projects?.find((p) => p.name === 'api-auth')?.use || {}),
      },
      testMatch: '**/auth/*.spec.ts',
    },
  ],

  // Global timeout for entire test suite
  globalTimeout: 30 * 60 * 1000, // 30 minutes for comprehensive suite

  // Keep webServer config from base
  webServer: baseConfig.webServer,
});
