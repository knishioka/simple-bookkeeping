/**
 * 統一認証ヘルパー
 * Issue #95対応: E2Eテスト全体で使用する統一された認証処理
 */

import { Page, BrowserContext } from '@playwright/test';

/**
 * ユーザーロール定義
 */
export type UserRole = 'admin' | 'accountant' | 'viewer';

/**
 * ユーザー情報インターフェース
 */
export interface UserInfo {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  role: UserRole;
  permissions?: string[];
}

/**
 * 認証トークン情報
 */
export interface AuthTokens {
  token: string;
  refreshToken: string;
}

/**
 * 認証設定オプション（拡張版）
 */
export interface UnifiedAuthOptions {
  role?: UserRole;
  customUser?: Partial<UserInfo>;
  customTokens?: Partial<AuthTokens>;
  useMock?: boolean;
  skipApiRoutes?: boolean;
}

/**
 * プリセットユーザー定義
 */
export const PRESET_USERS: Record<UserRole, UserInfo> = {
  admin: {
    id: '1',
    email: 'admin@example.com',
    name: 'Admin User',
    organizationId: 'org-1',
    role: 'admin',
    permissions: ['*'],
  },
  accountant: {
    id: '2',
    email: 'accountant@example.com',
    name: 'Accountant User',
    organizationId: 'org-1',
    role: 'accountant',
    permissions: ['accounts:read', 'accounts:write', 'journal:read', 'journal:write'],
  },
  viewer: {
    id: '3',
    email: 'viewer@example.com',
    name: 'Viewer User',
    organizationId: 'org-1',
    role: 'viewer',
    permissions: ['accounts:read', 'journal:read'],
  },
};

/**
 * デフォルトトークン定義
 */
export const DEFAULT_TOKENS: AuthTokens = {
  token: 'test-token-12345',
  refreshToken: 'test-refresh-token-12345',
};

/**
 * 統一認証ヘルパークラス
 */
export class UnifiedAuth {
  /**
   * 認証をセットアップ（推奨メソッド）
   * テストの種類に応じて最適な認証方法を自動選択
   */
  static async setup(
    context: BrowserContext,
    page: Page,
    options: UnifiedAuthOptions = {}
  ): Promise<void> {
    const { useMock = true, skipApiRoutes = false } = options;

    if (useMock && !skipApiRoutes) {
      // APIモックをセットアップ
      await this.setupMockRoutes(context, options);
    }

    // localStorageに認証情報を設定
    await this.setAuthData(page, options);
  }

  /**
   * APIモックルートをセットアップ
   */
  static async setupMockRoutes(
    context: BrowserContext,
    options: UnifiedAuthOptions = {}
  ): Promise<void> {
    const { role: userRole = 'admin', customUser, customTokens } = options;
    const user = { ...PRESET_USERS[userRole], ...customUser };
    const tokens = { ...DEFAULT_TOKENS, ...customTokens };

    // ログインAPIモック
    await context.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            ...tokens,
            user,
          },
        }),
      });
    });

    // トークン検証APIモック
    await context.route('**/api/v1/auth/verify', async (route) => {
      const authHeader = route.request().headers()['authorization'];
      const isValid = authHeader === `Bearer ${tokens.token}`;

      await route.fulfill({
        status: isValid ? 200 : 401,
        contentType: 'application/json',
        body: JSON.stringify(
          isValid
            ? {
                data: {
                  valid: true,
                  user,
                },
              }
            : {
                error: {
                  code: 'UNAUTHORIZED',
                  message: 'Invalid token',
                },
              }
        ),
      });
    });

    // リフレッシュトークンAPIモック
    await context.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            token: `${tokens.token}-refreshed`,
            refreshToken: `${tokens.refreshToken}-new`,
          },
        }),
      });
    });

    // ログアウトAPIモック
    await context.route('**/api/v1/auth/logout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            success: true,
          },
        }),
      });
    });

    // ユーザー情報取得APIモック
    await context.route('**/api/v1/auth/me', async (route) => {
      const authHeader = route.request().headers()['authorization'];
      const isValid = authHeader === `Bearer ${tokens.token}`;

      await route.fulfill({
        status: isValid ? 200 : 401,
        contentType: 'application/json',
        body: JSON.stringify(
          isValid
            ? {
                data: user,
              }
            : {
                error: {
                  code: 'UNAUTHORIZED',
                  message: 'Invalid token',
                },
              }
        ),
      });
    });
  }

  /**
   * localStorageに認証データを設定
   */
  static async setAuthData(page: Page, options: UnifiedAuthOptions = {}): Promise<void> {
    const { role = 'admin', customUser, customTokens } = options;
    const user = { ...PRESET_USERS[role], ...customUser };
    const tokens = { ...DEFAULT_TOKENS, ...customTokens };

    // ページが読み込まれていない場合は、最小限のページを読み込む
    const currentUrl = page.url();
    if (currentUrl === 'about:blank' || !currentUrl.startsWith('http')) {
      await page.goto('/');
    }

    // localStorageとsessionStorageに認証情報を設定
    await page.evaluate(
      ({ user, tokens }) => {
        // トークン情報
        localStorage.setItem('token', tokens.token);
        localStorage.setItem('refreshToken', tokens.refreshToken);

        // ユーザー情報
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('userId', user.id);
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('organizationId', user.organizationId);
        localStorage.setItem('userRole', user.role);

        // セッション情報
        sessionStorage.setItem('isAuthenticated', 'true');
        sessionStorage.setItem('authTimestamp', Date.now().toString());
      },
      { user, tokens }
    );
  }

  /**
   * 特定のロールでクイックセットアップ
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
  static async clear(page: Page): Promise<void> {
    await page.evaluate(() => {
      // localStorage
      const authKeys = [
        'token',
        'refreshToken',
        'user',
        'userId',
        'userEmail',
        'organizationId',
        'userRole',
      ];
      authKeys.forEach((key) => localStorage.removeItem(key));

      // sessionStorage
      sessionStorage.removeItem('isAuthenticated');
      sessionStorage.removeItem('authTimestamp');
    });
  }

  /**
   * 認証状態を確認
   */
  static async isAuthenticated(page: Page): Promise<boolean> {
    return await page.evaluate(() => {
      const token = localStorage.getItem('token');
      const isAuth = sessionStorage.getItem('isAuthenticated');
      return Boolean(token && isAuth === 'true');
    });
  }

  /**
   * 現在のユーザー情報を取得
   */
  static async getCurrentUser(page: Page): Promise<UserInfo | null> {
    return await page.evaluate(() => {
      const userStr = localStorage.getItem('user');
      if (!userStr) return null;
      try {
        return JSON.parse(userStr);
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
    return user?.role || null;
  }

  /**
   * 権限チェック
   */
  static async hasPermission(page: Page, permission: string): Promise<boolean> {
    const user = await this.getCurrentUser(page);
    if (!user || !user.permissions) return false;
    return user.permissions.includes('*') || user.permissions.includes(permission);
  }

  /**
   * テスト用ログインフォーム入力（実APIテスト用）
   */
  static async fillLoginForm(page: Page, email?: string, password?: string): Promise<void> {
    const loginEmail = email || PRESET_USERS.admin.email;
    const loginPassword = password || 'admin123';

    await page.goto('/login');
    await page.fill('input#email, input[name="email"]', loginEmail);
    await page.fill('input#password, input[name="password"]', loginPassword);
  }

  /**
   * ログインボタンクリックと成功待機
   */
  static async submitLoginAndWait(page: Page): Promise<void> {
    const loginButton = page.locator('button[type="submit"]');
    const isCI = !!process.env.CI;

    // ログインボタンをクリック
    await loginButton.click();

    // CI環境では異なる待機戦略を使用
    if (isCI) {
      // CI環境：APIレスポンスの完了を待つ
      await page.waitForLoadState('networkidle', { timeout: 15000 });

      // トークンが保存されるか、ダッシュボードへリダイレクトされるまで待機
      await page.waitForFunction(
        () => {
          return (
            localStorage.getItem('token') !== null ||
            window.location.pathname.includes('/dashboard')
          );
        },
        { timeout: 10000 }
      );
    } else {
      // ローカル環境：既存のロジックを使用
      try {
        await page.waitForURL('**/dashboard/**', { timeout: 10000 });
      } catch {
        // ダッシュボードへのリダイレクトが失敗した場合、トークンの保存を確認
        await page.waitForFunction(() => localStorage.getItem('token') !== null, { timeout: 5000 });
      }
    }
  }

  /**
   * デバッグ用：現在の認証状態をコンソールに出力
   */
  static async debugAuthState(page: Page): Promise<void> {
    const state = await page.evaluate(() => {
      return {
        token: localStorage.getItem('token'),
        refreshToken: localStorage.getItem('refreshToken'),
        user: localStorage.getItem('user'),
        isAuthenticated: sessionStorage.getItem('isAuthenticated'),
        authTimestamp: sessionStorage.getItem('authTimestamp'),
      };
    });
    console.log('Current Auth State:', state);
  }
}

/**
 * テスト用ヘルパー関数（エクスポート）
 */

/**
 * 認証済みコンテキストを作成
 */
export async function createAuthenticatedContext(
  context: BrowserContext,
  role: UserRole = 'admin'
): Promise<Page> {
  const page = await context.newPage();
  await UnifiedAuth.setup(context, page, { role });
  return page;
}

/**
 * 認証状態をアサート
 */
export async function assertAuthenticated(page: Page, expectedRole?: UserRole): Promise<void> {
  const isAuth = await UnifiedAuth.isAuthenticated(page);
  if (!isAuth) {
    throw new Error('Expected user to be authenticated');
  }

  if (expectedRole) {
    const role = await UnifiedAuth.getCurrentRole(page);
    if (role !== expectedRole) {
      throw new Error(`Expected role ${expectedRole}, got ${role}`);
    }
  }
}

/**
 * 権限をアサート
 */
export async function assertHasPermission(page: Page, permission: string): Promise<void> {
  const hasPermission = await UnifiedAuth.hasPermission(page, permission);
  if (!hasPermission) {
    throw new Error(`Expected user to have permission: ${permission}`);
  }
}
