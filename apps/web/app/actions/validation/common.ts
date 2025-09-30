import { z } from 'zod';

/**
 * 共通バリデーションスキーマ
 */

// ページネーション用スキーマ
export const paginationSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),
});

// クエリパラメータ用スキーマ
export const queryParamsSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  orderBy: z.string().optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
  search: z.string().max(100).optional(),
});

// UUID形式のIDバリデーション
export const uuidSchema = z.string().uuid({
  message: '無効なID形式です',
});

// 日付文字列バリデーション (YYYY-MM-DD形式)
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: '日付はYYYY-MM-DD形式で入力してください',
  })
  .refine(
    (date) => {
      const d = new Date(date);
      return !isNaN(d.getTime());
    },
    {
      message: '有効な日付を入力してください',
    }
  );

// 金額バリデーション
export const amountSchema = z
  .number()
  .min(0, { message: '金額は0以上の値を入力してください' })
  .max(999999999999, { message: '金額が大きすぎます' })
  .refine(
    (val) => {
      // 小数点以下2桁まで許可
      const decimals = (val.toString().split('.')[1] || '').length;
      return decimals <= 2;
    },
    {
      message: '金額は小数点以下2桁までです',
    }
  );

// 組織IDバリデーション
export const organizationIdSchema = z.string().uuid({
  message: '無効な組織IDです',
});

// ユーザーIDバリデーション
export const userIdSchema = z.string().uuid({
  message: '無効なユーザーIDです',
});

// 検索文字列のサニタイズ
export function sanitizeSearchString(search: string): string {
  // SQLインジェクション対策: 特殊文字をエスケープ
  return search
    .replace(/[%_]/g, '\\$&') // SQL wildcards
    .replace(/['";]/g, '') // Quotes and semicolons
    .trim();
}

// 日付範囲バリデーション
export const dateRangeSchema = z
  .object({
    startDate: dateStringSchema,
    endDate: dateStringSchema,
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return start <= end;
    },
    {
      message: '開始日は終了日以前である必要があります',
      path: ['endDate'],
    }
  );

/**
 * Zodエラーをフォーマットしてユーザーフレンドリーなメッセージにする
 * @param error - ZodError
 * @returns フォーマットされたエラーメッセージ
 */
export function formatZodError(error: z.ZodError): string {
  const issues = error.issues || [];
  const errors = issues.map((err) => {
    const path = err.path.join('.');
    return path ? `${path}: ${err.message}` : err.message;
  });

  return errors.join(', ');
}

/**
 * Zodエラーを詳細なエラー情報として返す
 * @param error - ZodError
 * @returns エラーの詳細情報
 */
export function getZodErrorDetails(error: z.ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  const issues = error.issues || [];

  issues.forEach((err) => {
    const path = err.path.join('.') || 'general';
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(err.message);
  });

  return details;
}
