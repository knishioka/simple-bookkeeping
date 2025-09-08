import { z } from 'zod';

import { dateStringSchema, uuidSchema } from './common';

/**
 * レポート関連のバリデーションスキーマ
 */

// レポートタイプのバリデーション
const reportTypeSchema = z.enum([
  'BALANCE_SHEET', // 貸借対照表
  'INCOME_STATEMENT', // 損益計算書
  'CASH_FLOW', // キャッシュフロー計算書
  'TRIAL_BALANCE', // 試算表
  'GENERAL_LEDGER', // 総勘定元帳
  'JOURNAL_REPORT', // 仕訳帳
  'ACCOUNT_LEDGER', // 勘定科目元帳
  'AGING_REPORT', // 売掛金・買掛金年齢表
  'TAX_REPORT', // 税務レポート
  'CUSTOM', // カスタムレポート
]);

// レポート期間のバリデーション
const reportPeriodSchema = z
  .object({
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    comparePeriod: z
      .object({
        startDate: dateStringSchema,
        endDate: dateStringSchema,
      })
      .optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);

      if (start > end) {
        return false;
      }

      if (data.comparePeriod) {
        const compareStart = new Date(data.comparePeriod.startDate);
        const compareEnd = new Date(data.comparePeriod.endDate);
        if (compareStart > compareEnd) {
          return false;
        }
      }

      return true;
    },
    {
      message: '開始日は終了日以前である必要があります',
    }
  );

// レポート生成オプションのバリデーション
const reportOptionsSchema = z.object({
  includeZeroBalance: z.boolean().optional().default(false),
  includeInactiveAccounts: z.boolean().optional().default(false),
  groupByLevel: z.number().int().min(1).max(5).optional(),
  showDetails: z.boolean().optional().default(true),
  currency: z.string().optional().default('JPY'),
  language: z.enum(['ja', 'en']).optional().default('ja'),
  format: z.enum(['HTML', 'PDF', 'CSV', 'EXCEL']).optional().default('HTML'),
});

// 貸借対照表生成用スキーマ
export const generateBalanceSheetSchema = z.object({
  date: dateStringSchema,
  compareDate: dateStringSchema.optional(),
  options: reportOptionsSchema.optional(),
});

// 損益計算書生成用スキーマ
export const generateIncomeStatementSchema = z.object({
  period: reportPeriodSchema,
  options: reportOptionsSchema.optional(),
});

// キャッシュフロー計算書生成用スキーマ
export const generateCashFlowSchema = z.object({
  period: reportPeriodSchema,
  method: z.enum(['DIRECT', 'INDIRECT']).optional().default('INDIRECT'),
  options: reportOptionsSchema.optional(),
});

// 試算表生成用スキーマ
export const generateTrialBalanceSchema = z.object({
  date: dateStringSchema,
  includeAdjustments: z.boolean().optional().default(false),
  options: reportOptionsSchema.optional(),
});

// 総勘定元帳生成用スキーマ
export const generateGeneralLedgerSchema = z.object({
  period: reportPeriodSchema,
  accountIds: z.array(uuidSchema).optional(),
  options: reportOptionsSchema.optional(),
});

// 仕訳帳生成用スキーマ
export const generateJournalReportSchema = z.object({
  period: reportPeriodSchema,
  filters: z
    .object({
      accountId: uuidSchema.optional(),
      partnerId: uuidSchema.optional(),
      projectId: uuidSchema.optional(),
      tags: z.array(z.string()).optional(),
      status: z.enum(['DRAFT', 'POSTED', 'CANCELLED']).optional(),
    })
    .optional(),
  options: reportOptionsSchema.optional(),
});

// 勘定科目元帳生成用スキーマ
export const generateAccountLedgerSchema = z.object({
  accountId: uuidSchema,
  period: reportPeriodSchema,
  includeSubAccounts: z.boolean().optional().default(false),
  options: reportOptionsSchema.optional(),
});

// 売掛金・買掛金年齢表生成用スキーマ
export const generateAgingReportSchema = z.object({
  type: z.enum(['RECEIVABLE', 'PAYABLE']),
  asOfDate: dateStringSchema,
  agingBuckets: z.array(z.number().int().positive()).optional().default([30, 60, 90, 120]),
  partnerId: uuidSchema.optional(),
  options: reportOptionsSchema.optional(),
});

// 税務レポート生成用スキーマ
export const generateTaxReportSchema = z.object({
  period: reportPeriodSchema,
  taxType: z.enum(['CONSUMPTION_TAX', 'CORPORATE_TAX', 'WITHHOLDING_TAX']),
  includeDetails: z.boolean().optional().default(true),
  options: reportOptionsSchema.optional(),
});

// カスタムレポート生成用スキーマ
export const generateCustomReportSchema = z.object({
  name: z.string().min(1).max(100),
  period: reportPeriodSchema,
  template: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  options: reportOptionsSchema.optional(),
});

// レポートスケジュール設定用スキーマ
export const scheduleReportSchema = z.object({
  reportType: reportTypeSchema,
  schedule: z.object({
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    timezone: z.string().optional().default('Asia/Tokyo'),
  }),
  recipients: z.array(z.string().email()).min(1),
  reportConfig: z.record(z.string(), z.unknown()),
  enabled: z.boolean().optional().default(true),
});

// レポートエクスポート用スキーマ
export const exportReportSchema = z.object({
  reportId: uuidSchema,
  format: z.enum(['PDF', 'CSV', 'EXCEL', 'XML']),
  includeAttachments: z.boolean().optional().default(false),
  compress: z.boolean().optional().default(false),
});

// レポート履歴取得用スキーマ
export const getReportHistorySchema = z.object({
  reportType: reportTypeSchema.optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

// 型定義のエクスポート
export type GenerateBalanceSheetInput = z.infer<typeof generateBalanceSheetSchema>;
export type GenerateIncomeStatementInput = z.infer<typeof generateIncomeStatementSchema>;
export type GenerateCashFlowInput = z.infer<typeof generateCashFlowSchema>;
export type GenerateTrialBalanceInput = z.infer<typeof generateTrialBalanceSchema>;
export type GenerateGeneralLedgerInput = z.infer<typeof generateGeneralLedgerSchema>;
export type GenerateJournalReportInput = z.infer<typeof generateJournalReportSchema>;
export type GenerateAccountLedgerInput = z.infer<typeof generateAccountLedgerSchema>;
export type GenerateAgingReportInput = z.infer<typeof generateAgingReportSchema>;
export type GenerateTaxReportInput = z.infer<typeof generateTaxReportSchema>;
export type GenerateCustomReportInput = z.infer<typeof generateCustomReportSchema>;
export type ScheduleReportInput = z.infer<typeof scheduleReportSchema>;
export type ExportReportInput = z.infer<typeof exportReportSchema>;
export type GetReportHistoryInput = z.infer<typeof getReportHistorySchema>;
