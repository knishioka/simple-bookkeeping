/**
 * Playwright グローバルセットアップ (簡易版)
 * Issue #466対応: Storage State機能を一時的に無効化してCI通過を優先
 *
 * Note: Storage State機能は複雑な競合状態を引き起こすため、
 * 一時的に無効化し、各テストで独立してログインする方式に戻す
 */

import { FullConfig } from '@playwright/test';

import { validateTestEnvironment, ENV_KEYS, HEALTH_CHECK } from '../playwright/config';

/**
 * グローバルセットアップ関数
 * 全テスト実行前に一度だけ実行される
 */
async function globalSetup(_config: FullConfig) {
  const shardInfo = getShardInfo();
  console.warn(
    `🚀 Starting E2E test global setup (simplified)... [Shard ${shardInfo.current}/${shardInfo.total}]`
  );

  const startTime = Date.now();

  try {
    // 環境変数の検証
    validateEnvironment();

    // ヘルスチェック（すべてのシャードで実行）
    await performHealthCheck();

    const duration = Date.now() - startTime;
    console.warn(`✅ Global setup completed in ${duration}ms [Shard ${shardInfo.current}]`);
  } catch (error) {
    console.error(`❌ Global setup failed [Shard ${shardInfo.current}]:`, error);
    throw error;
  }
}

/**
 * シャード情報を取得
 */
function getShardInfo() {
  const currentShard = process.env.TEST_PARALLEL_INDEX || '0';
  const totalShards = process.env.TEST_PARALLEL_TOTAL || '1';
  const isFirst = currentShard === '0';
  const isSharded = totalShards !== '1';

  return {
    current: currentShard,
    total: totalShards,
    isFirst,
    isSharded,
  };
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
 * ヘルスチェック
 * アプリケーションが起動していることを確認
 */
async function performHealthCheck() {
  const shardInfo = getShardInfo();
  console.warn(`🏥 [Shard ${shardInfo.current}] Performing health check...`);

  // Import unified test environment configuration
  const { getTestEnvironment } = await import('@simple-bookkeeping/config');

  // Use unified test environment
  const testEnv = getTestEnvironment();
  const webUrl = testEnv.webUrl;

  // Build health check URLs based on environment
  const urls = [{ url: webUrl, name: 'Web' }];

  console.warn(`ℹ️ [Shard ${shardInfo.current}] Checking Next.js web server health`);

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
          console.warn(`✅ [Shard ${shardInfo.current}] ${name} service at ${url} is healthy`);
          isHealthy = true;
        } else if (response.status === 404 && name === 'Web') {
          // For web service, 404 might be acceptable during startup
          console.warn(
            `✅ [Shard ${shardInfo.current}] ${name} service at ${url} is responding (404)`
          );
          isHealthy = true;
        } else {
          console.warn(
            `⚠️ [Shard ${shardInfo.current}] ${name} service at ${url} returned status ${response.status}`
          );
        }
      } catch (error) {
        if (attempts < maxRetries) {
          console.warn(
            `⚠️ [Shard ${shardInfo.current}] Could not reach ${name} service at ${url}, retrying in ${retryDelay}ms... (${attempts}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        } else {
          console.warn(
            `⚠️ [Shard ${shardInfo.current}] Could not reach ${name} service at ${url} after ${maxRetries} attempts:`,
            error
          );
        }
      }
    }
  }
}

export default globalSetup;
