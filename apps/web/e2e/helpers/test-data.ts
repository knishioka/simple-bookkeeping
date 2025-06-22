/**
 * E2Eテスト用のテストデータ管理
 *
 * 一貫性のあるテストデータを提供し、
 * テスト間でのデータ競合を避けます。
 */

import { TestUtils } from './test-setup';

/**
 * テストユーザーアカウント
 */
export const TEST_USERS = {
  admin: {
    email: 'admin@test.local',
    password: 'AdminTest123!',
    name: '管理者テスト',
    role: 'ADMIN' as const,
  },
  accountant: {
    email: 'accountant@test.local',
    password: 'AccountantTest123!',
    name: '経理担当テスト',
    role: 'ACCOUNTANT' as const,
  },
  viewer: {
    email: 'viewer@test.local',
    password: 'ViewerTest123!',
    name: '閲覧者テスト',
    role: 'VIEWER' as const,
  },
} as const;

/**
 * 標準的な勘定科目マスター
 */
export const STANDARD_ACCOUNTS = {
  // 資産
  cash: { code: '1110', name: '現金', type: 'ASSET' },
  bank: { code: '1120', name: '普通預金', type: 'ASSET' },
  receivables: { code: '1130', name: '売掛金', type: 'ASSET' },

  // 負債
  payables: { code: '2110', name: '買掛金', type: 'LIABILITY' },
  shortTermLoans: { code: '2120', name: '短期借入金', type: 'LIABILITY' },

  // 純資産
  capital: { code: '3110', name: '資本金', type: 'EQUITY' },
  retainedEarnings: { code: '3120', name: '繰越利益剰余金', type: 'EQUITY' },

  // 収益
  sales: { code: '4110', name: '売上高', type: 'REVENUE' },
  otherIncome: { code: '4120', name: 'その他の収益', type: 'REVENUE' },

  // 費用
  purchases: { code: '5110', name: '仕入高', type: 'EXPENSE' },
  rent: { code: '5120', name: '地代家賃', type: 'EXPENSE' },
  utilities: { code: '5130', name: '水道光熱費', type: 'EXPENSE' },
} as const;

/**
 * よくある仕訳パターン
 */
export const JOURNAL_PATTERNS = {
  // 現金売上
  cashSales: (amount: number) => ({
    description: '現金売上',
    lines: [
      { account: STANDARD_ACCOUNTS.cash, debit: amount, credit: 0 },
      { account: STANDARD_ACCOUNTS.sales, debit: 0, credit: amount },
    ],
  }),

  // 掛売上
  creditSales: (amount: number) => ({
    description: '掛売上',
    lines: [
      { account: STANDARD_ACCOUNTS.receivables, debit: amount, credit: 0 },
      { account: STANDARD_ACCOUNTS.sales, debit: 0, credit: amount },
    ],
  }),

  // 売掛金回収
  collectReceivables: (amount: number) => ({
    description: '売掛金回収',
    lines: [
      { account: STANDARD_ACCOUNTS.cash, debit: amount, credit: 0 },
      { account: STANDARD_ACCOUNTS.receivables, debit: 0, credit: amount },
    ],
  }),

  // 現金仕入
  cashPurchase: (amount: number) => ({
    description: '現金仕入',
    lines: [
      { account: STANDARD_ACCOUNTS.purchases, debit: amount, credit: 0 },
      { account: STANDARD_ACCOUNTS.cash, debit: 0, credit: amount },
    ],
  }),

  // 掛仕入
  creditPurchase: (amount: number) => ({
    description: '掛仕入',
    lines: [
      { account: STANDARD_ACCOUNTS.purchases, debit: amount, credit: 0 },
      { account: STANDARD_ACCOUNTS.payables, debit: 0, credit: amount },
    ],
  }),

  // 家賃支払い
  rentPayment: (amount: number) => ({
    description: '家賃支払い',
    lines: [
      { account: STANDARD_ACCOUNTS.rent, debit: amount, credit: 0 },
      { account: STANDARD_ACCOUNTS.cash, debit: 0, credit: amount },
    ],
  }),
} as const;

/**
 * テストシナリオ用のデータセット
 */
export class TestDataBuilder {
  /**
   * ユニークな勘定科目コードを生成
   */
  static generateUniqueAccountCode(baseCode: string = '9999'): string {
    const suffix = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `${baseCode}${suffix}`;
  }

  /**
   * テスト用の勘定科目データを生成
   */
  static createTestAccount(overrides: Partial<AccountData> = {}): AccountData {
    return {
      code: this.generateUniqueAccountCode(),
      name: `テスト科目_${TestUtils.randomString(6)}`,
      type: 'ASSET',
      ...overrides,
    };
  }

  /**
   * テスト用の仕訳データを生成
   */
  static createTestJournalEntry(overrides: Partial<JournalEntryData> = {}): JournalEntryData {
    const amount = Math.floor(Math.random() * 100000) + 10000;

    return {
      description: `テスト仕訳_${TestUtils.randomString(6)}`,
      entryDate: TestUtils.getCurrentDate(),
      lines: JOURNAL_PATTERNS.cashSales(amount).lines,
      ...overrides,
    };
  }

  /**
   * 複数行の複雑な仕訳を生成
   */
  static createComplexJournalEntry(): JournalEntryData {
    return {
      description: '複雑な仕訳（複数明細）',
      entryDate: TestUtils.getCurrentDate(),
      lines: [
        { account: STANDARD_ACCOUNTS.cash, debit: 50000, credit: 0 },
        { account: STANDARD_ACCOUNTS.bank, debit: 30000, credit: 0 },
        { account: STANDARD_ACCOUNTS.sales, debit: 0, credit: 70000 },
        { account: STANDARD_ACCOUNTS.otherIncome, debit: 0, credit: 10000 },
      ],
    };
  }

  /**
   * 期首残高設定用の仕訳
   */
  static createOpeningBalances(): JournalEntryData[] {
    return [
      {
        description: '期首残高設定',
        entryDate: '2024-01-01',
        lines: [
          { account: STANDARD_ACCOUNTS.cash, debit: 500000, credit: 0 },
          { account: STANDARD_ACCOUNTS.bank, debit: 1000000, credit: 0 },
          { account: STANDARD_ACCOUNTS.capital, debit: 0, credit: 1500000 },
        ],
      },
    ];
  }
}

/**
 * 型定義
 */
export interface AccountData {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  parentId?: string;
}

export interface JournalLineData {
  account: AccountData;
  debit: number;
  credit: number;
  description?: string;
}

export interface JournalEntryData {
  description: string;
  entryDate: string;
  lines: JournalLineData[];
}

/**
 * テスト環境のクリーンアップ用のユーティリティ
 */
export class TestCleanup {
  /**
   * テスト用のアカウントを識別するためのプレフィックス
   */
  static readonly TEST_PREFIX = 'TEST_';

  /**
   * テスト専用のユーザーメールドメイン
   */
  static readonly TEST_EMAIL_DOMAIN = '@test.local';

  /**
   * テストデータかどうかを判定
   */
  static isTestData(data: { code?: string; email?: string; name?: string }): boolean {
    return !!(
      data.code?.startsWith(this.TEST_PREFIX) ||
      data.email?.endsWith(this.TEST_EMAIL_DOMAIN) ||
      data.name?.includes('テスト')
    );
  }
}
