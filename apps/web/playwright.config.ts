import { defineConfig, devices } from '@playwright/test';
import { PORTS, TIMEOUTS, getTestEnvironment } from '@simple-bookkeeping/config';

/**
 * Optimized Playwright configuration for E2E tests
 * Issue #203対応: E2Eテスト環境の環境変数管理を統一
 */

// Set Supabase env vars for E2E tests (required by middleware in feature branch)
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1bW15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDU1NzY4MDAsImV4cCI6MTk2MTE1MjgwMH0.dummy_key_for_testing';

// Get unified test environment configuration
const testEnv = getTestEnvironment();

// 環境変数を安全に読み取る
const isCI = testEnv.isCI;
const isDebug = process.env.DEBUG === 'true' || process.env.PWDEBUG === '1';

// タイムアウト設定（最適化済み - Issue #129, #244, #254）
const TEST_TIMEOUTS = {
  test: isCI ? 30000 : 20000, // テスト全体のタイムアウト (CI環境で安定性を優先)
  expect: isCI ? 5000 : 1500, // アサーションタイムアウト (CI環境で余裕を持たせる)
  action: isCI ? 10000 : 2000, // アクションタイムアウト (CI環境でより寛容に)
  navigation: isCI ? 15000 : 3000, // ナビゲーションタイムアウト (CI環境で十分な時間を確保)
  server: 45000, // サーバー起動タイムアウト (CI環境対応)
};

// リトライ設定
const RETRIES = {
  ci: 2, // CI環境では2回リトライ (安定性を優先 - Issue #254)
  local: 0, // ローカルではリトライなし
};

// ワーカー設定
const WORKERS = {
  ci: 2, // CI環境では2ワーカーに制限 (GitHub Actionsのリソース制約対応 - Issue #254)
  local: '75%', // ローカルではCPUコアの75%を使用
};

export default defineConfig({
  // テストディレクトリ
  testDir: './e2e',

  // 並列実行の最適化
  fullyParallel: true,
  forbidOnly: isCI,

  // タイムアウト設定
  timeout: TEST_TIMEOUTS.test,

  // 期待値設定
  expect: {
    timeout: TEST_TIMEOUTS.expect,
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
    },
  },

  // リトライ設定
  retries: isCI ? RETRIES.ci : RETRIES.local,

  // ワーカー数の最適化
  workers: isCI ? WORKERS.ci : WORKERS.local,

  // レポーター設定
  reporter: [
    ['list', { printSteps: isDebug }],
    ...(isCI
      ? [
          ['json', { outputFile: 'test-results/results.json' }] as const,
          ['html', { outputFolder: 'test-results/html', open: 'never' }] as const,
        ]
      : [['html', { outputFolder: 'test-results/html', open: 'on-failure' }] as const]),
  ],

  // 出力ディレクトリ
  outputDir: 'test-results/output',

  // グローバル設定
  globalSetup:
    process.env.USE_GLOBAL_SETUP === 'false' ? undefined : require.resolve('./e2e/global-setup'),
  globalTeardown: undefined,

  // 共有設定
  use: {
    // ベースURL（統一された環境変数から取得）
    baseURL: testEnv.webUrl,

    // トレース設定（失敗時のみ）
    trace: isCI ? 'on-first-retry' : 'retain-on-failure',

    // スクリーンショット設定
    screenshot: {
      mode: 'only-on-failure',
      fullPage: false,
    },

    // ビデオ設定
    video: isCI ? 'retain-on-failure' : 'off',

    // タイムアウト設定
    actionTimeout: TEST_TIMEOUTS.action,
    navigationTimeout: TEST_TIMEOUTS.navigation,

    // ビューポート設定
    viewport: { width: 1280, height: 720 },

    // ネットワーク設定
    offline: false,

    // JavaScriptの有効化
    javaScriptEnabled: true,

    // ストレージステート（認証の永続化用）
    storageState: undefined,

    // HTTPクレデンシャル
    httpCredentials: undefined,

    // User-Agent
    userAgent: undefined,

    // カラースキーム
    colorScheme: 'light',
  },

  // プロジェクト設定（最適化済み）
  projects: [
    // メインテストプロジェクト（Chromium）
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: isCI
            ? [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security',
              ]
            : [],
        },
      },
    },

    // クロスブラウザテスト（ローカルのみ、必要時のみ実行）
    ...(!isCI
      ? [
          {
            name: 'firefox',
            use: {
              ...devices['Desktop Firefox'],
            },
            testMatch: /.*\.cross-browser\.spec\.ts$/,
          },
          {
            name: 'webkit',
            use: {
              ...devices['Desktop Safari'],
            },
            testMatch: /.*\.cross-browser\.spec\.ts$/,
          },
        ]
      : []),

    // モバイルテスト（必要時のみ）
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
      testMatch: /.*\.mobile\.spec\.ts$/,
    },

    // API認証テスト用プロジェクト
    {
      name: 'api-auth',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      testMatch: /.*\.auth\.spec\.ts$/,
      dependencies: [],
    },

    // Desktop browsers with different viewports
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
      testMatch: /^((?!mobile|tablet).)*\.spec\.ts$/,
    },
    {
      name: 'chromium-tablet',
      use: {
        ...devices['iPad Pro'],
      },
      testMatch: /.*\.tablet\.spec\.ts$/,
    },
  ],

  // 開発サーバー設定（最適化済み）
  webServer:
    process.env.REUSE_SERVER === 'true'
      ? undefined
      : [
          {
            command: 'pnpm --filter @simple-bookkeeping/api dev:test',
            port: PORTS.API,
            timeout: TEST_TIMEOUTS.server,
            reuseExistingServer: !isCI,
            stdout: isDebug ? 'pipe' : 'ignore',
            stderr: 'pipe',
            env: {
              NODE_ENV: 'test',
              PORT: String(PORTS.API),
              DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
              JWT_SECRET: 'test-jwt-secret',
              LOG_LEVEL: isDebug ? 'debug' : 'error',
              DISABLE_RATE_LIMIT: 'true',
            },
          },
          {
            command: 'pnpm --filter @simple-bookkeeping/web dev',
            port: PORTS.WEB,
            timeout: TEST_TIMEOUTS.server,
            reuseExistingServer: !isCI,
            stdout: isDebug ? 'pipe' : 'ignore',
            stderr: 'pipe',
            env: {
              NODE_ENV: 'test',
              PORT: String(PORTS.WEB),
              NEXT_PUBLIC_API_URL: `http://localhost:${PORTS.API}/api/v1`,
            },
          },
        ],
});
