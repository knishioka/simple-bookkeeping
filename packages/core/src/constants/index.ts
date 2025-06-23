/**
 * 共通定数
 */

// APIエンドポイント
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
  },
  ACCOUNTS: {
    BASE: '/accounts',
    BY_ID: (id: string) => `/accounts/${id}`,
  },
  JOURNAL_ENTRIES: {
    BASE: '/journal-entries',
    BY_ID: (id: string) => `/journal-entries/${id}`,
    APPROVE: (id: string) => `/journal-entries/${id}/approve`,
    POST: (id: string) => `/journal-entries/${id}/post`,
  },
  REPORTS: {
    TRIAL_BALANCE: '/reports/trial-balance',
    BALANCE_SHEET: '/reports/balance-sheet',
    PROFIT_LOSS: '/reports/profit-loss',
  },
} as const;

// HTTPステータスコード
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// エラーコード
export const ERROR_CODES = {
  // 認証関連
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  UNAUTHORIZED: 'UNAUTHORIZED',

  // バリデーション
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // リソース関連
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // システム
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

// ページネーション
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 20,
  MAX_PER_PAGE: 100,
} as const;

// 日付フォーマット
export const DATE_FORMAT = {
  DISPLAY: 'yyyy年MM月dd日',
  INPUT: 'yyyy-MM-dd',
  DATETIME: 'yyyy-MM-dd HH:mm:ss',
} as const;
