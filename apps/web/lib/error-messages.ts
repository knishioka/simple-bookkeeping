/**
 * Security-focused error message utilities
 * Prevents information leakage and user enumeration attacks
 */

import { isProduction } from '@/lib/env';

/**
 * Error types for categorization
 */
export enum ErrorType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NOT_FOUND = 'not_found',
  RATE_LIMIT = 'rate_limit',
  SERVER_ERROR = 'server_error',
  NETWORK = 'network',
  DATABASE = 'database',
  EXTERNAL_SERVICE = 'external_service',
}

/**
 * Language options for error messages
 */
export enum Language {
  JA = 'ja',
  EN = 'en',
}

/**
 * Generic error messages that don't reveal sensitive information
 */
const GENERIC_MESSAGES: Record<ErrorType, Record<Language, string>> = {
  [ErrorType.AUTHENTICATION]: {
    [Language.JA]: '認証情報が正しくありません',
    [Language.EN]: 'Invalid credentials',
  },
  [ErrorType.AUTHORIZATION]: {
    [Language.JA]: 'このアクションを実行する権限がありません',
    [Language.EN]: 'You do not have permission to perform this action',
  },
  [ErrorType.VALIDATION]: {
    [Language.JA]: '入力内容に問題があります',
    [Language.EN]: 'Invalid input provided',
  },
  [ErrorType.NOT_FOUND]: {
    [Language.JA]: 'リソースが見つかりません',
    [Language.EN]: 'Resource not found',
  },
  [ErrorType.RATE_LIMIT]: {
    [Language.JA]: 'リクエストが多すぎます。しばらくしてからお試しください',
    [Language.EN]: 'Too many requests. Please try again later',
  },
  [ErrorType.SERVER_ERROR]: {
    [Language.JA]: 'サーバーエラーが発生しました。しばらくしてからお試しください',
    [Language.EN]: 'A server error occurred. Please try again later',
  },
  [ErrorType.NETWORK]: {
    [Language.JA]: 'ネットワークエラーが発生しました。接続を確認してください',
    [Language.EN]: 'Network error. Please check your connection',
  },
  [ErrorType.DATABASE]: {
    [Language.JA]: 'データベースエラーが発生しました',
    [Language.EN]: 'Database error occurred',
  },
  [ErrorType.EXTERNAL_SERVICE]: {
    [Language.JA]: '外部サービスとの通信に失敗しました',
    [Language.EN]: 'Failed to communicate with external service',
  },
};

/**
 * Specific error messages for common scenarios
 * These are safe to show to users and don't reveal implementation details
 */
const SPECIFIC_MESSAGES: Record<string, Record<Language, string>> = {
  // Authentication
  'auth/invalid-credentials': {
    [Language.JA]: 'メールアドレスまたはパスワードが正しくありません',
    [Language.EN]: 'Invalid email or password',
  },
  'auth/user-not-found': {
    // Don't reveal if user exists - same message as invalid credentials
    [Language.JA]: 'メールアドレスまたはパスワードが正しくありません',
    [Language.EN]: 'Invalid email or password',
  },
  'auth/wrong-password': {
    // Don't reveal if user exists - same message as invalid credentials
    [Language.JA]: 'メールアドレスまたはパスワードが正しくありません',
    [Language.EN]: 'Invalid email or password',
  },
  'auth/email-already-in-use': {
    // Generic message to prevent user enumeration
    [Language.JA]: '登録処理に失敗しました',
    [Language.EN]: 'Registration failed',
  },
  'auth/weak-password': {
    [Language.JA]: 'パスワードが弱すぎます。より強力なパスワードを設定してください',
    [Language.EN]: 'Password is too weak. Please use a stronger password',
  },
  'auth/expired-token': {
    [Language.JA]: 'セッションが期限切れです。再度ログインしてください',
    [Language.EN]: 'Session expired. Please login again',
  },
  'auth/invalid-token': {
    [Language.JA]: '無効な認証トークンです',
    [Language.EN]: 'Invalid authentication token',
  },

  // Rate limiting
  'rate-limit/too-many-attempts': {
    [Language.JA]: 'ログイン試行回数が多すぎます。15分後に再試行してください',
    [Language.EN]: 'Too many login attempts. Please try again in 15 minutes',
  },

  // Validation
  'validation/invalid-email': {
    [Language.JA]: '有効なメールアドレスを入力してください',
    [Language.EN]: 'Please enter a valid email address',
  },
  'validation/required-field': {
    [Language.JA]: '必須項目です',
    [Language.EN]: 'This field is required',
  },
  'validation/invalid-format': {
    [Language.JA]: '入力形式が正しくありません',
    [Language.EN]: 'Invalid format',
  },

  // Account
  'account/not-verified': {
    [Language.JA]: 'メールアドレスの確認が必要です',
    [Language.EN]: 'Email verification required',
  },
  'account/suspended': {
    [Language.JA]: 'アカウントが一時停止されています',
    [Language.EN]: 'Account suspended',
  },
};

/**
 * Error logging configuration
 */
interface ErrorLogConfig {
  error: Error | unknown;
  context?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
}

/**
 * Get a secure error message for display to users
 *
 * @param error - The error object or code
 * @param language - The language for the message
 * @returns A safe error message that doesn't leak sensitive information
 */
export function getSecureErrorMessage(
  error: Error | string | unknown,
  language: Language = Language.JA
): string {
  // If it's a string error code, check specific messages
  if (typeof error === 'string' && SPECIFIC_MESSAGES[error]) {
    return SPECIFIC_MESSAGES[error][language];
  }

  // If it's an Error object with a known code
  if (error instanceof Error) {
    const errorWithCode = error as Error & { code?: string };
    const errorCode = errorWithCode.code || error.message;
    if (SPECIFIC_MESSAGES[errorCode]) {
      return SPECIFIC_MESSAGES[errorCode][language];
    }

    // Try to determine error type from error properties
    const errorType = determineErrorType(error);
    return GENERIC_MESSAGES[errorType][language];
  }

  // Default to generic server error
  return GENERIC_MESSAGES[ErrorType.SERVER_ERROR][language];
}

/**
 * Determine error type from an Error object
 * Order matters: check more specific patterns before generic ones
 */
function determineErrorType(error: Error): ErrorType {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Check for rate limit errors (check early as they're very specific)
  if (message.includes('rate') || message.includes('limit') || message.includes('too many')) {
    return ErrorType.RATE_LIMIT;
  }

  // Check for authorization errors FIRST (before authentication)
  // This prevents "User ... permission" from matching authentication
  if (
    message.includes('permission') ||
    message.includes('forbidden') ||
    message.includes('unauthorized') ||
    message.includes('access denied') ||
    message.includes('insufficient privileges') ||
    name.includes('forbidden')
  ) {
    return ErrorType.AUTHORIZATION;
  }

  // Check for authentication errors (after authorization to avoid false positives)
  if (
    message.includes('auth') ||
    message.includes('login') ||
    message.includes('password') ||
    message.includes('credentials') ||
    message.includes('user not found') ||
    message.includes('account does not exist') ||
    message.includes('invalid email or password') ||
    name.includes('auth')
  ) {
    return ErrorType.AUTHENTICATION;
  }

  // Check for database errors (before network, as some DB errors mention connection)
  if (
    message.includes('database') ||
    message.includes('sql') ||
    message.includes('query') ||
    message.includes('postgresql') ||
    message.includes('mysql') ||
    message.includes('econnrefused') ||
    (message.includes('connection') && (message.includes('5432') || message.includes('db'))) ||
    name.includes('database')
  ) {
    return ErrorType.DATABASE;
  }

  // Check for network errors
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('enotfound') ||
    message.includes('connection refused') ||
    (message.includes('connection') && !message.includes('database')) ||
    name.includes('network')
  ) {
    return ErrorType.NETWORK;
  }

  // Check for validation errors (after auth/authz to avoid false positives)
  if (
    message.includes('validation') ||
    message.includes('invalid input') ||
    message.includes('field is required') ||
    name.includes('validation')
  ) {
    return ErrorType.VALIDATION;
  }

  // Check for not found errors (check late to avoid matching auth errors)
  if (
    (message.includes('not found') && !message.includes('user not found')) ||
    message.includes('404') ||
    name.includes('notfound')
  ) {
    return ErrorType.NOT_FOUND;
  }

  // Default to server error
  return ErrorType.SERVER_ERROR;
}

/**
 * Log error securely (implementation details only in development)
 *
 * @param config - Error logging configuration
 */
export function logErrorSecurely({ error, context = {}, userId, sessionId }: ErrorLogConfig): void {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    userId: userId || 'anonymous',
    sessionId: sessionId || 'no-session',
    environment: process.env.NODE_ENV,
  };

  if (isProduction()) {
    // In production, log minimal information
    console.error('Application Error', {
      ...errorInfo,
      type: determineErrorType(error as Error),
      // Don't log the full error message or stack in production
    });

    // TODO: Send to error tracking service (e.g., Sentry)
    // sendToErrorTracking({ ...errorInfo, error });
  } else {
    // In development, log full error details
    console.error('Application Error (Development)', {
      ...errorInfo,
      error,
      context,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Create a user-friendly error response
 */
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    type: ErrorType;
  };
  timestamp: string;
}

/**
 * Create a standardized error response
 *
 * @param error - The error to convert
 * @param language - The language for the message
 * @returns A standardized error response object
 */
export function createErrorResponse(
  error: Error | string | unknown,
  language: Language = Language.JA
): ErrorResponse {
  const errorType = error instanceof Error ? determineErrorType(error) : ErrorType.SERVER_ERROR;

  return {
    success: false,
    error: {
      message: getSecureErrorMessage(error, language),
      type: errorType,
      // Only include error code in development
      ...(isProduction() ? {} : { code: error instanceof Error ? error.message : String(error) }),
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper to check if an error is a specific type
 */
export function isErrorType(error: unknown, type: ErrorType): boolean {
  if (error instanceof Error) {
    return determineErrorType(error) === type;
  }
  return false;
}

/**
 * Helper to sanitize error messages for logging
 * Removes potentially sensitive information
 */
export function sanitizeErrorForLogging(error: Error | string): string {
  let message = typeof error === 'string' ? error : error.message;

  // Remove potential sensitive patterns
  const sensitivePatterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card numbers
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN pattern
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, // Bearer tokens
    /[a-zA-Z0-9]{32,}/g, // API keys or tokens
  ];

  for (const pattern of sensitivePatterns) {
    message = message.replace(pattern, '[REDACTED]');
  }

  return message;
}

export default {
  getSecureErrorMessage,
  logErrorSecurely,
  createErrorResponse,
  isErrorType,
  sanitizeErrorForLogging,
  ErrorType,
  Language,
};
