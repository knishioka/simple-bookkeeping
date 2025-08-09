import { Page, expect, BrowserContext } from '@playwright/test';

/**
 * E2Eテスト用のヘルパー関数集
 *
 * 簿記アプリケーション特有の操作を抽象化し、
 * テストコードの再利用性と可読性を向上させます。
 */

/**
 * アプリケーション共通の待機・検証ヘルパー
 */
export class AppHelpers {
  constructor(private page: Page) {}

  /**
   * ページが完全に読み込まれるまで待機
   *
   * CI環境での安定性を考慮し、networkidleの代わりに
   * より信頼性の高い待機条件を使用します。
   */
  async waitForPageLoad() {
    // DOMContentLoadedとloadイベントを待機
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForLoadState('load');

    // CSSが読み込まれているか確認
    await this.page.waitForFunction(
      () => {
        // documentにスタイルシートが存在するか確認
        const stylesheets = Array.from(document.styleSheets);
        return stylesheets.length > 0;
      },
      { timeout: 15000 }
    );

    // bodyが表示されているか確認
    await this.page.waitForSelector('body', { state: 'visible', timeout: 15000 });

    // CI環境では追加の待機時間を設定（安定性向上）
    if (process.env.CI) {
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Toast メッセージの表示を確認
   */
  async expectToast(message: string) {
    await expect(this.page.locator('[data-sonner-toast]')).toContainText(message);
  }

  /**
   * エラーメッセージの表示を確認
   */
  async expectErrorMessage(message: string) {
    await expect(this.page.locator('[role="alert"], .text-destructive')).toContainText(message);
  }

  /**
   * ローディング状態の完了を待機
   */
  async waitForLoadingComplete() {
    await this.page.waitForSelector('[data-testid="loading"]', { state: 'hidden' });
  }
}

/**
 * 認証関連のヘルパー
 */
export class AuthHelpers {
  constructor(private page: Page) {}

  /**
   * ログイン実行（改善版）
   * Issue #25対応: タイムアウト問題を解決
   */
  async login(email: string = 'test@example.com', password: string = 'password') {
    await this.page.goto('/login');

    // フォーム入力
    await this.page.fill('input[name="email"], input#email', email);
    await this.page.fill('input[name="password"], input#password', password);

    // ログインボタンクリック（複数の待機条件で柔軟に対応）
    const loginButton = this.page.locator('button[type="submit"]');

    // クリックと同時に複数の条件を待機
    await Promise.race([
      // ダッシュボードへのリダイレクトを待つ
      Promise.all([
        loginButton.click(),
        this.page.waitForURL('**/dashboard/**', { timeout: 15000 }),
      ]).catch(() => null),

      // または認証成功のレスポンスを待つ
      Promise.all([
        loginButton.click(),
        this.page.waitForResponse((resp) => resp.url().includes('/auth/login') && resp.ok(), {
          timeout: 15000,
        }),
      ]).catch(() => null),

      // またはローカルストレージへのトークン保存を待つ
      Promise.all([
        loginButton.click(),
        this.page.waitForFunction(() => localStorage.getItem('token') !== null, { timeout: 15000 }),
      ]).catch(() => null),
    ]);

    // ログイン成功を確認
    const isLoggedIn = await this.isAuthenticated();
    if (!isLoggedIn) {
      throw new Error('Login failed: Authentication was not successful');
    }
  }

  /**
   * モックを使用したログイン（テスト環境用）
   */
  async loginWithMock(email: string = 'test@example.com', token: string = 'test-token') {
    // 直接localStorageにトークンを設定
    await this.page.goto('/');
    await this.page.evaluate(
      ({ token, email }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', 'test-refresh-token');
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userId', '1');
        localStorage.setItem('organizationId', 'org-1');
      },
      { token, email }
    );
  }

  /**
   * 認証状態の確認
   */
  async isAuthenticated(): Promise<boolean> {
    return await this.page.evaluate(() => {
      return localStorage.getItem('token') !== null;
    });
  }

  /**
   * ログアウト実行
   */
  async logout() {
    // ユーザーメニューが存在する場合のみクリック
    const userMenu = this.page.locator('[data-testid="user-menu"]');
    if (await userMenu.isVisible().catch(() => false)) {
      await userMenu.click();
      await this.page.click('text=ログアウト');
    }

    // localStorageをクリア
    await this.page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userId');
      localStorage.removeItem('organizationId');
    });

    // ログインページへのリダイレクトを待機
    await this.page.waitForURL('/login', { timeout: 10000 }).catch(() => {
      // リダイレクトしない場合は手動でナビゲート
      return this.page.goto('/login');
    });
  }

  /**
   * APIモックの設定
   */
  async setupAuthMock(
    context: BrowserContext,
    options?: {
      shouldSucceed?: boolean;
      token?: string;
      user?: Record<string, unknown>;
    }
  ) {
    const { shouldSucceed = true, token = 'test-token', user = {} } = options || {};

    await context.route('**/api/v1/auth/login', async (route) => {
      if (shouldSucceed) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              token,
              refreshToken: 'test-refresh-token',
              user: {
                id: '1',
                email: 'test@example.com',
                name: 'Test User',
                organizationId: 'org-1',
                ...user,
              },
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Invalid email or password',
            },
          }),
        });
      }
    });
  }
}

/**
 * 勘定科目関連のヘルパー
 */
export class AccountHelpers {
  constructor(private page: Page) {}

  /**
   * 勘定科目作成ダイアログを開く
   */
  async openCreateDialog() {
    await this.page.click('text=勘定科目を追加');
    await expect(this.page.locator('[role="dialog"]')).toBeVisible();
  }

  /**
   * 勘定科目を作成
   */
  async createAccount(code: string, name: string, type: string, parentId?: string) {
    await this.openCreateDialog();

    // 基本情報入力
    await this.page.fill('input[name="code"]', code);
    await this.page.fill('input[name="name"]', name);

    // タイプ選択（Radix UI Select）
    await this.selectAccountType(type);

    // 親科目選択（任意）
    if (parentId) {
      await this.selectParentAccount(parentId);
    }

    // 作成ボタンクリック
    await this.page.click('button:has-text("作成")');

    // ダイアログが閉じるまで待機
    await expect(this.page.locator('[role="dialog"]')).toBeHidden();
  }

  /**
   * Radix UI Selectで勘定科目タイプを選択
   */
  async selectAccountType(type: string) {
    // Select trigger をクリック
    await this.page.click('[data-testid="account-type-select"] button[role="combobox"]');

    // オプションが表示されるまで待機
    await expect(this.page.locator('[role="option"]').first()).toBeVisible();

    // 指定されたタイプを選択
    await this.page.click(`[role="option"]:has-text("${type}")`);
  }

  /**
   * 親科目を選択
   */
  async selectParentAccount(parentName: string) {
    await this.page.click('[data-testid="parent-account-select"] button[role="combobox"]');
    await expect(this.page.locator('[role="option"]').first()).toBeVisible();
    await this.page.click(`[role="option"]:has-text("${parentName}")`);
  }

  /**
   * 勘定科目一覧で特定の科目を検索
   */
  async searchAccount(searchTerm: string) {
    await this.page.fill('input[placeholder*="検索"]', searchTerm);
    await this.page.waitForTimeout(500); // デバウンス待機
  }

  /**
   * 勘定科目の存在確認
   */
  async expectAccountExists(code: string, name: string) {
    const accountRow = this.page.locator(`tr:has-text("${code}"):has-text("${name}")`);
    await expect(accountRow).toBeVisible();
  }
}

/**
 * 仕訳関連のヘルパー
 */
export class JournalHelpers {
  constructor(private page: Page) {}

  /**
   * 仕訳作成ダイアログを開く
   */
  async openCreateDialog() {
    await this.page.click('text=仕訳を追加');
    await expect(this.page.locator('[role="dialog"]')).toBeVisible();
  }

  /**
   * 仕訳を作成
   */
  async createJournalEntry(description: string, lines: JournalLine[]) {
    await this.openCreateDialog();

    // 摘要入力
    await this.page.fill('input[name="description"]', description);

    // 仕訳明細入力
    for (let i = 0; i < lines.length; i++) {
      await this.setJournalLine(i, lines[i]);
    }

    // 作成ボタンクリック
    await this.page.click('button:has-text("作成")');

    // ダイアログが閉じるまで待機
    await expect(this.page.locator('[role="dialog"]')).toBeHidden();
  }

  /**
   * 仕訳明細の設定
   */
  async setJournalLine(lineIndex: number, line: JournalLine) {
    const lineLocator = this.page.locator(`[data-testid="journal-line-${lineIndex}"]`);

    // 勘定科目選択
    await lineLocator.locator('button[role="combobox"]').click();
    await this.page.click(`[role="option"]:has-text("${line.accountName}")`);

    // 借方・貸方金額入力
    if (line.debitAmount > 0) {
      await lineLocator.locator('input[name*="debit"]').fill(line.debitAmount.toString());
    }
    if (line.creditAmount > 0) {
      await lineLocator.locator('input[name*="credit"]').fill(line.creditAmount.toString());
    }
  }

  /**
   * 仕訳残高の確認
   */
  async expectBalanced() {
    await expect(this.page.locator('text=差額: ¥0')).toBeVisible();
  }

  /**
   * 仕訳の存在確認
   */
  async expectJournalEntryExists(description: string) {
    await expect(this.page.locator(`tr:has-text("${description}")`)).toBeVisible();
  }
}

/**
 * 仕訳明細の型定義
 */
export interface JournalLine {
  accountName: string;
  debitAmount: number;
  creditAmount: number;
}

/**
 * テストユーティリティ関数
 */
export class TestUtils {
  /**
   * ランダムな文字列生成
   */
  static randomString(length: number = 8): string {
    return Math.random()
      .toString(36)
      .substring(2, length + 2);
  }

  /**
   * 現在の日付をYYYY-MM-DD形式で取得
   */
  static getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * 数値をカンマ区切りで表示
   */
  static formatCurrency(amount: number): string {
    return `¥${amount.toLocaleString()}`;
  }
}
