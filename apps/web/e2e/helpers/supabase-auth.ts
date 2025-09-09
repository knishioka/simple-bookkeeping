/**
 * Supabase認証ヘルパー
 * Issue #353対応: Server Actions移行に伴うSupabase認証のE2Eテストサポート
 *
 * JWT認証からSupabase認証への移行をサポートします。
 */

import { Page, BrowserContext } from '@playwright/test';

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
 * プリセットユーザー定義（Supabase形式）
 */
export const SUPABASE_TEST_USERS: Record<UserRole, SupabaseUser> = {
  admin: {
    id: 'test-admin-id',
    email: 'admin@test.example.com',
    user_metadata: {
      name: 'Test Admin',
      organization_id: 'test-org-1',
      role: 'admin',
      permissions: ['*'],
    },
  },
  accountant: {
    id: 'test-accountant-id',
    email: 'accountant@test.example.com',
    user_metadata: {
      name: 'Test Accountant',
      organization_id: 'test-org-1',
      role: 'accountant',
      permissions: ['accounts:read', 'accounts:write', 'journal:read', 'journal:write'],
    },
  },
  viewer: {
    id: 'test-viewer-id',
    email: 'viewer@test.example.com',
    user_metadata: {
      name: 'Test Viewer',
      organization_id: 'test-org-1',
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
   * テスト用のSupabaseセッションを生成
   */
  private static createTestSession(user: SupabaseUser): SupabaseSession {
    const now = Date.now();
    return {
      access_token: `test-access-token-${user.id}`,
      refresh_token: `test-refresh-token-${user.id}`,
      expires_at: Math.floor((now + 3600000) / 1000), // 1時間後
      user,
    };
  }

  /**
   * Supabase認証クッキーを設定
   *
   * Supabaseは認証情報をクッキーに保存します。
   * このメソッドは、テスト用の認証クッキーを設定します。
   */
  private static async setSupabaseCookies(
    context: BrowserContext,
    session: SupabaseSession
  ): Promise<void> {
    const domain = new URL(context.pages()[0]?.url() || 'http://localhost:3000').hostname;

    // Supabase認証クッキーを設定
    await context.addCookies([
      {
        name: 'sb-auth-token',
        value: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          user: session.user,
        }),
        domain,
        path: '/',
        httpOnly: true,
        secure: false, // テスト環境ではHTTPを使用
        sameSite: 'Lax',
      },
    ]);
  }

  /**
   * ローカルストレージにSupabase認証情報を設定
   *
   * Supabase クライアントライブラリは、認証情報をローカルストレージにも保存します。
   */
  private static async setSupabaseLocalStorage(
    page: Page,
    session: SupabaseSession
  ): Promise<void> {
    await page.evaluate((sessionData) => {
      // Supabaseのローカルストレージキー
      const storageKey = 'supabase.auth.token';

      // セッション情報を保存
      localStorage.setItem(storageKey, JSON.stringify(sessionData));

      // 追加の認証フラグを設定
      sessionStorage.setItem('isAuthenticated', 'true');
      sessionStorage.setItem('authTimestamp', Date.now().toString());
    }, session);
  }

  /**
   * 認証をセットアップ（メインメソッド）
   *
   * Supabase認証をテスト環境で設定します。
   * Server Actionsと連携して動作します。
   */
  static async setup(
    context: BrowserContext,
    page: Page,
    options: SupabaseAuthOptions = {}
  ): Promise<void> {
    const { role = 'admin', organizationId, customUser, skipCookies = false } = options;

    // ユーザー情報を構築
    const baseUser = SUPABASE_TEST_USERS[role];
    const user: SupabaseUser = {
      ...baseUser,
      ...customUser,
      user_metadata: {
        ...baseUser.user_metadata,
        ...(customUser?.user_metadata || {}),
        organization_id: organizationId || baseUser.user_metadata.organization_id,
      },
    };

    // セッションを作成
    const session = this.createTestSession(user);

    // ページが読み込まれていない場合は読み込む
    const currentUrl = page.url();
    if (currentUrl === 'about:blank' || !currentUrl.startsWith('http')) {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
    }

    // クッキーを設定（必要な場合）
    if (!skipCookies) {
      await this.setSupabaseCookies(context, session);
    }

    // ローカルストレージに認証情報を設定
    await this.setSupabaseLocalStorage(page, session);

    // Server Actionsのモックと連携するためのグローバル変数を設定
    await page.evaluate((userData) => {
      (window as unknown as { __testUser?: Record<string, unknown> }).__testUser = userData;
    }, user);
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
   * 認証状態をクリア
   */
  static async clear(context: BrowserContext, page: Page): Promise<void> {
    // クッキーをクリア
    await context.clearCookies();

    // ローカルストレージとセッションストレージをクリア
    await page.evaluate(() => {
      // Supabase関連のキーをクリア
      const supabaseKeys = [
        'supabase.auth.token',
        'supabase.auth.expires_at',
        'supabase.auth.refresh_token',
      ];

      supabaseKeys.forEach((key) => localStorage.removeItem(key));

      // セッションストレージもクリア
      sessionStorage.clear();

      // グローバル変数もクリア
      delete (window as unknown as { __testUser?: Record<string, unknown> }).__testUser;
    });
  }

  /**
   * 認証状態を確認
   */
  static async isAuthenticated(page: Page): Promise<boolean> {
    return await page.evaluate(() => {
      const storageKey = 'supabase.auth.token';
      const tokenData = localStorage.getItem(storageKey);

      if (!tokenData) return false;

      try {
        const session = JSON.parse(tokenData);
        const now = Date.now() / 1000;
        return session.expires_at > now;
      } catch {
        return false;
      }
    });
  }

  /**
   * 現在のユーザー情報を取得
   */
  static async getCurrentUser(page: Page): Promise<SupabaseUser | null> {
    return await page.evaluate(() => {
      const storageKey = 'supabase.auth.token';
      const tokenData = localStorage.getItem(storageKey);

      if (!tokenData) return null;

      try {
        const session = JSON.parse(tokenData);
        return session.user;
      } catch {
        return null;
      }
    });
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
    const state = await page.evaluate(() => {
      const storageKey = 'supabase.auth.token';
      return {
        token: localStorage.getItem(storageKey),
        isAuthenticated: sessionStorage.getItem('isAuthenticated'),
        authTimestamp: sessionStorage.getItem('authTimestamp'),
        testUser: (window as unknown as { __testUser?: Record<string, unknown> }).__testUser,
      };
    });
    console.log('Current Supabase Auth State:', state);
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
