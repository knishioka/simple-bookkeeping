import { test, expect } from '@playwright/test';

/**
 * セキュリティテスト
 *
 * 認可、入力検証、XSS/CSRF対策などの
 * セキュリティ機能をテストします。
 */

test.describe('セキュリティテスト', () => {
  test.describe('認可（Authorization）', () => {
    test('権限のないユーザーのアクセス制御', async ({ page, context }) => {
      // 閲覧権限のみのユーザーでログイン
      await context.addCookies([
        {
          name: 'auth-token',
          value: 'viewer-token',
          domain: 'localhost',
          path: '/',
        },
      ]);

      await page.goto('/dashboard/accounts');

      // 作成・編集・削除ボタンが表示されない
      await expect(page.locator('button:has-text("新規作成")')).not.toBeVisible();

      // 直接APIを叩いても拒否される
      const response = await page.request.post('/api/v1/accounts', {
        data: {
          code: '9999',
          name: '不正なアカウント',
          accountType: 'ASSET',
        },
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error.message).toContain('権限がありません');
    });

    test('組織を跨いだデータアクセスの防止', async ({ page, context }) => {
      // 組織Aのユーザーとしてログイン
      await context.addCookies([
        {
          name: 'auth-token',
          value: 'org-a-user-token',
          domain: 'localhost',
          path: '/',
        },
      ]);

      // 組織BのデータにアクセスしようとするP
      const response = await page.request.get('/api/v1/journal-entries/org-b-entry-id');

      expect(response.status()).toBe(404); // 存在しないように見える

      // URLを直接変更してもアクセスできない
      await page.goto('/dashboard/journal-entries/org-b-entry-id');
      await expect(page).toHaveURL('/dashboard/journal-entries'); // リダイレクト
      await expect(page.locator('text=データが見つかりません')).toBeVisible();
    });

    test('管理者権限の適切な制限', async ({ page, context }) => {
      // 一般管理者としてログイン
      await context.addCookies([
        {
          name: 'auth-token',
          value: 'admin-token',
          domain: 'localhost',
          path: '/',
        },
      ]);

      await page.goto('/dashboard/settings');

      // システム設定へのアクセスは制限
      await expect(page.locator('text=システム設定')).not.toBeVisible();

      // スーパー管理者のみの機能にアクセス
      const response = await page.request.post('/api/v1/system/maintenance-mode', {
        data: { enabled: true },
      });

      expect(response.status()).toBe(403);
    });
  });

  test.describe('入力検証', () => {
    test('SQLインジェクション対策', async ({ page }) => {
      await page.goto('/demo/accounts');

      // 悪意のある入力
      const maliciousInputs = [
        "'; DROP TABLE accounts; --",
        "1' OR '1'='1",
        "admin'--",
        "<script>alert('XSS')</script>",
      ];

      for (const input of maliciousInputs) {
        await page.fill('input[placeholder*="検索"]', input);
        await page.waitForTimeout(500); // デバウンス待機

        // エラーが発生しないことを確認
        await expect(page.locator('text=エラーが発生しました')).not.toBeVisible();

        // 正常に（0件として）処理される
        await expect(page.locator('text=検索結果: 0件')).toBeVisible();
      }
    });

    test('XSS対策 - スクリプトインジェクション防止', async ({ page }) => {
      await page.goto('/demo/journal-entries');
      await page.click('text=新規作成');

      const dialog = page.locator('[role="dialog"]');

      // 悪意のあるスクリプトを含む入力
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror="alert(\'XSS\')">',
        'javascript:alert("XSS")',
        '<svg onload="alert(\'XSS\')">',
      ];

      for (const payload of xssPayloads) {
        await dialog.locator('textarea').fill(payload);

        // 保存して表示を確認
        // （実際の実装では保存できないかもしれないが、表示時にエスケープされることを確認）
        await dialog.locator('[role="combobox"]').first().click();
        await page.click('[role="option"]').first();
        await dialog.locator('input[type="number"]').first().fill('1000');

        await dialog.locator('[role="combobox"]').nth(1).click();
        await page.click('[role="option"]').nth(1);
        await dialog.locator('input[type="number"]').nth(3).fill('1000');

        await dialog.locator('button:has-text("作成")').click();

        // アラートが表示されないことを確認
        let alertShown = false;
        page.on('dialog', () => {
          alertShown = true;
        });

        await page.waitForTimeout(1000);
        expect(alertShown).toBe(false);

        // テキストとして表示されることを確認
        await expect(page.locator(`text=${payload}`)).toBeVisible();

        // 次のテストのためにダイアログを開く
        await page.click('text=新規作成');
      }
    });

    test('ファイルアップロードの検証', async ({ page }) => {
      // ファイルアップロード機能があると仮定
      await page.goto('/dashboard/documents');

      // 危険なファイルタイプをアップロードしようとする
      const dangerousFiles = [
        { name: 'malware.exe', content: 'MZ...' }, // 実行ファイル
        { name: 'script.js', content: 'alert("danger")' },
        { name: 'hack.php', content: '<?php system($_GET["cmd"]); ?>' },
      ];

      for (const file of dangerousFiles) {
        // ファイル入力をシミュレート
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser'),
          page.click('input[type="file"]'),
        ]);

        await fileChooser.setFiles({
          name: file.name,
          mimeType: 'application/octet-stream',
          buffer: Buffer.from(file.content),
        });

        // エラーメッセージを確認
        await expect(page.locator('text=許可されていないファイル形式です')).toBeVisible();
      }
    });
  });

  test.describe('CSRF対策', () => {
    test('CSRFトークンの検証', async ({ page, context }) => {
      await page.goto('/demo/accounts');

      // CSRFトークンなしでPOSTリクエスト
      const response = await page.request.post('/api/v1/accounts', {
        data: {
          code: '9999',
          name: 'CSRF Test',
          accountType: 'ASSET',
        },
        headers: {
          // CSRFトークンを含めない
          'Content-Type': 'application/json',
        },
      });

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error.message).toContain('CSRF');
    });

    test('異なるオリジンからのリクエスト拒否', async ({ page }) => {
      // CORSポリシーのテスト
      const response = await page.evaluate(async () => {
        try {
          const res = await fetch('http://localhost:3001/api/v1/accounts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Origin: 'http://evil-site.com',
            },
            body: JSON.stringify({
              code: '9999',
              name: 'CORS Test',
              accountType: 'ASSET',
            }),
          });
          return {
            status: res.status,
            headers: Object.fromEntries(res.headers.entries()),
          };
        } catch (error) {
          return { error: error.message };
        }
      });

      // CORSエラーまたは明示的な拒否
      expect(response).toHaveProperty('error');
    });
  });

  test.describe('セッションセキュリティ', () => {
    test('セッション固定攻撃の防止', async ({ page, context }) => {
      // 攻撃者が設定したセッションID
      const maliciousSessionId = 'attacker-session-id';

      await context.addCookies([
        {
          name: 'session-id',
          value: maliciousSessionId,
          domain: 'localhost',
          path: '/',
        },
      ]);

      // ログイン
      await page.goto('/login');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // ログイン後のセッションIDが変更されていることを確認
      const cookies = await context.cookies();
      const sessionCookie = cookies.find((c) => c.name === 'session-id');

      expect(sessionCookie?.value).not.toBe(maliciousSessionId);
    });

    test('HTTPSでのセキュアクッキー', async ({ page, context }) => {
      // HTTPS環境でのテスト（実際の本番環境）
      if (process.env.NODE_ENV === 'production') {
        await page.goto('https://localhost:3000/login');
        await page.fill('input[name="email"]', 'test@example.com');
        await page.fill('input[name="password"]', 'password123');
        await page.click('button[type="submit"]');

        const cookies = await context.cookies();
        const authCookie = cookies.find((c) => c.name === 'auth-token');

        // Secure属性が設定されている
        expect(authCookie?.secure).toBe(true);
        // HttpOnly属性が設定されている
        expect(authCookie?.httpOnly).toBe(true);
        // SameSite属性が設定されている
        expect(authCookie?.sameSite).toBe('Strict');
      }
    });
  });

  test.describe('パスワードセキュリティ', () => {
    test('弱いパスワードの拒否', async ({ page }) => {
      await page.goto('/register');

      const weakPasswords = ['123456', 'password', 'qwerty', 'abc123', '12345678'];

      for (const password of weakPasswords) {
        await page.fill('input[name="password"]', password);
        await page.fill('input[name="confirmPassword"]', password);

        // リアルタイムバリデーション
        await expect(page.locator('text=パスワードが弱すぎます')).toBeVisible();
      }
    });

    test('ブルートフォース攻撃の防止', async ({ page }) => {
      await page.goto('/login');

      // 連続して失敗するログイン試行
      for (let i = 0; i < 5; i++) {
        await page.fill('input[name="email"]', 'test@example.com');
        await page.fill('input[name="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');

        await page.waitForTimeout(100);
      }

      // 5回失敗後はアカウントロック
      await expect(page.locator('text=アカウントが一時的にロックされています')).toBeVisible();

      // 一定時間待機が必要
      await expect(page.locator('text=15分後に再試行してください')).toBeVisible();
    });
  });

  test.describe('データ暗号化', () => {
    test('機密データの暗号化確認', async ({ page }) => {
      // ネットワークトラフィックを監視
      const requests: any[] = [];

      page.on('request', (request) => {
        if (request.url().includes('/api/')) {
          requests.push({
            url: request.url(),
            headers: request.headers(),
            postData: request.postData(),
          });
        }
      });

      // 機密情報を含む操作
      await page.goto('/dashboard/settings/security');
      await page.fill('input[name="apiKey"]', 'secret-api-key-12345');
      await page.click('button:has-text("保存")');

      // APIリクエストを確認
      const apiKeyRequest = requests.find((r) => r.postData?.includes('apiKey'));

      if (apiKeyRequest) {
        // 平文でAPIキーが送信されていないことを確認
        expect(apiKeyRequest.postData).not.toContain('secret-api-key-12345');
        // 暗号化されているか、ハッシュ化されている
        expect(apiKeyRequest.postData).toMatch(/encrypted_|hash_/);
      }
    });
  });
});
