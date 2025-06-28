// Account type labels in Japanese
export const ACCOUNT_TYPE_LABELS = {
  ASSET: '資産',
  LIABILITY: '負債',
  EQUITY: '純資産',
  REVENUE: '収益',
  EXPENSE: '費用',
} as const;

// Journal status labels in Japanese
export const JOURNAL_STATUS_LABELS = {
  DRAFT: '下書き',
  APPROVED: '承認済み',
  LOCKED: 'ロック済み',
} as const;

// User role labels in Japanese
export const USER_ROLE_LABELS = {
  ADMIN: '管理者',
  ACCOUNTANT: '経理担当者',
  VIEWER: '閲覧者',
} as const;

// Partner type labels in Japanese
export const PARTNER_TYPE_LABELS = {
  CUSTOMER: '顧客',
  VENDOR: '仕入先',
  BOTH: '顧客・仕入先',
} as const;

// Tax rates
export const TAX_RATES = {
  STANDARD: 10,
  REDUCED: 8,
  EXEMPT: 0,
} as const;

// Date formats (moved to api.constants.ts to avoid conflict)
// export const DATE_FORMAT = 'yyyy-MM-dd' as const;
export const DATETIME_FORMAT = 'yyyy-MM-dd HH:mm:ss' as const;

// Export all constants from other files
export * from './api.constants';
export * from './database.constants';
