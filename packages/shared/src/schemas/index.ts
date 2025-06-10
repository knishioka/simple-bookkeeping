import { z } from 'zod';

// User schemas
export const loginSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
});

export const createUserSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
  name: z.string().min(1, '名前を入力してください'),
  role: z.enum(['ADMIN', 'ACCOUNTANT', 'VIEWER']),
});

// Account schemas
export const createAccountSchema = z.object({
  code: z.string().min(1, '勘定科目コードを入力してください'),
  name: z.string().min(1, '勘定科目名を入力してください'),
  accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  parentId: z.string().uuid().optional(),
});

// Journal entry schemas
export const journalEntryLineSchema = z.object({
  accountId: z.string().uuid('勘定科目を選択してください'),
  debitAmount: z.number().min(0, '借方金額は0以上で入力してください'),
  creditAmount: z.number().min(0, '貸方金額は0以上で入力してください'),
  description: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
});

export const createJournalEntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付の形式が正しくありません'),
  description: z.string().min(1, '摘要を入力してください'),
  documentNumber: z.string().optional(),
  accountingPeriodId: z.string().uuid(),
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

// Export types
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type JournalEntryLineInput = z.infer<typeof journalEntryLineSchema>;
