import { Page } from '@playwright/test';

import { TestAccountsList, TestJournalEntriesList, DashboardTestData } from './test-data';

/**
 * E2Eテスト用のAPIモックレスポンス管理
 *
 * 一貫したモックデータを提供し、テストの独立性を保証します。
 */

export class MockResponseManager {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * 全ての基本的なAPIエンドポイントをモック
   */
  async setupBasicMocks(): Promise<void> {
    await this.mockAccountsAPI();
    await this.mockJournalEntriesAPI();
    await this.mockDashboardAPI();
  }

  /**
   * 勘定科目API のモック設定
   */
  async mockAccountsAPI(): Promise<void> {
    // 勘定科目一覧の取得
    await this.page.route('**/api/v1/accounts', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: TestAccountsList,
            meta: {
              total: TestAccountsList.length,
              page: 1,
              limit: 100,
            },
          }),
        });
      }
    });

    // 勘定科目の作成
    await this.page.route('**/api/v1/accounts', async (route) => {
      if (route.request().method() === 'POST') {
        const requestData = route.request().postDataJSON();

        // バリデーションチェック（テスト用）
        if (!requestData.code) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: {
                code: 'VALIDATION_ERROR',
                message: '勘定科目コードを入力してください',
                details: [{ field: 'code', message: 'Code is required' }],
              },
            }),
          });
          return;
        }

        if (!requestData.name) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: {
                code: 'VALIDATION_ERROR',
                message: '勘定科目名を入力してください',
                details: [{ field: 'name', message: 'Name is required' }],
              },
            }),
          });
          return;
        }

        // 重複チェック
        const existingAccount = TestAccountsList.find((acc) => acc.code === requestData.code);
        if (existingAccount) {
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              error: {
                code: 'CONFLICT_ERROR',
                message: '既に存在する勘定科目コードです',
              },
            }),
          });
          return;
        }

        // 成功レスポンス
        const newAccount = {
          id: `550e8400-e29b-41d4-a716-${Date.now()}`,
          ...requestData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: newAccount }),
        });
      }
    });

    // 勘定科目の更新
    await this.page.route('**/api/v1/accounts/*', async (route) => {
      if (route.request().method() === 'PUT') {
        const requestData = route.request().postDataJSON();
        const accountId = route.request().url().split('/').pop();

        const updatedAccount = {
          id: accountId,
          ...requestData,
          updatedAt: new Date().toISOString(),
        };

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: updatedAccount }),
        });
      }
    });

    // 勘定科目の削除
    await this.page.route('**/api/v1/accounts/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 204,
          contentType: 'application/json',
          body: '',
        });
      }
    });
  }

  /**
   * 仕訳入力API のモック設定
   */
  async mockJournalEntriesAPI(): Promise<void> {
    // 仕訳一覧の取得
    await this.page.route('**/api/v1/journal-entries', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: TestJournalEntriesList,
            meta: {
              total: TestJournalEntriesList.length,
              page: 1,
              limit: 50,
            },
          }),
        });
      }
    });

    // 仕訳の作成
    await this.page.route('**/api/v1/journal-entries', async (route) => {
      if (route.request().method() === 'POST') {
        const requestData = route.request().postDataJSON();

        // バリデーション: 借方貸方の合計チェック
        if (requestData.lines) {
          const debitTotal = requestData.lines.reduce(
            (sum: number, line: { debitAmount?: number }) => sum + (line.debitAmount || 0),
            0
          );
          const creditTotal = requestData.lines.reduce(
            (sum: number, line: { creditAmount?: number }) => sum + (line.creditAmount || 0),
            0
          );

          if (debitTotal !== creditTotal) {
            await route.fulfill({
              status: 400,
              contentType: 'application/json',
              body: JSON.stringify({
                error: {
                  code: 'VALIDATION_ERROR',
                  message: '借方と貸方の合計が一致していません',
                  details: [{ field: 'lines', message: 'Debit and credit totals must match' }],
                },
              }),
            });
            return;
          }
        }

        // 成功レスポンス
        const newEntry = {
          id: `660e8400-e29b-41d4-a716-${Date.now()}`,
          entryNumber: `JE-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
          ...requestData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ data: newEntry }),
        });
      }
    });
  }

  /**
   * ダッシュボードAPI のモック設定
   */
  async mockDashboardAPI(): Promise<void> {
    // ダッシュボードサマリー
    await this.page.route('**/api/v1/dashboard/summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: DashboardTestData.summary,
        }),
      });
    });

    // 売上推移データ
    await this.page.route('**/api/v1/dashboard/revenue-chart', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: DashboardTestData.chartData.dailyRevenue,
        }),
      });
    });
  }

  /**
   * エラーレスポンスのモック設定
   */
  async mockErrorResponses(): Promise<void> {
    // ネットワークエラーのシミュレーション
    await this.page.route('**/api/v1/error-test', async (route) => {
      await route.abort('failed');
    });

    // サーバーエラーのシミュレーション
    await this.page.route('**/api/v1/server-error-test', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'サーバーで問題が発生しました',
          },
        }),
      });
    });

    // 認証エラーのシミュレーション
    await this.page.route('**/api/v1/auth-error-test', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'セッションが期限切れです',
          },
        }),
      });
    });
  }

  /**
   * 遅延レスポンスのモック設定（パフォーマンステスト用）
   */
  async mockSlowResponses(delayMs: number = 2000): Promise<void> {
    await this.page.route('**/api/v1/slow-test', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { message: 'Slow response completed' } }),
      });
    });
  }

  /**
   * 認証関連のモック設定
   */
  async mockAuthAPI(): Promise<void> {
    // ログイン
    await this.page.route('**/api/v1/auth/login', async (route) => {
      const requestData = route.request().postDataJSON();

      if (requestData.email === 'test@example.com' && requestData.password === 'password') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              token: 'mock-jwt-token',
              refreshToken: 'mock-refresh-token',
              user: {
                id: 'user-123',
                email: 'test@example.com',
                name: 'テストユーザー',
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
              message: 'メールアドレスまたはパスワードが正しくありません',
            },
          }),
        });
      }
    });

    // トークンリフレッシュ
    await this.page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            token: 'new-mock-jwt-token',
            refreshToken: 'new-mock-refresh-token',
          },
        }),
      });
    });
  }

  /**
   * 特定のエンドポイントのモックを削除
   */
  async removeMock(pattern: string): Promise<void> {
    await this.page.unroute(pattern);
  }

  /**
   * すべてのモックを削除
   */
  async removeAllMocks(): Promise<void> {
    await this.page.unrouteAll();
  }

  /**
   * カスタムレスポンスの設定
   */
  async mockCustomResponse(
    pattern: string,
    response: {
      status: number;
      body: unknown;
      headers?: Record<string, string>;
    }
  ): Promise<void> {
    await this.page.route(pattern, async (route) => {
      await route.fulfill({
        status: response.status,
        contentType: 'application/json',
        headers: response.headers,
        body: JSON.stringify(response.body),
      });
    });
  }
}
