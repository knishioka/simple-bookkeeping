import { test, expect } from '@playwright/test';

import { UnifiedAuth } from './helpers/unified-auth';

/**
 * 仕訳入力機能の包括的なE2Eテスト
 * Issue #182: スキップされているテストの有効化とカバレッジ向上
 */
test.describe('仕訳入力機能', () => {
  test.use({ navigationTimeout: 10000 });

  test.beforeEach(async ({ page, context }) => {
    // 統一ヘルパーで認証とモックをセットアップ
    await UnifiedAuth.setupMockRoutes(context);
    await UnifiedAuth.setAuthData(page);
  });

  test('仕訳一覧ページが表示される', async ({ page, context }) => {
    // Mock journal entries API
    await context.route('**/api/v1/journal-entries', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'je-1',
                entryDate: '2024-01-15',
                description: '売上計上',
                totalAmount: 100000,
                status: 'posted',
                lines: [
                  {
                    id: 'jel-1',
                    accountId: 'acc-1',
                    accountName: '現金',
                    debitAmount: 100000,
                    creditAmount: 0,
                  },
                  {
                    id: 'jel-2',
                    accountId: 'acc-2',
                    accountName: '売上高',
                    debitAmount: 0,
                    creditAmount: 100000,
                  },
                ],
                createdAt: '2024-01-15T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z',
              },
            ],
            meta: {
              total: 1,
              page: 1,
              perPage: 20,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/dashboard/journal-entries', { waitUntil: 'domcontentloaded' });

    // ページが正しく表示されることを確認
    await expect(page).toHaveURL('/dashboard/journal-entries');

    // 仕訳データが表示されることを確認
    await expect(page.locator('text=売上計上')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=100,000')).toBeVisible();
  });

  test('新規仕訳を作成できる', async ({ page, context }) => {
    let entryCreated = false;

    // Mock APIs
    await context.route('**/api/v1/journal-entries', async (route) => {
      if (route.request().method() === 'POST') {
        entryCreated = true;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: 'je-new',
              entryDate: '2024-01-20',
              description: '備品購入',
              totalAmount: 50000,
              status: 'posted',
              lines: [
                {
                  id: 'jel-new-1',
                  accountId: 'acc-3',
                  accountName: '備品',
                  debitAmount: 50000,
                  creditAmount: 0,
                },
                {
                  id: 'jel-new-2',
                  accountId: 'acc-1',
                  accountName: '現金',
                  debitAmount: 0,
                  creditAmount: 50000,
                },
              ],
              createdAt: '2024-01-20T00:00:00Z',
              updatedAt: '2024-01-20T00:00:00Z',
            },
          }),
        });
      } else if (route.request().method() === 'GET') {
        const entries = [];
        if (entryCreated) {
          entries.push({
            id: 'je-new',
            entryDate: '2024-01-20',
            description: '備品購入',
            totalAmount: 50000,
            status: 'posted',
          });
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: entries,
            meta: { total: entries.length, page: 1, perPage: 20 },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock accounts API
    await context.route('**/api/v1/accounts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'acc-1', code: '1000', name: '現金', accountType: 'ASSET' },
            { id: 'acc-2', code: '4000', name: '売上高', accountType: 'REVENUE' },
            { id: 'acc-3', code: '1500', name: '備品', accountType: 'ASSET' },
          ],
        }),
      });
    });

    await page.goto('/dashboard/journal-entries', { waitUntil: 'domcontentloaded' });

    // 新規作成ボタンをクリック
    await page.click('button:has-text("新規作成")');

    // ダイアログが開くのを待つ
    await page.waitForTimeout(500);

    // フォームに入力
    const dateInput = page.locator('input[name="entryDate"]').first();
    await dateInput.waitFor({ state: 'visible', timeout: 10000 });
    await dateInput.fill('2024-01-20');

    await page.fill('input[name="description"]', '備品購入');

    // 仕訳明細の入力（簡略化）
    await page.locator('select[name="lines.0.accountId"]').selectOption('acc-3');
    await page.fill('input[name="lines.0.debitAmount"]', '50000');

    await page.locator('select[name="lines.1.accountId"]').selectOption('acc-1');
    await page.fill('input[name="lines.1.creditAmount"]', '50000');

    // 送信
    await page.click('button[type="submit"]:has-text("作成")');

    // 作成された仕訳が表示されることを確認
    await page.waitForTimeout(1000);
    await expect(page.locator('text=備品購入')).toBeVisible({ timeout: 10000 });
  });

  test.describe('ユーザー操作のテスト', () => {
    test('仕訳の編集機能', async ({ page, context }) => {
      let entryUpdated = false;

      // Mock APIs
      await context.route('**/api/v1/journal-entries**', async (route) => {
        const url = route.request().url();
        const method = route.request().method();

        if (url.includes('/journal-entries/je-1') && method === 'PUT') {
          entryUpdated = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                id: 'je-1',
                entryDate: '2024-01-15',
                description: '売上計上（修正）',
                totalAmount: 100000,
                status: 'posted',
                createdAt: '2024-01-15T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z',
              },
            }),
          });
        } else if (url.endsWith('/journal-entries') && method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [
                {
                  id: 'je-1',
                  entryDate: '2024-01-15',
                  description: entryUpdated ? '売上計上（修正）' : '売上計上',
                  totalAmount: 100000,
                  status: 'posted',
                },
              ],
              meta: { total: 1, page: 1, perPage: 20 },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/dashboard/journal-entries', { waitUntil: 'domcontentloaded' });

      // 編集ボタンをクリック
      await page.waitForSelector('text=売上計上', { timeout: 10000 });
      await page.locator('tr:has-text("売上計上")').locator('button:has(svg)').first().click();

      // ダイアログが開くのを待つ
      await page.waitForTimeout(500);

      // 説明を編集
      const descInput = page.locator('input[name="description"]').first();
      await descInput.waitFor({ state: 'visible', timeout: 10000 });
      await descInput.fill('売上計上（修正）');

      // 更新ボタンをクリック
      await page.click('button[type="submit"]:has-text("更新")');

      // 更新された内容が表示されることを確認
      await page.waitForTimeout(1000);
      await page.reload();
      await expect(page.locator('text=売上計上（修正）')).toBeVisible({ timeout: 10000 });
    });

    test('仕訳の削除機能', async ({ page, context }) => {
      let entryDeleted = false;

      // Mock APIs
      await context.route('**/api/v1/journal-entries**', async (route) => {
        const url = route.request().url();
        const method = route.request().method();

        if (url.includes('/journal-entries/je-1') && method === 'DELETE') {
          entryDeleted = true;
          await route.fulfill({
            status: 204,
          });
        } else if (url.endsWith('/journal-entries') && method === 'GET') {
          const entries = entryDeleted
            ? []
            : [
                {
                  id: 'je-1',
                  entryDate: '2024-01-15',
                  description: '売上計上',
                  totalAmount: 100000,
                  status: 'posted',
                },
              ];
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: entries,
              meta: { total: entries.length, page: 1, perPage: 20 },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/dashboard/journal-entries', { waitUntil: 'domcontentloaded' });

      // 削除ボタンをクリック
      await page.waitForSelector('text=売上計上', { timeout: 10000 });
      await page.locator('tr:has-text("売上計上")').locator('button').last().click();

      // 確認ダイアログで削除を確認
      await page.waitForSelector('text=仕訳を削除しますか', { timeout: 10000 });
      await page.locator('button:has-text("削除")').last().click();

      // 仕訳が削除されたことを確認
      await page.waitForTimeout(1000);
      await expect(page.locator('text=売上計上')).not.toBeVisible({ timeout: 10000 });
    });

    test('複数行の仕訳入力', async ({ page, context }) => {
      // Mock accounts API
      await context.route('**/api/v1/accounts', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              { id: 'acc-1', code: '1000', name: '現金', accountType: 'ASSET' },
              { id: 'acc-2', code: '1100', name: '売掛金', accountType: 'ASSET' },
              { id: 'acc-3', code: '4000', name: '売上高', accountType: 'REVENUE' },
              { id: 'acc-4', code: '2000', name: '消費税預り金', accountType: 'LIABILITY' },
            ],
          }),
        });
      });

      // Mock journal entry creation
      await context.route('**/api/v1/journal-entries', async (route) => {
        if (route.request().method() === 'POST') {
          const reqBody = route.request().postDataJSON();
          // 複数行の検証
          if (reqBody && reqBody.lines && reqBody.lines.length > 2) {
            await route.fulfill({
              status: 201,
              contentType: 'application/json',
              body: JSON.stringify({
                data: {
                  id: 'je-multi',
                  entryDate: reqBody.entryDate,
                  description: reqBody.description,
                  totalAmount: 110000,
                  status: 'posted',
                  lines: reqBody.lines,
                  createdAt: '2024-01-20T00:00:00Z',
                  updatedAt: '2024-01-20T00:00:00Z',
                },
              }),
            });
          } else {
            await route.continue();
          }
        } else if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [],
              meta: { total: 0, page: 1, perPage: 20 },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.goto('/dashboard/journal-entries', { waitUntil: 'domcontentloaded' });

      // 新規作成ボタンをクリック
      await page.click('button:has-text("新規作成")');

      // ダイアログが開くのを待つ
      await page.waitForTimeout(500);

      // フォームに入力
      const dateInput = page.locator('input[name="entryDate"]').first();
      await dateInput.waitFor({ state: 'visible', timeout: 10000 });
      await dateInput.fill('2024-01-20');

      await page.fill('input[name="description"]', '売上（税込）');

      // 借方: 現金 110,000円
      await page.locator('select[name="lines.0.accountId"]').selectOption('acc-1');
      await page.fill('input[name="lines.0.debitAmount"]', '110000');

      // 貸方: 売上高 100,000円
      await page.locator('select[name="lines.1.accountId"]').selectOption('acc-3');
      await page.fill('input[name="lines.1.creditAmount"]', '100000');

      // 行を追加
      await page.click('button:has-text("行を追加")');

      // 貸方: 消費税預り金 10,000円
      await page.locator('select[name="lines.2.accountId"]').selectOption('acc-4');
      await page.fill('input[name="lines.2.creditAmount"]', '10000');

      // 送信
      await page.click('button[type="submit"]:has-text("作成")');

      // 成功メッセージまたは作成された仕訳を確認
      await page.waitForTimeout(1000);
      const success =
        (await page.locator('text=作成しました').count()) > 0 ||
        (await page.locator('text=売上（税込）').count()) > 0;
      expect(success).toBeTruthy();
    });
  });

  test('借方と貸方の合計が一致しない場合のバリデーション', async ({ page, context }) => {
    // Mock accounts API
    await context.route('**/api/v1/accounts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'acc-1', code: '1000', name: '現金', accountType: 'ASSET' },
            { id: 'acc-2', code: '4000', name: '売上高', accountType: 'REVENUE' },
          ],
        }),
      });
    });

    // Mock journal entries API
    await context.route('**/api/v1/journal-entries', async (route) => {
      if (route.request().method() === 'POST') {
        // バリデーションエラーを返す
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: '借方と貸方の合計が一致しません',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
            meta: { total: 0, page: 1, perPage: 20 },
          }),
        });
      }
    });

    await page.goto('/dashboard/journal-entries', { waitUntil: 'domcontentloaded' });

    // 新規作成ボタンをクリック
    await page.click('button:has-text("新規作成")');

    // ダイアログが開くのを待つ
    await page.waitForTimeout(500);

    // 不正なデータを入力（借方と貸方が不一致）
    const dateInput = page.locator('input[name="entryDate"]').first();
    await dateInput.waitFor({ state: 'visible', timeout: 10000 });
    await dateInput.fill('2024-01-20');

    await page.fill('input[name="description"]', '不正な仕訳');

    await page.locator('select[name="lines.0.accountId"]').selectOption('acc-1');
    await page.fill('input[name="lines.0.debitAmount"]', '100000');

    await page.locator('select[name="lines.1.accountId"]').selectOption('acc-2');
    await page.fill('input[name="lines.1.creditAmount"]', '50000'); // 不一致

    // 送信
    await page.click('button[type="submit"]:has-text("作成")');

    // エラーメッセージが表示されることを確認
    await expect(page.locator('text=借方と貸方の合計が一致しません')).toBeVisible({
      timeout: 10000,
    });
  });

  test('仕訳の検索とフィルタリング', async ({ page, context }) => {
    // Mock journal entries API with filtering
    await context.route('**/api/v1/journal-entries**', async (route) => {
      const url = new URL(route.request().url());
      const search = url.searchParams.get('search');

      let entries = [
        {
          id: 'je-1',
          entryDate: '2024-01-15',
          description: '売上計上',
          totalAmount: 100000,
          status: 'posted',
        },
        {
          id: 'je-2',
          entryDate: '2024-01-20',
          description: '仕入計上',
          totalAmount: 50000,
          status: 'posted',
        },
        {
          id: 'je-3',
          entryDate: '2024-01-25',
          description: '経費精算',
          totalAmount: 30000,
          status: 'posted',
        },
      ];

      // 検索フィルタリング
      if (search) {
        entries = entries.filter((e) => e.description.includes(search));
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: entries,
          meta: { total: entries.length, page: 1, perPage: 20 },
        }),
      });
    });

    await page.goto('/dashboard/journal-entries', { waitUntil: 'domcontentloaded' });

    // 全件が表示されることを確認
    await expect(page.locator('text=売上計上')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=仕入計上')).toBeVisible();
    await expect(page.locator('text=経費精算')).toBeVisible();

    // 検索フィールドに入力
    await page.fill('input[placeholder*="検索"]', '売上');
    await page.keyboard.press('Enter');

    // フィルタリング結果を確認
    await page.waitForTimeout(1000);
    await expect(page.locator('text=売上計上')).toBeVisible();
    await expect(page.locator('text=仕入計上')).not.toBeVisible();
    await expect(page.locator('text=経費精算')).not.toBeVisible();
  });

  test('仕訳のページネーション', async ({ page, context }) => {
    // Mock journal entries API with pagination
    await context.route('**/api/v1/journal-entries**', async (route) => {
      const url = new URL(route.request().url());
      const pageParam = url.searchParams.get('page') || '1';
      const currentPage = parseInt(pageParam);

      const allEntries = Array.from({ length: 30 }, (_, i) => ({
        id: `je-${i + 1}`,
        entryDate: '2024-01-15',
        description: `仕訳 ${i + 1}`,
        totalAmount: (i + 1) * 1000,
        status: 'posted',
      }));

      const perPage = 10;
      const start = (currentPage - 1) * perPage;
      const entries = allEntries.slice(start, start + perPage);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: entries,
          meta: {
            total: allEntries.length,
            page: currentPage,
            perPage,
            totalPages: 3,
          },
        }),
      });
    });

    await page.goto('/dashboard/journal-entries', { waitUntil: 'domcontentloaded' });

    // 最初のページの内容を確認
    await expect(page.locator('text=仕訳 1')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=仕訳 10')).toBeVisible();
    await expect(page.locator('text=仕訳 11')).not.toBeVisible();

    // 次のページへ移動
    await page.click('button:has-text("次へ")');
    await page.waitForTimeout(1000);

    // 2ページ目の内容を確認
    await expect(page.locator('text=仕訳 11')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=仕訳 20')).toBeVisible();
    await expect(page.locator('text=仕訳 1')).not.toBeVisible();
  });
});
