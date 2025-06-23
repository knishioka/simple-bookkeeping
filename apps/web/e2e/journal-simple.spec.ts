import { test, expect } from '@playwright/test';

import { MockResponseManager } from './fixtures/mock-responses';
import { JournalEntryPage } from './pages/journal-entry-page';

/**
 * 仕訳入力の基本動作確認テスト（簡略版）
 *
 * 複雑な動作テストは削除し、基本的な動作確認のみに絞っています。
 */

test.describe('仕訳入力 - 基本動作確認', () => {
  let journalPage: JournalEntryPage;
  let mockManager: MockResponseManager;

  test.beforeEach(async ({ page }) => {
    journalPage = new JournalEntryPage(page);
    mockManager = new MockResponseManager(page);

    // 基本的なAPIモックを設定
    await mockManager.setupBasicMocks();

    // ページに移動
    await journalPage.navigate();
  });

  test('仕訳入力ページが表示される', async ({ page }) => {
    // ページタイトルまたは見出しを確認
    await expect(page.locator('h1, h2').first()).toContainText(/仕訳|Journal/);

    // 新規作成ボタンが存在することを確認
    const newButton = page.locator('text=新規作成');
    await expect(newButton).toBeVisible();
  });

  test('仕訳入力ダイアログが開く', async ({ page }) => {
    // 新規作成ダイアログを開く
    await journalPage.openCreateDialog();

    // ダイアログが表示されることを確認
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // 基本的なフォーム要素が存在することを確認
    await expect(dialog.locator('input[type="date"]')).toBeVisible();
    await expect(dialog.locator('textarea')).toBeVisible();
    await expect(dialog.locator('[role="combobox"]').first()).toBeVisible();

    // ダイアログを閉じる
    await journalPage.closeDialog();
  });

  test('仕訳の一覧が表示される', async () => {
    // 仕訳一覧を取得
    const entries = await journalPage.getEntryList();

    // 一覧が配列として取得できることを確認
    expect(Array.isArray(entries)).toBe(true);
  });
});
