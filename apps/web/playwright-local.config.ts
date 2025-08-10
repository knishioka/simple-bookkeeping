import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for local E2E testing
 * No webServer - expects manually started server
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: true,
  forbidOnly: false,
  retries: 1,
  workers: 1,

  reporter: [
    ['list', { printSteps: true }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    hasTouch: false,
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--font-render-hinting=none',
          ],
        },
      },
    },
  ],

  testMatch: ['**/*.spec.ts'],
  testIgnore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
});
