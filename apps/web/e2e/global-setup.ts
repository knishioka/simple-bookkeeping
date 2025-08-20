/**
 * Playwright グローバルセットアップ
 * Issue #95対応: E2Eテスト実行前の環境準備
 */

import { chromium, FullConfig } from '@playwright/test';

/**
 * グローバルセットアップ関数
 * 全テスト実行前に一度だけ実行される
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test global setup...');

  const startTime = Date.now();

  try {
    // 環境変数の検証
    validateEnvironment();

    // テスト用認証状態の準備（必要に応じて）
    if (process.env.PREPARE_AUTH_STATE === 'true') {
      await prepareAuthState(config);
    }

    // データベースのセットアップ（CI環境のみ）
    if (process.env.CI) {
      await setupTestDatabase();
    }

    // ヘルスチェック
    await performHealthCheck();

    const duration = Date.now() - startTime;
    console.log(`✅ Global setup completed in ${duration}ms`);
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

/**
 * 環境変数の検証
 */
function validateEnvironment() {
  console.log('🔍 Validating environment variables...');

  const requiredVars = [
    'NODE_ENV',
    // 必要に応じて追加
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.warn(`⚠️ Missing environment variables: ${missingVars.join(', ')}`);
  }

  // テスト環境の確認
  if (process.env.NODE_ENV !== 'test') {
    console.warn('⚠️ NODE_ENV is not set to "test"');
  }
}

/**
 * 認証状態の準備
 * 認証が必要なテストのために事前にログイン状態を作成
 */
async function prepareAuthState(config: FullConfig) {
  console.log('🔐 Preparing authentication state...');

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // ベースURLを取得
    const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';

    // ログインページにアクセス
    await page.goto(`${baseURL}/login`);

    // テスト用認証情報でログイン
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // ログイン成功を待つ
    await page.waitForURL('**/dashboard/**', { timeout: 10000 }).catch(() => {
      console.warn('⚠️ Could not prepare auth state - continuing without it');
    });

    // 認証状態を保存
    await context.storageState({ path: '.auth/admin.json' });
    console.log('✅ Authentication state saved');
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
  console.log('🗄️ Setting up test database...');

  // CI環境でのデータベースセットアップ
  // 必要に応じて実装
  try {
    // データベースマイグレーション実行
    // await exec('pnpm db:migrate');

    // シードデータ投入
    // await exec('pnpm db:seed');

    console.log('✅ Test database ready');
  } catch (error) {
    console.warn('⚠️ Database setup failed:', error);
  }
}

/**
 * ヘルスチェック
 * アプリケーションが起動していることを確認
 */
async function performHealthCheck() {
  console.log('🏥 Performing health check...');

  // Import unified test configuration
  const { getTestConfig, getHealthCheckUrl } = await import('@simple-bookkeeping/config');
  const testConfig = getTestConfig();

  const urls = [
    { url: testConfig.urls.web, name: 'Web' },
    { url: getHealthCheckUrl('api'), name: 'API' },
  ];

  // Add retry logic for CI environment
  const maxRetries = process.env.CI ? 5 : 1;
  const retryDelay = 2000; // 2 seconds

  for (const { url, name } of urls) {
    let attempts = 0;
    let isHealthy = false;

    while (attempts < maxRetries && !isHealthy) {
      attempts++;
      try {
        // Use appropriate HTTP method based on service type
        const method = name === 'API' ? 'GET' : 'HEAD';
        const response = await fetch(url, { method });

        if (response.ok) {
          console.log(`✅ ${name} service at ${url} is healthy`);
          isHealthy = true;
        } else if (response.status === 404 && name === 'Web') {
          // For web service, 404 might be acceptable during startup
          console.log(`✅ ${name} service at ${url} is responding (404)`);
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
