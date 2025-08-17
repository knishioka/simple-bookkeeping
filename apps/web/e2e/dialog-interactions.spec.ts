import { test, expect } from '@playwright/test';

import { UnifiedAuth } from './helpers/unified-auth';

/**
 * ダイアログ操作のE2Eテスト
 * Issue #182: スキップされているテストの有効化とカバレッジ向上
 */
test.describe('ダイアログ操作テスト', () => {
  test.use({ navigationTimeout: 10000 });

  test.beforeEach(async ({ page, context }) => {
    // 統一ヘルパーで認証とモックをセットアップ
    await UnifiedAuth.setupMockRoutes(context);
    await UnifiedAuth.setAuthData(page);
  });

  test.describe('勘定科目ダイアログ', () => {
    test('勘定科目作成ダイアログの開閉', async ({ page, context }) => {
      // Mock accounts API
      await context.route('**/api/v1/accounts', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
            meta: { total: 0 },
          }),
        });
      });

      await page.goto('/dashboard/accounts', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // 新規作成ボタンをクリック - より具体的なセレクタを使用
      const createButton = page
        .locator('button')
        .filter({ has: page.locator('svg') })
        .filter({ hasText: /新規作成|追加/i })
        .first();
      if (await createButton.isVisible()) {
        await createButton.click();
      } else {
        // アイコンのみのボタンの場合
        await page
          .locator('button[aria-label*="作成"], button[aria-label*="追加"], button')
          .first()
          .click();
      }

      // ダイアログが開くことを確認
      await page.waitForTimeout(500);
      const dialog = page.locator('[role="dialog"], .dialog, .modal').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // ダイアログ内にフォーム要素があることを確認
      const dialogHasForm = (await dialog.locator('input').count()) > 0;
      expect(dialogHasForm).toBeTruthy();

      // ESCキーでダイアログを閉じる
      await page.keyboard.press('Escape');

      // ダイアログが閉じることを確認
      await expect(page.locator('dialog[open], [role="dialog"]')).not.toBeVisible({
        timeout: 5000,
      });
    });

    test('勘定科目作成フォームのバリデーション', async ({ page, context }) => {
      // Mock accounts API
      await context.route('**/api/v1/accounts', async (route) => {
        if (route.request().method() === 'POST') {
          const body = route.request().postDataJSON();

          // バリデーションチェック
          if (!body.code || !body.name) {
            await route.fulfill({
              status: 400,
              contentType: 'application/json',
              body: JSON.stringify({
                error: '必須項目が入力されていません',
              }),
            });
          } else if (body.code === '1000') {
            await route.fulfill({
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({
                error: '勘定科目コードが重複しています',
              }),
            });
          } else {
            await route.fulfill({
              status: 201,
              contentType: 'application/json',
              body: JSON.stringify({
                data: {
                  id: 'acc-new',
                  ...body,
                  createdAt: '2024-01-01T00:00:00Z',
                  updatedAt: '2024-01-01T00:00:00Z',
                },
              }),
            });
          }
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [{ id: 'acc-1', code: '1000', name: '現金', accountType: 'ASSET' }],
              meta: { total: 1 },
            }),
          });
        }
      });

      await page.goto('/dashboard/accounts', { waitUntil: 'domcontentloaded' });

      // 新規作成ボタンをクリック
      await page.click('button:has-text("新規作成")');
      await page.waitForTimeout(500);

      // 空のフォームを送信
      await page.click('button[type="submit"]:has-text("作成")');

      // エラーメッセージが表示されることを確認
      await expect(page.locator('text=必須項目が入力されていません')).toBeVisible({
        timeout: 5000,
      });

      // 重複するコードを入力
      await page.fill('input[name="code"]', '1000');
      await page.fill('input[name="name"]', 'テスト勘定科目');
      await page.selectOption('select[name="accountType"]', 'ASSET');
      await page.click('button[type="submit"]:has-text("作成")');

      // 重複エラーが表示されることを確認
      await expect(page.locator('text=勘定科目コードが重複しています')).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe('仕訳ダイアログ', () => {
    test('仕訳作成ダイアログのフォーム送信', async ({ page, context }) => {
      // Mock APIs
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

      await context.route('**/api/v1/journal-entries', async (route) => {
        if (route.request().method() === 'POST') {
          const body = route.request().postDataJSON();

          // 借方と貸方の合計チェック
          let totalDebit = 0;
          let totalCredit = 0;

          if (body.lines) {
            body.lines.forEach((line: any) => {
              totalDebit += line.debitAmount || 0;
              totalCredit += line.creditAmount || 0;
            });
          }

          if (totalDebit !== totalCredit) {
            await route.fulfill({
              status: 400,
              contentType: 'application/json',
              body: JSON.stringify({
                error: '借方と貸方の合計が一致しません',
              }),
            });
          } else {
            await route.fulfill({
              status: 201,
              contentType: 'application/json',
              body: JSON.stringify({
                data: {
                  id: 'je-new',
                  ...body,
                  totalAmount: totalDebit,
                  status: 'posted',
                  createdAt: '2024-01-01T00:00:00Z',
                  updatedAt: '2024-01-01T00:00:00Z',
                },
              }),
            });
          }
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
      await page.waitForTimeout(500);

      // フォームに入力
      const dateInput = page.locator('input[name="entryDate"]').first();
      await dateInput.waitFor({ state: 'visible', timeout: 10000 });
      await dateInput.fill('2024-01-15');

      await page.fill('input[name="description"]', 'テスト仕訳');

      // 仕訳明細の入力
      await page.locator('select[name="lines.0.accountId"]').selectOption('acc-1');
      await page.fill('input[name="lines.0.debitAmount"]', '10000');

      await page.locator('select[name="lines.1.accountId"]').selectOption('acc-2');
      await page.fill('input[name="lines.1.creditAmount"]', '10000');

      // 送信
      await page.click('button[type="submit"]:has-text("作成")');

      // ダイアログが閉じることを確認
      await page.waitForTimeout(1000);
      await expect(page.locator('dialog[open], [role="dialog"]')).not.toBeVisible({
        timeout: 5000,
      });
    });

    test('仕訳ダイアログのバリデーション', async ({ page, context }) => {
      // Mock APIs
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

      await context.route('**/api/v1/journal-entries', async (route) => {
        if (route.request().method() === 'GET') {
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
      await page.waitForTimeout(500);

      // 不完全なフォームを送信
      await page.click('button[type="submit"]:has-text("作成")');

      // バリデーションエラーが表示されることを確認
      const hasError =
        (await page.locator('text=/必須|入力してください/i').count()) > 0 ||
        (await page.locator('.text-destructive, [role="alert"]').count()) > 0;
      expect(hasError).toBeTruthy();

      // 借方と貸方が不一致のデータを入力
      const dateInput = page.locator('input[name="entryDate"]').first();
      await dateInput.waitFor({ state: 'visible', timeout: 10000 });
      await dateInput.fill('2024-01-15');

      await page.fill('input[name="description"]', 'バランス不一致テスト');

      await page.locator('select[name="lines.0.accountId"]').selectOption('acc-1');
      await page.fill('input[name="lines.0.debitAmount"]', '10000');

      await page.locator('select[name="lines.1.accountId"]').selectOption('acc-2');
      await page.fill('input[name="lines.1.creditAmount"]', '5000'); // 不一致

      // 送信
      await page.click('button[type="submit"]:has-text("作成")');

      // エラーメッセージが表示されることを確認
      const balanceError =
        (await page.locator('text=/借方.*貸方.*一致/i').count()) > 0 ||
        (await page.locator('text=/バランス/i').count()) > 0;
      expect(balanceError).toBeTruthy();
    });
  });

  test.describe('確認ダイアログ', () => {
    test('削除確認ダイアログの操作', async ({ page, context }) => {
      // Mock APIs
      await context.route('**/api/v1/accounts', async (route) => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 204,
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [{ id: 'acc-1', code: '1000', name: '現金', accountType: 'ASSET' }],
              meta: { total: 1 },
            }),
          });
        }
      });

      await page.goto('/dashboard/accounts', { waitUntil: 'domcontentloaded' });

      // 削除ボタンをクリック
      await page.waitForSelector('text=現金', { timeout: 10000 });
      await page.locator('tr:has-text("現金")').locator('button').last().click();

      // 確認ダイアログが表示されることを確認
      await expect(page.locator('text=削除しますか')).toBeVisible({ timeout: 5000 });

      // キャンセルボタンをクリック
      await page.click('button:has-text("キャンセル")');

      // ダイアログが閉じることを確認
      await expect(page.locator('text=削除しますか')).not.toBeVisible({ timeout: 5000 });

      // データがまだ存在することを確認
      await expect(page.locator('text=現金')).toBeVisible();

      // 再度削除ボタンをクリック
      await page.locator('tr:has-text("現金")').locator('button').last().click();

      // 削除を確認
      await page.click('button:has-text("削除")');

      // データが削除されることを確認
      await page.waitForTimeout(1000);
      await expect(page.locator('text=現金')).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('モーダルの重複表示', () => {
    test('複数のダイアログが同時に開かないことを確認', async ({ page, context }) => {
      // Mock APIs
      await context.route('**/api/v1/accounts', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [{ id: 'acc-1', code: '1000', name: '現金', accountType: 'ASSET' }],
            meta: { total: 1 },
          }),
        });
      });

      await page.goto('/dashboard/accounts', { waitUntil: 'domcontentloaded' });

      // 編集ダイアログを開く
      await page.waitForSelector('text=現金', { timeout: 10000 });
      await page.locator('tr:has-text("現金")').locator('button:has(svg)').first().click();

      // 編集ダイアログが開いていることを確認
      const editDialog = page.locator('dialog[open], [role="dialog"]');
      await expect(editDialog).toBeVisible({ timeout: 5000 });

      // ダイアログ内に編集フォームがあることを確認
      await expect(editDialog.locator('input[name="name"]')).toBeVisible();

      // 背景をクリックしてもダイアログが閉じないことを確認（モーダル）
      await page.mouse.click(10, 10);
      await page.waitForTimeout(500);
      await expect(editDialog).toBeVisible();

      // ESCキーでダイアログを閉じる
      await page.keyboard.press('Escape');
      await expect(editDialog).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('フォーカス管理', () => {
    test('ダイアログ開閉時のフォーカス管理', async ({ page, context }) => {
      // Mock APIs
      await context.route('**/api/v1/accounts', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
            meta: { total: 0 },
          }),
        });
      });

      await page.goto('/dashboard/accounts', { waitUntil: 'domcontentloaded' });

      // 新規作成ボタンにフォーカス
      const createButton = page.locator('button:has-text("新規作成")');
      await createButton.focus();

      // ボタンがフォーカスされていることを確認
      await expect(createButton).toBeFocused();

      // Enterキーでダイアログを開く
      await page.keyboard.press('Enter');

      // ダイアログが開いたら、最初の入力フィールドにフォーカスが移動することを確認
      await page.waitForTimeout(500);
      const firstInput = page.locator('dialog input, [role="dialog"] input').first();
      await expect(firstInput).toBeFocused({ timeout: 5000 });

      // ESCキーでダイアログを閉じる
      await page.keyboard.press('Escape');

      // フォーカスが元のボタンに戻ることを確認
      await page.waitForTimeout(500);
      await expect(createButton).toBeFocused({ timeout: 5000 });
    });
  });

  test.describe('非同期処理中の状態表示', () => {
    test('送信中のローディング状態', async ({ page, context }) => {
      let requestCount = 0;

      // Mock APIs with delay
      await context.route('**/api/v1/accounts', async (route) => {
        if (route.request().method() === 'POST') {
          requestCount++;
          // 最初のリクエストは遅延させる
          if (requestCount === 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                id: 'acc-new',
                code: '2000',
                name: 'テスト勘定科目',
                accountType: 'ASSET',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              },
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [],
              meta: { total: 0 },
            }),
          });
        }
      });

      await page.goto('/dashboard/accounts', { waitUntil: 'domcontentloaded' });

      // 新規作成ダイアログを開く
      await page.click('button:has-text("新規作成")');
      await page.waitForTimeout(500);

      // フォームに入力
      await page.fill('input[name="code"]', '2000');
      await page.fill('input[name="name"]', 'テスト勘定科目');
      await page.selectOption('select[name="accountType"]', 'ASSET');

      // 送信ボタンをクリック
      const submitButton = page.locator('button[type="submit"]:has-text("作成")');
      await submitButton.click();

      // ローディング状態を確認（ボタンが無効化される、またはローディングインジケータが表示される）
      const isLoading =
        (await submitButton.isDisabled()) ||
        (await page.locator('.animate-spin, [role="status"]').count()) > 0;
      expect(isLoading).toBeTruthy();

      // 処理完了を待つ
      await page.waitForTimeout(3000);

      // ダイアログが閉じることを確認
      await expect(page.locator('dialog[open], [role="dialog"]')).not.toBeVisible({
        timeout: 5000,
      });
    });
  });
});
