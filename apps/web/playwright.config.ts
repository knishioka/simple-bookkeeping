import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Simple Bookkeeping E2E tests (最適化版)
 *
 * 改良されたConfiguration:
 * - 安定したタイムアウト設定
 * - 環境別の最適化されたワーカー設定
 * - 詳細なレポート機能
 * - 失敗時の詳細デバッグ情報
 * - ブラウザ別の設定最適化
 */
export default defineConfig({
  // テストファイルの場所
  testDir: './e2e',

  // 各テストのタイムアウト時間（安定性を重視して増加）
  timeout: process.env.CI ? 60000 : 45000, // CI環境では60秒、ローカルでは45秒

  // テスト実行前の期待値設定
  expect: {
    // アサーションのタイムアウト（Radix UI Selectに対応）
    timeout: 10000, // 10秒に増加
  },

  // テスト実行設定
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 1, // CI環境では3回、ローカルでは1回リトライ
  workers: process.env.CI ? 2 : undefined, // CI環境では2ワーカーで安定性重視

  // レポート設定（詳細化）
  reporter: [
    [
      'html',
      {
        outputFolder: 'playwright-report',
        open: process.env.CI ? 'never' : 'on-failure',
      },
    ],
    [
      'json',
      {
        outputFile: 'playwright-report/results.json',
      },
    ],
    [
      'junit',
      {
        outputFile: 'playwright-report/junit.xml',
      },
    ],
    [
      'list',
      {
        printSteps: true, // ステップ情報を表示
      },
    ],
    // CI環境では追加レポート
    ...(process.env.CI ? [['github']] : []),
  ],

  // グローバル設定
  use: {
    // ベースURL（開発サーバー）
    baseURL: 'http://localhost:3000',

    // トレース設定（詳細化）
    trace: 'retain-on-failure',

    // スクリーンショット設定
    screenshot: 'only-on-failure',

    // ビデオ設定
    video: 'retain-on-failure',

    // 安定性向上のための設定
    actionTimeout: 15000, // アクション（クリック、入力等）のタイムアウト
    navigationTimeout: 30000, // ページ遷移のタイムアウト

    // ブラウザコンテキスト設定
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',

    // Radix UI対応のための設定
    hasTouch: false, // デスクトップ環境をデフォルトに
  },

  // プロジェクト設定（最適化済み）
  projects: [
    // デスクトップブラウザ（メイン）
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        // Chromium固有の最適化
        launchOptions: {
          args: ['--disable-web-security', '--disable-features=VizDisplayCompositor'],
        },
      },
    },

    // 主要ブラウザテスト（CI環境のみ）
    ...(process.env.CI
      ? [
          {
            name: 'firefox-desktop',
            use: {
              ...devices['Desktop Firefox'],
              // Firefox固有の設定
              launchOptions: {
                firefoxUserPrefs: {
                  'ui.systemUsesDarkTheme': 0, // ライトテーマ固定
                },
              },
            },
          },

          {
            name: 'webkit-desktop',
            use: {
              ...devices['Desktop Safari'],
              // Safari固有の設定
            },
          },
        ]
      : []),

    // モバイルテスト（重要なテストのみ）
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        // モバイル固有の設定
        hasTouch: true,
      },
      testMatch: /.*mobile.*\.spec\.ts/, // モバイル専用テストのみ実行
    },

    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
        hasTouch: true,
      },
      testMatch: /.*mobile.*\.spec\.ts/,
    },

    // パフォーマンステスト専用プロジェクト
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        // パフォーマンス測定用の設定
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      },
      testMatch: /.*performance.*\.spec\.ts/,
      timeout: 120000, // パフォーマンステストは2分
    },

    // ストーリーテスト専用プロジェクト
    {
      name: 'user-stories',
      use: {
        ...devices['Desktop Chrome'],
        // ストーリーテスト用の設定
        actionTimeout: 20000, // ユーザー操作により長い時間を許可
      },
      testMatch: /.*user-stories.*\.spec\.ts/,
      timeout: 90000, // ストーリーテストは90秒
    },
  ],

  // 開発サーバー設定（安定性向上）
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180000, // 3分に延長（依存関係のビルド時間を考慮）

    // サーバー起動の安定性向上
    env: {
      NODE_ENV: 'test',
    },

    // ヘルスチェック
    retries: 3,

    // ログ出力（デバッグ用）
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // グローバルセットアップ（必要に応じて）
  globalSetup: process.env.CI ? undefined : undefined, // 将来の拡張用

  // グローバル片付け
  globalTeardown: process.env.CI ? undefined : undefined, // 将来の拡張用

  // テストマッチパターン（最適化）
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],

  // 無視するファイル
  testIgnore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],

  // 並列実行の制御
  maxFailures: process.env.CI ? 10 : 5, // CI環境では10個、ローカルでは5個の失敗で停止

  // メタデータ
  metadata: {
    project: 'Simple Bookkeeping E2E Tests',
    version: '1.0.0',
    environment: process.env.CI ? 'CI' : 'local',
  },
});
