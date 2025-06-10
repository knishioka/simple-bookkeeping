import { Page, expect } from '@playwright/test';

/**
 * E2Eテスト用のヘルパー関数集
 * 
 * 簿記アプリケーション特有の操作を抽象化し、
 * テストコードの再利用性と可読性を向上させます。
 */

/**
 * アプリケーション共通の待機・検証ヘルパー
 */
export class AppHelpers {
  constructor(private page: Page) {}

  /**
   * ページが完全に読み込まれるまで待機
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Toast メッセージの表示を確認
   */
  async expectToast(message: string) {
    await expect(this.page.locator('[data-sonner-toast]')).toContainText(message);
  }

  /**
   * エラーメッセージの表示を確認
   */
  async expectErrorMessage(message: string) {
    await expect(this.page.locator('[role="alert"], .text-destructive')).toContainText(message);
  }

  /**
   * ローディング状態の完了を待機
   */
  async waitForLoadingComplete() {
    await this.page.waitForSelector('[data-testid="loading"]', { state: 'hidden' });
  }
}

/**
 * 認証関連のヘルパー
 */
export class AuthHelpers {
  constructor(private page: Page) {}

  /**
   * ログイン実行
   */
  async login(email: string = 'test@example.com', password: string = 'password') {
    await this.page.goto('/login');
    
    // フォーム入力
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    
    // ログインボタンクリック
    await this.page.click('button[type="submit"]');
    
    // ダッシュボードへのリダイレクトを待機
    await this.page.waitForURL('/dashboard');
  }

  /**
   * ログアウト実行
   */
  async logout() {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.click('text=ログアウト');
    await this.page.waitForURL('/login');
  }
}

/**
 * 勘定科目関連のヘルパー
 */
export class AccountHelpers {
  constructor(private page: Page) {}

  /**
   * 勘定科目作成ダイアログを開く
   */
  async openCreateDialog() {
    await this.page.click('text=勘定科目を追加');
    await expect(this.page.locator('[role="dialog"]')).toBeVisible();
  }

  /**
   * 勘定科目を作成
   */
  async createAccount(code: string, name: string, type: string, parentId?: string) {
    await this.openCreateDialog();
    
    // 基本情報入力
    await this.page.fill('input[name="code"]', code);
    await this.page.fill('input[name="name"]', name);
    
    // タイプ選択（Radix UI Select）
    await this.selectAccountType(type);
    
    // 親科目選択（任意）
    if (parentId) {
      await this.selectParentAccount(parentId);
    }
    
    // 作成ボタンクリック
    await this.page.click('button:has-text("作成")');
    
    // ダイアログが閉じるまで待機
    await expect(this.page.locator('[role="dialog"]')).toBeHidden();
  }

  /**
   * Radix UI Selectで勘定科目タイプを選択
   */
  async selectAccountType(type: string) {
    // Select trigger をクリック
    await this.page.click('[data-testid="account-type-select"] button[role="combobox"]');
    
    // オプションが表示されるまで待機
    await expect(this.page.locator('[role="option"]').first()).toBeVisible();
    
    // 指定されたタイプを選択
    await this.page.click(`[role="option"]:has-text("${type}")`);
  }

  /**
   * 親科目を選択
   */
  async selectParentAccount(parentName: string) {
    await this.page.click('[data-testid="parent-account-select"] button[role="combobox"]');
    await expect(this.page.locator('[role="option"]').first()).toBeVisible();
    await this.page.click(`[role="option"]:has-text("${parentName}")`);
  }

  /**
   * 勘定科目一覧で特定の科目を検索
   */
  async searchAccount(searchTerm: string) {
    await this.page.fill('input[placeholder*="検索"]', searchTerm);
    await this.page.waitForTimeout(500); // デバウンス待機
  }

  /**
   * 勘定科目の存在確認
   */
  async expectAccountExists(code: string, name: string) {
    const accountRow = this.page.locator(`tr:has-text("${code}"):has-text("${name}")`);
    await expect(accountRow).toBeVisible();
  }
}

/**
 * 仕訳関連のヘルパー
 */
export class JournalHelpers {
  constructor(private page: Page) {}

  /**
   * 仕訳作成ダイアログを開く
   */
  async openCreateDialog() {
    await this.page.click('text=仕訳を追加');
    await expect(this.page.locator('[role="dialog"]')).toBeVisible();
  }

  /**
   * 仕訳を作成
   */
  async createJournalEntry(description: string, lines: JournalLine[]) {
    await this.openCreateDialog();
    
    // 摘要入力
    await this.page.fill('input[name="description"]', description);
    
    // 仕訳明細入力
    for (let i = 0; i < lines.length; i++) {
      await this.setJournalLine(i, lines[i]);
    }
    
    // 作成ボタンクリック
    await this.page.click('button:has-text("作成")');
    
    // ダイアログが閉じるまで待機
    await expect(this.page.locator('[role="dialog"]')).toBeHidden();
  }

  /**
   * 仕訳明細の設定
   */
  async setJournalLine(lineIndex: number, line: JournalLine) {
    const lineLocator = this.page.locator(`[data-testid="journal-line-${lineIndex}"]`);
    
    // 勘定科目選択
    await lineLocator.locator('button[role="combobox"]').click();
    await this.page.click(`[role="option"]:has-text("${line.accountName}")`);
    
    // 借方・貸方金額入力
    if (line.debitAmount > 0) {
      await lineLocator.locator('input[name*="debit"]').fill(line.debitAmount.toString());
    }
    if (line.creditAmount > 0) {
      await lineLocator.locator('input[name*="credit"]').fill(line.creditAmount.toString());
    }
  }

  /**
   * 仕訳残高の確認
   */
  async expectBalanced() {
    await expect(this.page.locator('text=差額: ¥0')).toBeVisible();
  }

  /**
   * 仕訳の存在確認
   */
  async expectJournalEntryExists(description: string) {
    await expect(this.page.locator(`tr:has-text("${description}")`)).toBeVisible();
  }
}

/**
 * 仕訳明細の型定義
 */
export interface JournalLine {
  accountName: string;
  debitAmount: number;
  creditAmount: number;
}

/**
 * テストユーティリティ関数
 */
export class TestUtils {
  /**
   * ランダムな文字列生成
   */
  static randomString(length: number = 8): string {
    return Math.random().toString(36).substring(2, length + 2);
  }

  /**
   * 現在の日付をYYYY-MM-DD形式で取得
   */
  static getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * 数値をカンマ区切りで表示
   */
  static formatCurrency(amount: number): string {
    return `¥${amount.toLocaleString()}`;
  }
}