import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Simple Bookkeeping E2E tests
 * 
 * This configuration provides:
 * - Chrome, Firefox, Safari browser testing
 * - Mobile viewport testing
 * - Parallel test execution
 * - Test environment setup with local dev server
 */
export default defineConfig({
  // テストファイルの場所
  testDir: './e2e',
  
  // 各テストのタイムアウト時間
  timeout: 30000,
  
  // テスト実行前の期待値設定
  expect: {
    // アサーションのタイムアウト
    timeout: 5000
  },
  
  // テスト実行設定
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  // レポート設定
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['list']
  ],
  
  // グローバル設定
  use: {
    // ベースURL（開発サーバー）
    baseURL: 'http://localhost:3000',
    
    // トレース設定（失敗時のデバッグ用）
    trace: 'on-first-retry',
    
    // スクリーンショット設定
    screenshot: 'only-on-failure',
    
    // ビデオ設定
    video: 'retain-on-failure',
  },

  // プロジェクト設定（ブラウザ・デバイス別）
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    // モバイルテスト
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // 開発サーバー設定
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});