/**
 * 仕訳に関する型定義
 */

import { Account } from './account';
import { JournalEntryStatus } from './enums';

// import type {
//   JournalEntry as PrismaJournalEntry,
//   JournalEntryLine as PrismaJournalEntryLine,
//   AccountingPeriod as PrismaAccountingPeriod,
// } from '@simple-bookkeeping/database';

// 会計期間
// TODO: Restore PrismaAccountingPeriod extension after build issues are resolved
export interface AccountingPeriod {
  id: string;
  organizationId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isClosed: boolean;
  createdAt: Date;
  updatedAt: Date;
  // 必要に応じて拡張
}

// 仕訳伝票
// TODO: Restore PrismaJournalEntry extension after build issues are resolved
export interface JournalEntry {
  id: string;
  entryDate: Date;
  description: string;
  status: JournalEntryStatus;
  accountingPeriodId: string;
  organizationId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  lines?: JournalEntryLine[];
  accountingPeriod?: AccountingPeriod;
  _count?: {
    lines: number;
  };
}

// 仕訳明細
// TODO: Restore PrismaJournalEntryLine extension after build issues are resolved
export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  debitAmount: number;
  creditAmount: number;
  description?: string | null;
  lineNumber: number;
  createdAt: Date;
  updatedAt: Date;
  account?: Account;
  journalEntry?: JournalEntry;
}

// 仕訳明細作成用DTO
export interface CreateJournalEntryLineDto {
  accountId: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
  taxRate?: number;
}

// 仕訳作成用DTO
export interface CreateJournalEntryDto {
  entryDate: string; // YYYY-MM-DD形式
  description: string;
  documentNumber?: string;
  accountingPeriodId: string;
  organizationId?: string; // APIで自動設定
  lines: CreateJournalEntryLineDto[];
}

// 仕訳更新用DTO
export interface UpdateJournalEntryDto {
  entryDate?: string;
  description?: string;
  documentNumber?: string;
  status?: JournalEntryStatus;
  lines?: CreateJournalEntryLineDto[];
}

// 仕訳フィルター
export interface JournalEntryFilter {
  startDate?: string;
  endDate?: string;
  accountId?: string;
  status?: JournalEntryStatus;
  searchTerm?: string;
  accountingPeriodId?: string;
}

// 仕訳集計情報
export interface JournalEntrySummary {
  totalDebit: number;
  totalCredit: number;
  entryCount: number;
  lineCount: number;
}
