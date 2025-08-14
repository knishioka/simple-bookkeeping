/**
 * Test-specific constants for Simple Bookkeeping
 */

// Test Account Codes
export const TEST_ACCOUNTS = {
  // 資産
  CASH: {
    code: '1000',
    name: '現金',
    type: 'ASSET' as const,
    category: 'CURRENT_ASSETS' as const,
  },
  BANK: {
    code: '1010',
    name: '普通預金',
    type: 'ASSET' as const,
    category: 'CURRENT_ASSETS' as const,
  },
  ACCOUNTS_RECEIVABLE: {
    code: '1200',
    name: '売掛金',
    type: 'ASSET' as const,
    category: 'CURRENT_ASSETS' as const,
  },

  // 負債
  ACCOUNTS_PAYABLE: {
    code: '2000',
    name: '買掛金',
    type: 'LIABILITY' as const,
    category: 'CURRENT_LIABILITIES' as const,
  },

  // 資本
  CAPITAL: {
    code: '3000',
    name: '資本金',
    type: 'EQUITY' as const,
    category: 'CAPITAL' as const,
  },

  // 収益
  SALES: {
    code: '4000',
    name: '売上高',
    type: 'REVENUE' as const,
    category: 'OPERATING_REVENUE' as const,
  },

  // 費用
  COST_OF_SALES: {
    code: '5000',
    name: '売上原価',
    type: 'EXPENSE' as const,
    category: 'COST_OF_SALES' as const,
  },
  RENT_EXPENSE: {
    code: '6000',
    name: '地代家賃',
    type: 'EXPENSE' as const,
    category: 'OPERATING_EXPENSES' as const,
  },
  UTILITIES_EXPENSE: {
    code: '6100',
    name: '水道光熱費',
    type: 'EXPENSE' as const,
    category: 'OPERATING_EXPENSES' as const,
  },
  OFFICE_SUPPLIES: {
    code: '6200',
    name: '消耗品費',
    type: 'EXPENSE' as const,
    category: 'OPERATING_EXPENSES' as const,
  },
} as const;

// Test Credentials
export const TEST_CREDENTIALS = {
  ADMIN: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin.test@example.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'AdminTest123!',
    name: 'Test Admin',
    role: 'admin' as const,
  },
  ACCOUNTANT: {
    email: process.env.TEST_ACCOUNTANT_EMAIL || 'accountant.test@example.com',
    password: process.env.TEST_ACCOUNTANT_PASSWORD || 'AccountantTest123!',
    name: 'Test Accountant',
    role: 'accountant' as const,
  },
  VIEWER: {
    email: process.env.TEST_VIEWER_EMAIL || 'viewer.test@example.com',
    password: process.env.TEST_VIEWER_PASSWORD || 'ViewerTest123!',
    name: 'Test Viewer',
    role: 'viewer' as const,
  },
} as const;

// Test Organization
export const TEST_ORGANIZATION = {
  name: 'Test Organization',
  code: 'TEST001',
  fiscalYearEnd: 3, // March
} as const;

// Test Accounting Period
export const TEST_ACCOUNTING_PERIOD = {
  name: '2024年度',
  startDate: '2024-04-01',
  endDate: '2025-03-31',
  isClosed: false,
} as const;

// Test Journal Entries
export const TEST_JOURNAL_ENTRIES = {
  SIMPLE_CASH_SALE: {
    date: '2024-04-15',
    description: '現金売上',
    lines: [
      {
        accountCode: TEST_ACCOUNTS.CASH.code,
        debitAmount: 10000,
        creditAmount: 0,
      },
      {
        accountCode: TEST_ACCOUNTS.SALES.code,
        debitAmount: 0,
        creditAmount: 10000,
      },
    ],
  },
  EXPENSE_PAYMENT: {
    date: '2024-04-20',
    description: '家賃支払い',
    lines: [
      {
        accountCode: TEST_ACCOUNTS.RENT_EXPENSE.code,
        debitAmount: 50000,
        creditAmount: 0,
      },
      {
        accountCode: TEST_ACCOUNTS.CASH.code,
        debitAmount: 0,
        creditAmount: 50000,
      },
    ],
  },
} as const;

// Test Data Limits
export const TEST_LIMITS = {
  MAX_ACCOUNTS: 100,
  MAX_JOURNAL_ENTRIES: 1000,
  MAX_JOURNAL_LINES: 10,
  BULK_INSERT_SIZE: 50,
} as const;

// Test Timeouts (Optimized - Issue #129)
export const TEST_TIMEOUTS = {
  UNIT: 5000, // 5 seconds
  INTEGRATION: 10000, // 10 seconds
  E2E: 10000, // 10 seconds (reduced from 30s)
  SLOW_E2E: 20000, // 20 seconds (reduced from 60s, for data-heavy tests only)
  WAIT_SHORT: 100, // 100ms for short waits
  WAIT_MEDIUM: 500, // 500ms for medium waits
  WAIT_LONG: 1000, // 1s for long waits (avoid using)
} as const;
