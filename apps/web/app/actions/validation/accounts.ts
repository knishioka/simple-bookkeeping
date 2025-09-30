import { z } from 'zod';

import { queryParamsSchema, uuidSchema } from './common';

/**
 * 勘定科目関連のバリデーションスキーマ
 */

// 勘定科目コードのバリデーション
const accountCodeSchema = z
  .string()
  .min(1, { message: '勘定科目コードは必須です' })
  .max(20, { message: '勘定科目コードは20文字以内で入力してください' })
  .regex(/^[A-Z0-9_-]+$/i, {
    message: '勘定科目コードは英数字、ハイフン、アンダースコアのみ使用できます',
  });

// 勘定科目名のバリデーション
const accountNameSchema = z
  .string()
  .min(1, { message: '勘定科目名は必須です' })
  .max(100, { message: '勘定科目名は100文字以内で入力してください' });

// 勘定科目タイプのバリデーション
const accountTypeSchema = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);

// 勘定科目作成用スキーマ
export const createAccountSchema = z.object({
  code: accountCodeSchema,
  name: accountNameSchema,
  type: accountTypeSchema,
  description: z.string().max(500).optional(),
  parentId: uuidSchema.optional(),
  isActive: z.boolean().optional().default(true),
});

// 勘定科目更新用スキーマ
export const updateAccountSchema = z.object({
  code: accountCodeSchema.optional(),
  name: accountNameSchema.optional(),
  type: accountTypeSchema.optional(),
  description: z.string().max(500).optional(),
  parentId: uuidSchema.nullable().optional(),
  isActive: z.boolean().optional(),
});

// 勘定科目取得用パラメータスキーマ
export const getAccountsParamsSchema = queryParamsSchema.extend({
  type: accountTypeSchema.optional(),
  isActive: z.boolean().optional(),
  parentId: uuidSchema.nullable().optional(),
});

// 勘定科目取得用スキーマ
export const getAccountSchema = z.object({
  id: uuidSchema,
});

// 勘定科目削除用スキーマ
export const deleteAccountSchema = z.object({
  id: uuidSchema,
  force: z.boolean().optional().default(false),
});

// 勘定科目インポート用スキーマ
export const importAccountsSchema = z.object({
  accounts: z
    .array(
      z.object({
        code: accountCodeSchema,
        name: accountNameSchema,
        type: accountTypeSchema,
        description: z.string().max(500).optional(),
        parentCode: z.string().optional(),
      })
    )
    .min(1, { message: 'インポートする勘定科目が必要です' })
    .max(1000, { message: '一度にインポートできるのは1000件までです' }),
  updateExisting: z.boolean().optional().default(false),
});

// 勘定科目集計用スキーマ
export const accountBalanceParamsSchema = z.object({
  accountId: uuidSchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  includeSubAccounts: z.boolean().optional().default(false),
});

// 勘定科目検索用スキーマ
export const searchAccountsSchema = z.object({
  query: z.string().min(1).max(100),
  types: z.array(accountTypeSchema).optional(),
  limit: z.number().int().min(1).max(100).optional().default(10),
  includeInactive: z.boolean().optional().default(false),
});

// バリデーション関数のエクスポート
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type GetAccountsParams = z.infer<typeof getAccountsParamsSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type ImportAccountsInput = z.infer<typeof importAccountsSchema>;
export type AccountBalanceParams = z.infer<typeof accountBalanceParamsSchema>;
export type SearchAccountsInput = z.infer<typeof searchAccountsSchema>;
