import { Page, expect } from '@playwright/test';

import { RadixSelectHelper, FormHelper } from '../utils/select-helpers';

import { BasePage } from './base-page';

/**
 * 勘定科目管理ページのPage Object
 */
export class AccountsPage extends BasePage {
  // セレクター定義
  private readonly selectors = {
    newAccountButton: 'text=新規作成',
    searchInput: 'input[placeholder*="検索"]',
    typeFilter: '[role="combobox"]', // タイプフィルター用のSelect
    accountTable: 'table',
    accountRow: 'table tbody tr',
    dialog: '[role="dialog"]',

    // ダイアログ内の要素
    codeInput: 'input[name="code"]',
    nameInput: 'input[name="name"]',
    typeSelect: '[role="dialog"] [role="combobox"]',
    parentSelect: '[role="dialog"] [role="combobox"]',
    createButton: 'button:has-text("作成")',
    updateButton: 'button:has-text("更新")',
    cancelButton: 'button:has-text("キャンセル")',
    deleteButton: 'button[aria-label*="削除"]',
  };

  constructor(page: Page) {
    super(page);
  }

  /**
   * 勘定科目管理ページに移動
   */
  async navigate(): Promise<void> {
    await this.goto('/demo/accounts');
  }

  /**
   * 新規作成ダイアログを開く
   */
  async openCreateDialog(): Promise<void> {
    await this.page.click(this.selectors.newAccountButton);
    await this.waitForDialog();
  }

  /**
   * 勘定科目を検索
   */
  async searchAccounts(searchText: string): Promise<void> {
    await FormHelper.fillField(this.page, this.selectors.searchInput, searchText);
    await this.waitForLoadingComplete();
  }

  /**
   * タイプでフィルタリング
   */
  async filterByType(accountType: string): Promise<void> {
    const filterSelect = this.page.locator(this.selectors.typeFilter).last();
    await RadixSelectHelper.selectOption(this.page, filterSelect, accountType);
    await this.waitForLoadingComplete();
  }

  /**
   * 勘定科目を作成
   */
  async createAccount(data: {
    code: string;
    name: string;
    type: string;
    parentAccount?: string;
  }): Promise<void> {
    await this.openCreateDialog();

    // フォームに入力
    await FormHelper.fillField(this.page, this.selectors.codeInput, data.code);
    await FormHelper.fillField(this.page, this.selectors.nameInput, data.name);

    // タイプを選択（通常は最初のSelect）
    const typeSelect = this.page.locator(this.selectors.typeSelect).first();
    await RadixSelectHelper.selectOption(this.page, typeSelect, data.type);

    // 親勘定科目を選択（必要な場合）
    if (data.parentAccount) {
      const parentSelect = this.page.locator(this.selectors.parentSelect).nth(1);
      await RadixSelectHelper.selectOption(this.page, parentSelect, data.parentAccount);
    }

    // 保存（改善版）
    await FormHelper.submitForm(this.page, this.selectors.createButton, {
      waitForResponse: true,
      responseUrlPattern: '/api/v1/accounts',
      timeout: 10000,
    });

    // ダイアログが閉じるまで待機
    await this.waitForDialogHidden();
  }

  /**
   * 勘定科目を編集
   */
  async editAccount(
    accountCode: string,
    newData: {
      code?: string;
      name?: string;
      type?: string;
    }
  ): Promise<void> {
    // 対象の勘定科目行を探してクリック
    const accountRow = this.page.locator(`tr:has-text("${accountCode}")`);
    await accountRow.click();

    await this.waitForDialog();

    // フィールドを更新
    if (newData.code) {
      await FormHelper.fillField(this.page, this.selectors.codeInput, newData.code);
    }
    if (newData.name) {
      await FormHelper.fillField(this.page, this.selectors.nameInput, newData.name);
    }
    if (newData.type) {
      const typeSelect = this.page.locator(this.selectors.typeSelect).first();
      await RadixSelectHelper.selectOption(this.page, typeSelect, newData.type);
    }

    // 更新（改善版）
    await FormHelper.submitForm(this.page, this.selectors.updateButton, {
      waitForResponse: true,
      responseUrlPattern: '/api/v1/accounts',
      timeout: 10000,
    });

    await this.waitForDialogHidden();
  }

  /**
   * 勘定科目を削除
   */
  async deleteAccount(accountCode: string): Promise<void> {
    const accountRow = this.page.locator(`tr:has-text("${accountCode}")`);
    const deleteButton = accountRow.locator(this.selectors.deleteButton);

    await deleteButton.click();

    // 確認ダイアログ
    await this.waitForDialog();
    await this.page.click('button:has-text("削除する")');

    await this.waitForDialogHidden();
  }

  /**
   * 勘定科目の存在を確認
   */
  async verifyAccountExists(accountCode: string, accountName: string): Promise<void> {
    const accountRow = this.page.locator(
      `tr:has-text("${accountCode}"):has-text("${accountName}")`
    );
    await expect(accountRow).toBeVisible();
  }

  /**
   * 勘定科目が存在しないことを確認
   */
  async verifyAccountNotExists(accountCode: string): Promise<void> {
    const accountRow = this.page.locator(`tr:has-text("${accountCode}")`);
    await expect(accountRow).not.toBeVisible();
  }

  /**
   * 勘定科目の一覧を取得
   */
  async getAccountList(): Promise<Array<{ code: string; name: string; type: string }>> {
    const rows = await this.page.locator(this.selectors.accountRow).all();
    const accounts = [];

    for (const row of rows) {
      const cells = await row.locator('td').allTextContents();
      if (cells.length >= 3) {
        accounts.push({
          code: cells[0].trim(),
          name: cells[1].trim(),
          type: cells[2].trim(),
        });
      }
    }

    return accounts;
  }

  /**
   * バリデーションエラーを確認
   */
  async verifyValidationError(fieldName: string, expectedMessage: string): Promise<void> {
    const dialog = this.page.locator(this.selectors.dialog);
    const errorMessage = dialog.locator(
      `.error:has-text("${expectedMessage}"), [role="alert"]:has-text("${expectedMessage}")`
    );
    await expect(errorMessage).toBeVisible();
  }

  /**
   * フォームの初期状態を確認
   */
  async verifyFormInitialState(): Promise<void> {
    const dialog = this.page.locator(this.selectors.dialog);

    // 必須フィールドが空であることを確認
    await expect(dialog.locator(this.selectors.codeInput)).toHaveValue('');
    await expect(dialog.locator(this.selectors.nameInput)).toHaveValue('');

    // 作成ボタンが存在することを確認
    await expect(dialog.locator(this.selectors.createButton)).toBeVisible();
  }

  /**
   * ダイアログを閉じる
   */
  async closeDialog(): Promise<void> {
    await this.page.click(this.selectors.cancelButton);
    await this.waitForDialogHidden();
  }

  /**
   * 利用可能な勘定科目タイプの一覧を取得
   */
  async getAvailableAccountTypes(): Promise<string[]> {
    await this.openCreateDialog();
    const typeSelect = this.page.locator(this.selectors.typeSelect).first();
    const types = await RadixSelectHelper.getAvailableOptions(this.page, typeSelect);
    await this.closeDialog();
    return types;
  }
}
