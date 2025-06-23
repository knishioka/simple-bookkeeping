/**
 * 仕訳関連のバリデーションスキーマ
 */

import { z } from 'zod';

import { JournalEntryStatus } from '../types/enums';

// 日付フォーマットのバリデーション
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日付は YYYY-MM-DD 形式で入力してください');

// 金額のバリデーション
const amountSchema = z
  .number()
  .min(0, '金額は0以上で入力してください')
  .max(999999999999, '金額が大きすぎます');

// 仕訳明細スキーマ
export const journalEntryLineSchema = z
  .object({
    accountId: z.string().uuid('勘定科目を選択してください'),
    debitAmount: amountSchema,
    creditAmount: amountSchema,
    description: z.string().max(255, '摘要は255文字以内で入力してください').optional(),
    taxRate: z.number().min(0).max(100, '税率は0〜100の範囲で入力してください').optional(),
  })
  .refine((data) => data.debitAmount > 0 || data.creditAmount > 0, {
    message: '借方または貸方の金額を入力してください',
  })
  .refine((data) => !(data.debitAmount > 0 && data.creditAmount > 0), {
    message: '借方と貸方の両方に金額を入力することはできません',
  });

// 仕訳作成スキーマ
export const createJournalEntrySchema = z.object({
  entryDate: dateSchema,
  description: z
    .string()
    .min(1, '摘要を入力してください')
    .max(255, '摘要は255文字以内で入力してください'),
  documentNumber: z.string().max(50, '伝票番号は50文字以内で入力してください').optional(),
  accountingPeriodId: z.string().uuid('会計期間を選択してください'),
  lines: z
    .array(journalEntryLineSchema)
    .min(2, '仕訳明細は2行以上必要です')
    .refine(
      (lines) => {
        const totalDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
        const totalCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);
        return Math.abs(totalDebit - totalCredit) < 0.01; // 浮動小数点の誤差を考慮
      },
      {
        message: '借方と貸方の合計が一致しません',
      }
    ),
});

// 仕訳更新スキーマ
export const updateJournalEntrySchema = z.object({
  entryDate: dateSchema.optional(),
  description: z.string().min(1, '摘要を入力してください').max(255).optional(),
  documentNumber: z.string().max(50).optional(),
  status: z
    .enum([
      JournalEntryStatus.DRAFT,
      JournalEntryStatus.APPROVED,
      JournalEntryStatus.POSTED,
      JournalEntryStatus.CANCELLED,
    ])
    .optional(),
  lines: z.array(journalEntryLineSchema).min(2).optional(),
});

// 仕訳フィルタースキーマ
export const journalEntryFilterSchema = z.object({
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  accountId: z.string().uuid().optional(),
  status: z
    .enum([
      JournalEntryStatus.DRAFT,
      JournalEntryStatus.APPROVED,
      JournalEntryStatus.POSTED,
      JournalEntryStatus.CANCELLED,
    ])
    .optional(),
  searchTerm: z.string().optional(),
  accountingPeriodId: z.string().uuid().optional(),
});

// 型のエクスポート
export type JournalEntryLineInput = z.infer<typeof journalEntryLineSchema>;
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>;
export type JournalEntryFilterInput = z.infer<typeof journalEntryFilterSchema>;
