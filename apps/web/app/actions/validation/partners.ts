import { z } from 'zod';

import { queryParamsSchema, uuidSchema } from './common';

/**
 * 取引先関連のバリデーションスキーマ
 */

// 取引先タイプのバリデーション
export const partnerTypeSchema = z.enum(['customer', 'supplier', 'both']);

// 取引先コードのバリデーション
const partnerCodeSchema = z
  .string()
  .min(1, { message: '取引先コードは必須です' })
  .max(20, { message: '取引先コードは20文字以内で入力してください' })
  .regex(/^[A-Z0-9_-]+$/i, {
    message: '取引先コードは英数字、ハイフン、アンダースコアのみ使用できます',
  });

// 取引先名のバリデーション
const partnerNameSchema = z
  .string()
  .min(1, { message: '取引先名は必須です' })
  .max(100, { message: '取引先名は100文字以内で入力してください' });

// 取引先名（カナ）のバリデーション
const partnerNameKanaSchema = z
  .string()
  .max(100, { message: '取引先名（カナ）は100文字以内で入力してください' })
  .regex(/^[ァ-ヴー\s]*$/, {
    message: '取引先名（カナ）は全角カタカナで入力してください',
  })
  .optional()
  .nullable();

// メールアドレスのバリデーション
const emailSchema = z
  .string()
  .email({ message: 'メールアドレスの形式が正しくありません' })
  .max(100, { message: 'メールアドレスは100文字以内で入力してください' })
  .optional()
  .nullable();

// 電話番号のバリデーション
const phoneSchema = z
  .string()
  .max(20, { message: '電話番号は20文字以内で入力してください' })
  .regex(/^[0-9-+\s()]*$/, {
    message: '電話番号は数字、ハイフン、プラス記号、括弧のみ使用できます',
  })
  .optional()
  .nullable();

// 郵便番号のバリデーション
const postalCodeSchema = z
  .string()
  .max(10, { message: '郵便番号は10文字以内で入力してください' })
  .regex(/^\d{3}-?\d{4}$/, {
    message: '郵便番号は7桁の数字（ハイフンあり/なし）で入力してください',
  })
  .optional()
  .nullable();

// 住所のバリデーション
const addressSchema = z
  .string()
  .max(200, { message: '住所は200文字以内で入力してください' })
  .optional()
  .nullable();

// 銀行名のバリデーション
const bankNameSchema = z
  .string()
  .max(50, { message: '銀行名は50文字以内で入力してください' })
  .optional()
  .nullable();

// 銀行支店のバリデーション
const bankBranchSchema = z
  .string()
  .max(50, { message: '支店名は50文字以内で入力してください' })
  .optional()
  .nullable();

// 銀行口座タイプのバリデーション
const bankAccountTypeSchema = z
  .string()
  .max(20, { message: '口座タイプは20文字以内で入力してください' })
  .optional()
  .nullable();

// 銀行口座番号のバリデーション
const bankAccountNumberSchema = z
  .string()
  .max(20, { message: '口座番号は20文字以内で入力してください' })
  .regex(/^[0-9-]*$/, {
    message: '口座番号は数字とハイフンのみ使用できます',
  })
  .optional()
  .nullable();

// 銀行口座名義のバリデーション
const bankAccountNameSchema = z
  .string()
  .max(100, { message: '口座名義は100文字以内で入力してください' })
  .optional()
  .nullable();

// 支払条件のバリデーション (日数)
const paymentTermsSchema = z
  .number()
  .min(0, { message: '支払条件は0以上の値を入力してください' })
  .max(365, { message: '支払条件は365日以内で入力してください' })
  .optional()
  .nullable();

// 与信限度額のバリデーション
const creditLimitSchema = z
  .number()
  .min(0, { message: '与信限度額は0以上の値を入力してください' })
  .max(999999999999, { message: '与信限度額が大きすぎます' })
  .optional()
  .nullable();

// 備考のバリデーション
const notesSchema = z
  .string()
  .max(500, { message: '備考は500文字以内で入力してください' })
  .optional()
  .nullable();

// 取引先作成用スキーマ
export const createPartnerSchema = z.object({
  code: partnerCodeSchema,
  name: partnerNameSchema,
  name_kana: partnerNameKanaSchema,
  partner_type: partnerTypeSchema,
  email: emailSchema,
  phone: phoneSchema,
  postal_code: postalCodeSchema,
  address: addressSchema,
  bank_name: bankNameSchema,
  bank_branch: bankBranchSchema,
  bank_account_type: bankAccountTypeSchema,
  bank_account_number: bankAccountNumberSchema,
  bank_account_name: bankAccountNameSchema,
  payment_terms: paymentTermsSchema,
  credit_limit: creditLimitSchema,
  is_active: z.boolean().optional().default(true),
  notes: notesSchema,
});

// 取引先更新用スキーマ
export const updatePartnerSchema = z.object({
  code: partnerCodeSchema.optional(),
  name: partnerNameSchema.optional(),
  name_kana: partnerNameKanaSchema,
  partner_type: partnerTypeSchema.optional(),
  email: emailSchema,
  phone: phoneSchema,
  postal_code: postalCodeSchema,
  address: addressSchema,
  bank_name: bankNameSchema,
  bank_branch: bankBranchSchema,
  bank_account_type: bankAccountTypeSchema,
  bank_account_number: bankAccountNumberSchema,
  bank_account_name: bankAccountNameSchema,
  payment_terms: paymentTermsSchema,
  credit_limit: creditLimitSchema,
  is_active: z.boolean().optional(),
  notes: notesSchema,
});

// 取引先取得用パラメータスキーマ
export const getPartnersParamsSchema = queryParamsSchema.extend({
  partner_type: partnerTypeSchema.optional(),
  is_active: z.boolean().optional(),
});

// 取引先取得用スキーマ
export const getPartnerSchema = z.object({
  id: uuidSchema,
});

// 取引先削除用スキーマ
export const deletePartnerSchema = z.object({
  id: uuidSchema,
});

// 取引先取引履歴取得用スキーマ
export const getPartnerTransactionsParamsSchema = z.object({
  partnerId: uuidSchema,
  from_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: '日付形式はYYYY-MM-DDで入力してください' })
    .optional(),
  to_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: '日付形式はYYYY-MM-DDで入力してください' })
    .optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});

// 取引先残高取得用スキーマ
export const getPartnerBalanceParamsSchema = z.object({
  partnerId: uuidSchema,
  asOfDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: '日付形式はYYYY-MM-DDで入力してください' })
    .optional(),
});

// 取引先検索用スキーマ
export const searchPartnersSchema = z.object({
  query: z.string().min(1).max(100),
  partner_types: z.array(partnerTypeSchema).optional(),
  limit: z.number().int().min(1).max(100).optional().default(10),
  includeInactive: z.boolean().optional().default(false),
});

// 取引先インポート用スキーマ
export const importPartnersSchema = z.object({
  partners: z
    .array(
      z.object({
        code: partnerCodeSchema,
        name: partnerNameSchema,
        name_kana: partnerNameKanaSchema,
        partner_type: partnerTypeSchema,
        email: emailSchema,
        phone: phoneSchema,
        postal_code: postalCodeSchema,
        address: addressSchema,
        bank_name: bankNameSchema,
        bank_branch: bankBranchSchema,
        bank_account_type: bankAccountTypeSchema,
        bank_account_number: bankAccountNumberSchema,
        bank_account_name: bankAccountNameSchema,
        payment_terms: paymentTermsSchema,
        credit_limit: creditLimitSchema,
        notes: notesSchema,
      })
    )
    .min(1, { message: 'インポートする取引先が必要です' })
    .max(1000, { message: '一度にインポートできるのは1000件までです' }),
  updateExisting: z.boolean().optional().default(false),
});

// バリデーション関数のエクスポート
export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;
export type GetPartnersParams = z.infer<typeof getPartnersParamsSchema>;
export type GetPartnerTransactionsParams = z.infer<typeof getPartnerTransactionsParamsSchema>;
export type GetPartnerBalanceParams = z.infer<typeof getPartnerBalanceParamsSchema>;
export type SearchPartnersInput = z.infer<typeof searchPartnersSchema>;
export type ImportPartnersInput = z.infer<typeof importPartnersSchema>;
