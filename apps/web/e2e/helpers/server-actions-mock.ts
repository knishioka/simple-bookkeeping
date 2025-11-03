/**
 * Server Actions Mock Helper
 * Issue #353対応: Server Actions用のE2Eテストモック基盤
 *
 * Server Actionsは通常のREST APIと異なり、Next.jsの内部メカニズムで動作するため、
 * ネットワークレベルでのインターセプトができません。
 * このヘルパーは、Server Actionsをテスト環境でモックするための基盤を提供します。
 */

import { Page } from '@playwright/test';

/**
 * Server Action のモックレスポンス定義
 */
export interface MockedAction<T = unknown> {
  modulePath: string;
  actionName: string;
  mockImplementation: (...args: unknown[]) => Promise<T>;
}

/**
 * Server Actions モックマネージャー
 *
 * このクラスは、Server Actionsをブラウザコンテキストでモックするための
 * 戦略を提供します。実際のServer Actionsの代わりに、
 * クライアントサイドで動作するモック関数を注入します。
 */
export class ServerActionsMock {
  private static mockedActions = new Map<string, MockedAction>();

  /**
   * Server Actionをモック化
   *
   * @param action モック化するアクションの定義
   */
  static registerMock(action: MockedAction): void {
    const key = `${action.modulePath}::${action.actionName}`;
    this.mockedActions.set(key, action);
  }

  /**
   * 複数のServer Actionsをまとめてモック化
   */
  static registerMocks(actions: MockedAction[]): void {
    actions.forEach((action) => this.registerMock(action));
  }

  /**
   * ページにモック関数を注入
   *
   * この関数は、ページのコンテキストでServer Actionsの呼び出しを
   * インターセプトし、モック実装に置き換えます。
   */
  static async injectMocks(page: Page): Promise<void> {
    // モック実装を直接評価して注入（セキュアな方法）
    for (const [key, mock] of this.mockedActions.entries()) {
      await page.evaluate(
        ({ key, mockImpl }) => {
          // グローバルなモックストアを作成（初回のみ）
          if (
            !(window as unknown as { __serverActionMocks?: Map<string, unknown> })
              .__serverActionMocks
          ) {
            (
              window as unknown as { __serverActionMocks: Map<string, unknown> }
            ).__serverActionMocks = new Map();
          }
          // モック関数を直接格納
          (
            window as unknown as { __serverActionMocks: Map<string, unknown> }
          ).__serverActionMocks.set(key, mockImpl);
        },
        { key, mockImpl: mock.mockImplementation }
      );
    }

    await page.addInitScript(() => {
      // Server Actionsの呼び出しをインターセプトする
      // これは、Next.jsがServer Actionsを呼び出す際のフックポイント
      const originalFetch = window.fetch;
      window.fetch = async function (...args) {
        const [url, options] = args;

        // Server Actionの呼び出しパターンを検出
        if (typeof url === 'string' && url.includes('_action')) {
          const body = options?.body;
          if (body && typeof body === 'string') {
            try {
              const parsed = JSON.parse(body);
              const actionId = parsed.actionId || parsed[0];

              // モックが登録されているか確認
              const mockFn = (
                window as unknown as { __serverActionMocks?: Map<string, unknown> }
              ).__serverActionMocks.get(actionId);
              if (mockFn) {
                // モック関数を実行
                const result = await mockFn(...(parsed.args || parsed.slice(1)));

                // Server Actionのレスポンス形式で返す
                return new Response(JSON.stringify(result), {
                  status: 200,
                  headers: { 'content-type': 'application/json' },
                });
              }
            } catch (e) {
              console.error('Failed to intercept Server Action:', e);
            }
          }
        }

        // モックされていない場合は通常のfetchを実行
        return originalFetch.apply(window, args as [RequestInfo | URL, RequestInit?]);
      };
    });
  }

  /**
   * 特定のアクションのモックをクリア
   */
  static clearMock(modulePath: string, actionName: string): void {
    const key = `${modulePath}::${actionName}`;
    this.mockedActions.delete(key);
  }

  /**
   * すべてのモックをクリア
   */
  static clearAllMocks(): void {
    this.mockedActions.clear();
  }

  /**
   * テスト用のデフォルトモックセットを作成
   */
  static setupDefaultMocks(): void {
    // 認証関連のモック
    this.registerMocks([
      {
        modulePath: '@/lib/supabase/server',
        actionName: 'createClient',
        mockImplementation: async () => ({
          auth: {
            getUser: async () => ({
              data: {
                user: {
                  id: 'test-user-id',
                  email: 'test@example.com',
                  user_metadata: {
                    name: 'Test User',
                    organization_id: 'test-org-id',
                    role: 'admin',
                  },
                },
              },
              error: null,
            }),
            signIn: async () => ({ data: { session: {} }, error: null }),
            signOut: async () => ({ error: null }),
          },
          from: (_table: string) => ({
            select: () => ({
              eq: () => ({
                single: async () => ({ data: {}, error: null }),
                limit: () => ({
                  data: [],
                  error: null,
                }),
              }),
              order: () => ({
                limit: () => ({
                  data: [],
                  error: null,
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: async () => ({ data: {}, error: null }),
              }),
            }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: async () => ({ data: {}, error: null }),
                }),
              }),
            }),
            delete: () => ({
              eq: () => ({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      },
    ]);
  }
}

/**
 * Server Actions用のテストデータビルダー
 */
export class TestDataBuilder {
  /**
   * 会計期間のテストデータを生成
   */
  static createAccountingPeriod(overrides = {}) {
    return {
      id: 'period-1',
      name: '2024年度',
      start_date: '2024-01-01',
      end_date: '2024-12-31',
      is_active: true,
      is_closed: false,
      organization_id: 'test-org-id',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * 監査ログのテストデータを生成
   */
  static createAuditLog(overrides = {}) {
    return {
      id: 'audit-1',
      entity_type: 'AccountingPeriod',
      entity_id: 'period-1',
      action: 'CREATE',
      changes: {},
      user_id: 'test-user-id',
      user_email: 'test@example.com',
      organization_id: 'test-org-id',
      created_at: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * 勘定科目のテストデータを生成
   */
  static createAccount(overrides = {}) {
    return {
      id: 'account-1',
      code: '101',
      name: '現金',
      account_type: 'ASSET',
      is_active: true,
      organization_id: 'test-org-id',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * 仕訳のテストデータを生成
   */
  static createJournalEntry(overrides = {}) {
    return {
      id: 'entry-1',
      entry_date: '2024-01-15',
      description: 'テスト仕訳',
      amount: 10000,
      accounting_period_id: 'period-1',
      organization_id: 'test-org-id',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'test-user-id',
      ...overrides,
    };
  }
}

/**
 * Server Actions のモック実装プロバイダー
 */
export class MockImplementations {
  /**
   * 会計期間関連のServer Actionsモック
   */
  static accountingPeriods = {
    getAccountingPeriods: async () => ({
      success: true,
      data: {
        items: [
          TestDataBuilder.createAccountingPeriod(),
          TestDataBuilder.createAccountingPeriod({
            id: 'period-2',
            name: '2025年度',
            start_date: '2025-01-01',
            end_date: '2025-12-31',
            is_active: false,
          }),
        ],
        total: 2,
        page: 1,
        limit: 10,
      },
    }),

    createAccountingPeriod: async (data: Record<string, unknown>) => ({
      success: true,
      data: TestDataBuilder.createAccountingPeriod({
        ...data,
        id: `period-${Date.now()}`,
      }),
    }),

    updateAccountingPeriod: async (id: string, data: Record<string, unknown>) => ({
      success: true,
      data: TestDataBuilder.createAccountingPeriod({
        id,
        ...data,
        updated_at: new Date().toISOString(),
      }),
    }),

    deleteAccountingPeriod: async (id: string) => ({
      success: true,
      data: { id },
    }),

    closeAccountingPeriod: async (id: string) => ({
      success: true,
      data: TestDataBuilder.createAccountingPeriod({
        id,
        is_active: false,
        is_closed: true,
      }),
    }),

    reopenAccountingPeriod: async (id: string) => ({
      success: true,
      data: TestDataBuilder.createAccountingPeriod({
        id,
        is_active: true,
        is_closed: false,
      }),
    }),

    activateAccountingPeriod: async (id: string) => ({
      success: true,
      data: TestDataBuilder.createAccountingPeriod({
        id,
        is_active: true,
      }),
    }),
  };

  /**
   * 監査ログ関連のServer Actionsモック
   */
  static auditLogs = {
    getAuditLogs: async () => ({
      success: true,
      data: {
        items: [
          TestDataBuilder.createAuditLog(),
          TestDataBuilder.createAuditLog({
            id: 'audit-2',
            action: 'UPDATE',
          }),
        ],
        total: 2,
        page: 1,
        limit: 10,
      },
    }),

    getEntityTypes: async () => ({
      success: true,
      data: ['AccountingPeriod', 'Account', 'JournalEntry', 'User', 'Organization'],
    }),

    exportAuditLogs: async () => ({
      success: true,
      data: 'id,entity_type,action,user_email,created_at\n1,AccountingPeriod,CREATE,test@example.com,2024-01-01',
    }),

    auditEntityChange: async () => ({
      success: true,
      data: {
        id: `audit-${Date.now()}`,
        action: 'UPDATE',
      },
    }),
  };
}

/**
 * E2Eテスト用のヘルパー関数
 */

/**
 * Server Actionsモックを使用したテスト環境のセットアップ
 */
export async function setupServerActionsTest(
  page: Page,
  options: {
    mockAuth?: boolean;
    mockAccountingPeriods?: boolean;
    mockAuditLogs?: boolean;
    customMocks?: MockedAction[];
  } = {}
): Promise<void> {
  const {
    mockAuth = true,
    mockAccountingPeriods = false,
    mockAuditLogs = false,
    customMocks = [],
  } = options;

  // デフォルトの認証モックを設定
  if (mockAuth) {
    ServerActionsMock.setupDefaultMocks();
  }

  // 会計期間のモックを設定
  if (mockAccountingPeriods) {
    ServerActionsMock.registerMocks([
      {
        modulePath: '@/app/actions/accounting-periods',
        actionName: 'getAccountingPeriods',
        mockImplementation: MockImplementations.accountingPeriods.getAccountingPeriods,
      },
      {
        modulePath: '@/app/actions/accounting-periods',
        actionName: 'createAccountingPeriod',
        mockImplementation: MockImplementations.accountingPeriods.createAccountingPeriod,
      },
      {
        modulePath: '@/app/actions/accounting-periods',
        actionName: 'updateAccountingPeriod',
        mockImplementation: MockImplementations.accountingPeriods.updateAccountingPeriod,
      },
      {
        modulePath: '@/app/actions/accounting-periods',
        actionName: 'deleteAccountingPeriod',
        mockImplementation: MockImplementations.accountingPeriods.deleteAccountingPeriod,
      },
      {
        modulePath: '@/app/actions/accounting-periods',
        actionName: 'closeAccountingPeriod',
        mockImplementation: MockImplementations.accountingPeriods.closeAccountingPeriod,
      },
      {
        modulePath: '@/app/actions/accounting-periods',
        actionName: 'reopenAccountingPeriod',
        mockImplementation: MockImplementations.accountingPeriods.reopenAccountingPeriod,
      },
      {
        modulePath: '@/app/actions/accounting-periods',
        actionName: 'activateAccountingPeriod',
        mockImplementation: MockImplementations.accountingPeriods.activateAccountingPeriod,
      },
    ]);
  }

  // 監査ログのモックを設定
  if (mockAuditLogs) {
    ServerActionsMock.registerMocks([
      {
        modulePath: '@/app/actions/audit-logs',
        actionName: 'getAuditLogs',
        mockImplementation: MockImplementations.auditLogs.getAuditLogs,
      },
      {
        modulePath: '@/app/actions/audit-logs',
        actionName: 'getEntityTypes',
        mockImplementation: MockImplementations.auditLogs.getEntityTypes,
      },
      {
        modulePath: '@/app/actions/audit-logs',
        actionName: 'exportAuditLogs',
        mockImplementation: MockImplementations.auditLogs.exportAuditLogs,
      },
      {
        modulePath: '@/app/actions/audit-logs',
        actionName: 'auditEntityChange',
        mockImplementation: MockImplementations.auditLogs.auditEntityChange,
      },
    ]);
  }

  // カスタムモックを登録
  if (customMocks.length > 0) {
    ServerActionsMock.registerMocks(customMocks);
  }

  // ページにモックを注入
  await ServerActionsMock.injectMocks(page);
}

/**
 * テスト後のクリーンアップ
 */
export function cleanupServerActionsTest(): void {
  ServerActionsMock.clearAllMocks();
}
