import { z } from 'zod';

import { dateStringSchema, uuidSchema, queryParamsSchema } from './common';

/**
 * 会計期間のバリデーションスキーマ
 */

// 会計期間の名称バリデーション
const periodNameSchema = z
  .string()
  .min(1, { message: '会計期間の名称は必須です' })
  .max(100, { message: '会計期間の名称は100文字以内で入力してください' })
  .regex(/^[^<>'";&]*$/, { message: '会計期間の名称に使用できない文字が含まれています' });

// 会計期間の作成用入力スキーマ
export const createAccountingPeriodSchema = z
  .object({
    name: periodNameSchema,
    start_date: dateStringSchema,
    end_date: dateStringSchema,
    description: z
      .string()
      .max(500, { message: '説明は500文字以内で入力してください' })
      .regex(/^[^<>'";&]*$/, { message: '説明に使用できない文字が含まれています' })
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);
      return start < end;
    },
    {
      message: '開始日は終了日より前である必要があります',
      path: ['end_date'],
    }
  )
  .refine(
    (data) => {
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);
      const maxPeriod = new Date(start);
      maxPeriod.setFullYear(maxPeriod.getFullYear() + 2); // 最大2年の期間
      return end <= maxPeriod;
    },
    {
      message: '会計期間は最大2年までです',
      path: ['end_date'],
    }
  );

// 会計期間の更新用入力スキーマ
export const updateAccountingPeriodSchema = z
  .object({
    name: periodNameSchema.optional(),
    start_date: dateStringSchema.optional(),
    end_date: dateStringSchema.optional(),
    description: z
      .string()
      .max(500, { message: '説明は500文字以内で入力してください' })
      .regex(/^[^<>'";&]*$/, { message: '説明に使用できない文字が含まれています' })
      .optional()
      .nullable(),
    is_closed: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // 両方の日付が提供された場合のみ検証
      if (data.start_date && data.end_date) {
        const start = new Date(data.start_date);
        const end = new Date(data.end_date);
        return start < end;
      }
      return true;
    },
    {
      message: '開始日は終了日より前である必要があります',
      path: ['end_date'],
    }
  );

// 会計期間の一覧取得用パラメータスキーマ
export const getAccountingPeriodsParamsSchema = queryParamsSchema.extend({
  organizationId: uuidSchema,
});

// 会計期間ID検証スキーマ
export const accountingPeriodIdSchema = z.object({
  periodId: uuidSchema,
});

// 組織IDと期間IDの検証スキーマ
export const periodWithOrgSchema = z.object({
  periodId: uuidSchema,
  organizationId: uuidSchema,
});

// 会計期間のフィルタスキーマ
export const accountingPeriodFilterSchema = z.object({
  organizationId: uuidSchema,
  isActive: z.boolean().optional(),
  isClosed: z.boolean().optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
});

// 会計期間の重複チェック用パラメータスキーマ
export const checkPeriodOverlapSchema = z.object({
  organizationId: uuidSchema,
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  excludeId: uuidSchema.optional(),
});

/**
 * 型定義のエクスポート
 */
export type CreateAccountingPeriodInput = z.infer<typeof createAccountingPeriodSchema>;
export type UpdateAccountingPeriodInput = z.infer<typeof updateAccountingPeriodSchema>;
export type GetAccountingPeriodsParams = z.infer<typeof getAccountingPeriodsParamsSchema>;
export type AccountingPeriodFilter = z.infer<typeof accountingPeriodFilterSchema>;
export type CheckPeriodOverlapParams = z.infer<typeof checkPeriodOverlapSchema>;
