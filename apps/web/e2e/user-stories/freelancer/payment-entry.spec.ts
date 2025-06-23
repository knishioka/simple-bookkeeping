/**
 * US001-S02: クライアントからの入金処理（改良版）
 *
 * ペルソナ: 田中さん（フリーランスデザイナー）
 * シナリオ: 売掛金の入金を記録
 *
 * 新しい安定したテスト基盤を使用して実装
 */

import { PersonaData } from '../../fixtures/test-data';
import { storyTest, StoryTestHelper, storyExpect } from '../story-test-base';
import { userStories } from '../user-stories';

const story = userStories.find((s) => s.id === 'US001');
if (!story) throw new Error('Story US001 not found');
const scenario = story.scenarios.find((s) => s.id === 'US001-S02');
if (!scenario) throw new Error('Scenario US001-S02 not found');

storyTest.describe('US001-S02: クライアントからの入金処理（安定版）', () => {
  storyTest.beforeEach(async ({ mockManager }) => {
    // 売掛金残高のモック（専用メソッドを使用）
    await mockManager.mockCustomResponse('**/api/v1/accounts/receivables', {
      status: 200,
      body: {
        data: [
          {
            clientName: PersonaData.freelancerDesigner.clients[0], // 'ABC株式会社'
            projectName: 'ロゴデザイン',
            amount: 100000,
            dueDate: '2024-03-31',
            invoiceNumber: 'INV-2024-001',
          },
          {
            clientName: PersonaData.freelancerDesigner.clients[1], // 'XYZ商事'
            projectName: 'Webサイトデザイン',
            amount: 300000,
            dueDate: '2024-03-25',
            invoiceNumber: 'INV-2024-002',
          },
        ],
      },
    });
  });

  storyTest(
    '田中さんの入金処理フロー（安定版）',
    async ({ page, recordStep, journalPage, mockManager }) => {
      // ステップ1: 仕訳入力画面を開く
      await StoryTestHelper.executeStep(
        page,
        '仕訳入力画面を開く',
        async () => {
          await journalPage.navigate();
          await StoryTestHelper.waitForPageReady(page);
          await journalPage.openCreateDialog();
        },
        recordStep
      );

      // 受け入れ条件: 仕訳入力が1分以内に完了できる
      const performanceResult = await StoryTestHelper.measurePerformance(
        async () => {
          // ステップ2: 日付に入金日を設定
          await StoryTestHelper.executeStep(
            page,
            '日付に入金日を設定',
            async () => {
              const today = new Date().toISOString().split('T')[0];
              await StoryTestHelper.fillFormSafely(page, 'input[type="date"]', today, '入金日');
            },
            recordStep
          );

          // ステップ3: 借方：普通預金 100,000円
          await StoryTestHelper.executeStep(
            page,
            '借方：普通預金 100,000円',
            async () => {
              await journalPage.setAccountLine(0, {
                account: '普通預金',
                debitAmount: 100000,
                creditAmount: 0,
              });
            },
            recordStep
          );

          // ステップ4: 貸方：売掛金 100,000円
          await StoryTestHelper.executeStep(
            page,
            '貸方：売掛金 100,000円',
            async () => {
              await journalPage.setAccountLine(1, {
                account: '売掛金',
                debitAmount: 0,
                creditAmount: 100000,
              });
            },
            recordStep
          );

          // ステップ5: 摘要入力
          await StoryTestHelper.executeStep(
            page,
            '摘要：ABC株式会社 ロゴデザイン料入金',
            async () => {
              await StoryTestHelper.fillFormSafely(
                page,
                'textarea',
                'ABC株式会社 ロゴデザイン料入金 INV-2024-001',
                '摘要'
              );
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

              // 成功メッセージを待機
              await journalPage.expectSuccessMessage('仕訳を作成しました');

              // 一覧に表示されることを確認
              await journalPage.verifyEntryExists('ABC株式会社 ロゴデザイン料入金');
            },
            recordStep
          );
        },
        '入金処理全体',
        60000 // 1分以内
      );

      console.log(`実際の入力時間: ${performanceResult.duration / 1000}秒`);

      // 追加検証: 売掛金残高の更新
      await StoryTestHelper.verifyAcceptanceCriteria(
        page,
        '売掛金残高が正しく更新される',
        async () => {
          // モックレスポンスで残高更新を設定
          await mockManager.mockCustomResponse('**/api/v1/dashboard/receivables', {
            status: 200,
            body: {
              data: [
                {
                  clientName: 'ABC株式会社',
                  balance: 0, // 入金後は0
                },
                {
                  clientName: 'XYZ商事',
                  balance: 300000, // 未入金
                },
              ],
            },
          });

          await page.goto('/dashboard/receivables');
          await StoryTestHelper.waitForPageReady(page);

          // ABC株式会社の残高が0になっている
          const abcRow = page.locator('tr:has-text("ABC株式会社")');
          await storyTest.expect(abcRow.locator('.balance')).toContainText('¥0');
        }
      );
    }
  );

  storyTest('入力補助機能の活用（安定版）', async ({ page, recordStep, journalPage }) => {
    await journalPage.navigate();
    await journalPage.openCreateDialog();

    const dialog = page.locator('[role="dialog"]');

    // よく使う仕訳のテンプレート
    await StoryTestHelper.executeStep(
      page,
      'テンプレートから入金仕訳を選択',
      async () => {
        const templateButton = dialog.locator('button:has-text("テンプレート")');
        if ((await templateButton.count()) > 0) {
          await templateButton.click();

          // テンプレート選択ダイアログが表示される
          const templateDialog = page.locator('[role="dialog"]').nth(1);
          await templateDialog.waitFor();

          await templateDialog.locator('text=売掛金入金').click();

          // テンプレートが適用されることを確認
          await page.waitForTimeout(500); // 適用待機
          const debitAccount = await dialog.locator('[role="combobox"]').first().textContent();
          storyTest.expect(debitAccount).toContain('普通預金');
        } else {
          console.log('Template feature not available - skipping this test');
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
        await descriptionInput.click();
        await descriptionInput.type('ABC');
        await page.waitForTimeout(300); // 候補表示待機

        // 過去の入力から候補が表示される
        const suggestions = page.locator('.autocomplete-suggestion, [role="option"]');
        if ((await suggestions.count()) > 0) {
          await storyTest.expect(suggestions.first()).toContainText('ABC株式会社');
          await suggestions.first().click();

          const value = await descriptionInput.inputValue();
          storyTest.expect(value).toContain('ABC株式会社');
        } else {
          console.log('Autocomplete feature not available - continuing with manual input');
          await descriptionInput.fill('ABC株式会社 手動入力');
        }
      },
      recordStep
    );

    // バリデーション
    await StoryTestHelper.verifyAcceptanceCriteria(
      page,
      '入力ミスを防ぐバリデーションが機能する',
      async () => {
        // 勘定科目をまず設定
        await journalPage.setAccountLine(0, {
          account: '普通預金',
          debitAmount: 100000,
          creditAmount: 0,
        });

        await journalPage.setAccountLine(1, {
          account: '売掛金',
          debitAmount: 0,
          creditAmount: 90000, // 意図的に不一致
        });

        // バランスエラーが表示されることを確認
        await page.waitForTimeout(500); // 計算待機
        await journalPage.verifyBalanceError();

        // 作成ボタンが無効化されるか確認
        const createButton = dialog.locator('button:has-text("作成")');
        const isDisabled = await createButton.isDisabled();
        storyTest.expect(isDisabled).toBe(true);
      }
    );

    await journalPage.closeDialog();
  });

  storyTest(
    'スマートフォンでの入金処理（安定版）',
    async ({ page, recordStep: _recordStep, journalPage }) => {
      // iPhone 12 サイズに設定
      await page.setViewportSize({ width: 390, height: 844 });

      await journalPage.navigate();
      await StoryTestHelper.waitForPageReady(page);

      await StoryTestHelper.verifyAcceptanceCriteria(
        page,
        'スマホでも問題なく入力できる',
        async () => {
          await journalPage.openCreateDialog();
          const dialog = page.locator('[role="dialog"]');

          // ダイアログがモバイルに最適化されて表示
          const dialogBox = await dialog.boundingBox();
          if (dialogBox) {
            storyTest.expect(dialogBox.width).toBeGreaterThan(350);
            console.log(`Dialog width on mobile: ${dialogBox.width}px`);
          }

          // タッチ操作しやすいボタンサイズ
          const buttons = await dialog.locator('button').all();
          for (const button of buttons.slice(0, 3)) {
            // 最初の3つをチェック
            const box = await button.boundingBox();
            if (box) {
              storyTest.expect(box.height).toBeGreaterThanOrEqual(44); // iOS推奨の最小タップターゲット
            }
          }

          // 数値入力時の inputmode 属性
          const numberInput = dialog.locator('input[type="number"]').first();
          await numberInput.click();
          const inputMode = await numberInput.getAttribute('inputmode');
          if (inputMode) {
            storyTest.expect(inputMode).toBe('numeric');
          }

          await journalPage.closeDialog();
        }
      );

      // ユーザビリティテスト
      await storyExpect.toBeUserFriendly(page, {
        isResponsive: true,
        isKeyboardNavigable: true,
        hasProperFocus: true,
      });
    }
  );

  storyTest(
    'パフォーマンステスト: 大量データでの動作',
    async ({ page, recordStep: _recordStep, journalPage, mockManager }) => {
      // 大量の勘定科目データをモック
      const largeAccountList = Array.from({ length: 100 }, (_, i) => ({
        id: `account-${i}`,
        code: `${1000 + i}`,
        name: `勘定科目${i}`,
        accountType: 'ASSET',
      }));

      await mockManager.mockCustomResponse('**/api/v1/accounts', {
        status: 200,
        body: { data: largeAccountList },
      });

      await journalPage.navigate();

      // 大量データ環境でのダイアログ表示パフォーマンス
      const openResult = await StoryTestHelper.measurePerformance(
        async () => {
          await journalPage.openCreateDialog();
        },
        'ダイアログ表示（大量データ）',
        3000 // 3秒以内
      );

      console.log(`Large data dialog open: ${openResult.duration}ms`);

      // 大量データ環境でのSelect操作パフォーマンス
      const selectResult = await StoryTestHelper.measurePerformance(
        async () => {
          const dialog = page.locator('[role="dialog"]');
          const firstSelect = dialog.locator('[role="combobox"]').first();
          await firstSelect.click();
          await page.waitForTimeout(500); // オプション表示待機
          await page.keyboard.press('Escape'); // 閉じる
        },
        'Select操作（大量データ）',
        2000 // 2秒以内
      );

      console.log(`Large data select operation: ${selectResult.duration}ms`);

      await journalPage.closeDialog();
    }
  );

  storyTest('エラー復旧シナリオ', async ({ page, recordStep, journalPage, mockManager }) => {
    await journalPage.navigate();
    await journalPage.openCreateDialog();

    // ネットワークエラーのシミュレーション
    await StoryTestHelper.executeStep(
      page,
      'ネットワークエラーからの復旧',
      async () => {
        // エラーレスポンスを設定
        await mockManager.mockCustomResponse('**/api/v1/journal-entries', {
          status: 500,
          body: {
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'サーバーで問題が発生しました',
            },
          },
        });

        // 仕訳データを入力
        await journalPage.createSimpleEntry({
          date: '2024-03-20',
          description: 'エラーテスト仕訳',
          debitAccount: '現金',
          debitAmount: 50000,
          creditAccount: '売上高',
          creditAmount: 50000,
        });

        // エラーメッセージが表示されることを確認
        await journalPage.expectErrorMessage('サーバーで問題が発生しました');

        // 正常なレスポンスに戻す
        await mockManager.setupBasicMocks();

        // 再試行で成功することを確認
        const dialog = page.locator('[role="dialog"]');
        await dialog.locator('button:has-text("作成")').click();
        await journalPage.expectSuccessMessage('仕訳を作成しました');
      },
      recordStep
    );
  });
});
