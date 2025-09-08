import { z } from 'zod';

import { amountSchema, dateStringSchema, queryParamsSchema, uuidSchema } from './common';

/**
 * 仕訳エントリー関連のバリデーションスキーマ
 */

// 仕訳明細行のバリデーション
const journalEntryLineSchema = z
  .object({
    accountId: uuidSchema,
    debit: amountSchema.nullable().optional(),
    credit: amountSchema.nullable().optional(),
    description: z.string().max(500).optional(),
    partnerId: uuidSchema.optional(),
    projectId: uuidSchema.optional(),
    tags: z.array(z.string()).optional(),
  })
  .refine(
    (data) => {
      // 借方か貸方のいずれか一方のみ入力されていることを確認
      const hasDebit = data.debit !== null && data.debit !== undefined && data.debit > 0;
      const hasCredit = data.credit !== null && data.credit !== undefined && data.credit > 0;
      return (hasDebit && !hasCredit) || (!hasDebit && hasCredit);
    },
    {
      message: '借方か貸方のいずれか一方のみ入力してください',
    }
  );

// 仕訳エントリー作成用スキーマ
export const createJournalEntrySchema = z
  .object({
    date: dateStringSchema,
    description: z.string().min(1, { message: '摘要は必須です' }).max(500),
    lines: z
      .array(journalEntryLineSchema)
      .min(2, { message: '仕訳には最低2行の明細が必要です' })
      .max(100, { message: '仕訳明細は100行までです' }),
    attachments: z.array(z.string().url()).optional(),
    tags: z.array(z.string()).optional(),
    memo: z.string().max(1000).optional(),
    referenceNumber: z.string().max(50).optional(),
  })
  .refine(
    (data) => {
      // 借方と貸方の合計が一致することを確認
      const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
      const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
      return Math.abs(totalDebit - totalCredit) < 0.01; // 浮動小数点誤差を考慮
    },
    {
      message: '借方と貸方の合計金額が一致しません',
    }
  );

// 仕訳エントリー更新用スキーマ
export const updateJournalEntrySchema = z
  .object({
    date: dateStringSchema.optional(),
    description: z.string().min(1).max(500).optional(),
    lines: z.array(journalEntryLineSchema).min(2).max(100).optional(),
    attachments: z.array(z.string().url()).optional(),
    tags: z.array(z.string()).optional(),
    memo: z.string().max(1000).optional(),
    referenceNumber: z.string().max(50).optional(),
  })
  .refine(
    (data) => {
      if (!data.lines) return true;

      // 借方と貸方の合計が一致することを確認
      const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
      const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
      return Math.abs(totalDebit - totalCredit) < 0.01;
    },
    {
      message: '借方と貸方の合計金額が一致しません',
    }
  );

// 仕訳エントリー取得用パラメータスキーマ
export const getJournalEntriesParamsSchema = queryParamsSchema
  .extend({
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
    accountId: uuidSchema.optional(),
    partnerId: uuidSchema.optional(),
    projectId: uuidSchema.optional(),
    status: z.enum(['DRAFT', 'POSTED', 'CANCELLED']).optional(),
    tags: z.array(z.string()).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return start <= end;
      }
      return true;
    },
    {
      message: '開始日は終了日以前である必要があります',
      path: ['endDate'],
    }
  );

// 仕訳エントリー削除用スキーマ
export const deleteJournalEntrySchema = z.object({
  id: uuidSchema,
  reason: z.string().min(1, { message: '削除理由は必須です' }).max(500),
});

// 仕訳エントリー承認用スキーマ
export const approveJournalEntrySchema = z.object({
  id: uuidSchema,
  comment: z.string().max(500).optional(),
});

// 仕訳エントリー取消用スキーマ
export const cancelJournalEntrySchema = z.object({
  id: uuidSchema,
  reason: z.string().min(1, { message: '取消理由は必須です' }).max(500),
  reverseEntry: z.boolean().optional().default(false),
});

// 仕訳エントリー一括インポート用スキーマ
export const importJournalEntriesSchema = z.object({
  entries: z
    .array(createJournalEntrySchema)
    .min(1, { message: 'インポートする仕訳が必要です' })
    .max(500, { message: '一度にインポートできるのは500件までです' }),
  validateOnly: z.boolean().optional().default(false),
  skipErrors: z.boolean().optional().default(false),
});

// 仕訳エントリー複製用スキーマ
export const duplicateJournalEntrySchema = z.object({
  id: uuidSchema,
  newDate: dateStringSchema,
  adjustDescription: z.boolean().optional().default(true),
});

// 仕訳エントリー検索用スキーマ
export const searchJournalEntriesSchema = z.object({
  query: z.string().min(1).max(100),
  searchIn: z.array(z.enum(['description', 'memo', 'referenceNumber', 'tags'])).optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

// 型定義のエクスポート
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>;
export type GetJournalEntriesParams = z.infer<typeof getJournalEntriesParamsSchema>;
export type DeleteJournalEntryInput = z.infer<typeof deleteJournalEntrySchema>;
export type ApproveJournalEntryInput = z.infer<typeof approveJournalEntrySchema>;
export type CancelJournalEntryInput = z.infer<typeof cancelJournalEntrySchema>;
export type ImportJournalEntriesInput = z.infer<typeof importJournalEntriesSchema>;
export type DuplicateJournalEntryInput = z.infer<typeof duplicateJournalEntrySchema>;
export type SearchJournalEntriesInput = z.infer<typeof searchJournalEntriesSchema>;
