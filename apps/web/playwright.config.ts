import { defineConfig, devices } from '@playwright/test';

/**
 * Optimized Playwright configuration for E2E tests
 * Issue #95対応: E2Eテストインフラの改善と安定化
 */

// 環境変数の読み込み
const isCI = !!process.env.CI;
const isDebug = !!process.env.DEBUG;

// タイムアウト設定（最適化済み）
const TIMEOUTS = {
  test: isCI ? 30000 : 20000, // テスト全体のタイムアウトを短縮
  expect: 5000, // アサーションタイムアウトを短縮
  action: 10000, // アクションタイムアウト
  navigation: 15000, // ナビゲーションタイムアウト
  server: 60000, // サーバー起動タイムアウト
};

// リトライ設定
const RETRIES = {
  ci: 2, // CI環境では2回（3回から削減）
  local: 0, // ローカルではリトライなし（1回から削減）
};

// ワーカー設定
const WORKERS = {
  ci: 4, // CI環境では4ワーカー（2から増加）
  local: '75%', // ローカルではCPUコアの75%を使用
};

export default defineConfig({
  // テストディレクトリ
  testDir: './e2e',

  // 並列実行の最適化
  fullyParallel: true,
  forbidOnly: isCI,

  // タイムアウト設定
  timeout: TIMEOUTS.test,

  // 期待値設定
  expect: {
    timeout: TIMEOUTS.expect,
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
    },
  },

  // リトライ設定
  retries: isCI ? RETRIES.ci : RETRIES.local,

  // ワーカー設定
  workers: isCI ? WORKERS.ci : WORKERS.local,

  // レポート設定（シンプル化）
  reporter: isCI
    ? [
        ['github'],
        ['json', { outputFile: 'test-results.json' }],
        ['junit', { outputFile: 'junit.xml' }],
      ]
    : [['list'], ['html', { open: 'on-failure' }]],

  // グローバル設定
  use: {
    // ベースURL
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    // トレース設定（最適化）
    trace: isCI ? 'on-first-retry' : 'retain-on-failure',

    // スクリーンショット設定
    screenshot: {
      mode: 'only-on-failure',
      fullPage: false, // フルページは不要
    },

    // ビデオ設定（最適化）
    video: isCI ? 'on-first-retry' : 'off', // ローカルではビデオ無効

    // タイムアウト設定
    actionTimeout: TIMEOUTS.action,
    navigationTimeout: TIMEOUTS.navigation,

    // ロケール設定
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',

    // ビューポート設定
    viewport: { width: 1280, height: 720 },

    // 権限設定
    permissions: [],

    // オフライン設定
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

    // モバイルテスト（特定のテストのみ）
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 5'],
      },
      testMatch: /.*\.mobile\.spec\.ts$/,
    },

    // 認証テスト専用（高速化のため分離）
    {
      name: 'auth',
      use: {
        ...devices['Desktop Chrome'],
        // 認証テスト用の特別な設定
        storageState: undefined, // 認証状態を持たない
      },
      testMatch: /.*auth.*\.spec\.ts$/,
    },

    // 統合テスト（モック無効）
    {
      name: 'integration',
      use: {
        ...devices['Desktop Chrome'],
        // 実際のAPIを使用
      },
      testMatch: /.*\.integration\.spec\.ts$/,
      timeout: TIMEOUTS.test * 2, // 統合テストは長めのタイムアウト
    },
  ],

  // 開発サーバー設定（最適化）
  webServer: {
    command: isCI
      ? 'pnpm --filter @simple-bookkeeping/web start' // CI環境ではビルド済みアプリを起動
      : 'pnpm dev:test', // ローカルでは開発サーバー
    url: 'http://localhost:3000',
    reuseExistingServer: !isCI, // CI環境では新規起動、ローカルでは再利用
    timeout: TIMEOUTS.server,
    stdout: isDebug ? 'pipe' : 'ignore',
    stderr: 'pipe',
  },

  // グローバルセットアップ
  globalSetup: './e2e/global-setup.ts',

  // グローバルティアダウン
  globalTeardown: './e2e/global-teardown.ts',

  // テストマッチパターン
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],

  // 無視パターン
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/*.skip.spec.ts',
  ],

  // エラー時の挙動
  preserveOutput: 'failures-only',
  updateSnapshots: isCI ? 'none' : 'missing',

  // 最大失敗数
  maxFailures: isCI ? 5 : 0, // CI環境では5個で停止、ローカルでは全て実行

  // 出力ディレクトリ
  outputDir: 'test-results',

  // スナップショットディレクトリ
  snapshotDir: './e2e/snapshots',
  snapshotPathTemplate:
    '{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-projectName}{-snapshotSuffix}{ext}',

  // カスタムメタデータ
  metadata: {
    project: 'Simple Bookkeeping',
    environment: isCI ? 'ci' : 'local',
    timestamp: new Date().toISOString(),
  },
});

/**
 * カスタムテストヘルパーの設定
 */
export const testConfig = {
  // モック設定
  mock: {
    enabled: !isCI, // ローカルではモック有効
    delay: 0, // モックレスポンスの遅延なし
    errorRate: 0, // エラーレートなし
  },

  // 認証設定
  auth: {
    defaultRole: 'admin' as const,
    useUnifiedHelper: true,
  },

  // デバッグ設定
  debug: {
    slowMo: isDebug ? 500 : 0,
    headless: isCI ? true : !isDebug,
    devtools: isDebug,
  },

  // パフォーマンス設定
  performance: {
    collectMetrics: false,
    tracingEnabled: false,
  },
};

/**
 * テスト環境別の設定
 */
export const environments = {
  local: {
    baseURL: 'http://localhost:3000',
    apiURL: 'http://localhost:3001',
  },
  ci: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    apiURL: process.env.API_URL || 'http://localhost:3001',
  },
  staging: {
    baseURL: process.env.STAGING_URL || 'https://staging.example.com',
    apiURL: process.env.STAGING_API_URL || 'https://api-staging.example.com',
  },
};
