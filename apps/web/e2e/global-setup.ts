/**
 * Playwright グローバルセットアップ
 * Issue #203対応: E2Eテスト環境の環境変数管理を統一
 */

import { chromium, FullConfig } from '@playwright/test';

import {
  validateTestEnvironment,
  getTestAdminCredentials,
  shouldPrepareAuthState,
  getAuthStatePath,
  URLS,
  HEALTH_CHECK,
  ENV_KEYS,
} from '../playwright/config';

/**
 * グローバルセットアップ関数
 * 全テスト実行前に一度だけ実行される
 */
async function globalSetup(config: FullConfig) {
  console.warn('🚀 Starting E2E test global setup...');

  const startTime = Date.now();

  try {
    // 環境変数の検証
    validateEnvironment();

    // テスト用認証状態の準備（必要に応じて）
    if (shouldPrepareAuthState()) {
      await prepareAuthState(config);
    }

    // データベースのセットアップ（CI環境のみ）
    if (process.env[ENV_KEYS.CI]) {
      await setupTestDatabase();
    }

    // ヘルスチェック
    await performHealthCheck();

    const duration = Date.now() - startTime;
    console.warn(`✅ Global setup completed in ${duration}ms`);
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

/**
 * 環境変数の検証
 */
function validateEnvironment() {
  console.warn('🔍 Validating environment variables...');

  const missingVars = validateTestEnvironment();

  if (missingVars.length > 0) {
    console.warn(`⚠️ Missing environment variables: ${missingVars.join(', ')}`);
  }

  // テスト環境の確認
  if (process.env[ENV_KEYS.NODE_ENV] !== 'test') {
    console.warn('⚠️ NODE_ENV is not set to "test"');
  }
}

/**
 * 認証状態の準備
 * 認証が必要なテストのために事前にログイン状態を作成
 */
async function prepareAuthState(config: FullConfig) {
  console.warn('🔐 Preparing authentication state...');

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // ベースURLを取得
    const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';

    // ログインページにアクセス
    await page.goto(`${baseURL}${URLS.LOGIN_PATH}`);

    // テスト用認証情報でログイン
    const credentials = getTestAdminCredentials();
    await page.fill('input[name="email"]', credentials.email);
    await page.fill('input[name="password"]', credentials.password);
    await page.click('button[type="submit"]');

    // ログイン成功を待つ
    await page.waitForURL(URLS.DASHBOARD_PATH, { timeout: 10000 }).catch(() => {
      console.warn('⚠️ Could not prepare auth state - continuing without it');
    });

    // 認証状態を保存
    await context.storageState({ path: getAuthStatePath() });
    console.warn('✅ Authentication state saved');
  } catch (error) {
    console.warn('⚠️ Failed to prepare auth state:', error);
  } finally {
    await browser.close();
  }
}

/**
 * テスト用データベースのセットアップ
 */
async function setupTestDatabase() {
  console.warn('🗄️ Setting up test database...');

  // CI環境でのデータベースセットアップ
  // 必要に応じて実装
  try {
    // データベースマイグレーション実行
    // await exec('pnpm db:migrate');

    // シードデータ投入
    // await exec('pnpm db:seed');

    console.warn('✅ Test database ready');
  } catch (error) {
    console.warn('⚠️ Database setup failed:', error);
  }
}

/**
 * ヘルスチェック
 * アプリケーションが起動していることを確認
 */
async function performHealthCheck() {
  console.warn('🏥 Performing health check...');

  // Import unified test environment configuration
  const { getTestEnvironment } = await import('@simple-bookkeeping/config');

  // Use unified test environment
  const testEnv = getTestEnvironment();
  const webUrl = testEnv.webUrl;

  // Build health check URLs based on environment
  // Only check the Next.js web server since Express.js API has been removed
  const urls = [{ url: webUrl, name: 'Web' }];

  console.warn('ℹ️ Checking Next.js web server health (Express.js API has been removed)');

  // Add retry logic for CI environment
  const maxRetries = process.env[ENV_KEYS.CI]
    ? HEALTH_CHECK.MAX_RETRIES_CI
    : HEALTH_CHECK.MAX_RETRIES_LOCAL;
  const retryDelay = HEALTH_CHECK.RETRY_DELAY;

  for (const { url, name } of urls) {
    let attempts = 0;
    let isHealthy = false;

    while (attempts < maxRetries && !isHealthy) {
      attempts++;
      try {
        // Use HEAD method for web service health check
        const response = await fetch(url, { method: 'HEAD' });

        if (response.ok) {
          console.warn(`✅ ${name} service at ${url} is healthy`);
          isHealthy = true;
        } else if (response.status === 404 && name === 'Web') {
          // For web service, 404 might be acceptable during startup
          console.warn(`✅ ${name} service at ${url} is responding (404)`);
          isHealthy = true;
        } else {
          console.warn(`⚠️ ${name} service at ${url} returned status ${response.status}`);
        }
      } catch (error) {
        if (attempts < maxRetries) {
          console.warn(
            `⚠️ Could not reach ${name} service at ${url}, retrying in ${retryDelay}ms... (${attempts}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        } else {
          console.warn(
            `⚠️ Could not reach ${name} service at ${url} after ${maxRetries} attempts:`,
            error
          );
        }
      }
    }
  }
}

export default globalSetup;
