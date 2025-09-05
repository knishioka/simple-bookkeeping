/**
 * Server Actions 共通型定義
 *
 * Server Actionsのレスポンス形式を統一し、
 * エラーハンドリングを標準化するための型定義
 */

/**
 * Server Action の標準レスポンス型
 * 成功時はdataを、失敗時はerrorを返す
 */
export type ActionResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: ActionError };

/**
 * エラー情報の型定義
 */
export interface ActionError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * ページネーション情報
 */
export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/**
 * ページネーション付きレスポンス
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationInfo;
}

/**
 * 一般的なクエリパラメータ
 */
export interface QueryParams {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  search?: string;
}

/**
 * エラーコード定数
 */
export const ERROR_CODES = {
  // 認証関連
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // バリデーション関連
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // データベース関連
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',

  // ビジネスロジック関連
  INVALID_OPERATION: 'INVALID_OPERATION',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',

  // システム関連
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

/**
 * エラーレスポンスを作成するヘルパー関数
 */
export function createErrorResult(
  code: string,
  message: string,
  details?: unknown
): ActionResult<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

/**
 * 成功レスポンスを作成するヘルパー関数
 */
export function createSuccessResult<T>(data: T): ActionResult<T> {
  return {
    success: true,
    data,
  };
}

/**
 * 認証エラーレスポンスを作成するヘルパー関数
 */
export function createUnauthorizedResult(): ActionResult<never> {
  return createErrorResult(ERROR_CODES.UNAUTHORIZED, '認証が必要です。ログインしてください。');
}

/**
 * 権限エラーレスポンスを作成するヘルパー関数
 */
export function createForbiddenResult(): ActionResult<never> {
  return createErrorResult(ERROR_CODES.FORBIDDEN, 'この操作を行う権限がありません。');
}

/**
 * Not Found エラーレスポンスを作成するヘルパー関数
 */
export function createNotFoundResult(resource: string): ActionResult<never> {
  return createErrorResult(ERROR_CODES.NOT_FOUND, `${resource}が見つかりません。`);
}

/**
 * バリデーションエラーレスポンスを作成するヘルパー関数
 */
export function createValidationErrorResult(
  message: string,
  details?: unknown
): ActionResult<never> {
  return createErrorResult(ERROR_CODES.VALIDATION_ERROR, message, details);
}

/**
 * 内部エラーレスポンスを作成するヘルパー関数
 */
export function createInternalErrorResult(error: unknown): ActionResult<never> {
  console.error('Internal Server Error:', error);

  return createErrorResult(
    ERROR_CODES.INTERNAL_ERROR,
    'システムエラーが発生しました。しばらく時間をおいて再度お試しください。',
    process.env.NODE_ENV === 'development' ? error : undefined
  );
}

/**
 * Supabaseエラーをハンドリングするヘルパー関数
 */
export function handleSupabaseError(error: unknown): ActionResult<never> {
  console.error('Supabase Error:', error);

  // Type guard to check if error has a code property
  const errorWithCode = error as { code?: string; message?: string };

  // 認証エラー
  if (errorWithCode.code === 'PGRST301') {
    return createUnauthorizedResult();
  }

  // 権限エラー
  if (errorWithCode.code === 'PGRST200' || errorWithCode.code === '42501') {
    return createForbiddenResult();
  }

  // 一意制約違反
  if (errorWithCode.code === '23505') {
    return createErrorResult(ERROR_CODES.ALREADY_EXISTS, 'このデータは既に存在します。');
  }

  // 外部キー制約違反
  if (errorWithCode.code === '23503') {
    return createErrorResult(
      ERROR_CODES.CONSTRAINT_VIOLATION,
      '関連するデータが存在しないため、操作を実行できません。'
    );
  }

  // その他のエラー
  return createInternalErrorResult(error);
}
