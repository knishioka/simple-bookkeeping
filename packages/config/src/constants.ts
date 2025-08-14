/**
 * Common configuration constants for Simple Bookkeeping
 */

// Server Ports
export const PORTS = {
  WEB: parseInt(process.env.WEB_PORT || '3000', 10),
  API: parseInt(process.env.API_PORT || '3001', 10),
} as const;

// API URLs
export const API_URLS = {
  BASE: process.env.NEXT_PUBLIC_API_URL || `http://localhost:${PORTS.API}`,
  CORS_ORIGIN: process.env.CORS_ORIGIN || `http://localhost:${PORTS.WEB}`,
} as const;

// Timeouts (in milliseconds)
export const TIMEOUTS = {
  API: parseInt(process.env.API_TIMEOUT || '5000', 10),
  DATABASE: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000', 10),
  E2E_TEST: parseInt(process.env.TEST_TIMEOUT || '30000', 10),
  TEST_NAVIGATION: 5000,
  TEST_ELEMENT: 3000,
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: parseInt(process.env.DEFAULT_PAGE_SIZE || '10', 10),
  MAX_PAGE_SIZE: parseInt(process.env.MAX_PAGE_SIZE || '100', 10),
  DEFAULT_PAGE_NUMBER: 1,
} as const;

// Rate Limiting
export const RATE_LIMIT = {
  WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  LOGIN_MAX_ATTEMPTS: parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10),
} as const;

// Session & Auth
export const AUTH = {
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  SESSION_TIMEOUT_MS: parseInt(process.env.SESSION_TIMEOUT_MS || '1800000', 10), // 30 minutes
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
} as const;

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE_MB: parseInt(process.env.FILE_UPLOAD_MAX_SIZE_MB || '10', 10),
  MAX_SIZE_BYTES: parseInt(process.env.FILE_UPLOAD_MAX_SIZE_MB || '10', 10) * 1024 * 1024,
  ALLOWED_MIME_TYPES: [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
} as const;

// CSV Import
export const CSV_IMPORT = {
  MAX_RECORDS: parseInt(process.env.CSV_MAX_RECORDS || '1000', 10),
  BATCH_SIZE: parseInt(process.env.CSV_BATCH_SIZE || '100', 10),
} as const;

// Report Generation
export const REPORT = {
  CACHE_TTL_SECONDS: parseInt(process.env.REPORT_CACHE_TTL || '300', 10), // 5 minutes
  MAX_DATE_RANGE_DAYS: parseInt(process.env.REPORT_MAX_DATE_RANGE_DAYS || '365', 10),
} as const;

// Validation
export const VALIDATION = {
  MAX_DESCRIPTION_LENGTH: 255,
  MAX_NAME_LENGTH: 100,
  MAX_CODE_LENGTH: 10,
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 100,
} as const;

// Database
export const DATABASE = {
  POOL_MIN: parseInt(process.env.DB_POOL_MIN || '2', 10),
  POOL_MAX: parseInt(process.env.DB_POOL_MAX || '10', 10),
  POOL_IDLE_TIMEOUT_MS: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '10000', 10),
  ACQUIRE_TIMEOUT_MS: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '60000', 10),
} as const;
