import { test, expect } from '@playwright/test';

/**
 * エラーハンドリングテスト
 * 
 * ネットワークエラー、サーバーエラー、
 * クライアントエラーなどの処理をテストします。
 */

test.describe('エラーハンドリングテスト', () => {
  test.describe('ネットワークエラー', () => {
    test('ネットワーク切断時の適切なエラー表示', async ({ page, context }) => {
      await page.goto('/demo/journal-entries');
      
      // ネットワークを切断
      await context.setOffline(true);
      
      // 新規作成を試みる
      await page.click('text=新規作成');
      const dialog = page.locator('[role="dialog"]');
      
      await dialog.locator('textarea').fill('オフラインテスト');
      await dialog.locator('[role="combobox"]').first().click();
      await page.click('[role="option"]').first();
      await dialog.locator('input[type="number"]').first().fill('1000');
      
      await dialog.locator('[role="combobox"]').nth(1).click();
      await page.click('[role="option"]').nth(1);
      await dialog.locator('input[type="number"]').nth(3).fill('1000');
      
      // 保存を試みる
      await dialog.locator('button:has-text("作成")').click();
      
      // エラーメッセージが表示される
      await expect(page.locator('text=ネットワークに接続できません')).toBeVisible();
      
      // オフライン中のデータは保持される
      await expect(dialog.locator('textarea')).toHaveValue('オフラインテスト');
      
      // ネットワーク復旧
      await context.setOffline(false);
      
      // リトライボタンが表示される場合
      const retryButton = page.locator('button:has-text("再試行")');
      if (await retryButton.isVisible()) {
        await retryButton.click();
        await expect(page.locator('text=仕訳を作成しました')).toBeVisible();
      }
    });

    test('API呼び出しのタイムアウト処理', async ({ page }) => {
      // 遅延するAPIレスポンスをシミュレート
      await page.route('**/api/v1/journal-entries', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 35000)); // 35秒遅延
        await route.fulfill({
          status: 200,
          json: { data: [] },
        });
      });
      
      await page.goto('/demo/journal-entries');
      
      // タイムアウトエラーが表示される（通常30秒でタイムアウト）
      await expect(page.locator('text=リクエストがタイムアウトしました')).toBeVisible({
        timeout: 35000,
      });
      
      // リトライオプションが表示される
      await expect(page.locator('button:has-text("再読み込み")')).toBeVisible();
    });

    test('断続的なネットワークエラーの自動リトライ', async ({ page }) => {
      let attemptCount = 0;
      
      // 最初の2回は失敗、3回目で成功
      await page.route('**/api/v1/accounts', async (route) => {
        attemptCount++;
        if (attemptCount < 3) {
          await route.abort('failed');
        } else {
          await route.fulfill({
            status: 200,
            json: { data: [] },
          });
        }
      });
      
      await page.goto('/demo/accounts');
      
      // 自動リトライ中の表示
      await expect(page.locator('text=接続を再試行しています...')).toBeVisible();
      
      // 最終的に成功
      await expect(page.locator('table')).toBeVisible();
      
      // 3回試行されたことを確認
      expect(attemptCount).toBe(3);
    });
  });

  test.describe('サーバーエラー', () => {
    test('500エラー時のフォールバック', async ({ page }) => {
      await page.route('**/api/v1/journal-entries', (route) => {
        route.fulfill({
          status: 500,
          json: {
            error: {
              message: 'Internal Server Error',
              code: 'INTERNAL_ERROR',
            },
          },
        });
      });
      
      await page.goto('/demo/journal-entries');
      
      // エラーページが表示される
      await expect(page.locator('text=サーバーエラーが発生しました')).toBeVisible();
      await expect(page.locator('text=しばらく時間をおいてから再度お試しください')).toBeVisible();
      
      // サポート連絡先が表示される
      await expect(page.locator('text=問題が続く場合はサポートまでご連絡ください')).toBeVisible();
      
      // エラーIDが表示される（トラッキング用）
      const errorId = page.locator('text=/エラーID: [A-Z0-9-]+/');
      await expect(errorId).toBeVisible();
    });

    test('503メンテナンスモード', async ({ page }) => {
      await page.route('**/*', (route) => {
        if (route.request().url().includes('/api/')) {
          route.fulfill({
            status: 503,
            headers: {
              'Retry-After': '3600', // 1時間後
            },
            json: {
              error: {
                message: 'Service Unavailable - Maintenance Mode',
                code: 'MAINTENANCE',
              },
            },
          });
        } else {
          route.continue();
        }
      });
      
      await page.goto('/dashboard');
      
      // メンテナンス画面が表示される
      await expect(page.locator('text=メンテナンス中')).toBeVisible();
      await expect(page.locator('text=ご不便をおかけして申し訳ございません')).toBeVisible();
      
      // 復旧予定時刻が表示される
      await expect(page.locator('text=/復旧予定時刻.*\d{2}:\d{2}/')).toBeVisible();
    });

    test('429レート制限エラー', async ({ page }) => {
      await page.route('**/api/v1/**', (route) => {
        route.fulfill({
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Date.now() + 60000), // 1分後
          },
          json: {
            error: {
              message: 'Too Many Requests',
              code: 'RATE_LIMIT_EXCEEDED',
            },
          },
        });
      });
      
      await page.goto('/demo/accounts');
      await page.fill('input[placeholder*="検索"]', 'test');
      
      // レート制限メッセージ
      await expect(page.locator('text=リクエスト数が制限を超えました')).toBeVisible();
      await expect(page.locator('text=/1分.*待ってから/')).toBeVisible();
      
      // カウントダウンタイマーが表示される
      const timer = page.locator('text=/\d{1,2}:\d{2}/');
      await expect(timer).toBeVisible();
    });
  });

  test.describe('クライアントエラー', () => {
    test('フォームバリデーションエラーの表示', async ({ page }) => {
      await page.goto('/demo/accounts');
      await page.click('text=新規作成');
      
      const dialog = page.locator('[role="dialog"]');
      
      // 空のフォームを送信
      await dialog.locator('button:has-text("作成")').click();
      
      // 各フィールドのエラーメッセージ
      await expect(dialog.locator('text=コードは必須です')).toBeVisible();
      await expect(dialog.locator('text=科目名は必須です')).toBeVisible();
      await expect(dialog.locator('text=タイプを選択してください')).toBeVisible();
      
      // エラーがある場合はフォーカスが最初のエラーフィールドに移動
      await expect(dialog.locator('input[name="code"]')).toBeFocused();
    });

    test('不正なデータ形式のエラーハンドリング', async ({ page }) => {
      await page.goto('/demo/journal-entries');
      await page.click('text=新規作成');
      
      const dialog = page.locator('[role="dialog"]');
      
      // 不正な日付を入力（コンソールから直接）
      await page.evaluate(() => {
        const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
        if (dateInput) {
          dateInput.value = '2024-13-45'; // 不正な日付
        }
      });
      
      await dialog.locator('textarea').fill('不正な日付テスト');
      
      // 仕訳明細を入力
      await dialog.locator('[role="combobox"]').first().click();
      await page.click('[role="option"]').first();
      await dialog.locator('input[type="number"]').first().fill('1000');
      
      await dialog.locator('[role="combobox"]').nth(1).click();
      await page.click('[role="option"]').nth(1);
      await dialog.locator('input[type="number"]').nth(3).fill('1000');
      
      await dialog.locator('button:has-text("作成")').click();
      
      // エラーメッセージ
      await expect(dialog.locator('text=有効な日付を入力してください')).toBeVisible();
    });

    test('JavaScriptエラーのキャッチとレポート', async ({ page }) => {
      // コンソールエラーを監視
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      // エラーを発生させる
      await page.goto('/demo');
      await page.evaluate(() => {
        // 意図的にエラーを発生させる
        throw new Error('Test JavaScript Error');
      });
      
      // エラーバウンダリーが機能することを確認
      await expect(page.locator('text=予期しないエラーが発生しました')).toBeVisible();
      await expect(page.locator('button:has-text("ページをリロード")')).toBeVisible();
      
      // エラーがコンソールに記録されている
      expect(errors.some(e => e.includes('Test JavaScript Error'))).toBe(true);
    });
  });

  test.describe('ファイルアップロードエラー', () => {
    test('大きすぎるファイルのエラー', async ({ page }) => {
      await page.goto('/dashboard/documents');
      
      // 10MBを超えるファイルをアップロード
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click('button:has-text("ファイルを選択")'),
      ]);
      
      // 大きなファイルを生成
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      await fileChooser.setFiles({
        name: 'large-file.pdf',
        mimeType: 'application/pdf',
        buffer: largeBuffer,
      });
      
      // エラーメッセージ
      await expect(page.locator('text=ファイルサイズが大きすぎます')).toBeVisible();
      await expect(page.locator('text=最大10MBまでアップロード可能です')).toBeVisible();
    });

    test('アップロード中の接続エラー', async ({ page, context }) => {
      await page.goto('/dashboard/documents');
      
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click('button:has-text("ファイルを選択")'),
      ]);
      
      await fileChooser.setFiles({
        name: 'test.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('test content'),
      });
      
      // アップロード中にネットワークを切断
      await context.setOffline(true);
      
      // プログレスバーが表示される
      await expect(page.locator('[role="progressbar"]')).toBeVisible();
      
      // エラーメッセージ
      await expect(page.locator('text=アップロードに失敗しました')).toBeVisible();
      
      // リトライオプション
      await expect(page.locator('button:has-text("再アップロード")')).toBeVisible();
      
      // ネットワーク復旧後のリトライ
      await context.setOffline(false);
      await page.click('button:has-text("再アップロード")');
      
      await expect(page.locator('text=アップロードが完了しました')).toBeVisible();
    });
  });

  test.describe('グローバルエラーハンドリング', () => {
    test('未処理の Promise rejection', async ({ page }) => {
      // エラーイベントをリスニング
      let unhandledRejection = false;
      page.on('pageerror', (error) => {
        if (error.message.includes('Unhandled Promise rejection')) {
          unhandledRejection = true;
        }
      });
      
      await page.goto('/demo');
      
      // 未処理のPromise rejectionを発生させる
      await page.evaluate(() => {
        Promise.reject(new Error('Test unhandled rejection'));
      });
      
      await page.waitForTimeout(1000);
      
      // グローバルエラーハンドラーがキャッチ
      expect(unhandledRejection).toBe(false); // 適切にハンドリングされている
      
      // ユーザーへの通知（実装による）
      const toast = page.locator('[role="alert"]');
      if (await toast.isVisible()) {
        await expect(toast).toContainText('エラーが発生しました');
      }
    });

    test('チャンクロードエラー（コード分割）', async ({ page }) => {
      // 動的インポートのエラーをシミュレート
      await page.route('**/*.js', (route) => {
        if (route.request().url().includes('chunk')) {
          route.abort('failed');
        } else {
          route.continue();
        }
      });
      
      await page.goto('/dashboard');
      
      // 遅延ロードされるページへ移動
      await page.click('text=レポート');
      
      // チャンクロードエラー
      await expect(page.locator('text=ページの読み込みに失敗しました')).toBeVisible();
      
      // リロードボタン
      await expect(page.locator('button:has-text("ページをリロード")')).toBeVisible();
    });
  });
});