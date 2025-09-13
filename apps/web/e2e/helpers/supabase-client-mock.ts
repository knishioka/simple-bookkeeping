/**
 * Supabaseクライアントモック
 * Issue #390対応: E2Eテストで完全なSupabaseクライアントモックを提供
 *
 * このファイルは、Supabaseクライアントの完全なモックを提供し、
 * データベースクエリやリアルタイム機能を含むすべての機能をモックします。
 */

import { Page, BrowserContext } from '@playwright/test';

interface UserOrganization {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;
  created_at: string;
  updated_at: string;
}

/**
 * Supabase user_organizations テーブルのモックデータ
 */
export const MOCK_USER_ORGANIZATIONS: Record<string, UserOrganization> = {
  admin: {
    id: 'user-org-1',
    user_id: 'test-admin-id',
    organization_id: 'test-org-1',
    role: 'admin',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  accountant: {
    id: 'user-org-2',
    user_id: 'test-accountant-id',
    organization_id: 'test-org-1',
    role: 'accountant',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  viewer: {
    id: 'user-org-3',
    user_id: 'test-viewer-id',
    organization_id: 'test-org-1',
    role: 'viewer',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
};

/**
 * Supabaseクライアントモッククラス
 */
export class SupabaseClientMock {
  /**
   * Supabase REST APIのルートをインターセプト
   */
  static async interceptSupabaseAPI(context: BrowserContext): Promise<void> {
    // Supabase REST APIのパターンをインターセプト
    await context.route('**/rest/v1/**', async (route) => {
      const url = new URL(route.request().url());
      const pathname = url.pathname;

      // user_organizationsテーブルへのクエリをモック
      if (pathname.includes('/user_organizations')) {
        // 認証ヘッダーからユーザーを判定
        const authHeader = route.request().headers()['authorization'];
        let userId = 'test-admin-id'; // デフォルト

        if (authHeader) {
          if (authHeader.includes('viewer')) {
            userId = 'test-viewer-id';
          } else if (authHeader.includes('accountant')) {
            userId = 'test-accountant-id';
          }
        }

        const mockData =
          MOCK_USER_ORGANIZATIONS[
            userId === 'test-admin-id'
              ? 'admin'
              : userId === 'test-viewer-id'
                ? 'viewer'
                : 'accountant'
          ];

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([mockData]),
        });
        return;
      }

      // その他のAPIコールは通常通り処理
      await route.continue();
    });
  }

  /**
   * ページにSupabaseクライアントモックを注入
   */
  static async injectMock(page: Page): Promise<void> {
    // モックを注入する前にページに必要な設定を追加
    await page.addInitScript(() => {
      // 型定義（ブラウザコンテキスト内）
      interface InnerSupabaseUser {
        id: string;
        email: string;
        user_metadata?: {
          name: string;
          organization_id: string;
          role: string;
          permissions?: string[];
        };
      }

      interface InnerSupabaseSession {
        access_token: string;
        refresh_token: string;
        expires_at: number;
        user: InnerSupabaseUser;
      }

      interface InnerQueryResult<T> {
        data: T | null;
        error: Error | null;
      }

      interface MockUserOrganization {
        id: string;
        user_id: string;
        organization_id: string;
        role: string;
        created_at: string;
        updated_at: string;
      }

      // Supabaseクライアントのモック実装
      const createSupabaseClientMock = () => {
        // 現在の認証ユーザー情報を取得
        const getAuthUser = (): InnerSupabaseUser | null => {
          const storageKey = 'supabase.auth.token';
          const tokenData = localStorage.getItem(storageKey);
          if (!tokenData) return null;

          try {
            const session = JSON.parse(tokenData) as InnerSupabaseSession;
            return session.user;
          } catch {
            return null;
          }
        };

        // デバッグログ追加
        const debug = (message: string, data?: unknown) => {
          if (
            typeof window !== 'undefined' &&
            (window as Window & { __DEBUG_SUPABASE_MOCK?: boolean }).__DEBUG_SUPABASE_MOCK
          ) {
            console.log(`[SupabaseMock] ${message}`, data || '');
          }
        };

        // user_organizationsテーブルのモックデータ
        const mockUserOrganizations: Record<string, MockUserOrganization> = {
          'test-admin-id': {
            id: 'user-org-1',
            user_id: 'test-admin-id',
            organization_id: 'test-org-1',
            role: 'admin',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          'test-accountant-id': {
            id: 'user-org-2',
            user_id: 'test-accountant-id',
            organization_id: 'test-org-1',
            role: 'accountant',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          'test-viewer-id': {
            id: 'user-org-3',
            user_id: 'test-viewer-id',
            organization_id: 'test-org-1',
            role: 'viewer',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        };

        // Supabaseクライアントモックオブジェクト
        const supabaseClientMock = {
          auth: {
            getUser: async (): Promise<InnerQueryResult<{ user: InnerSupabaseUser | null }>> => {
              const user = getAuthUser();
              debug('getUser called', { user });
              return {
                data: { user },
                error: null, // エラーを返さない - dataがnullであることで未認証を示す
              };
            },
            getSession: async (): Promise<
              InnerQueryResult<{ session: InnerSupabaseSession | null }>
            > => {
              const storageKey = 'supabase.auth.token';
              const tokenData = localStorage.getItem(storageKey);
              if (!tokenData) {
                return { data: { session: null }, error: null };
              }

              try {
                const session = JSON.parse(tokenData) as InnerSupabaseSession;
                return { data: { session }, error: null };
              } catch {
                return { data: { session: null }, error: null };
              }
            },
            signOut: async (): Promise<{ error: Error | null }> => {
              localStorage.removeItem('supabase.auth.token');
              sessionStorage.clear();
              return { error: null };
            },
            onAuthStateChange: (
              callback: (event: string, session: InnerSupabaseSession | null) => void
            ) => {
              // 初期状態を通知
              const user = getAuthUser();
              if (user) {
                const storageKey = 'supabase.auth.token';
                const tokenData = localStorage.getItem(storageKey);
                if (tokenData) {
                  try {
                    const session = JSON.parse(tokenData) as InnerSupabaseSession;
                    callback('SIGNED_IN', session);
                  } catch {
                    // エラー時は何もしない
                  }
                }
              }

              // クリーンアップ関数を返す
              return {
                data: { subscription: { unsubscribe: () => {} } },
                error: null,
              };
            },
          },
          from: (table: string) => {
            // テーブル別のモック実装
            if (table === 'user_organizations') {
              return {
                select: (_columns?: string) => ({
                  eq: (column: string, value: unknown) => ({
                    single: async (): Promise<
                      InnerQueryResult<MockUserOrganization | Partial<MockUserOrganization>>
                    > => {
                      debug('user_organizations.eq.single called', { column, value, _columns });

                      // 現在のユーザーIDに基づいてデータを返す
                      const user = getAuthUser();
                      if (!user) {
                        debug('No authenticated user');
                        return { data: null, error: null };
                      }

                      // eqの条件に基づいてデータをフィルタ
                      let targetUserId = user.id;
                      if (column === 'user_id' && typeof value === 'string') {
                        targetUserId = value;
                      }

                      const orgData = mockUserOrganizations[targetUserId];
                      debug('Found org data', { targetUserId, orgData });

                      if (!orgData) {
                        return { data: null, error: null };
                      }

                      // columnsが指定されていれば、必要なフィールドのみ返す
                      if (_columns) {
                        const fields = _columns.split(',').map((f) => f.trim());
                        const filteredData = fields.reduce(
                          (acc: Record<string, unknown>, field) => {
                            if (field in orgData) {
                              acc[field] = (orgData as Record<string, unknown>)[field];
                            }
                            return acc;
                          },
                          {}
                        );
                        debug('Returning filtered data', { filteredData });
                        return { data: filteredData as Partial<MockUserOrganization>, error: null };
                      }

                      debug('Returning full org data', { orgData });
                      return { data: orgData, error: null };
                    },
                    limit: (_n: number) => ({
                      order: (_column: string, _options?: { ascending: boolean }) => ({
                        then: async (
                          resolve: (value: InnerQueryResult<MockUserOrganization[]>) => void
                        ) => {
                          const user = getAuthUser();
                          if (!user) {
                            resolve({ data: [], error: new Error('Not authenticated') });
                            return;
                          }

                          const orgData = mockUserOrganizations[user.id];
                          resolve({ data: orgData ? [orgData] : [], error: null });
                        },
                      }),
                    }),
                  }),
                  filter: (_column: string, _operator: string, _value: unknown) => ({
                    single: async (): Promise<InnerQueryResult<MockUserOrganization | null>> => {
                      const user = getAuthUser();
                      if (!user) {
                        return { data: null, error: new Error('Not authenticated') };
                      }

                      const orgData = mockUserOrganizations[user.id];
                      return { data: orgData || null, error: null };
                    },
                  }),
                }),
              };
            }

            // 他のテーブルのモック（必要に応じて追加）
            return {
              select: () => ({
                eq: () => ({
                  single: async (): Promise<InnerQueryResult<null>> => ({
                    data: null,
                    error: null,
                  }),
                  limit: () => ({
                    order: () => ({
                      then: async (resolve: (value: InnerQueryResult<unknown[]>) => void) => {
                        resolve({ data: [], error: null });
                      },
                    }),
                  }),
                }),
              }),
            };
          },
          storage: {
            from: (_bucket: string) => ({
              upload: async (): Promise<InnerQueryResult<{ path: string }>> => ({
                data: { path: 'mock-path' },
                error: null,
              }),
              download: async (): Promise<InnerQueryResult<Blob>> => ({
                data: new Blob(),
                error: null,
              }),
              remove: async (): Promise<InnerQueryResult<unknown[]>> => ({ data: [], error: null }),
              list: async (): Promise<InnerQueryResult<unknown[]>> => ({ data: [], error: null }),
            }),
          },
          realtime: {
            channel: (_name: string) => ({
              on: () => ({ subscribe: () => {} }),
              subscribe: () => {},
            }),
          },
        };

        return supabaseClientMock;
      };

      // グローバルにcreateClientモックを設定
      (
        window as Window & { __supabaseClientMock?: typeof createSupabaseClientMock }
      ).__supabaseClientMock = createSupabaseClientMock;

      // Next.jsのモジュールシステムをインターセプト
      // createClient関数をグローバルに設定して、モジュールがインポートされたときに使用されるようにする
      (window as Window & { createClient?: typeof createSupabaseClientMock }).createClient =
        createSupabaseClientMock;

      // webpackのrequireシステムをインターセプト (Next.jsの場合)
      if (
        typeof window !== 'undefined' &&
        (window as Window & { __webpack_require__?: unknown }).__webpack_require__
      ) {
        const originalRequire = (
          window as Window & { __webpack_require__: (id: string) => unknown }
        ).__webpack_require__;
        (window as Window & { __webpack_require__: (id: string) => unknown }).__webpack_require__ =
          function (id: string) {
            const module = originalRequire(id);
            // createClient関数を含むモジュールをインターセプト
            if (module && typeof module === 'object' && 'createClient' in module) {
              return { ...module, createClient: createSupabaseClientMock };
            }
            return module;
          };
      }
    });
  }

  /**
   * 特定のテーブルデータを更新
   */
  static async updateMockData(page: Page, table: string, data: unknown): Promise<void> {
    await page.evaluate(
      ({ tableName, tableData }) => {
        const win = window as Window & { __mockTableData?: Record<string, unknown> };
        win.__mockTableData = win.__mockTableData || {};
        win.__mockTableData[tableName] = tableData;
      },
      { tableName: table, tableData: data }
    );
  }

  /**
   * モックをクリア
   */
  static async clearMock(page: Page): Promise<void> {
    await page.evaluate(() => {
      const win = window as Window & {
        __originalCreateClient?: unknown;
        createClient?: unknown;
        __mockTableData?: Record<string, unknown>;
      };
      if (win.__originalCreateClient) {
        win.createClient = win.__originalCreateClient;
        delete win.__originalCreateClient;
      }
      delete win.__mockTableData;
    });
  }
}
