import { test, expect } from '@playwright/test';

/**
 * ダイアログ操作のE2Eテスト
 * Issue #182: スキップされているテストの有効化とカバレッジ向上
 */
test.describe('ダイアログ操作テスト（デモページ）', () => {
  test.use({ navigationTimeout: 10000 });

  test.describe('勘定科目ダイアログ', () => {
    test('勘定科目作成ダイアログの開閉', async ({ page }) => {
      await page.goto('/demo/accounts', { waitUntil: 'networkidle' });

      // 新規作成ボタンを待つ
      const createButton = page.locator('button').filter({ hasText: '新規作成' }).first();
      await expect(createButton).toBeVisible({ timeout: 5000 });
      await createButton.click();

      // ダイアログが開くのを待つ
      await page.waitForSelector('[data-state="open"], h2:has-text("勘定科目")', {
        state: 'visible',
        timeout: 3000,
      });

      // ダイアログの中身が表示されているか確認
      const dialogVisible = await page
        .locator('[data-state="open"], h2:has-text("勘定科目")')
        .first()
        .isVisible();
      expect(dialogVisible).toBeTruthy();

      // ダイアログ内にフォーム要素があることを確認
      const codeInput = page.locator('input[name="code"]');
      await expect(codeInput).toBeVisible({ timeout: 2000 });

      // ESCキーでダイアログを閉じる
      await page.keyboard.press('Escape');

      // ダイアログが閉じたことを待機・確認
      await page.waitForFunction(
        () => document.querySelectorAll('[data-state="open"]').length === 0,
        { timeout: 2000 }
      );
      const dialogClosed = (await page.locator('[data-state="open"]').count()) === 0;
      expect(dialogClosed).toBeTruthy();
    });

    test('勘定科目編集ダイアログの操作', async ({ page }) => {
      await page.goto('/demo/accounts', { waitUntil: 'networkidle' });

      // 編集ボタンの出現を待つ
      const editButton = page.locator('button').filter({ hasText: '編集' }).first();
      await expect(editButton).toBeVisible({ timeout: 5000 });
      await editButton.click();

      // ダイアログが開くことを確認
      await page.waitForSelector('[role="dialog"], [data-state="open"]', {
        state: 'visible',
        timeout: 2000,
      });

      const dialogVisible = await page.evaluate(() => {
        const dialogElement = document.querySelector('[role="dialog"], [data-state="open"]');
        return dialogElement !== null;
      });
      expect(dialogVisible).toBeTruthy();

      // 名前フィールドがあることを確認
      const nameInput = page.locator('input[name="name"]').first();
      await expect(nameInput).toBeVisible();

      // ESCキーでダイアログを閉じる
      await page.keyboard.press('Escape');

      // ダイアログが閉じたことを待機・確認
      await page.waitForFunction(
        () => !document.querySelector('[role="dialog"], [data-state="open"]'),
        { timeout: 2000 }
      );

      const dialogClosed = await page.evaluate(() => {
        const dialogElement = document.querySelector('[role="dialog"], [data-state="open"]');
        return dialogElement === null;
      });
      expect(dialogClosed).toBeTruthy();
    });
  });

  test.describe('仕訳ダイアログ', () => {
    test('仕訳作成ダイアログの開閉', async ({ page }) => {
      await page.goto('/demo/journal-entries', { waitUntil: 'networkidle' });

      // 新規作成ボタンの出現を待つ
      const createButton = page
        .locator('button')
        .filter({ hasText: /新規作成|新規仕訳|追加/i })
        .first();
      await expect(createButton).toBeVisible({ timeout: 5000 });
      await createButton.click();

      // ダイアログが開くことを確認
      await page.waitForSelector('[role="dialog"], [data-state="open"]', {
        state: 'visible',
        timeout: 2000,
      });

      const dialogVisible = await page.evaluate(() => {
        const dialogElement = document.querySelector('[role="dialog"], [data-state="open"]');
        return dialogElement !== null;
      });
      expect(dialogVisible).toBeTruthy();

      // ESCキーでダイアログを閉じる
      await page.keyboard.press('Escape');

      // ダイアログが閉じたことを待機・確認
      await page.waitForFunction(
        () => !document.querySelector('[role="dialog"], [data-state="open"]'),
        { timeout: 2000 }
      );

      const dialogClosed = await page.evaluate(() => {
        const dialogElement = document.querySelector('[role="dialog"], [data-state="open"]');
        return dialogElement === null;
      });
      expect(dialogClosed).toBeTruthy();
    });
  });

  test.describe('フォーカス管理', () => {
    test('ダイアログ開閉時のフォーカス管理', async ({ page }) => {
      await page.goto('/demo/accounts', { waitUntil: 'networkidle' });

      // 新規作成ボタンの出現を待つ
      const createButton = page.locator('button').filter({ hasText: '新規作成' }).first();
      await expect(createButton).toBeVisible({ timeout: 5000 });
      await createButton.focus();

      // ボタンがフォーカスされていることを確認
      await expect(createButton).toBeFocused();

      // Enterキーでダイアログを開く
      await page.keyboard.press('Enter');

      // ダイアログが開いたことを確認
      await page.waitForSelector('[role="dialog"], [data-state="open"]', {
        state: 'visible',
        timeout: 2000,
      });

      const dialogVisible = await page.evaluate(() => {
        const dialogElement = document.querySelector('[role="dialog"], [data-state="open"]');
        return dialogElement !== null;
      });
      expect(dialogVisible).toBeTruthy();

      // ESCキーでダイアログを閉じる
      await page.keyboard.press('Escape');

      // ダイアログが閉じたことを待機・確認
      await page.waitForFunction(
        () => !document.querySelector('[role="dialog"], [data-state="open"]'),
        { timeout: 2000 }
      );

      const dialogClosed = await page.evaluate(() => {
        const dialogElement = document.querySelector('[role="dialog"], [data-state="open"]');
        return dialogElement === null;
      });
      expect(dialogClosed).toBeTruthy();
    });
  });
});
