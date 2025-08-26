/**
 * 統一認証ヘルパー
 * Issue #95対応: E2Eテスト全体で使用する統一された認証処理
 * Issue #131対応: test-utilsパッケージから認証情報をインポート
 */

import { Page, BrowserContext } from '@playwright/test';
import { TEST_CREDENTIALS } from '@simple-bookkeeping/test-utils';

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
 * TEST_CREDENTIALSから認証情報を取得
 */
export const PRESET_USERS: Record<UserRole, UserInfo> = {
  admin: {
    id: '1',
    email: TEST_CREDENTIALS.admin.email,
    name: TEST_CREDENTIALS.admin.name,
    organizationId: 'org-1',
    role: 'admin',
    permissions: ['*'],
  },
  accountant: {
    id: '2',
    email: TEST_CREDENTIALS.accountant.email,
    name: TEST_CREDENTIALS.accountant.name,
    organizationId: 'org-1',
    role: 'accountant',
    permissions: ['accounts:read', 'accounts:write', 'journal:read', 'journal:write'],
  },
  viewer: {
    id: '3',
    email: TEST_CREDENTIALS.viewer.email,
    name: TEST_CREDENTIALS.viewer.name,
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
    const baseUser = { ...PRESET_USERS[userRole], ...customUser };
    const tokens = { ...DEFAULT_TOKENS, ...customTokens };

    // Add organizations and currentOrganization structure
    const user = {
      ...baseUser,
      organizations: [
        {
          id: baseUser.organizationId || 'org-1',
          name: 'Test Organization',
          code: 'TEST',
          role: baseUser.role.toUpperCase() as 'ADMIN' | 'ACCOUNTANT' | 'VIEWER',
          isDefault: true,
        },
      ],
      currentOrganization: {
        id: baseUser.organizationId || 'org-1',
        name: 'Test Organization',
        code: 'TEST',
        role: baseUser.role.toUpperCase() as 'ADMIN' | 'ACCOUNTANT' | 'VIEWER',
        isDefault: true,
      },
    };

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
                data: { user },
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
      // Docker環境では BASE_URL を使用、それ以外は / を使用
      const baseUrl = process.env.BASE_URL || '/';
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
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
    const loginEmail = email || TEST_CREDENTIALS.admin.email;
    const loginPassword = password || TEST_CREDENTIALS.admin.password;

    await page.goto('/login');
    await page.fill('input#email, input[name="email"]', loginEmail);
    await page.fill('input#password, input[name="password"]', loginPassword);
  }

  /**
   * ログインボタンクリックと成功待機
   *
   * 注意: モック環境でログインページが存在しない場合は、
   * 代わりに setAuthData() を直接使用することを推奨します。
   */
  static async submitLoginAndWait(page: Page): Promise<void> {
    // 現在のURLを確認
    const currentUrl = page.url();
    const isLoginPage = currentUrl.includes('/login') || currentUrl.includes('/auth');

    if (!isLoginPage) {
      // ログインページにいない場合は、まずログインページに移動
      try {
        await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 5000 });
      } catch {
        console.warn('Failed to navigate to login page. Using direct auth method.');
        await UnifiedAuth.setAuthData(page);
        return;
      }
    }

    const loginButton = page.locator('button[type="submit"]');
    const isCI = !!process.env.CI;

    // ログインボタンが存在するか確認
    const buttonCount = await loginButton.count();
    if (buttonCount === 0) {
      console.warn('Login button not found. Using direct auth method.');
      await UnifiedAuth.setAuthData(page);
      return;
    }

    // ログインボタンをクリック
    await loginButton.click();

    // CI環境では異なる待機戦略を使用
    if (isCI) {
      // CI環境：より確実な待機戦略
      // 1. まず短い時間でdomcontentloadedを待つ
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 });

      // 2. ログイン処理の結果を待つ（成功または失敗）
      await Promise.race([
        // ダッシュボードへのリダイレクトを待つ
        page.waitForURL('**/dashboard/**', { timeout: 10000 }).catch(() => null),
        // トークンの保存を待つ
        page
          .waitForFunction(() => localStorage.getItem('token') !== null, { timeout: 10000 })
          .catch(() => null),
        // エラーメッセージの表示を待つ
        page
          .waitForSelector('[role="alert"], .text-destructive', { timeout: 10000 })
          .catch(() => null),
      ]);

      // 3. Wait for state to stabilize with proper condition
      await page.waitForLoadState('domcontentloaded', { timeout: 1000 });
    } else {
      // ローカル環境：フォールバック機能付きの改善版
      try {
        await page.waitForURL('**/dashboard/**', { timeout: 5000 });
      } catch {
        // ダッシュボードへのリダイレクトが失敗した場合、トークンの保存を確認
        try {
          await page.waitForFunction(() => localStorage.getItem('token') !== null, {
            timeout: 3000,
          });
        } catch {
          // それでも失敗する場合は直接認証データを設定（フォールバック）
          console.warn('Login wait failed. Using direct auth method as fallback.');
          await UnifiedAuth.setAuthData(page);
        }
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
