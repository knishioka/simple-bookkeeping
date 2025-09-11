/**
 * Server Actions 共通型定義
 *
 * Server Actionsのレスポンス形式を統一し、
 * エラーハンドリングを標準化するための型定義
 */

import { z } from 'zod';

import { formatZodError, getZodErrorDetails } from './validation/common';

/**
 * Server Action の標準レスポンス型
 * 成功時はdataを、失敗時はerrorを返す
 */
export type ActionResult<T = void> =
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

/**
 * Zodスキーマによる入力検証を行うヘルパー関数
 *
 * @param schema - Zodバリデーションスキーマ
 * @param data - 検証対象のデータ
 * @returns 検証成功時はデータ、失敗時はエラーレスポンス
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: ActionResult<never> } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: createValidationErrorResult(formatZodError(error), getZodErrorDetails(error)),
      };
    }
    return {
      success: false,
      error: createInternalErrorResult(error),
    };
  }
}

/**
 * 検索文字列をサニタイズしてSQLインジェクションを防ぐ
 *
 * @param search - 検索文字列
 * @returns サニタイズされた検索文字列
 */
export function sanitizeSearchQuery(search: string | undefined): string | undefined {
  if (!search) return undefined;

  // SQLワイルドカードとクォートをエスケープ
  return search
    .replace(/[%_]/g, '\\$&') // SQL wildcards
    .replace(/['";]/g, '') // Quotes and semicolons
    .replace(/--/g, '') // SQL comments
    .replace(/\/\*/g, '') // Multi-line comments start
    .replace(/\*\//g, '') // Multi-line comments end
    .trim();
}

/**
 * ページネーションパラメータの検証とデフォルト値設定
 *
 * @param params - ページネーションパラメータ
 * @returns 検証済みのページネーションパラメータ
 */
export function validatePaginationParams(params: { page?: number; pageSize?: number }): {
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));

  return { page, pageSize };
}

/**
 * レート制限エラーレスポンスを作成するヘルパー関数
 *
 * @param retryAfter - 再試行可能になるまでの秒数
 * @returns レート制限エラーレスポンス
 */
export function createRateLimitErrorResult(retryAfter?: number): ActionResult<never> {
  return createErrorResult(
    ERROR_CODES.LIMIT_EXCEEDED,
    `リクエスト数が制限を超えました。${retryAfter ? `${retryAfter}秒後に再試行してください。` : 'しばらく待ってから再試行してください。'}`,
    { retryAfter }
  );
}

/**
 * SQL識別子（テーブル名、カラム名など）の検証
 * SQLインジェクション対策
 *
 * @param identifier - 検証する識別子
 * @returns 安全な識別子かどうか
 */
export function isValidSqlIdentifier(identifier: string): boolean {
  // 英数字とアンダースコアのみ、先頭は英字またはアンダースコア
  const pattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  return pattern.test(identifier) && identifier.length <= 63;
}

/**
 * 複数の識別子を検証
 *
 * @param identifiers - 検証する識別子の配列
 * @returns すべて安全な識別子かどうか
 */
export function areValidSqlIdentifiers(identifiers: string[]): boolean {
  return identifiers.every(isValidSqlIdentifier);
}
