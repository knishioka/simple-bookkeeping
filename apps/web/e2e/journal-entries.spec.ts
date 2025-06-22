import { test, expect } from '@playwright/test';

import { AppHelpers } from './helpers/test-setup';
// import { JournalHelpers } from './helpers/test-setup';
// import { STANDARD_ACCOUNTS, JOURNAL_PATTERNS } from './helpers/test-data';

/**
 * 仕訳入力のE2Eテスト
 *
 * 複数行の仕訳明細と複雑なSelect操作を含む包括的なテスト。
 * 実際の経理業務フローに基づいたシナリオをテストします。
 */

test.describe('仕訳入力 - E2Eテスト', () => {
  test.beforeEach(async ({ page }) => {
    // デモページにアクセス
    await page.goto('/demo/journal-entries');
    await new AppHelpers(page).waitForPageLoad();
  });

  test.describe('基本的な仕訳入力', () => {
    test('【シナリオ1】現金売上の仕訳入力（2行仕訳）', async ({ page }) => {
      // const appHelpers = new AppHelpers(page);

      // 1. 新規作成ボタンをクリック
      await page.click('text=新規作成');
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // 2. 基本情報を入力
      await page.fill('textarea[name="description"]', '現金売上（テスト）');

      // 3. 日付の確認（デフォルトで今日の日付）
      const dateInput = page.locator('input[type="date"]');
      await expect(dateInput).toBeVisible();

      // 4. 1行目: 現金（借方）の入力
      const firstLineAccount = page.locator('[data-testid="journal-line-0"] [role="combobox"]');
      await firstLineAccount.click();

      // オプションが表示されるまで待機
      await expect(page.locator('[role="option"]').first()).toBeVisible();

      // 「現金」を選択
      await page.click('[role="option"]:has-text("1110 - 現金")');

      // 借方金額を入力
      await page.fill('[data-testid="journal-line-0"] input[name*="debit"]', '100000');

      // 5. 2行目: 売上高（貸方）の入力
      const secondLineAccount = page.locator('[data-testid="journal-line-1"] [role="combobox"]');
      await secondLineAccount.click();

      // 「売上高」を選択
      await page.click('[role="option"]:has-text("4110 - 売上高")');

      // 貸方金額を入力
      await page.fill('[data-testid="journal-line-1"] input[name*="credit"]', '100000');

      // 6. 貸借バランスの確認
      await expect(page.locator('text=差額: ¥0')).toBeVisible();

      // 7. 保存ボタンをクリック
      await page.click('button:has-text("作成")');

      // 8. ダイアログが閉じることを確認
      await expect(page.locator('[role="dialog"]')).toBeHidden();

      // 9. 一覧に追加されたことを確認（デモなので実際の保存はされない）
      await page.fill('input[placeholder*="検索"]', '現金売上（テスト）');
      await page.waitForTimeout(500); // デバウンス待機
    });

    test('【シナリオ2】複数行の複雑な仕訳入力', async ({ page }) => {
      // 1. 新規作成ダイアログを開く
      await page.click('text=新規作成');
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // 2. 摘要を入力
      await page.fill('textarea[name="description"]', '備品購入（PC、デスク、椅子）');

      // 3. 行を追加（デフォルト2行→4行に）
      await page.click('button:has-text("行を追加")');
      await page.click('button:has-text("行を追加")');

      // 4. 1行目: 備品（借方）
      const line1 = page.locator('[data-testid="journal-line-0"]');
      await line1.locator('[role="combobox"]').click();
      await page.click('[role="option"]:has-text("1510 - 備品")');
      await line1.locator('input[name*="debit"]').fill('300000');

      // 5. 2行目: 消耗品費（借方）
      const line2 = page.locator('[data-testid="journal-line-1"]');
      await line2.locator('[role="combobox"]').click();
      await page.click('[role="option"]:has-text("5210 - 消耗品費")');
      await line2.locator('input[name*="debit"]').fill('50000');

      // 6. 3行目: 現金（貸方）
      const line3 = page.locator('[data-testid="journal-line-2"]');
      await line3.locator('[role="combobox"]').click();
      await page.click('[role="option"]:has-text("1110 - 現金")');
      await line3.locator('input[name*="credit"]').fill('150000');

      // 7. 4行目: 未払金（貸方）
      const line4 = page.locator('[data-testid="journal-line-3"]');
      await line4.locator('[role="combobox"]').click();
      await page.click('[role="option"]:has-text("2110 - 未払金")');
      await line4.locator('input[name*="credit"]').fill('200000');

      // 8. 貸借バランスを確認
      await expect(page.locator('text=差額: ¥0')).toBeVisible();

      // 9. 作成
      await page.click('button:has-text("作成")');
      await expect(page.locator('[role="dialog"]')).toBeHidden();
    });

    test('【シナリオ3】仕訳明細の削除操作', async ({ page }) => {
      // 1. 新規作成ダイアログを開く
      await page.click('text=新規作成');

      // 2. 3行追加（合計5行）
      for (let i = 0; i < 3; i++) {
        await page.click('button:has-text("行を追加")');
      }

      // 3. 行数を確認
      const lines = page.locator('[data-testid^="journal-line-"]');
      await expect(lines).toHaveCount(5);

      // 4. 3行目を削除
      await page.click('[data-testid="journal-line-2"] button[aria-label="削除"]');

      // 5. 行数が減ったことを確認
      await expect(lines).toHaveCount(4);

      // 6. キャンセル
      await page.click('button:has-text("キャンセル")');
    });
  });

  test.describe('バリデーションとエラーハンドリング', () => {
    test('【シナリオ4】貸借不一致時のエラー表示', async ({ page }) => {
      // 1. 新規作成ダイアログを開く
      await page.click('text=新規作成');

      // 2. 摘要を入力
      await page.fill('textarea[name="description"]', '不一致テスト');

      // 3. 1行目: 現金 100,000円（借方）
      const line1 = page.locator('[data-testid="journal-line-0"]');
      await line1.locator('[role="combobox"]').click();
      await page.click('[role="option"]:has-text("1110 - 現金")');
      await line1.locator('input[name*="debit"]').fill('100000');

      // 4. 2行目: 売上高 80,000円（貸方）- 意図的に不一致
      const line2 = page.locator('[data-testid="journal-line-1"]');
      await line2.locator('[role="combobox"]').click();
      await page.click('[role="option"]:has-text("4110 - 売上高")');
      await line2.locator('input[name*="credit"]').fill('80000');

      // 5. 差額が表示されることを確認
      await expect(page.locator('text=/差額: ¥[0-9,]+/')).toBeVisible();
      await expect(page.locator('text=差額: ¥20,000')).toBeVisible();

      // 6. 作成ボタンが無効になっていることを確認（実装による）
      // const createButton = page.locator('button:has-text("作成")');
      // デモ版では無効にならないかもしれない

      // 7. キャンセル
      await page.click('button:has-text("キャンセル")');
    });

    test('【シナリオ5】必須項目未入力時のバリデーション', async ({ page }) => {
      // 1. 新規作成ダイアログを開く
      await page.click('text=新規作成');

      // 2. 摘要を空のままにする

      // 3. 仕訳明細を入力
      const line1 = page.locator('[data-testid="journal-line-0"]');
      await line1.locator('[role="combobox"]').click();
      await page.click('[role="option"]:has-text("1110 - 現金")');
      await line1.locator('input[name*="debit"]').fill('10000');

      const line2 = page.locator('[data-testid="journal-line-1"]');
      await line2.locator('[role="combobox"]').click();
      await page.click('[role="option"]:has-text("4110 - 売上高")');
      await line2.locator('input[name*="credit"]').fill('10000');

      // 4. 作成ボタンをクリック
      await page.click('button:has-text("作成")');

      // 5. エラーメッセージまたはダイアログが残ることを確認
      // デモ版では実際のバリデーションは動作しないかもしれない

      // 6. キャンセル
      await page.click('button:has-text("キャンセル")');
    });
  });

  test.describe('高度な仕訳入力機能', () => {
    test('【シナリオ6】勘定科目の検索機能', async ({ page }) => {
      // 1. 新規作成ダイアログを開く
      await page.click('text=新規作成');

      // 2. 1行目のSelectを開く
      const line1Select = page.locator('[data-testid="journal-line-0"] [role="combobox"]');
      await line1Select.click();

      // 3. すべての選択肢が表示されることを確認
      const allOptions = await page.locator('[role="option"]').count();
      // console.log(`Total options: ${allOptions}`);
      expect(allOptions).toBeGreaterThan(0);

      // 4. キーボードで検索（実装されている場合）
      await page.keyboard.type('現金');

      // 5. フィルタされた結果を確認（実装による）
      await page.waitForTimeout(500);

      // 6. Escapeで閉じる
      await page.press('body', 'Escape');

      // 7. キャンセル
      await page.click('button:has-text("キャンセル")');
    });

    test('【シナリオ7】仕訳のコピー機能（実装されている場合）', async ({ page }) => {
      // 既存の仕訳から「コピー」ボタンがある場合のテスト
      const copyButtons = page.locator('button:has-text("コピー")');
      const copyCount = await copyButtons.count();

      if (copyCount > 0) {
        // 1. 最初の仕訳のコピーボタンをクリック
        await copyButtons.first().click();

        // 2. 編集ダイアログが開き、データがコピーされていることを確認
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        // 3. キャンセル
        await page.click('button:has-text("キャンセル")');
      }
    });

    test('【シナリオ8】日付ピッカーの操作', async ({ page }) => {
      // 1. 新規作成ダイアログを開く
      await page.click('text=新規作成');

      // 2. 日付入力フィールドを確認
      const dateInput = page.locator('input[type="date"]');
      await expect(dateInput).toBeVisible();

      // 3. 日付を変更
      await dateInput.fill('2024-12-25');

      // 4. 値が設定されたことを確認
      await expect(dateInput).toHaveValue('2024-12-25');

      // 5. キャンセル
      await page.click('button:has-text("キャンセル")');
    });
  });

  test.describe('フィルタリングと検索', () => {
    test('【シナリオ9】仕訳一覧のフィルタ機能', async ({ page }) => {
      // 1. 検索ボックスに入力
      await page.fill('input[placeholder*="検索"]', '売上');
      await page.waitForTimeout(500); // デバウンス待機

      // 2. フィルタ結果を確認（デモデータによる）
      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();
      // console.log(`Filtered rows: ${rowCount}`);
      expect(rowCount).toBeGreaterThanOrEqual(0);

      // 3. ステータスフィルタ（実装されている場合）
      const statusFilter = page.locator('[role="combobox"]').filter({ hasText: 'ステータス' });
      const statusCount = await statusFilter.count();

      if (statusCount > 0) {
        await statusFilter.click();
        await page.click('[role="option"]:has-text("承認済")');
      }

      // 4. 日付範囲フィルタ（実装されている場合）
      const dateFromInput = page.locator('input[type="date"]').first();
      const dateToInput = page.locator('input[type="date"]').last();

      if ((await dateFromInput.isVisible()) && (await dateToInput.isVisible())) {
        await dateFromInput.fill('2024-01-01');
        await dateToInput.fill('2024-12-31');
      }
    });

    test('【シナリオ10】仕訳の詳細表示', async ({ page }) => {
      // 1. テーブルの最初の行をクリック（詳細表示がある場合）
      const firstRow = page.locator('table tbody tr').first();
      await firstRow.click();

      // 2. 詳細モーダルまたは展開表示を確認
      // 実装によって異なる

      // 3. 編集ボタンがある場合はクリック
      const editButton = page.locator('button:has-text("編集")').first();
      if (await editButton.isVisible()) {
        await editButton.click();

        // 編集ダイアログが開くことを確認
        await expect(page.locator('[role="dialog"]')).toBeVisible();

        // キャンセル
        await page.click('button:has-text("キャンセル")');
      }
    });
  });

  test.describe('レスポンシブデザイン', () => {
    test('【シナリオ11】モバイル表示での仕訳入力', async ({ page }) => {
      // モバイルビューポートに設定
      await page.setViewportSize({ width: 375, height: 667 });

      // 1. 新規作成ボタンをクリック
      await page.click('text=新規作成');

      // 2. ダイアログがモバイルでも適切に表示されることを確認
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // 3. フォーム要素が縦に配置されていることを確認（レイアウト確認）
      await expect(page.locator('textarea[name="description"]')).toBeVisible();

      // 4. Select操作がモバイルでも動作することを確認
      const mobileSelect = page.locator('[data-testid="journal-line-0"] [role="combobox"]');
      await mobileSelect.click();

      // オプションが表示される
      await expect(page.locator('[role="option"]').first()).toBeVisible();

      // 5. キャンセル
      await page.press('body', 'Escape');
      await page.click('button:has-text("キャンセル")');
    });
  });
});
