/**
 * Simplified Global Setup for E2E Tests
 * Issue #520: Stabilize E2E authentication for Playwright sharding compatibility
 *
 * Strategy:
 * - Single-step mock authentication
 * - Storage State for session sharing
 * - No file locks or complex coordination
 * - Shard-safe implementation
 */

import * as fs from 'fs';
import * as path from 'path';

import { chromium, FullConfig } from '@playwright/test';

const AUTH_STATE_PATH = path.join(__dirname, '.auth', 'authenticated.json');

/**
 * グローバルセットアップ関数
 * 全テスト実行前に一度だけ実行される
 */
async function globalSetupSimple(config: FullConfig) {
  console.log('🚀 Starting simplified E2E test global setup...');
  const startTime = Date.now();

  try {
    // 認証ディレクトリの作成
    const authDir = path.dirname(AUTH_STATE_PATH);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    // Storage Stateが既に存在し、有効な場合はスキップ
    if (await isStorageStateValid()) {
      console.log('✅ Valid Storage State found, skipping authentication setup');
      const duration = Date.now() - startTime;
      console.log(`✅ Global setup completed in ${duration}ms`);
      return;
    }

    // シンプルなモック認証でStorage Stateを作成
    await createStorageState(config);

    const duration = Date.now() - startTime;
    console.log(`✅ Global setup completed in ${duration}ms`);
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

/**
 * Storage Stateの有効性チェック（Shard対応）
 * 他のShardがStorage Stateを作成中の場合は待機する
 */
async function isStorageStateValid(): Promise<boolean> {
  const MAX_WAIT_TIME = 30000; // 30秒
  const CHECK_INTERVAL = 500; // 500ms
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_WAIT_TIME) {
    try {
      if (!fs.existsSync(AUTH_STATE_PATH)) {
        // ファイルが存在しない場合、少し待機して再チェック
        // 他のShardが作成中の可能性がある
        await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL));
        continue;
      }

      const content = fs.readFileSync(AUTH_STATE_PATH, 'utf-8');
      const data = JSON.parse(content);

      // 必須フィールドの確認
      if (!data.cookies || !Array.isArray(data.cookies)) {
        console.warn('⚠️ Storage State is invalid (missing cookies), waiting...');
        await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL));
        continue;
      }

      if (!data.origins || !Array.isArray(data.origins)) {
        console.warn('⚠️ Storage State is invalid (missing origins), waiting...');
        await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL));
        continue;
      }

      // ファイルの新鮮性チェック（1時間以内）
      const stats = fs.statSync(AUTH_STATE_PATH);
      const age = Date.now() - stats.mtimeMs;
      if (age > 3600000) {
        console.log('⚠️ Storage State is stale (>1 hour old), recreating...');
        return false;
      }

      console.log('✅ Valid Storage State found');
      return true;
    } catch (error) {
      // JSONパースエラーなど - ファイルが作成中の可能性
      console.warn('⚠️ Storage State validation failed, retrying...:', error);
      await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL));
    }
  }

  // タイムアウト: ファイルが見つからないか無効
  console.warn(`⚠️ Storage State validation timeout after ${MAX_WAIT_TIME}ms`);
  return false;
}

/**
 * Storage Stateを作成
 */
async function createStorageState(config: FullConfig) {
  console.log('🔐 Creating Storage State with mock authentication...');

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';

    // ホームページに移動
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });

    // モック認証データを設定
    await page.evaluate(() => {
      const mockAuthData = {
        currentSession: {
          access_token: `mock-access-token-${Date.now()}`,
          refresh_token: `mock-refresh-token-${Date.now()}`,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'test-user-id',
            email: 'admin.e2e@test.localhost',
            user_metadata: {
              name: 'E2E Test Admin',
              organization_id: 'test-org-e2e-001',
              role: 'admin',
              permissions: ['*'],
            },
          },
        },
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };

      // Supabase認証トークン（モック）
      localStorage.setItem('sb-placeholder-auth-token', JSON.stringify(mockAuthData));
      // 後方互換性のため
      localStorage.setItem('supabase.auth.token', JSON.stringify(mockAuthData));
      // モック認証フラグ
      localStorage.setItem('mockAuth', 'true');
      // 組織ID
      localStorage.setItem('selectedOrganizationId', 'test-org-e2e-001');

      // セッションストレージ
      sessionStorage.setItem('isAuthenticated', 'true');
      sessionStorage.setItem('authRole', 'admin');
      sessionStorage.setItem('authTimestamp', Date.now().toString());
    });

    // クッキーも設定（ミドルウェア検出用）
    await context.addCookies([
      {
        name: 'mockAuth',
        value: 'true',
        url: baseURL,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
      },
    ]);

    // Storage Stateを保存
    await context.storageState({ path: AUTH_STATE_PATH });
    console.log('✅ Storage State saved to:', AUTH_STATE_PATH);
  } finally {
    await browser.close();
  }
}

export default globalSetupSimple;
