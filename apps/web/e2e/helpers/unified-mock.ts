/**
 * 統一モックマネージャー
 * Issue #95対応: E2Eテスト全体で使用する統一されたモック戦略
 */

import { BrowserContext, Route } from '@playwright/test';

/**
 * モック設定オプション
 */
export interface UnifiedMockOptions {
  /** モックを有効にするかどうか */
  enabled?: boolean;
  /** 遅延時間（ミリ秒） - 実際のAPIレスポンス時間をシミュレート */
  delay?: number;
  /** エラーレートシミュレーション（0-1） */
  errorRate?: number;
  /** カスタムレスポンスデータ */
  customResponses?: Record<string, unknown>;
  /** デバッグモード */
  debug?: boolean;
}

/**
 * APIエンドポイント定義
 */
export interface ApiEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: (route: Route) => Promise<void>;
}

/**
 * 統一モックマネージャークラス
 */
export class UnifiedMock {
  private static endpoints: Map<string, ApiEndpoint[]> = new Map();
  private static globalOptions: UnifiedMockOptions = {};

  /**
   * グローバルオプション設定
   */
  static setGlobalOptions(options: UnifiedMockOptions): void {
    this.globalOptions = { ...this.globalOptions, ...options };
  }

  /**
   * 全てのモックをセットアップ（推奨メソッド）
   */
  static async setupAll(context: BrowserContext, options: UnifiedMockOptions = {}): Promise<void> {
    const mergedOptions = { ...this.globalOptions, ...options };

    if (!mergedOptions.enabled && mergedOptions.enabled !== false) {
      mergedOptions.enabled = true; // デフォルトは有効
    }

    if (!mergedOptions.enabled) {
      return; // モックが無効な場合は何もしない
    }

    // 基本的なAPIモック
    await this.setupAuthMocks(context, mergedOptions);
    await this.setupAccountsMocks(context, mergedOptions);
    await this.setupJournalMocks(context, mergedOptions);
    await this.setupDashboardMocks(context, mergedOptions);
    await this.setupAuditLogsMocks(context, mergedOptions);
  }

  /**
   * 認証関連のモック
   */
  static async setupAuthMocks(
    context: BrowserContext,
    options: UnifiedMockOptions = {}
  ): Promise<void> {
    const isCI = !!process.env.CI;

    // CI環境では遅延を無効化してレスポンスを高速化
    if (isCI && !options.delay) {
      options.delay = 0;
    }
    // /auth/me
    await context.route('**/api/v1/auth/me', async (route) => {
      await this.handleRoute(route, options, async () => {
        const authHeader = route.request().headers()['authorization'];
        const isAuthorized = authHeader && authHeader.startsWith('Bearer ');

        if (!isAuthorized) {
          return {
            status: 401,
            body: { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
          };
        }

        return {
          status: 200,
          body: {
            data: {
              user: options.customResponses?.user || {
                id: '1',
                email: 'admin@example.com',
                name: 'Admin User',
                role: 'admin',
                organizationId: 'org-1',
              },
            },
          },
        };
      });
    });

    // /auth/verify
    await context.route('**/api/v1/auth/verify', async (route) => {
      await this.handleRoute(route, options, async () => {
        const authHeader = route.request().headers()['authorization'];
        const isValid = authHeader === 'Bearer test-token-12345';

        return {
          status: 200,
          body: {
            data: {
              valid: isValid,
            },
          },
        };
      });
    });

    // /auth/refresh
    await context.route('**/api/v1/auth/refresh', async (route) => {
      await this.handleRoute(route, options, async () => {
        return {
          status: 200,
          body: {
            data: {
              token: 'test-token-refreshed',
              refreshToken: 'test-refresh-token-new',
            },
          },
        };
      });
    });
  }

  /**
   * 勘定科目関連のモック
   */
  static async setupAccountsMocks(
    context: BrowserContext,
    options: UnifiedMockOptions = {}
  ): Promise<void> {
    const defaultAccounts = [
      { id: '1', code: '101', name: '現金', type: 'ASSET', balance: 100000 },
      { id: '2', code: '201', name: '買掛金', type: 'LIABILITY', balance: 50000 },
      { id: '3', code: '301', name: '資本金', type: 'EQUITY', balance: 1000000 },
      { id: '4', code: '401', name: '売上高', type: 'REVENUE', balance: 500000 },
      { id: '5', code: '501', name: '仕入高', type: 'EXPENSE', balance: 200000 },
    ];

    await context.route('**/api/v1/accounts**', async (route) => {
      await this.handleRoute(route, options, async () => {
        const method = route.request().method();
        const accounts = options.customResponses?.accounts || defaultAccounts;

        if (method === 'GET') {
          return {
            status: 200,
            body: {
              data: accounts,
              meta: {
                total: accounts.length,
                page: 1,
                limit: 100,
              },
            },
          };
        }

        if (method === 'POST') {
          const data = route.request().postDataJSON();
          const newAccount = {
            id: `acc-${Date.now()}`,
            ...data,
            balance: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            status: 201,
            body: { data: newAccount },
          };
        }

        return {
          status: 405,
          body: { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } },
        };
      });
    });
  }

  /**
   * 仕訳関連のモック
   */
  static async setupJournalMocks(
    context: BrowserContext,
    options: UnifiedMockOptions = {}
  ): Promise<void> {
    const defaultJournalEntries = [
      {
        id: '1',
        date: '2024-01-15',
        description: '売上計上',
        lines: [
          { accountId: '1', debitAmount: 100000, creditAmount: 0 },
          { accountId: '4', debitAmount: 0, creditAmount: 100000 },
        ],
        status: 'APPROVED',
      },
    ];

    await context.route('**/api/v1/journal-entries**', async (route) => {
      await this.handleRoute(route, options, async () => {
        const method = route.request().method();
        const entries = options.customResponses?.journalEntries || defaultJournalEntries;

        if (method === 'GET') {
          return {
            status: 200,
            body: {
              data: entries,
              meta: {
                total: entries.length,
                page: 1,
                limit: 50,
              },
            },
          };
        }

        if (method === 'POST') {
          const data = route.request().postDataJSON();

          // バリデーション: 借方と貸方の合計が一致するか
          const totalDebit =
            data.lines?.reduce(
              (sum: number, line: { debitAmount?: number }) => sum + (line.debitAmount || 0),
              0
            ) || 0;
          const totalCredit =
            data.lines?.reduce(
              (sum: number, line: { creditAmount?: number }) => sum + (line.creditAmount || 0),
              0
            ) || 0;

          if (totalDebit !== totalCredit) {
            return {
              status: 400,
              body: {
                error: {
                  code: 'VALIDATION_ERROR',
                  message: '借方と貸方の合計が一致しません',
                },
              },
            };
          }

          const newEntry = {
            id: `je-${Date.now()}`,
            ...data,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          return {
            status: 201,
            body: { data: newEntry },
          };
        }

        return {
          status: 405,
          body: { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } },
        };
      });
    });
  }

  /**
   * ダッシュボード関連のモック
   */
  static async setupDashboardMocks(
    context: BrowserContext,
    options: UnifiedMockOptions = {}
  ): Promise<void> {
    await context.route('**/api/v1/dashboard/**', async (route) => {
      await this.handleRoute(route, options, async () => {
        const url = route.request().url();

        if (url.includes('/summary')) {
          return {
            status: 200,
            body: {
              data: {
                totalAssets: 1500000,
                totalLiabilities: 500000,
                totalEquity: 1000000,
                totalRevenue: 2000000,
                totalExpenses: 1500000,
                netIncome: 500000,
                period: '2024-01',
              },
            },
          };
        }

        if (url.includes('/recent-transactions')) {
          return {
            status: 200,
            body: {
              data: [
                {
                  id: '1',
                  date: '2024-01-20',
                  description: '商品売上',
                  amount: 50000,
                  type: 'income',
                },
                {
                  id: '2',
                  date: '2024-01-19',
                  description: '事務用品購入',
                  amount: 5000,
                  type: 'expense',
                },
              ],
            },
          };
        }

        return {
          status: 404,
          body: { error: { code: 'NOT_FOUND', message: 'Endpoint not found' } },
        };
      });
    });
  }

  /**
   * 監査ログ関連のモック
   */
  static async setupAuditLogsMocks(
    context: BrowserContext,
    options: UnifiedMockOptions = {}
  ): Promise<void> {
    const defaultAuditLogs = options.customResponses?.auditLogs || [];

    await context.route('**/api/v1/audit-logs**', async (route) => {
      await this.handleRoute(route, options, async () => {
        const url = route.request().url();

        if (url.includes('/entity-types')) {
          return {
            status: 200,
            body: {
              data: ['JournalEntry', 'Account', 'User', 'Organization', 'AccountingPeriod'],
            },
          };
        }

        if (url.includes('/export')) {
          return {
            status: 200,
            contentType: 'text/csv',
            body: 'id,date,user,action,entity\n1,2024-01-01,admin@example.com,CREATE,Account',
          };
        }

        // 通常のリスト取得
        return {
          status: 200,
          body: {
            data: defaultAuditLogs,
            meta: {
              page: 1,
              limit: 10,
              total: defaultAuditLogs.length,
              totalPages: Math.ceil(defaultAuditLogs.length / 10) || 1,
            },
          },
        };
      });
    });
  }

  /**
   * ルートハンドラーのヘルパー関数
   */
  private static async handleRoute(
    route: Route,
    options: UnifiedMockOptions,
    handler: () => Promise<{ status?: number; contentType?: string; body: unknown }>
  ): Promise<void> {
    try {
      // デバッグモード
      if (options.debug) {
        console.log(`[Mock] ${route.request().method()} ${route.request().url()}`);
      }

      // エラーレートシミュレーション
      if (options.errorRate && Math.random() < options.errorRate) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Simulated error for testing',
            },
          }),
        });
        return;
      }

      // 遅延シミュレーション
      if (options.delay && options.delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.delay));
      }

      // ハンドラー実行
      const response = await handler();

      // CSVレスポンスの場合
      if (response.contentType === 'text/csv') {
        await route.fulfill({
          status: response.status || 200,
          contentType: response.contentType,
          body: response.body,
        });
        return;
      }

      // 通常のJSONレスポンス
      await route.fulfill({
        status: response.status || 200,
        contentType: 'application/json',
        body: JSON.stringify(response.body),
      });
    } catch (error) {
      console.error('[Mock] Error handling route:', error);
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'MOCK_ERROR',
            message: 'Mock handler error',
          },
        }),
      });
    }
  }

  /**
   * 特定のエンドポイントのみモック
   */
  static async setupSpecificMocks(
    context: BrowserContext,
    endpoints: string[],
    options: UnifiedMockOptions = {}
  ): Promise<void> {
    for (const endpoint of endpoints) {
      switch (endpoint) {
        case 'auth':
          await this.setupAuthMocks(context, options);
          break;
        case 'accounts':
          await this.setupAccountsMocks(context, options);
          break;
        case 'journal':
          await this.setupJournalMocks(context, options);
          break;
        case 'dashboard':
          await this.setupDashboardMocks(context, options);
          break;
        case 'audit-logs':
          await this.setupAuditLogsMocks(context, options);
          break;
      }
    }
  }

  /**
   * モックを無効化
   */
  static async disable(context: BrowserContext): Promise<void> {
    await context.unrouteAll();
  }

  /**
   * レスポンスをカスタマイズ
   */
  static customizeResponse(endpoint: string, data: unknown): void {
    if (!this.globalOptions.customResponses) {
      this.globalOptions.customResponses = {};
    }
    this.globalOptions.customResponses[endpoint] = data;
  }

  /**
   * モックの状態をリセット
   */
  static reset(): void {
    this.endpoints.clear();
    this.globalOptions = {};
  }
}

/**
 * テスト用ヘルパー関数
 */

/**
 * テスト環境をセットアップ
 */
export async function setupTestEnvironment(
  context: BrowserContext,
  options?: {
    mockEnabled?: boolean;
    delay?: number;
    errorRate?: number;
  }
): Promise<void> {
  await UnifiedMock.setupAll(context, {
    enabled: options?.mockEnabled ?? true,
    delay: options?.delay ?? 0,
    errorRate: options?.errorRate ?? 0,
  });
}

/**
 * 特定のモックセットアップ
 */
export async function setupMocks(context: BrowserContext, ...endpoints: string[]): Promise<void> {
  await UnifiedMock.setupSpecificMocks(context, endpoints);
}
