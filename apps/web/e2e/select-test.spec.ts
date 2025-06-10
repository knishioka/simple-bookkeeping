/* eslint-disable no-console */
import { test, expect } from '@playwright/test';

/**
 * Radix UI Select コンポーネントの基本動作テスト
 * 
 * まず最も基本的なSelect操作が動作することを確認します。
 */

test.describe('Radix UI Select - 基本動作テスト', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/accounts');
    await page.waitForLoadState('networkidle');
  });

  test('科目タイプフィルタのSelect操作', async ({ page }) => {
    // ページ内のSelectを探して操作する
    
    // 1. 全てのcomboboxを確認
    const comboboxes = page.locator('[role="combobox"]');
    const count = await comboboxes.count();
    console.log(`Found ${count} comboboxes`);
    
    // 2. フィルタ用のSelectを特定（通常は検索入力の後にある）
    const searchInput = page.locator('input[placeholder*="検索"]');
    await expect(searchInput).toBeVisible();
    
    // 3. 検索入力の隣にあるSelectを見つける
    const filterSelect = page.locator('[role="combobox"]').last();
    
    // 4. Selectの現在の状態を確認
    const selectText = await filterSelect.textContent();
    console.log(`Current select text: ${selectText}`);
    
    // 5. Selectをクリック
    await filterSelect.click();
    
    // 6. オプションが表示されることを確認
    const optionCount = await page.locator('[role="option"]').count();
    expect(optionCount).toBeGreaterThan(0);
    
    // 7. オプションのテキストを確認
    const options = page.locator('[role="option"]');
    console.log(`Found ${optionCount} options`);
    
    for (let i = 0; i < optionCount; i++) {
      const optionText = await options.nth(i).textContent();
      console.log(`Option ${i}: ${optionText}`);
    }
    
    // 8. 「資産」オプションをクリック
    await page.click('[role="option"]:has-text("資産")');
    
    // 9. Selectが閉じることを確認
    await expect(page.locator('[role="option"]')).toHaveCount(0);
  });

  test('新規作成ダイアログのSelect操作', async ({ page }) => {
    // 1. 新規作成ボタンをクリック
    await page.click('text=新規作成');
    
    // 2. ダイアログが開くことを確認
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // 3. ダイアログ内のフォーム要素を確認
    await expect(page.locator('input[name="code"]')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    
    // 4. ダイアログ内のSelectを探す
    const dialogSelects = page.locator('[role="dialog"] [role="combobox"]');
    const dialogSelectCount = await dialogSelects.count();
    console.log(`Found ${dialogSelectCount} selects in dialog`);
    
    // 5. 最初のSelect（タイプ選択）をクリック
    if (dialogSelectCount > 0) {
      await dialogSelects.first().click();
      
      // 6. オプションが表示されることを確認
      const optionCount = await page.locator('[role="option"]').count();
      expect(optionCount).toBeGreaterThan(0);
      
      // 7. 「資産」を選択
      await page.click('[role="option"]:has-text("資産")');
      
      // 8. Selectが閉じることを確認
      await expect(page.locator('[role="option"]')).toHaveCount(0);
    }
    
    // 9. ダイアログを閉じる
    await page.click('button:has-text("キャンセル")');
    await expect(page.locator('[role="dialog"]')).toBeHidden();
  });

  test('Selectコンポーネントのアクセシビリティ属性確認', async ({ page }) => {
    // 1. フィルタSelectの属性を確認
    const filterSelect = page.locator('[role="combobox"]').last();
    
    // 2. role属性を確認
    await expect(filterSelect).toHaveAttribute('role', 'combobox');
    
    // 3. Selectを開く
    await filterSelect.click();
    
    // 4. オプションのrole属性を確認
    const firstOption = page.locator('[role="option"]').first();
    await expect(firstOption).toHaveAttribute('role', 'option');
    
    // 5. Escapeで閉じる
    await page.press('body', 'Escape');
    await expect(page.locator('[role="option"]')).toHaveCount(0);
  });
});