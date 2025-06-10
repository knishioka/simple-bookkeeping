/* eslint-disable no-console */
import { test, expect } from '@playwright/test';

/**
 * 仕訳入力の基本動作確認テスト
 * 
 * 実際のDOM構造を確認しながら基本的な操作をテストします。
 */

test.describe('仕訳入力 - 基本動作確認', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/journal-entries');
    await page.waitForLoadState('networkidle');
  });

  test('仕訳入力ダイアログの基本操作', async ({ page }) => {
    // 1. 新規作成ボタンをクリック
    await page.click('text=新規作成');
    
    // 2. ダイアログが開くことを確認
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // 3. フォーム要素を確認
    const dialog = page.locator('[role="dialog"]');
    
    // 日付入力
    const dateInput = dialog.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();
    console.log('Date input found');
    
    // 摘要入力
    const descriptionInput = dialog.locator('textarea');
    await expect(descriptionInput).toBeVisible();
    await descriptionInput.fill('テスト仕訳入力');
    console.log('Description input found and filled');
    
    // 4. 仕訳明細行の確認
    // Selectコンポーネントを探す
    const selects = dialog.locator('[role="combobox"]');
    const selectCount = await selects.count();
    console.log(`Found ${selectCount} select components in dialog`);
    
    // 5. 最初の行の勘定科目選択
    if (selectCount > 0) {
      await selects.first().click();
      
      // オプションが表示されるまで待機
      await expect(page.locator('[role="option"]').first()).toBeVisible();
      
      // オプションの内容を確認
      const firstOption = await page.locator('[role="option"]').first().textContent();
      console.log(`First option: ${firstOption}`);
      
      // 現金を選択
      await page.click('[role="option"]:has-text("現金")');
      console.log('Selected 現金');
    }
    
    // 6. 金額入力フィールドを探す
    const numberInputs = dialog.locator('input[type="number"]');
    const inputCount = await numberInputs.count();
    console.log(`Found ${inputCount} number inputs`);
    
    // 借方金額を入力（最初の数値入力）
    if (inputCount > 0) {
      await numberInputs.nth(0).fill('10000');
      console.log('Entered debit amount');
    }
    
    // 7. 2行目の処理
    if (selectCount > 1) {
      await selects.nth(1).click();
      await page.click('[role="option"]:has-text("売上高")');
      console.log('Selected 売上 for second line');
      
      // 貸方金額を入力（3番目の数値入力）
      if (inputCount > 2) {
        await numberInputs.nth(3).fill('10000');
        console.log('Entered credit amount');
      }
    }
    
    // 8. 差額表示を確認
    const balanceText = await dialog.locator('text=/差額/').textContent();
    console.log(`Balance text: ${balanceText}`);
    
    // 9. ボタンを確認
    const buttons = dialog.locator('button');
    const buttonCount = await buttons.count();
    console.log(`Found ${buttonCount} buttons in dialog`);
    
    for (let i = 0; i < buttonCount; i++) {
      const buttonText = await buttons.nth(i).textContent();
      console.log(`Button ${i}: ${buttonText}`);
    }
    
    // 10. キャンセル
    await page.click('button:has-text("キャンセル")');
    await expect(page.locator('[role="dialog"]')).toBeHidden();
  });

  test('行の追加と削除', async ({ page }) => {
    // 1. 新規作成ダイアログを開く
    await page.click('text=新規作成');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    const dialog = page.locator('[role="dialog"]');
    
    // 2. 初期の行数を確認
    const initialSelects = await dialog.locator('[role="combobox"]').count();
    console.log(`Initial select count: ${initialSelects}`);
    
    // 3. 行追加ボタンを探す
    const addButton = dialog.locator('button').filter({ hasText: /追加|Add|\+/ });
    const addButtonCount = await addButton.count();
    console.log(`Add button count: ${addButtonCount}`);
    
    if (addButtonCount > 0) {
      // 行を追加
      await addButton.first().click();
      
      // 行数が増えたことを確認
      const newSelects = await dialog.locator('[role="combobox"]').count();
      console.log(`Select count after add: ${newSelects}`);
      expect(newSelects).toBeGreaterThan(initialSelects);
    }
    
    // 4. 削除ボタンを探す
    const deleteButtons = dialog.locator('button[aria-label*="削除"], button:has-text("削除"), button:has(svg)').filter({ hasText: /-|削除/ });
    const deleteCount = await deleteButtons.count();
    console.log(`Delete button count: ${deleteCount}`);
    
    // 5. キャンセル
    await page.click('button:has-text("キャンセル")');
  });

  test('貸借バランスの計算確認', async ({ page }) => {
    // 1. 新規作成ダイアログを開く
    await page.click('text=新規作成');
    
    const dialog = page.locator('[role="dialog"]');
    
    // 2. 摘要を入力
    await dialog.locator('textarea').fill('バランステスト');
    
    // 3. 1行目: 現金 50,000円（借方）
    await dialog.locator('[role="combobox"]').first().click();
    await page.click('[role="option"]:has-text("現金")');
    await dialog.locator('input[type="number"]').nth(0).fill('50000');
    
    // 4. 2行目: 売上 30,000円（貸方）- 意図的に不一致
    await dialog.locator('[role="combobox"]').nth(1).click();
    await page.click('[role="option"]:has-text("売上")');
    await dialog.locator('input[type="number"]').nth(3).fill('30000');
    
    // 5. 合計と差額を確認
    await page.waitForTimeout(500); // 計算待機
    
    // 合計行を探す
    const totalRow = dialog.locator('text=合計').locator('..');
    const debitTotal = await totalRow.locator('div').nth(1).textContent();
    const creditTotal = await totalRow.locator('div').nth(2).textContent();
    console.log(`Debit total: ${debitTotal}, Credit total: ${creditTotal}`);
    
    // エラーメッセージまたは差額表示を確認
    const errorMessage = dialog.locator('text=借方と貸方の合計が一致していません');
    if (await errorMessage.isVisible()) {
      console.log('Error message is shown');
    }
    
    // 6. 金額を修正して一致させる
    await dialog.locator('input[type="number"]').nth(3).fill('50000');
    
    // 7. 再度合計を確認
    await page.waitForTimeout(500);
    const newDebitTotal = await totalRow.locator('div').nth(1).textContent();
    const newCreditTotal = await totalRow.locator('div').nth(2).textContent();
    console.log(`New debit total: ${newDebitTotal}, New credit total: ${newCreditTotal}`);
    
    // エラーメッセージが消えることを確認
    await expect(errorMessage).toBeHidden();
    
    // 8. キャンセル
    await page.click('button:has-text("キャンセル")');
  });
});