// Simple Entry Types for Easy Input Mode

export type TransactionType =
  | 'cash_sale' // 現金売上
  | 'credit_sale' // 掛売上
  | 'cash_purchase' // 現金仕入
  | 'credit_purchase' // 掛仕入
  | 'expense_cash' // 現金経費
  | 'expense_bank' // 振込経費
  | 'salary_payment' // 給与支払
  | 'collection' // 売掛金回収
  | 'payment' // 買掛金支払
  | 'bank_deposit' // 預金預入
  | 'bank_withdrawal' // 預金引出
  | 'transfer'; // 振替

export interface TransactionPattern {
  type: TransactionType;
  name: string;
  description: string;
  icon?: string;
  category: 'income' | 'expense' | 'asset' | 'other';
  defaultDebitAccount?: string; // Account code
  defaultCreditAccount?: string; // Account code
  requiredFields: Array<'amount' | 'account' | 'description' | 'date'>;
  accountSelectionHint?: string;
}

export interface SimpleEntryInput {
  transactionType: TransactionType;
  amount: number;
  date: string;
  description: string;
  selectedAccount?: string; // For transactions requiring account selection
  taxRate?: number;
}

export interface SimpleEntryConversionResult {
  journalEntry: {
    entryDate: string;
    description: string;
    lines: Array<{
      accountId: string;
      debitAmount: number;
      creditAmount: number;
    }>;
  };
  validationErrors?: string[];
}

// Transaction patterns configuration
export const TRANSACTION_PATTERNS: Record<TransactionType, TransactionPattern> = {
  cash_sale: {
    type: 'cash_sale',
    name: '現金売上',
    description: '現金で売上を受け取った',
    icon: '💵',
    category: 'income',
    defaultDebitAccount: '1110', // 現金
    defaultCreditAccount: '4110', // 売上高
    requiredFields: ['amount', 'date', 'description'],
  },
  credit_sale: {
    type: 'credit_sale',
    name: '掛売上',
    description: '後日支払いで売上を計上',
    icon: '📝',
    category: 'income',
    defaultDebitAccount: '1140', // 売掛金
    defaultCreditAccount: '4110', // 売上高
    requiredFields: ['amount', 'date', 'description'],
  },
  cash_purchase: {
    type: 'cash_purchase',
    name: '現金仕入',
    description: '現金で商品を仕入れた',
    icon: '🛒',
    category: 'expense',
    defaultDebitAccount: '5110', // 仕入高
    defaultCreditAccount: '1110', // 現金
    requiredFields: ['amount', 'date', 'description'],
  },
  credit_purchase: {
    type: 'credit_purchase',
    name: '掛仕入',
    description: '後日支払いで仕入れた',
    icon: '📦',
    category: 'expense',
    defaultDebitAccount: '5110', // 仕入高
    defaultCreditAccount: '2110', // 買掛金
    requiredFields: ['amount', 'date', 'description'],
  },
  expense_cash: {
    type: 'expense_cash',
    name: '現金経費',
    description: '現金で経費を支払った',
    icon: '💸',
    category: 'expense',
    defaultCreditAccount: '1110', // 現金
    requiredFields: ['amount', 'account', 'date', 'description'],
    accountSelectionHint: '経費科目を選択してください',
  },
  expense_bank: {
    type: 'expense_bank',
    name: '振込経費',
    description: '銀行振込で経費を支払った',
    icon: '🏦',
    category: 'expense',
    defaultCreditAccount: '1130', // 普通預金
    requiredFields: ['amount', 'account', 'date', 'description'],
    accountSelectionHint: '経費科目を選択してください',
  },
  salary_payment: {
    type: 'salary_payment',
    name: '給与支払',
    description: '従業員に給与を支払った',
    icon: '👥',
    category: 'expense',
    defaultDebitAccount: '5210', // 給料手当
    defaultCreditAccount: '1130', // 普通預金
    requiredFields: ['amount', 'date', 'description'],
  },
  collection: {
    type: 'collection',
    name: '売掛金回収',
    description: '売掛金を回収した',
    icon: '✅',
    category: 'asset',
    defaultDebitAccount: '1130', // 普通預金
    defaultCreditAccount: '1140', // 売掛金
    requiredFields: ['amount', 'date', 'description'],
  },
  payment: {
    type: 'payment',
    name: '買掛金支払',
    description: '買掛金を支払った',
    icon: '💳',
    category: 'asset',
    defaultDebitAccount: '2110', // 買掛金
    defaultCreditAccount: '1130', // 普通預金
    requiredFields: ['amount', 'date', 'description'],
  },
  bank_deposit: {
    type: 'bank_deposit',
    name: '預金預入',
    description: '現金を銀行に預け入れた',
    icon: '🏧',
    category: 'asset',
    defaultDebitAccount: '1130', // 普通預金
    defaultCreditAccount: '1110', // 現金
    requiredFields: ['amount', 'date', 'description'],
  },
  bank_withdrawal: {
    type: 'bank_withdrawal',
    name: '預金引出',
    description: '銀行から現金を引き出した',
    icon: '💰',
    category: 'asset',
    defaultDebitAccount: '1110', // 現金
    defaultCreditAccount: '1130', // 普通預金
    requiredFields: ['amount', 'date', 'description'],
  },
  transfer: {
    type: 'transfer',
    name: '振替',
    description: '勘定科目間の振替',
    icon: '🔄',
    category: 'other',
    requiredFields: ['amount', 'account', 'date', 'description'],
    accountSelectionHint: '振替元と振替先を選択してください',
  },
};

// Helper function to get patterns by category
export const getPatternsByCategory = (category: 'income' | 'expense' | 'asset' | 'other') => {
  return Object.values(TRANSACTION_PATTERNS).filter((p) => p.category === category);
};
