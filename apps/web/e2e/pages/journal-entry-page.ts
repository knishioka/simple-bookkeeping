import { Page, expect } from '@playwright/test';

import { RadixSelectHelper, FormHelper } from '../utils/select-helpers';

import { BasePage } from './base-page';

/**
 * 仕訳入力ページのPage Object
 */
export class JournalEntryPage extends BasePage {
  // セレクター定義
  private readonly selectors = {
    newEntryButton: 'text=新規作成',
    entryTable: 'table',
    entryRow: 'table tbody tr',
    dialog: '[role="dialog"]',

    // ダイアログ内の要素
    dateInput: 'input[type="date"]',
    descriptionInput: 'textarea',

    // 仕訳明細行
    lineRow: '.journal-line-row, .entry-line',
    accountSelect: '[role="combobox"]',
    debitAmountInput:
      'input[type="number"][name*="debit"], input[type="number"][placeholder*="借方"]',
    creditAmountInput:
      'input[type="number"][name*="credit"], input[type="number"][placeholder*="貸方"]',
    lineDescriptionInput: 'input[name*="description"], input[placeholder*="摘要"]',

    // 行の操作ボタン
    addLineButton:
      'button:has-text("行追加"), button[aria-label*="追加"], button:has(svg):has-text("+")',
    deleteLineButton:
      'button[aria-label*="削除"], button:has-text("削除"), button:has(svg):not(:has-text("+"))',

    // フッター情報
    totalRow: '.total-row, .summary-row',
    debitTotal: '.debit-total',
    creditTotal: '.credit-total',
    balanceDifference: '.balance-difference, .difference',

    // ダイアログボタン
    createButton: 'button:has-text("作成")',
    updateButton: 'button:has-text("更新")',
    cancelButton: 'button:has-text("キャンセル")',

    // エラーメッセージ
    errorMessage: '.error, [role="alert"]',
    balanceError: 'text=借方と貸方の合計が一致していません',
  };

  constructor(page: Page) {
    super(page);
  }

  /**
   * 仕訳入力ページに移動
   */
  async navigate(): Promise<void> {
    await this.goto('/dashboard/journal-entries');
  }

  /**
   * 新規作成ダイアログを開く
   */
  async openCreateDialog(): Promise<void> {
    await this.page.click(this.selectors.newEntryButton);
    await this.waitForDialog();
  }

  /**
   * 基本的な仕訳を作成
   */
  async createSimpleEntry(data: {
    date: string;
    description: string;
    debitAccount: string;
    debitAmount: number;
    creditAccount: string;
    creditAmount: number;
  }): Promise<void> {
    await this.openCreateDialog();

    // const dialog = this.page.locator(this.selectors.dialog);

    // 日付を設定
    await FormHelper.fillField(this.page, this.selectors.dateInput, data.date);

    // 摘要を設定
    await FormHelper.fillTextarea(this.page, this.selectors.descriptionInput, data.description);

    // 1行目: 借方
    await this.setAccountLine(0, {
      account: data.debitAccount,
      debitAmount: data.debitAmount,
      creditAmount: 0,
    });

    // 2行目: 貸方
    await this.setAccountLine(1, {
      account: data.creditAccount,
      debitAmount: 0,
      creditAmount: data.creditAmount,
    });

    // 保存
    await FormHelper.submitForm(this.page, this.selectors.createButton, {
      waitForResponse: true,
    });

    await this.waitForDialogHidden();
  }

  /**
   * 特定の行に勘定科目と金額を設定
   */
  async setAccountLine(
    lineIndex: number,
    data: {
      account: string;
      debitAmount?: number;
      creditAmount?: number;
      description?: string;
    }
  ): Promise<void> {
    const dialog = this.page.locator(this.selectors.dialog);

    // 勘定科目を選択
    const accountSelects = dialog.locator(this.selectors.accountSelect);
    const targetSelect = accountSelects.nth(lineIndex);

    await RadixSelectHelper.selectOption(this.page, targetSelect, data.account);

    // 金額を入力
    // const numberInputs = dialog.locator('input[type="number"]');

    if (data.debitAmount !== undefined && data.debitAmount > 0) {
      // 借方金額（通常は偶数インデックス: 0, 2, 4...）
      // const debitInput = numberInputs.nth(lineIndex * 4); // 各行に4つの数値入力（借方、貸方、税額、etc）
      await FormHelper.fillNumericField(
        this.page,
        `input[type="number"]:nth-of-type(${lineIndex * 4 + 1})`,
        data.debitAmount
      );
    }

    if (data.creditAmount !== undefined && data.creditAmount > 0) {
      // 貸方金額（通常は奇数インデックス: 1, 3, 5...）
      // const creditInput = numberInputs.nth(lineIndex * 4 + 1);
      await FormHelper.fillNumericField(
        this.page,
        `input[type="number"]:nth-of-type(${lineIndex * 4 + 2})`,
        data.creditAmount
      );
    }

    // 明細摘要（任意）
    if (data.description) {
      const lineDescInputs = dialog.locator(this.selectors.lineDescriptionInput);
      if ((await lineDescInputs.count()) > lineIndex) {
        await FormHelper.fillField(this.page, lineDescInputs.nth(lineIndex), data.description);
      }
    }
  }

  /**
   * より安全な金額入力（セレクターを動的に探す）
   */
  async setAmountsSafely(
    lineIndex: number,
    debitAmount?: number,
    creditAmount?: number
  ): Promise<void> {
    const dialog = this.page.locator(this.selectors.dialog);

    // 各行の金額入力フィールドを特定
    const allNumberInputs = await dialog.locator('input[type="number"]').all();

    // デバッグ: 利用可能な入力フィールドを確認
    console.log(`Found ${allNumberInputs.length} number inputs`);

    // 借方金額を入力
    if (debitAmount !== undefined && debitAmount > 0) {
      const debitInputIndex = lineIndex * 2; // 仮定: 各行に借方・貸方の2つの入力
      if (debitInputIndex < allNumberInputs.length) {
        await allNumberInputs[debitInputIndex].fill(String(debitAmount));
        await this.page.keyboard.press('Tab'); // フォーカスを外して値を確定
      }
    }

    // 貸方金額を入力
    if (creditAmount !== undefined && creditAmount > 0) {
      const creditInputIndex = lineIndex * 2 + 1;
      if (creditInputIndex < allNumberInputs.length) {
        await allNumberInputs[creditInputIndex].fill(String(creditAmount));
        await this.page.keyboard.press('Tab');
      }
    }
  }

  /**
   * 行を追加
   */
  async addLine(): Promise<void> {
    const dialog = this.page.locator(this.selectors.dialog);
    const addButton = dialog.locator(this.selectors.addLineButton);

    // 追加ボタンが存在する場合のみクリック
    if ((await addButton.count()) > 0) {
      await addButton.first().click();
      await this.page.waitForTimeout(300); // UI更新待機
    }
  }

  /**
   * 指定した行を削除
   */
  async deleteLine(lineIndex: number): Promise<void> {
    const dialog = this.page.locator(this.selectors.dialog);
    const deleteButtons = dialog.locator(this.selectors.deleteLineButton);

    if ((await deleteButtons.count()) > lineIndex) {
      await deleteButtons.nth(lineIndex).click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * 貸借バランスを確認
   */
  async verifyBalance(): Promise<{ debitTotal: number; creditTotal: number; isBalanced: boolean }> {
    const dialog = this.page.locator(this.selectors.dialog);

    // 合計行を探す
    const totalRow = dialog.locator(this.selectors.totalRow);

    if ((await totalRow.count()) > 0) {
      const debitTotalText =
        (await totalRow.locator(this.selectors.debitTotal).textContent()) || '0';
      const creditTotalText =
        (await totalRow.locator(this.selectors.creditTotal).textContent()) || '0';

      const debitTotal = this.parseAmount(debitTotalText);
      const creditTotal = this.parseAmount(creditTotalText);

      return {
        debitTotal,
        creditTotal,
        isBalanced: debitTotal === creditTotal,
      };
    }

    return { debitTotal: 0, creditTotal: 0, isBalanced: false };
  }

  /**
   * バランスエラーの表示を確認
   */
  async verifyBalanceError(): Promise<void> {
    const dialog = this.page.locator(this.selectors.dialog);
    await expect(dialog.locator(this.selectors.balanceError)).toBeVisible();
  }

  /**
   * バランスエラーが表示されていないことを確認
   */
  async verifyNoBalanceError(): Promise<void> {
    const dialog = this.page.locator(this.selectors.dialog);
    await expect(dialog.locator(this.selectors.balanceError)).toBeHidden();
  }

  /**
   * 仕訳の一覧を取得
   */
  async getEntryList(): Promise<Array<{ date: string; description: string; amount: string }>> {
    const rows = await this.page.locator(this.selectors.entryRow).all();
    const entries = [];

    for (const row of rows) {
      const cells = await row.locator('td').allTextContents();
      if (cells.length >= 3) {
        entries.push({
          date: cells[0].trim(),
          description: cells[1].trim(),
          amount: cells[2].trim(),
        });
      }
    }

    return entries;
  }

  /**
   * 仕訳が一覧に表示されていることを確認
   */
  async verifyEntryExists(description: string): Promise<void> {
    const entryRow = this.page.locator(`tr:has-text("${description}")`);
    await expect(entryRow).toBeVisible();
  }

  /**
   * ダイアログを閉じる
   */
  async closeDialog(): Promise<void> {
    await this.page.click(this.selectors.cancelButton);
    await this.waitForDialogHidden();
  }

  /**
   * 利用可能な勘定科目の一覧を取得
   */
  async getAvailableAccounts(): Promise<string[]> {
    await this.openCreateDialog();
    const dialog = this.page.locator(this.selectors.dialog);
    const firstSelect = dialog.locator(this.selectors.accountSelect).first();
    const accounts = await RadixSelectHelper.getAvailableOptions(this.page, firstSelect);
    await this.closeDialog();
    return accounts;
  }

  /**
   * 金額文字列をパース（カンマ区切りなどに対応）
   */
  private parseAmount(amountText: string): number {
    const cleanText = amountText.replace(/[^\d.-]/g, ''); // 数字とピリオド、マイナス以外を削除
    return parseFloat(cleanText) || 0;
  }

  /**
   * フォームの初期状態を確認
   */
  async verifyFormInitialState(): Promise<void> {
    const dialog = this.page.locator(this.selectors.dialog);

    // 日付フィールドが今日の日付で初期化されていることを確認
    const dateInput = dialog.locator(this.selectors.dateInput);
    const today = new Date().toISOString().split('T')[0];
    await expect(dateInput).toHaveValue(today);

    // 摘要が空であることを確認
    await expect(dialog.locator(this.selectors.descriptionInput)).toHaveValue('');

    // 最低2行の明細行が存在することを確認
    const accountSelects = await dialog.locator(this.selectors.accountSelect).count();
    expect(accountSelects).toBeGreaterThanOrEqual(2);
  }

  /**
   * 複雑な仕訳を作成（複数行）
   */
  async createComplexEntry(data: {
    date: string;
    description: string;
    lines: Array<{
      account: string;
      debitAmount?: number;
      creditAmount?: number;
      description?: string;
    }>;
  }): Promise<void> {
    await this.openCreateDialog();

    const dialog = this.page.locator(this.selectors.dialog);

    // 基本情報を入力
    await FormHelper.fillField(this.page, this.selectors.dateInput, data.date);
    await FormHelper.fillTextarea(this.page, this.selectors.descriptionInput, data.description);

    // 必要に応じて行を追加
    const currentLines = await dialog.locator(this.selectors.accountSelect).count();
    const neededLines = data.lines.length;

    for (let i = currentLines; i < neededLines; i++) {
      await this.addLine();
    }

    // 各行を設定
    for (let i = 0; i < data.lines.length; i++) {
      await this.setAccountLine(i, data.lines[i]);
      await this.page.waitForTimeout(200); // 各行の処理間に小さな待機
    }

    // バランスが一致するまで待機
    let attempts = 0;
    while (attempts < 5) {
      const balance = await this.verifyBalance();
      if (balance.isBalanced) break;

      await this.page.waitForTimeout(500);
      attempts++;
    }

    // 保存
    await FormHelper.submitForm(this.page, this.selectors.createButton, {
      waitForResponse: true,
    });

    await this.waitForDialogHidden();
  }
}
