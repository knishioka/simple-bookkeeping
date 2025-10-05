/**
 * Supabase認証ヘルパー
 * Issue #353対応: Server Actions移行に伴うSupabase認証のE2Eテストサポート
 *
 * 実際のSupabase認証を使用したE2Eテストをサポートします。
 * テスト専用のSupabaseプロジェクトと実際の認証フローを使用します。
 */

import { Page, BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * ユーザーロール定義
 */
export type UserRole = 'admin' | 'accountant' | 'viewer';

/**
 * Supabaseユーザー情報
 */
export interface SupabaseUser {
  id: string;
  email: string;
  user_metadata: {
    name: string;
    organization_id: string;
    role: UserRole;
    permissions?: string[];
  };
}

/**
 * Supabaseセッション情報
 */
export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: SupabaseUser;
}

/**
 * 認証オプション
 */
export interface SupabaseAuthOptions {
  role?: UserRole;
  organizationId?: string;
  customUser?: Partial<SupabaseUser>;
  skipCookies?: boolean;
}

/**
 * テスト環境のSupabaseクライアント（Service Role Key使用）
 * 注意: このクライアントはテスト環境でのみ使用し、本番環境では絶対に使用しないでください。
 */
let supabaseAdmin: ReturnType<typeof createClient> | null = null;

/**
 * テスト環境モードの判定
 */
function getTestMode(): 'docker' | 'cloud' | 'mock' {
  // Check if we're using placeholder/mock values
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (url.includes('placeholder') || !serviceKey) {
    return 'mock';
  }

  return (process.env.E2E_TEST_MODE as 'docker' | 'cloud') || 'docker';
}

/**
 * Supabase Admin クライアントの取得（シングルトン）
 */
function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      const mode = getTestMode();
      if (mode === 'docker') {
        // Docker環境のデフォルト値を使用
        const dockerUrl = 'http://localhost:8000';
        const dockerServiceKey =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
        console.log('Using Docker Supabase environment (local)');
        supabaseAdmin = createClient(dockerUrl, dockerServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });
      } else {
        throw new Error(
          'Missing Supabase test environment variables. Please set up .env.test.local or use Docker environment'
        );
      }
    } else {
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  }
  return supabaseAdmin;
}

/**
 * プリセットユーザー定義（実際のSupabaseで作成）
 */
export const SUPABASE_TEST_USERS: Record<
  UserRole,
  {
    email: string;
    password: string;
    metadata: SupabaseUser['user_metadata'];
  }
> = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin.e2e@test.example.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'AdminE2E123!@#',
    metadata: {
      name: process.env.TEST_ADMIN_NAME || 'E2E Test Admin',
      organization_id: process.env.TEST_ORGANIZATION_ID || 'test-org-e2e-001',
      role: 'admin',
      permissions: ['*'],
    },
  },
  accountant: {
    email: process.env.TEST_ACCOUNTANT_EMAIL || 'accountant.e2e@test.example.com',
    password: process.env.TEST_ACCOUNTANT_PASSWORD || 'AccountantE2E123!@#',
    metadata: {
      name: process.env.TEST_ACCOUNTANT_NAME || 'E2E Test Accountant',
      organization_id: process.env.TEST_ORGANIZATION_ID || 'test-org-e2e-001',
      role: 'accountant',
      permissions: ['accounts:read', 'accounts:write', 'journal:read', 'journal:write'],
    },
  },
  viewer: {
    email: process.env.TEST_VIEWER_EMAIL || 'viewer.e2e@test.example.com',
    password: process.env.TEST_VIEWER_PASSWORD || 'ViewerE2E123!@#',
    metadata: {
      name: process.env.TEST_VIEWER_NAME || 'E2E Test Viewer',
      organization_id: process.env.TEST_ORGANIZATION_ID || 'test-org-e2e-001',
      role: 'viewer',
      permissions: ['accounts:read', 'journal:read'],
    },
  },
};

/**
 * Supabase認証ヘルパークラス
 */
export class SupabaseAuth {
  /**
   * テストユーザーを作成または取得
   */
  private static async ensureTestUser(role: UserRole): Promise<SupabaseUser> {
    const mode = getTestMode();
    const testUser = SUPABASE_TEST_USERS[role];

    // モックモードの場合は、モックユーザーを返す
    if (mode === 'mock') {
      return {
        id: `mock-${role}-${Date.now()}`,
        email: testUser.email,
        user_metadata: testUser.metadata,
      };
    }

    const admin = getSupabaseAdmin();

    try {
      // 既存ユーザーを削除（クリーンな状態を保証）
      const { data: existingUsers } = await admin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u) => u.email === testUser.email);

      if (existingUser) {
        await admin.auth.admin.deleteUser(existingUser.id);
      }

      // 新しいテストユーザーを作成
      const { data, error } = await admin.auth.admin.createUser({
        email: testUser.email,
        password: testUser.password,
        email_confirm: true, // E2Eテストのため、メール確認をスキップ
        user_metadata: testUser.metadata,
      });

      if (error) {
        throw new Error(`Failed to create test user: ${error.message}`);
      }

      if (!data?.user) {
        throw new Error('User creation succeeded but no user data returned');
      }

      return {
        id: data.user.id,
        email: data.user.email || '',
        user_metadata: testUser.metadata,
      };
    } catch (error) {
      console.error(`Failed to ensure test user for role ${role}:`, error);
      throw error;
    }
  }

  /**
   * 実際のSupabase認証を使用してログイン
   */
  private static async authenticateUser(role: UserRole): Promise<SupabaseSession> {
    const mode = getTestMode();
    const testUser = SUPABASE_TEST_USERS[role];

    // モックモードの場合は、モックセッションを返す
    if (mode === 'mock') {
      return {
        access_token: `mock-access-token-${role}-${Date.now()}`,
        refresh_token: `mock-refresh-token-${role}-${Date.now()}`,
        expires_at: Date.now() / 1000 + 3600,
        user: {
          id: `mock-${role}-${Date.now()}`,
          email: testUser.email,
          user_metadata: testUser.metadata,
        },
      };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    // 通常のクライアントを使用してログイン
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password,
    });

    if (error) {
      throw new Error(`Failed to authenticate test user: ${error.message}`);
    }

    if (!data?.session) {
      throw new Error('Authentication succeeded but no session returned');
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at || 0,
      user: {
        id: data.user.id,
        email: data.user.email || '',
        user_metadata: testUser.metadata,
      },
    };
  }

  /**
   * Supabase認証クッキーを設定
   *
   * Supabase SSRライブラリが期待する形式でクッキーを設定します。
   */
  private static async setSupabaseCookies(
    context: BrowserContext,
    session: SupabaseSession
  ): Promise<void> {
    const domain = new URL(context.pages()[0]?.url() || 'http://localhost:3000').hostname;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
    }

    // Supabase SSRが使用するクッキー名のプレフィックス
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    const cookiePrefix = `sb-${projectRef}`;

    // Supabase認証クッキーを設定（実際のSupabase SSRの形式に合わせる）
    const cookies = [
      {
        name: `${cookiePrefix}-auth-token`,
        value: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          expires_in: 3600,
          token_type: 'bearer',
          user: session.user,
        }),
        domain,
        path: '/',
        httpOnly: true,
        secure: false, // テスト環境ではHTTPを使用
        sameSite: 'Lax' as const,
        expires: session.expires_at,
      },
    ];

    await context.addCookies(cookies);
  }

  /**
   * ローカルストレージにSupabase認証情報を設定
   *
   * Supabase クライアントライブラリが期待する形式で認証情報を保存します。
   */
  private static async setSupabaseLocalStorage(
    page: Page,
    session: SupabaseSession
  ): Promise<void> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    await page.evaluate(
      ({ sessionData, url }) => {
        // Supabaseのローカルストレージキー形式
        const projectRef = new URL(url).hostname.split('.')[0];
        const storageKey = `sb-${projectRef}-auth-token`;

        // Supabase クライアントが期待する形式でセッション情報を保存
        const sessionInfo = {
          currentSession: {
            access_token: sessionData.access_token,
            refresh_token: sessionData.refresh_token,
            expires_at: sessionData.expires_at,
            expires_in: 3600,
            token_type: 'bearer',
            user: sessionData.user,
          },
          expiresAt: sessionData.expires_at,
        };

        localStorage.setItem(storageKey, JSON.stringify(sessionInfo));

        // 追加の認証フラグを設定
        sessionStorage.setItem('isAuthenticated', 'true');
        sessionStorage.setItem('authTimestamp', Date.now().toString());
      },
      {
        sessionData: session,
        url: supabaseUrl,
      }
    );
  }

  /**
   * 認証をセットアップ（メインメソッド）
   *
   * 実際のSupabase認証を使用してテスト環境をセットアップします。
   * 環境に応じて実際のSupabaseまたはモック認証を使用します。
   *
   * Issue #520: Optimized for single-step authentication without multiple navigations
   */
  static async setup(
    context: BrowserContext,
    page: Page,
    options: SupabaseAuthOptions = {}
  ): Promise<void> {
    const { role = 'admin', organizationId, customUser, skipCookies = false } = options;
    const mode = getTestMode();

    // CI環境またはモックモードの場合は従来のモック認証を使用
    // Use E2E_USE_MOCK_AUTH flag to match middleware behavior
    const useMockAuth = process.env.E2E_USE_MOCK_AUTH === 'true' || process.env.CI === 'true';
    if (mode === 'mock' || useMockAuth) {
      await this.setupMockAuthSingleStep(context, page, options);
      return;
    }

    try {
      // テストユーザーを作成または取得
      const user = await this.ensureTestUser(role);

      // カスタムユーザー情報をマージ
      if (customUser) {
        Object.assign(user, customUser);
        if (customUser.user_metadata) {
          Object.assign(user.user_metadata, customUser.user_metadata);
        }
      }

      // 組織IDを上書き（指定された場合）
      if (organizationId) {
        user.user_metadata.organization_id = organizationId;
      }

      // 実際のSupabase認証でログイン
      const session = await this.authenticateUser(role);

      // Single-step authentication: Only navigate once if needed
      const currentUrl = page.url();
      if (currentUrl === 'about:blank' || !currentUrl.startsWith('http')) {
        // Issue #520: Single navigation to reduce race conditions
        await page.goto('/', { waitUntil: 'domcontentloaded' });
      }

      // Set all authentication data in parallel for efficiency
      await Promise.all([
        // クッキーを設定（必要な場合）
        !skipCookies ? this.setSupabaseCookies(context, session) : Promise.resolve(),
        // ローカルストレージに認証情報を設定
        this.setSupabaseLocalStorage(page, session),
      ]);

      // デバッグ用のグローバル変数を設定（テスト環境のみ）
      if (process.env.TEST_DEBUG_MODE === 'true') {
        await page.evaluate((userData) => {
          (window as unknown as { __testUser?: Record<string, unknown> }).__testUser = userData;
        }, user);
      }
    } catch (error) {
      console.error('Failed to setup Supabase authentication:', error);
      throw error;
    }
  }

  /**
   * 特定ロールでクイックセットアップ
   */
  static async setupAsAdmin(context: BrowserContext, page: Page): Promise<void> {
    await this.setup(context, page, { role: 'admin' });
  }

  static async setupAsAccountant(context: BrowserContext, page: Page): Promise<void> {
    await this.setup(context, page, { role: 'accountant' });
  }

  static async setupAsViewer(context: BrowserContext, page: Page): Promise<void> {
    await this.setup(context, page, { role: 'viewer' });
  }

  /**
   * モック認証のセットアップ（Supabaseが利用できない場合のフォールバック）
   * Issue #520: Optimized for single-step authentication
   */
  private static async setupMockAuthSingleStep(
    context: BrowserContext,
    page: Page,
    options: SupabaseAuthOptions = {}
  ): Promise<void> {
    const { role = 'admin', organizationId, customUser, skipCookies = false } = options;

    // モックユーザーデータ
    const mockUser = {
      id: `mock-${role}-${Date.now()}`,
      email: SUPABASE_TEST_USERS[role].email,
      user_metadata: {
        ...SUPABASE_TEST_USERS[role].metadata,
        ...(customUser?.user_metadata || {}),
        organization_id: organizationId || SUPABASE_TEST_USERS[role].metadata.organization_id,
      },
    };

    // モックセッションの作成
    const mockSession = {
      access_token: `mock-access-token-${role}-${Date.now()}`,
      refresh_token: `mock-refresh-token-${role}-${Date.now()}`,
      expires_at: Date.now() / 1000 + 3600,
      user: mockUser,
    };

    // Issue #520: Single navigation only if needed
    const currentUrl = page.url();
    if (currentUrl === 'about:blank' || !currentUrl.startsWith('http')) {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
    }

    // Issue #520: Set all auth data in parallel for efficiency
    const authSetupPromises: Promise<void>[] = [];

    // Set storage state
    authSetupPromises.push(
      page.evaluate(
        ({ sessionData }) => {
          // Mock Supabase session
          const storageKey = 'sb-placeholder-auth-token';
          const sessionInfo = {
            currentSession: {
              access_token: sessionData.access_token,
              refresh_token: sessionData.refresh_token,
              expires_at: sessionData.expires_at,
              expires_in: 3600,
              token_type: 'bearer',
              user: sessionData.user,
            },
            expiresAt: sessionData.expires_at,
          };

          localStorage.setItem(storageKey, JSON.stringify(sessionInfo));
          localStorage.setItem('mockAuth', 'true');
          sessionStorage.setItem('isAuthenticated', 'true');
          sessionStorage.setItem('authRole', sessionData.user.user_metadata.role);
          // Add timestamp for auth freshness checks
          sessionStorage.setItem('authTimestamp', Date.now().toString());
        },
        { sessionData: mockSession }
      )
    );

    // Cookie設定（必要な場合）
    if (!skipCookies) {
      authSetupPromises.push(
        context.addCookies([
          {
            name: 'sb-auth-token',
            value: mockSession.access_token,
            url: 'http://localhost:3000',
            expires: mockSession.expires_at,
            httpOnly: false,
            secure: false,
            sameSite: 'Lax' as const,
          },
          // Issue #514: Add mockAuth cookie for middleware detection
          {
            name: 'mockAuth',
            value: 'true',
            url: 'http://localhost:3000',
            httpOnly: false,
            secure: false,
            sameSite: 'Lax' as const,
          },
        ])
      );
    }

    // Execute all auth setup operations in parallel
    await Promise.all(authSetupPromises);
  }

  /**
   * モック認証のセットアップ（後方互換性のため維持）
   * @deprecated Use setupMockAuthSingleStep instead
   */
  private static async setupMockAuth(
    context: BrowserContext,
    page: Page,
    options: SupabaseAuthOptions = {}
  ): Promise<void> {
    return this.setupMockAuthSingleStep(context, page, options);
  }

  /**
   * 認証状態をクリア
   */
  static async clear(context: BrowserContext, page: Page): Promise<void> {
    // クッキーをクリア
    await context.clearCookies();

    // ローカルストレージとセッションストレージをクリア
    await page.evaluate(() => {
      // Supabase関連のキーをクリア（プレフィックスでマッチ）
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.startsWith('supabase'))) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));

      // セッションストレージもクリア
      sessionStorage.clear();

      // グローバル変数もクリア（デバッグモードの場合）
      delete (window as unknown as { __testUser?: Record<string, unknown> }).__testUser;
    });

    // Supabaseクライアントでサインアウト（念のため）
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseAnonKey) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        await supabase.auth.signOut();
      }
    } catch (error) {
      // サインアウトエラーは無視（既にログアウト済みの可能性があるため）
      console.debug('Supabase signOut failed (may already be signed out):', error);
    }
  }

  /**
   * 認証状態を確認
   */
  static async isAuthenticated(page: Page): Promise<boolean> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return false;

    return await page.evaluate((url) => {
      const projectRef = new URL(url).hostname.split('.')[0];
      const storageKey = `sb-${projectRef}-auth-token`;
      const tokenData = localStorage.getItem(storageKey);

      if (!tokenData) return false;

      try {
        const sessionInfo = JSON.parse(tokenData);
        const now = Date.now() / 1000;
        return sessionInfo.expiresAt > now;
      } catch {
        return false;
      }
    }, supabaseUrl);
  }

  /**
   * 現在のユーザー情報を取得
   */
  static async getCurrentUser(page: Page): Promise<SupabaseUser | null> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return null;

    return await page.evaluate((url) => {
      const projectRef = new URL(url).hostname.split('.')[0];
      const storageKey = `sb-${projectRef}-auth-token`;
      const tokenData = localStorage.getItem(storageKey);

      if (!tokenData) return null;

      try {
        const sessionInfo = JSON.parse(tokenData);
        return sessionInfo.currentSession?.user || null;
      } catch {
        return null;
      }
    }, supabaseUrl);
  }

  /**
   * 現在のユーザーロールを取得
   */
  static async getCurrentRole(page: Page): Promise<UserRole | null> {
    const user = await this.getCurrentUser(page);
    return user?.user_metadata?.role || null;
  }

  /**
   * 権限チェック
   */
  static async hasPermission(page: Page, permission: string): Promise<boolean> {
    const user = await this.getCurrentUser(page);
    const permissions = user?.user_metadata?.permissions || [];
    return permissions.includes('*') || permissions.includes(permission);
  }

  /**
   * デバッグ用：現在の認証状態をコンソールに出力
   */
  static async debugAuthState(page: Page): Promise<void> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    const state = await page.evaluate((url) => {
      const projectRef = url ? new URL(url).hostname.split('.')[0] : 'unknown';
      const storageKey = `sb-${projectRef}-auth-token`;

      // すべてのSupabase関連キーを取得
      const supabaseKeys: Record<string, string | null> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.startsWith('supabase'))) {
          supabaseKeys[key] = localStorage.getItem(key);
        }
      }

      return {
        mainToken: localStorage.getItem(storageKey),
        allSupabaseKeys: supabaseKeys,
        isAuthenticated: sessionStorage.getItem('isAuthenticated'),
        authTimestamp: sessionStorage.getItem('authTimestamp'),
        testUser: (window as unknown as { __testUser?: Record<string, unknown> }).__testUser,
        cookies: document.cookie,
      };
    }, supabaseUrl || '');

    console.log('Current Supabase Auth State:', state);
  }

  /**
   * すべてのテストユーザーをクリーンアップ
   * テストスイート終了時に呼び出してください
   */
  static async cleanupAllTestUsers(): Promise<void> {
    const admin = getSupabaseAdmin();

    try {
      const { data: users } = await admin.auth.admin.listUsers();

      if (users?.users) {
        const testEmails = Object.values(SUPABASE_TEST_USERS).map((u) => u.email);
        const testUsers = users.users.filter((u) => u.email && testEmails.includes(u.email));

        for (const user of testUsers) {
          await admin.auth.admin.deleteUser(user.id);
          console.log(`Cleaned up test user: ${user.email}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup test users:', error);
    }
  }
}

/**
 * テスト用ヘルパー関数
 */

/**
 * Supabase認証済みコンテキストを作成
 */
export async function createAuthenticatedContext(
  context: BrowserContext,
  role: UserRole = 'admin'
): Promise<Page> {
  const page = await context.newPage();
  await SupabaseAuth.setup(context, page, { role });
  return page;
}

/**
 * 認証状態をアサート
 */
export async function assertAuthenticated(page: Page, expectedRole?: UserRole): Promise<void> {
  const isAuth = await SupabaseAuth.isAuthenticated(page);
  if (!isAuth) {
    throw new Error('Expected user to be authenticated');
  }

  if (expectedRole) {
    const role = await SupabaseAuth.getCurrentRole(page);
    if (role !== expectedRole) {
      throw new Error(`Expected role ${expectedRole}, got ${role}`);
    }
  }
}

/**
 * 権限をアサート
 */
export async function assertHasPermission(page: Page, permission: string): Promise<void> {
  const hasPermission = await SupabaseAuth.hasPermission(page, permission);
  if (!hasPermission) {
    throw new Error(`Expected user to have permission: ${permission}`);
  }
}
