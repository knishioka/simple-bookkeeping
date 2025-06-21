/**
 * US001-S02: クライアントからの入金処理
 * 
 * ペルソナ: 田中さん（フリーランスデザイナー）
 * シナリオ: 売掛金の入金を記録
 */

import { storyTest, StoryTestHelper, storyExpect } from '../story-test-base';
import { userStories } from '../user-stories';

const story = userStories.find(s => s.id === 'US001')!;
const scenario = story.scenarios.find(s => s.id === 'US001-S02')!;

storyTest.describe('US001-S02: クライアントからの入金処理', () => {
  storyTest.beforeEach(async ({ page }) => {
    // 売掛金残高のモック
    await page.route('**/api/v1/accounts/receivables', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          data: [
            {
              clientName: 'ABC株式会社',
              projectName: 'ロゴデザイン',
              amount: 100000,
              dueDate: '2024-03-31',
              invoiceNumber: 'INV-2024-001'
            },
            {
              clientName: 'XYZ商事',
              projectName: 'Webサイトデザイン',
              amount: 300000,
              dueDate: '2024-03-25',
              invoiceNumber: 'INV-2024-002'
            }
          ]
        }
      });
    });
  });

  storyTest('田中さんの入金処理フロー', async ({ page, recordStep }) => {
    // ステップ1: 仕訳入力画面を開く
    await StoryTestHelper.executeStep(
      page,
      '仕訳入力画面を開く',
      async () => {
        await page.goto('/demo/journal-entries');
        await page.click('button:has-text("新規作成")');
        
        const dialog = page.locator('[role="dialog"]');
        await storyTest.expect(dialog).toBeVisible();
      },
      recordStep
    );

    // 受け入れ条件: 仕訳入力が1分以内に完了できる
    const startTime = Date.now();

    // ステップ2: 日付に入金日を設定
    await StoryTestHelper.executeStep(
      page,
      '日付に入金日を設定',
      async () => {
        const dialog = page.locator('[role="dialog"]');
        const dateInput = dialog.locator('input[type="date"]');
        
        // 今日の日付を設定
        const today = new Date().toISOString().split('T')[0];
        await dateInput.fill(today);
      },
      recordStep
    );

    // ステップ3: 借方：普通預金 100,000円
    await StoryTestHelper.executeStep(
      page,
      '借方：普通預金 100,000円',
      async () => {
        const dialog = page.locator('[role="dialog"]');
        
        // 勘定科目選択
        await dialog.locator('[role="combobox"]').first().click();
        await page.keyboard.type('普通預金');
        await page.waitForTimeout(300); // 検索結果の表示待ち
        await page.click('[role="option"]:has-text("普通預金")');
        
        // 金額入力
        await dialog.locator('input[type="number"]').first().fill('100000');
      },
      recordStep
    );

    // ステップ4: 貸方：売掛金 100,000円
    await StoryTestHelper.executeStep(
      page,
      '貸方：売掛金 100,000円',
      async () => {
        const dialog = page.locator('[role="dialog"]');
        
        // 2行目の勘定科目選択
        await dialog.locator('[role="combobox"]').nth(1).click();
        await page.keyboard.type('売掛金');
        await page.waitForTimeout(300);
        await page.click('[role="option"]:has-text("売掛金")');
        
        // 貸方金額入力
        await dialog.locator('input[type="number"]').nth(3).fill('100000');
      },
      recordStep
    );

    // ステップ5: 摘要入力
    await StoryTestHelper.executeStep(
      page,
      '摘要：〇〇デザイン料入金',
      async () => {
        const dialog = page.locator('[role="dialog"]');
        await dialog.locator('textarea').fill('ABC株式会社 ロゴデザイン料入金 INV-2024-001');
      },
      recordStep
    );

    // ステップ6: 保存して確認
    await StoryTestHelper.executeStep(
      page,
      '保存して仕訳一覧で確認',
      async () => {
        const dialog = page.locator('[role="dialog"]');
        await dialog.locator('button:has-text("作成")').click();
        
        // 成功メッセージ
        await storyTest.expect(page.locator('text=仕訳を作成しました')).toBeVisible();
        
        // 一覧に表示される
        await storyTest.expect(
          page.locator('table tbody tr:has-text("ABC株式会社 ロゴデザイン料入金")')
        ).toBeVisible();
      },
      recordStep
    );

    // 受け入れ条件の確認
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    storyTest.expect(duration).toBeLessThan(60); // 1分以内
    console.log(`実際の入力時間: ${duration}秒`);

    // 追加検証: 売掛金残高の更新
    await StoryTestHelper.verifyAcceptanceCriteria(
      page,
      '売掛金残高が正しく更新される',
      async () => {
        // 売掛金残高確認画面へ
        await page.goto('/dashboard/receivables');
        
        // ABC株式会社の残高が0になっている
        const abcRow = page.locator('tr:has-text("ABC株式会社")');
        const balance = await abcRow.locator('.balance').textContent();
        storyTest.expect(balance).toBe('¥0');
      }
    );
  });

  storyTest('入力補助機能の活用', async ({ page, recordStep }) => {
    await page.goto('/demo/journal-entries');
    await page.click('button:has-text("新規作成")');
    
    const dialog = page.locator('[role="dialog"]');

    // よく使う仕訳のテンプレート
    await StoryTestHelper.executeStep(
      page,
      'テンプレートから入金仕訳を選択',
      async () => {
        const templateButton = dialog.locator('button:has-text("テンプレート")');
        if (await templateButton.isVisible()) {
          await templateButton.click();
          await page.click('text=売掛金入金');
          
          // テンプレートが適用される
          const debitAccount = await dialog.locator('[role="combobox"]').first().textContent();
          storyTest.expect(debitAccount).toContain('普通預金');
        }
      },
      recordStep
    );

    // 自動補完機能
    await StoryTestHelper.executeStep(
      page,
      '摘要の自動補完',
      async () => {
        const descriptionInput = dialog.locator('textarea');
        await descriptionInput.type('ABC');
        
        // 過去の入力から候補が表示される
        const suggestions = page.locator('.autocomplete-suggestion');
        if (await suggestions.count() > 0) {
          await storyTest.expect(suggestions.first()).toContainText('ABC株式会社');
          await suggestions.first().click();
          
          const value = await descriptionInput.inputValue();
          storyTest.expect(value).toContain('ABC株式会社');
        }
      },
      recordStep
    );

    // バリデーション
    await StoryTestHelper.verifyAcceptanceCriteria(
      page,
      '入力ミスを防ぐバリデーションが機能する',
      async () => {
        // 貸借不一致のチェック
        await dialog.locator('input[type="number"]').first().fill('100000');
        await dialog.locator('input[type="number"]').nth(3).fill('90000'); // 意図的に不一致
        
        const createButton = dialog.locator('button:has-text("作成")');
        await storyTest.expect(createButton).toBeDisabled();
        
        // エラーメッセージ
        await storyTest.expect(
          dialog.locator('text=借方と貸方の合計が一致していません')
        ).toBeVisible();
      }
    );
  });

  storyTest('スマートフォンでの入金処理', async ({ page, recordStep }) => {
    // iPhone 12 サイズ
    await page.setViewportSize({ width: 390, height: 844 });
    
    await page.goto('/demo/journal-entries');
    
    await StoryTestHelper.verifyAcceptanceCriteria(
      page,
      'スマホでも問題なく入力できる',
      async () => {
        await page.click('button:has-text("新規作成")');
        const dialog = page.locator('[role="dialog"]');
        
        // ダイアログがフルスクリーンに近い形で表示
        const dialogBox = await dialog.boundingBox();
        if (dialogBox) {
          storyTest.expect(dialogBox.width).toBeGreaterThan(350);
        }
        
        // タッチ操作しやすいボタンサイズ
        const buttons = await dialog.locator('button').all();
        for (const button of buttons) {
          const box = await button.boundingBox();
          if (box) {
            storyTest.expect(box.height).toBeGreaterThanOrEqual(44); // iOS推奨の最小タップターゲット
          }
        }
        
        // 数値入力時にテンキーが表示される
        const numberInput = dialog.locator('input[type="number"]').first();
        await numberInput.click();
        const inputMode = await numberInput.getAttribute('inputmode');
        storyTest.expect(inputMode).toBe('numeric');
      }
    );
  });
});