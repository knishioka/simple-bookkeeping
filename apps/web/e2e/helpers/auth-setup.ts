/**
 * 認証セットアップヘルパー
 * Issue #25対応: Playwrightテストでの認証処理を改善
 */

import { Page, BrowserContext } from '@playwright/test';

/**
 * 認証設定オプション
 */
export interface AuthSetupOptions {
  email?: string;
  password?: string;
  token?: string;
  organizationId?: string;
  userId?: string;
  useMock?: boolean;
}

/**
 * テスト用の認証セットアップ
 */
export class AuthSetup {
  /**
   * テスト用のデフォルト認証情報
   */
  static readonly DEFAULT_CREDENTIALS = {
    email: 'admin@example.com',
    password: 'admin123',
    token: 'test-token-12345',
    organizationId: 'org-1',
    userId: '1',
  };

  /**
   * ブラウザコンテキストに認証モックを設定
   */
  static async setupAuthMock(
    context: BrowserContext,
    options: AuthSetupOptions = {}
  ): Promise<void> {
    const {
      token = this.DEFAULT_CREDENTIALS.token,
      email = this.DEFAULT_CREDENTIALS.email,
      userId = this.DEFAULT_CREDENTIALS.userId,
      organizationId = this.DEFAULT_CREDENTIALS.organizationId,
    } = options;

    // 認証APIのモック
    await context.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            token,
            refreshToken: 'test-refresh-token',
            user: {
              id: userId,
              email,
              name: 'Test User',
              organizationId,
            },
          },
        }),
      });
    });

    // トークン検証APIのモック
    await context.route('**/api/v1/auth/verify', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            valid: true,
            user: {
              id: userId,
              email,
              organizationId,
            },
          },
        }),
      });
    });

    // リフレッシュトークンAPIのモック
    await context.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            token: `${token}-refreshed`,
            refreshToken: 'test-refresh-token-new',
          },
        }),
      });
    });
  }

  /**
   * 直接localStorageに認証情報を設定
   */
  static async setAuthTokensDirectly(page: Page, options: AuthSetupOptions = {}): Promise<void> {
    const {
      token = this.DEFAULT_CREDENTIALS.token,
      email = this.DEFAULT_CREDENTIALS.email,
      userId = this.DEFAULT_CREDENTIALS.userId,
      organizationId = this.DEFAULT_CREDENTIALS.organizationId,
    } = options;

    await page.goto('/');

    // localStorageに認証情報を設定
    await page.evaluate(
      ({ token, email, userId, organizationId }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', 'test-refresh-token');
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userId', userId);
        localStorage.setItem('organizationId', organizationId);

        // セッションストレージにも設定（必要に応じて）
        sessionStorage.setItem('isAuthenticated', 'true');
      },
      { token, email, userId, organizationId }
    );
  }

  /**
   * 実際のAPIを使用してログイン（改善版）
   */
  static async loginWithApi(page: Page, options: AuthSetupOptions = {}): Promise<void> {
    const { email = this.DEFAULT_CREDENTIALS.email, password = this.DEFAULT_CREDENTIALS.password } =
      options;

    await page.goto('/login');

    // フォーム入力
    await page.fill('input#email, input[name="email"]', email);
    await page.fill('input#password, input[name="password"]', password);

    // ログインボタンをクリック（複数の待機戦略）
    const loginButton = page.locator('button[type="submit"]');

    // 複数の成功条件を並列で待機
    const loginPromise = Promise.race([
      // オプション1: ダッシュボードへのリダイレクト
      loginButton.click().then(() => page.waitForURL('**/dashboard/**', { timeout: 5000 })),

      // オプション2: トークンがlocalStorageに保存される
      loginButton
        .click()
        .then(() =>
          page.waitForFunction(() => localStorage.getItem('token') !== null, { timeout: 5000 })
        ),

      // オプション3: ログイン成功のレスポンス
      Promise.all([
        loginButton.click(),
        page.waitForResponse((resp) => resp.url().includes('/auth/login') && resp.ok(), {
          timeout: 5000,
        }),
      ]),
    ]);

    try {
      await loginPromise;
    } catch (error) {
      // エラーメッセージの確認
      const errorMessage = await page.locator('[role="alert"], .text-destructive').textContent();
      if (errorMessage) {
        throw new Error(`Login failed: ${errorMessage}`);
      }
      throw error;
    }
  }

  /**
   * 認証状態をクリア
   */
  static async clearAuth(page: Page): Promise<void> {
    await page.evaluate(() => {
      // localStorageをクリア
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userId');
      localStorage.removeItem('organizationId');

      // sessionStorageもクリア
      sessionStorage.removeItem('isAuthenticated');
    });
  }

  /**
   * 認証状態を確認
   */
  static async isAuthenticated(page: Page): Promise<boolean> {
    return await page.evaluate(() => {
      const token = localStorage.getItem('token');
      return token !== null && token !== undefined && token !== '';
    });
  }

  /**
   * 認証が必要なページのテストをスキップ
   */
  static async skipIfNotAuthenticated(page: Page): Promise<boolean> {
    const isAuth = await this.isAuthenticated(page);
    if (!isAuth) {
      console.log('Skipping test: Not authenticated');
      return true;
    }
    return false;
  }
}
