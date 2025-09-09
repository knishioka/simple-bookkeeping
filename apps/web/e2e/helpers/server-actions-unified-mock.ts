/**
 * Server Actions用統一モックマネージャー
 * Issue #353対応: Server Actions移行後のE2Eテストモック戦略
 *
 * このファイルは、REST APIからServer Actionsへの移行後も
 * 既存のテストコードを最小限の変更で動作させるための統一モック層を提供します。
 */

import { Page, BrowserContext } from '@playwright/test';

import { ServerActionsMock } from './server-actions-mock';
import { SupabaseAuth } from './supabase-auth';

/**
 * モック設定オプション（後方互換性のため既存インターフェースを維持）
 */
export interface UnifiedMockOptions {
  enabled?: boolean;
  delay?: number;
  errorRate?: number;
  customResponses?: Record<string, unknown>;
  debug?: boolean;
}

/**
 * モックデータの型定義
 */
interface MockData {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  clear(): void;
}

/**
 * グローバルウィンドウ拡張（型安全性のため）
 */
declare global {
  interface Window {
    __mockOptions?: UnifiedMockOptions;
    __mockData?: MockData;
    __testUser?: Record<string, unknown>;
  }
}

/**
 * Server Actions用統一モックマネージャー
 *
 * 既存のUnifiedMockクラスと同じインターフェースを提供しながら、
 * 内部ではServer Actionsのモックを管理します。
 */
export class ServerActionsUnifiedMock {
  private static globalOptions: UnifiedMockOptions = {};
  private static mockData: Map<string, unknown> = new Map();

  /**
   * グローバルオプション設定
   */
  static setGlobalOptions(options: UnifiedMockOptions): void {
    this.globalOptions = { ...this.globalOptions, ...options };
  }

  /**
   * 全てのモックをセットアップ（既存インターフェース互換）
   */
  static async setupAll(context: BrowserContext, options: UnifiedMockOptions = {}): Promise<void> {
    const mergedOptions = { ...this.globalOptions, ...options };

    if (!mergedOptions.enabled && mergedOptions.enabled !== false) {
      mergedOptions.enabled = true;
    }

    if (!mergedOptions.enabled) {
      return;
    }

    // ページを取得または作成
    let page = context.pages()[0];
    if (!page) {
      page = await context.newPage();
    }

    // Server Actionsのモックをページに注入
    await this.injectServerActionMocks(page, mergedOptions);
  }

  /**
   * Server Actionsのモックを注入
   */
  private static async injectServerActionMocks(
    page: Page,
    options: UnifiedMockOptions
  ): Promise<void> {
    // ページにモック実装を注入
    await page.addInitScript((opts) => {
      // グローバルモックハンドラーを設定
      (window as unknown as { __mockOptions: typeof opts }).__mockOptions = opts;
      (window as unknown as { __mockData: Map<string, unknown> }).__mockData = new Map();

      // fetch をオーバーライドしてServer Actionsの呼び出しをインターセプト
      const originalFetch = window.fetch;
      window.fetch = async function (...args) {
        const [input, init] = args;

        // Server Actionsの呼び出しパターンを検出
        if (typeof input === 'string') {
          // 会計期間のServer Actions
          if (input.includes('accounting-periods')) {
            return handleAccountingPeriodsMock(input, init);
          }

          // 監査ログのServer Actions
          if (input.includes('audit-logs')) {
            return handleAuditLogsMock(input, init);
          }

          // 認証関連のServer Actions
          if (input.includes('auth') || input.includes('supabase')) {
            return handleAuthMock(input, init);
          }
        }

        // モックされていない場合は通常のfetchを実行
        return originalFetch.apply(window, args as Parameters<typeof fetch>);
      };

      // 会計期間のモックハンドラー
      function handleAccountingPeriodsMock(_url: string, _init?: RequestInit) {
        const mockData = (window as unknown as { __mockData: Map<string, unknown> }).__mockData;
        const mockOptions = (window as unknown as { __mockOptions: { delay?: number } })
          .__mockOptions;

        // 遅延シミュレーション
        const delay = mockOptions.delay || 0;

        return new Promise<Response>((resolve) => {
          setTimeout(() => {
            // デフォルトの会計期間データ
            const defaultPeriods = [
              {
                id: 'period-1',
                name: '2024年度',
                start_date: '2024-01-01',
                end_date: '2024-12-31',
                is_active: true,
                is_closed: false,
                organization_id: 'test-org-1',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
              {
                id: 'period-2',
                name: '2025年度',
                start_date: '2025-01-01',
                end_date: '2025-12-31',
                is_active: false,
                is_closed: false,
                organization_id: 'test-org-1',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
            ];

            const periods = mockData.get('accounting-periods') || defaultPeriods;

            resolve(
              new Response(
                JSON.stringify({
                  success: true,
                  data: {
                    items: periods,
                    total: (periods as unknown[]).length,
                    page: 1,
                    limit: 10,
                  },
                }),
                {
                  status: 200,
                  headers: { 'content-type': 'application/json' },
                }
              )
            );
          }, delay);
        });
      }

      // 監査ログのモックハンドラー
      function handleAuditLogsMock(url: string, _init?: RequestInit) {
        const mockData = (window as unknown as { __mockData: Map<string, unknown> }).__mockData;

        // エンティティタイプの取得
        if (url.includes('entity-types')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                success: true,
                data: ['JournalEntry', 'Account', 'User', 'Organization', 'AccountingPeriod'],
              }),
              {
                status: 200,
                headers: { 'content-type': 'application/json' },
              }
            )
          );
        }

        // CSVエクスポート
        if (url.includes('export')) {
          return Promise.resolve(
            new Response(
              'id,date,user,action,entity\n1,2024-01-01,admin@example.com,CREATE,Account',
              {
                status: 200,
                headers: { 'content-type': 'text/csv' },
              }
            )
          );
        }

        // 通常のリスト取得
        const defaultAuditLogs = mockData.get('audit-logs') || [];

        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                items: defaultAuditLogs,
                total: (defaultAuditLogs as unknown[]).length,
                page: 1,
                limit: 10,
              },
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }
          )
        );
      }

      // 認証のモックハンドラー
      function handleAuthMock(_url: string, _init?: RequestInit) {
        const testUser = (window as unknown as { __testUser?: Record<string, unknown> })
          .__testUser || {
          id: 'test-user-id',
          email: 'test@example.com',
          user_metadata: {
            name: 'Test User',
            organization_id: 'test-org-1',
            role: 'admin',
          },
        };

        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                user: testUser,
                session: {
                  access_token: 'test-token',
                  refresh_token: 'test-refresh',
                  expires_at: Date.now() + 3600000,
                },
              },
              error: null,
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }
          )
        );
      }
    }, options);
  }

  /**
   * 認証関連のモック（Supabase対応）
   */
  static async setupAuthMocks(
    context: BrowserContext,
    _options: UnifiedMockOptions = {}
  ): Promise<void> {
    // Supabase認証ヘルパーを使用
    const page = context.pages()[0] || (await context.newPage());
    await SupabaseAuth.setup(context, page, { role: 'admin' });
  }

  /**
   * 勘定科目関連のモック
   */
  static async setupAccountsMocks(
    _context: BrowserContext,
    options: UnifiedMockOptions = {}
  ): Promise<void> {
    const defaultAccounts = options.customResponses?.accounts || [
      { id: '1', code: '101', name: '現金', account_type: 'ASSET', balance: 100000 },
      { id: '2', code: '201', name: '買掛金', account_type: 'LIABILITY', balance: 50000 },
      { id: '3', code: '301', name: '資本金', account_type: 'EQUITY', balance: 1000000 },
      { id: '4', code: '401', name: '売上高', account_type: 'REVENUE', balance: 500000 },
      { id: '5', code: '501', name: '仕入高', account_type: 'EXPENSE', balance: 200000 },
    ];

    this.mockData.set('accounts', defaultAccounts);
  }

  /**
   * 仕訳関連のモック
   */
  static async setupJournalMocks(
    _context: BrowserContext,
    options: UnifiedMockOptions = {}
  ): Promise<void> {
    const defaultJournalEntries = options.customResponses?.journalEntries || [
      {
        id: '1',
        entry_date: '2024-01-15',
        description: '売上計上',
        lines: [
          { account_id: '1', debit_amount: 100000, credit_amount: 0 },
          { account_id: '4', debit_amount: 0, credit_amount: 100000 },
        ],
        status: 'APPROVED',
      },
    ];

    this.mockData.set('journal-entries', defaultJournalEntries);
  }

  /**
   * ダッシュボード関連のモック
   */
  static async setupDashboardMocks(
    _context: BrowserContext,
    options: UnifiedMockOptions = {}
  ): Promise<void> {
    const dashboardData = options.customResponses?.dashboard || {
      summary: {
        totalAssets: 1500000,
        totalLiabilities: 500000,
        totalEquity: 1000000,
        totalRevenue: 2000000,
        totalExpenses: 1500000,
        netIncome: 500000,
        period: '2024-01',
      },
      recentTransactions: [
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
    };

    this.mockData.set('dashboard', dashboardData);
  }

  /**
   * 監査ログ関連のモック
   */
  static async setupAuditLogsMocks(
    _context: BrowserContext,
    options: UnifiedMockOptions = {}
  ): Promise<void> {
    const defaultAuditLogs = options.customResponses?.auditLogs || [];
    this.mockData.set('audit-logs', defaultAuditLogs);
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
  static async disable(_context: BrowserContext): Promise<void> {
    // Server Actionsのモックをクリア
    ServerActionsMock.clearAllMocks();
    this.mockData.clear();
  }

  /**
   * レスポンスをカスタマイズ
   */
  static customizeResponse(endpoint: string, data: unknown): void {
    this.mockData.set(endpoint, data);
    if (!this.globalOptions.customResponses) {
      this.globalOptions.customResponses = {};
    }
    this.globalOptions.customResponses[endpoint] = data;
  }

  /**
   * モックの状態をリセット
   */
  static reset(): void {
    ServerActionsMock.clearAllMocks();
    this.mockData.clear();
    this.globalOptions = {};
  }
}

/**
 * 既存コードとの互換性のため、エクスポート名を維持
 */
export const UnifiedMock = ServerActionsUnifiedMock;

/**
 * テスト環境をセットアップ（既存インターフェース互換）
 */
export async function setupTestEnvironment(
  context: BrowserContext,
  options?: {
    mockEnabled?: boolean;
    delay?: number;
    errorRate?: number;
  }
): Promise<void> {
  await ServerActionsUnifiedMock.setupAll(context, {
    enabled: options?.mockEnabled ?? true,
    delay: options?.delay ?? 0,
    errorRate: options?.errorRate ?? 0,
  });
}

/**
 * 特定のモックセットアップ（既存インターフェース互換）
 */
export async function setupMocks(context: BrowserContext, ...endpoints: string[]): Promise<void> {
  await ServerActionsUnifiedMock.setupSpecificMocks(context, endpoints);
}
