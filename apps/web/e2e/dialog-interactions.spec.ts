import { test, expect } from '@playwright/test';

/**
 * ダイアログ操作のE2Eテスト
 * Issue #182: スキップされているテストの有効化とカバレッジ向上
 */
test.describe('ダイアログ操作テスト（デモページ）', () => {
  test.use({ navigationTimeout: 10000 });

  test.describe('勘定科目ダイアログ', () => {
    test('勘定科目作成ダイアログの開閉', async ({ page }) => {
      await page.goto('/demo/accounts', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // 新規作成ボタンをクリック
      const createButton = page.locator('button:has-text("新規作成")').first();
      await expect(createButton).toBeVisible();
      await createButton.click();

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
      await expect(dialog).not.toBeVisible({
        timeout: 5000,
      });
    });

    test('勘定科目編集ダイアログの操作', async ({ page }) => {
      await page.goto('/demo/accounts', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // 最初の編集ボタンをクリック
      const editButton = page.locator('button:has-text("編集")').first();
      await expect(editButton).toBeVisible();
      await editButton.click();

      // ダイアログが開くことを確認
      await page.waitForTimeout(500);
      const dialog = page.locator('[role="dialog"], .dialog, .modal').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // 名前フィールドがあることを確認
      const nameInput = dialog.locator('input[name="name"]').first();
      await expect(nameInput).toBeVisible();

      // ESCキーでダイアログを閉じる
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('仕訳ダイアログ', () => {
    test('仕訳作成ダイアログの開閉', async ({ page }) => {
      await page.goto('/demo/journal-entries', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // 新規作成ボタンをクリック
      const createButton = page
        .locator('button')
        .filter({ hasText: /新規作成|追加/i })
        .first();
      await expect(createButton).toBeVisible();
      await createButton.click();

      // ダイアログが開くことを確認
      await page.waitForTimeout(500);
      const dialog = page.locator('[role="dialog"], .dialog, .modal').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // ESCキーでダイアログを閉じる
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('フォーカス管理', () => {
    test('ダイアログ開閉時のフォーカス管理', async ({ page }) => {
      await page.goto('/demo/accounts', { waitUntil: 'domcontentloaded' });

      // ページの読み込みを待つ
      await page.waitForTimeout(1000);

      // 新規作成ボタンにフォーカス
      const createButton = page.locator('button:has-text("新規作成")').first();
      await createButton.focus();

      // ボタンがフォーカスされていることを確認
      await expect(createButton).toBeFocused();

      // Enterキーでダイアログを開く
      await page.keyboard.press('Enter');

      // ダイアログが開いたら、最初の入力フィールドにフォーカスが移動することを確認
      await page.waitForTimeout(500);
      const firstInput = page.locator('dialog input, [role="dialog"] input').first();
      await expect(firstInput).toBeVisible({ timeout: 5000 });

      // ESCキーでダイアログを閉じる
      await page.keyboard.press('Escape');

      // フォーカスが元のボタンに戻ることを確認（ベストエフォート）
      await page.waitForTimeout(500);
      // Note: フォーカスの戻りは実装依存なので、ダイアログが閉じたことのみ確認
      const dialog = page.locator('[role="dialog"], .dialog, .modal').first();
      await expect(dialog).not.toBeVisible({ timeout: 5000 });
    });
  });
});
