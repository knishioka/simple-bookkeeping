import { test, expect } from '@playwright/test';

/**
 * トランザクション整合性テスト
 * 
 * データの整合性、同時更新、トランザクション処理の
 * 信頼性をテストします。
 */

test.describe('トランザクション整合性テスト', () => {
  test.describe('仕訳入力の整合性', () => {
    test('貸借不一致の仕訳は保存できない', async ({ page }) => {
      await page.goto('/demo/journal-entries');
      await page.click('text=新規作成');
      
      const dialog = page.locator('[role="dialog"]');
      
      // 摘要入力
      await dialog.locator('textarea').fill('不一致テスト');
      
      // 借方: 現金 100,000円
      await dialog.locator('[role="combobox"]').first().click();
      await page.click('[role="option"]:has-text("1110 - 現金")');
      await dialog.locator('input[type="number"]').first().fill('100000');
      
      // 貸方: 売上高 80,000円（意図的に不一致）
      await dialog.locator('[role="combobox"]').nth(1).click();
      await page.click('[role="option"]:has-text("4110 - 売上高")');
      await dialog.locator('input[type="number"]').nth(3).fill('80000');
      
      // 作成ボタンが無効になっていることを確認
      const createButton = dialog.locator('button:has-text("作成")');
      await expect(createButton).toBeDisabled();
      
      // エラーメッセージの表示
      await expect(dialog.locator('text=借方と貸方の合計が一致していません')).toBeVisible();
    });

    test('複数行仕訳の合計検証', async ({ page }) => {
      await page.goto('/demo/journal-entries');
      await page.click('text=新規作成');
      
      const dialog = page.locator('[role="dialog"]');
      
      // 3行の仕訳を作成
      await dialog.locator('button:has-text("行を追加")').click();
      
      // 借方: 仕入 100,000円、仮払消費税 10,000円
      // 貸方: 現金 110,000円
      
      await dialog.locator('textarea').fill('仕入と消費税');
      
      // 1行目: 仕入（借方）
      await dialog.locator('[role="combobox"]').nth(0).click();
      await page.click('[role="option"]:has-text("5110 - 仕入高")');
      await dialog.locator('input[type="number"]').nth(0).fill('100000');
      
      // 2行目: 仮払消費税（借方）
      await dialog.locator('[role="combobox"]').nth(3).click();
      await page.click('[role="option"]:has-text("2140 - 仮払消費税")');
      await dialog.locator('input[type="number"]').nth(2).fill('10000');
      
      // 3行目: 現金（貸方）
      await dialog.locator('[role="combobox"]').nth(6).click();
      await page.click('[role="option"]:has-text("1110 - 現金")');
      await dialog.locator('input[type="number"]').nth(7).fill('110000');
      
      // 合計が一致していることを確認
      await expect(dialog.locator('text=110,000').first()).toBeVisible(); // 借方合計
      await expect(dialog.locator('text=110,000').last()).toBeVisible(); // 貸方合計
      
      // 作成ボタンが有効
      const createButton = dialog.locator('button:has-text("作成")');
      await expect(createButton).toBeEnabled();
      
      await createButton.click();
      await expect(page.locator('text=仕訳を作成しました')).toBeVisible();
    });
  });

  test.describe('会計期間の整合性', () => {
    test('締め処理済み期間への仕訳入力拒否', async ({ page }) => {
      // 前月の日付で仕訳を作成しようとする
      await page.goto('/demo/journal-entries');
      await page.click('text=新規作成');
      
      const dialog = page.locator('[role="dialog"]');
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const dateString = lastMonth.toISOString().split('T')[0];
      
      await dialog.locator('input[type="date"]').fill(dateString);
      await dialog.locator('textarea').fill('過去の仕訳');
      
      // 仕訳明細を入力
      await dialog.locator('[role="combobox"]').first().click();
      await page.click('[role="option"]:has-text("1110 - 現金")');
      await dialog.locator('input[type="number"]').first().fill('10000');
      
      await dialog.locator('[role="combobox"]').nth(1).click();
      await page.click('[role="option"]:has-text("4110 - 売上高")');
      await dialog.locator('input[type="number"]').nth(3).fill('10000');
      
      // 保存を試みる
      await dialog.locator('button:has-text("作成")').click();
      
      // エラーメッセージ（実装による）
      await expect(page.locator('text=指定された期間は締め処理済みです')).toBeVisible();
    });

    test('期末をまたぐ仕訳の警告', async ({ page }) => {
      await page.goto('/demo/journal-entries');
      await page.click('text=新規作成');
      
      const dialog = page.locator('[role="dialog"]');
      
      // 3月31日の日付を設定（期末想定）
      await dialog.locator('input[type="date"]').fill('2024-03-31');
      await dialog.locator('textarea').fill('期末仕訳');
      
      // 仕訳入力
      await dialog.locator('[role="combobox"]').first().click();
      await page.click('[role="option"]:has-text("1110 - 現金")');
      await dialog.locator('input[type="number"]').first().fill('50000');
      
      await dialog.locator('[role="combobox"]').nth(1).click();
      await page.click('[role="option"]:has-text("4110 - 売上高")');
      await dialog.locator('input[type="number"]').nth(3).fill('50000');
      
      await dialog.locator('button:has-text("作成")').click();
      
      // 警告ダイアログが表示される（実装による）
      const warningDialog = page.locator('[role="dialog"]:has-text("期末の仕訳です")');
      await expect(warningDialog).toBeVisible();
      await expect(warningDialog.locator('text=この仕訳は期末日付です。続行しますか？')).toBeVisible();
      
      // 確認して続行
      await warningDialog.locator('button:has-text("続行")').click();
      await expect(page.locator('text=仕訳を作成しました')).toBeVisible();
    });
  });

  test.describe('同時更新の制御', () => {
    test('同じ仕訳の同時編集防止', async ({ browser }) => {
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      // 両方のページで同じ仕訳一覧を開く
      await page1.goto('/demo/journal-entries');
      await page2.goto('/demo/journal-entries');
      
      // ユーザー1が編集開始
      await page1.locator('table tbody tr').first().locator('button:has-text("編集")').click();
      const dialog1 = page1.locator('[role="dialog"]');
      await expect(dialog1).toBeVisible();
      
      // ユーザー2も同じ仕訳を編集しようとする
      await page2.locator('table tbody tr').first().locator('button:has-text("編集")').click();
      
      // 編集中の警告が表示される（実装による）
      await expect(page2.locator('text=この仕訳は他のユーザーが編集中です')).toBeVisible();
      
      // ユーザー1が編集を完了
      await dialog1.locator('textarea').fill('更新テスト');
      await dialog1.locator('button:has-text("更新")').click();
      
      // ユーザー2のページをリロードして最新データを確認
      await page2.reload();
      await expect(page2.locator('text=更新テスト')).toBeVisible();
      
      await context1.close();
      await context2.close();
    });

    test('楽観的ロックによる更新競合の検出', async ({ page }) => {
      await page.goto('/demo/journal-entries');
      
      // 仕訳を編集モードで開く
      await page.locator('table tbody tr').first().locator('button:has-text("編集")').click();
      const dialog = page.locator('[role="dialog"]');
      
      // 編集中に別のプロセスがデータを更新したことをシミュレート
      await page.evaluate(() => {
        // バージョン番号を変更（実際はAPIレスポンスで検出）
        window.localStorage.setItem('entry-version-mismatch', 'true');
      });
      
      // 更新を試みる
      await dialog.locator('textarea').fill('競合テスト');
      await dialog.locator('button:has-text("更新")').click();
      
      // 競合エラーが表示される
      const conflictDialog = page.locator('[role="dialog"]:has-text("更新の競合")');
      await expect(conflictDialog).toBeVisible();
      await expect(conflictDialog.locator('text=他のユーザーによって更新されています')).toBeVisible();
      
      // 最新データを取得して再編集
      await conflictDialog.locator('button:has-text("最新データを取得")').click();
      await expect(dialog).not.toBeVisible();
    });
  });

  test.describe('マスターデータの整合性', () => {
    test('使用中の勘定科目は削除できない', async ({ page }) => {
      await page.goto('/demo/accounts');
      
      // 「現金」勘定科目（仕訳で使用中）の削除を試みる
      const cashRow = page.locator('table tbody tr:has-text("1110")');
      await cashRow.locator('button[aria-label="アクション"]').click();
      await page.click('text=削除');
      
      // 確認ダイアログ
      const confirmDialog = page.locator('[role="dialog"]:has-text("削除の確認")');
      await expect(confirmDialog).toBeVisible();
      await confirmDialog.locator('button:has-text("削除")').click();
      
      // エラーメッセージ
      await expect(page.locator('text=この勘定科目は仕訳で使用されているため削除できません')).toBeVisible();
    });

    test('親子関係の整合性チェック', async ({ page }) => {
      await page.goto('/demo/accounts');
      await page.click('text=新規作成');
      
      const dialog = page.locator('[role="dialog"]');
      
      // 循環参照を作ろうとする
      await dialog.locator('input[name="code"]').fill('1999');
      await dialog.locator('input[name="name"]').fill('テスト科目');
      
      // タイプ選択
      await dialog.locator('[role="combobox"]').first().click();
      await page.click('[role="option"]:has-text("資産")');
      
      // 親科目を自分自身に設定しようとする（実装による）
      await dialog.locator('[role="combobox"]').last().click();
      await page.click('[role="option"]:has-text("1999 - テスト科目")');
      
      await dialog.locator('button:has-text("作成")').click();
      
      // エラーメッセージ
      await expect(dialog.locator('text=親科目に自分自身を指定することはできません')).toBeVisible();
    });
  });
});