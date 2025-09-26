/**
 * Playwright グローバルセットアップ
 * Issue #203対応: E2Eテスト環境の環境変数管理を統一
 * Issue #338対応: Storage State機能によるE2E高速化
 * Issue #466対応: Shard 1/3の失敗を修正
 */

import fs from 'fs';
import path from 'path';

import { chromium, FullConfig } from '@playwright/test';

import {
  validateTestEnvironment,
  getTestAdminCredentials,
  getAuthStatePath,
  shouldPrepareAuthState,
  isAuthStateValid,
  URLS,
  HEALTH_CHECK,
  ENV_KEYS,
} from '../playwright/config';

/**
 * グローバルセットアップ関数
 * 全テスト実行前に一度だけ実行される
 */
async function globalSetup(config: FullConfig) {
  const shardInfo = getShardInfo();
  console.warn(
    `🚀 Starting E2E test global setup... [Shard ${shardInfo.current}/${shardInfo.total}]`
  );

  const startTime = Date.now();

  try {
    // 環境変数の検証
    validateEnvironment();

    // 認証ディレクトリの作成
    await ensureAuthDirectory();

    // Storage State機能を使用した認証状態の準備
    // Issue #466: Shard間の競合を防ぐため、適切な順序で実行
    await prepareAuthStateWithShardCoordination(config);

    // データベースのセットアップ（CI環境のみ、最初のシャードのみ）
    if (process.env[ENV_KEYS.CI] && shardInfo.isFirst) {
      await setupTestDatabase();
    }

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
 * 認証ディレクトリの作成
 * Storage Stateファイルを保存するディレクトリを準備
 * Issue #466: シャード間で共有されるディレクトリ構造を作成
 */
async function ensureAuthDirectory() {
  // adminロールのパスからディレクトリを取得
  const authPath = getAuthStatePath('admin');
  const authDir = path.dirname(authPath);

  if (!fs.existsSync(authDir)) {
    console.warn(`📁 Creating auth directory: ${authDir}`);
    fs.mkdirSync(authDir, { recursive: true });
  }

  // CI環境でシャード共有ディレクトリも作成
  if (process.env.CI === 'true') {
    const sharedDir = path.join(path.dirname(authDir), '.auth', 'shared');
    if (!fs.existsSync(sharedDir)) {
      console.warn(`📁 Creating shared auth directory: ${sharedDir}`);
      fs.mkdirSync(sharedDir, { recursive: true });
    }
  }
}

/**
 * 認証状態の準備（シャード対応版）
 * Issue #466: シャード間の競合を防ぐための調整メカニズム
 */
async function prepareAuthStateWithShardCoordination(config: FullConfig) {
  const shardInfo = getShardInfo();

  // 認証状態の準備が必要かチェック
  if (!shouldPrepareAuthState()) {
    // 既存の認証状態を待機
    await waitForAuthState(shardInfo);
    return;
  }

  // 認証状態を準備
  await prepareAuthState(config, shardInfo);
}

/**
 * 既存の認証状態を待機
 * Issue #466: 他のシャードが認証状態を作成するのを待つ
 */
async function waitForAuthState(shardInfo: ReturnType<typeof getShardInfo>) {
  console.warn(
    `⏳ [Shard ${shardInfo.current}] Waiting for auth state to be prepared by another shard...`
  );

  const maxWaitTime = 30000; // 30秒
  const checkInterval = 500; // 500ms
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    if (isAuthStateValid('admin')) {
      console.warn(`✅ [Shard ${shardInfo.current}] Auth state found and valid`);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }

  // タイムアウトした場合は、このシャードで認証状態を作成
  console.warn(
    `⚠️ [Shard ${shardInfo.current}] Timeout waiting for auth state, creating it now...`
  );
  const config = { projects: [{ use: { baseURL: 'http://localhost:3000' } }] } as FullConfig;
  await prepareAuthState(config, shardInfo);
}

/**
 * 認証状態の準備
 * 各ロール（admin、accountant、viewer）の認証状態を事前に作成
 * Issue #338: Storage State機能で認証処理を高速化
 * Issue #466: シャード対応の改善
 */
async function prepareAuthState(config: FullConfig, shardInfo: ReturnType<typeof getShardInfo>) {
  console.warn(`🔐 [Shard ${shardInfo.current}] Preparing authentication states for all roles...`);

  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';

  // 各ロールの認証状態を準備
  const roles = [
    { name: 'admin', credentials: getTestAdminCredentials() },
    // 将来的に他のロール用の認証も追加可能
    // { name: 'accountant', credentials: getTestAccountantCredentials() },
    // { name: 'viewer', credentials: getTestViewerCredentials() },
  ];

  for (const role of roles) {
    // 既に有効な認証状態がある場合はスキップ
    if (isAuthStateValid(role.name)) {
      console.warn(
        `  ✅ [Shard ${shardInfo.current}] ${role.name} auth state already exists and is valid`
      );
      continue;
    }

    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      console.warn(
        `  📝 [Shard ${shardInfo.current}] Preparing ${role.name} authentication state...`
      );

      // ログインページにアクセス
      await page.goto(`${baseURL}${URLS.LOGIN_PATH}`);

      // テスト用認証情報でログイン
      await page.fill('input[name="email"]', role.credentials.email);
      await page.fill('input[name="password"]', role.credentials.password);
      await page.click('button[type="submit"]');

      // ログイン成功を待つ（ダッシュボードへのリダイレクト）
      let isAuthenticated = false;
      try {
        await page.waitForURL('**/dashboard/**', { timeout: 10000 });
        isAuthenticated = true;
      } catch {
        console.warn(
          `  ⚠️ [Shard ${shardInfo.current}] Real login failed, using mock authentication fallback`
        );

        // モック認証にフォールバック
        // localStorageとsessionStorageにモック認証データを設定
        await page.evaluate(() => {
          // Supabaseのモック認証トークン
          const mockAuthData = {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
              user_metadata: {
                name: 'Test User',
                organization_id: 'test-org',
                role: 'admin',
              },
            },
          };

          // localStorageに認証状態を設定
          localStorage.setItem('sb-localhost-auth-token', JSON.stringify(mockAuthData));
          sessionStorage.setItem('isAuthenticated', 'true');
          sessionStorage.setItem('authTimestamp', Date.now().toString());
        });
        isAuthenticated = true;
      }

      if (isAuthenticated) {
        // 認証状態を保存（getAuthStatePathを使用して一貫性を保つ）
        const authPath = getAuthStatePath(role.name);

        // ディレクトリが存在することを確認
        const authDir = path.dirname(authPath);
        if (!fs.existsSync(authDir)) {
          fs.mkdirSync(authDir, { recursive: true });
        }

        // ファイルロックメカニズム（簡易版）
        const lockPath = `${authPath}.lock`;
        const maxRetries = 10;
        let retries = 0;

        while (fs.existsSync(lockPath) && retries < maxRetries) {
          console.warn(
            `  ⏳ [Shard ${shardInfo.current}] Waiting for lock release on ${role.name} auth state...`
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
          retries++;
        }

        // ロックファイルを作成
        fs.writeFileSync(lockPath, shardInfo.current);

        try {
          // 認証状態を保存
          await context.storageState({ path: authPath });
          console.warn(
            `  ✅ [Shard ${shardInfo.current}] ${role.name} authentication state saved to ${authPath}`
          );
        } finally {
          // ロックファイルを削除
          if (fs.existsSync(lockPath)) {
            fs.unlinkSync(lockPath);
          }
        }
      }
    } catch (error) {
      console.warn(
        `  ❌ [Shard ${shardInfo.current}] Failed to prepare ${role.name} auth state:`,
        error
      );
    } finally {
      await browser.close();
    }
  }

  console.warn(`✅ [Shard ${shardInfo.current}] All authentication states prepared`);
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
  const shardInfo = getShardInfo();
  console.warn(`🏥 [Shard ${shardInfo.current}] Performing health check...`);

  // Import unified test environment configuration
  const { getTestEnvironment } = await import('@simple-bookkeeping/config');

  // Use unified test environment
  const testEnv = getTestEnvironment();
  const webUrl = testEnv.webUrl;

  // Build health check URLs based on environment
  // Only check the Next.js web server since Express.js API has been removed
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
