/**
 * 勘定科目関連のバリデーションスキーマ
 */

import { z } from 'zod';

import { AccountType } from '../types/enums';

// 勘定科目コードのバリデーション
const accountCodeSchema = z
  .string()
  .min(1, '勘定科目コードを入力してください')
  .max(10, '勘定科目コードは10文字以内で入力してください')
  .regex(/^[0-9A-Za-z-]+$/, '勘定科目コードは英数字とハイフンのみ使用できます');

// 勘定科目名のバリデーション
const accountNameSchema = z
  .string()
  .min(1, '勘定科目名を入力してください')
  .max(100, '勘定科目名は100文字以内で入力してください');

// 勘定科目作成スキーマ
export const createAccountSchema = z.object({
  code: accountCodeSchema,
  name: accountNameSchema,
  accountType: z.enum(
    [
      AccountType.ASSET,
      AccountType.LIABILITY,
      AccountType.EQUITY,
      AccountType.REVENUE,
      AccountType.EXPENSE,
    ],
    {
      required_error: '勘定科目タイプを選択してください',
      invalid_type_error: '無効な勘定科目タイプです',
    }
  ),
  parentId: z.string().uuid('親科目IDの形式が正しくありません').nullable().optional(),
});

// 勘定科目更新スキーマ
export const updateAccountSchema = z.object({
  code: accountCodeSchema.optional(),
  name: accountNameSchema.optional(),
  accountType: z
    .enum([
      AccountType.ASSET,
      AccountType.LIABILITY,
      AccountType.EQUITY,
      AccountType.REVENUE,
      AccountType.EXPENSE,
    ])
    .optional(),
  parentId: z.string().uuid('親科目IDの形式が正しくありません').nullable().optional(),
  isActive: z.boolean().optional(),
});

// 勘定科目フィルタースキーマ
export const accountFilterSchema = z.object({
  accountType: z
    .enum([
      AccountType.ASSET,
      AccountType.LIABILITY,
      AccountType.EQUITY,
      AccountType.REVENUE,
      AccountType.EXPENSE,
    ])
    .optional(),
  isActive: z.boolean().optional(),
  parentId: z.string().uuid().nullable().optional(),
  searchTerm: z.string().optional(),
});

// 型のエクスポート
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type AccountFilterInput = z.infer<typeof accountFilterSchema>;
