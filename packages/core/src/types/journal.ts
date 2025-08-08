/**
 * 仕訳に関する型定義
 */

import { Account } from './account';
import { JournalEntryStatus } from './enums';

import type {
  JournalEntry as PrismaJournalEntry,
  JournalEntryLine as PrismaJournalEntryLine,
  AccountingPeriod as PrismaAccountingPeriod,
} from '@simple-bookkeeping/database';

// 会計期間
export type AccountingPeriod = PrismaAccountingPeriod;

// 仕訳伝票
export interface JournalEntry extends PrismaJournalEntry {
  lines?: JournalEntryLine[];
  accountingPeriod?: AccountingPeriod;
  _count?: {
    lines: number;
  };
}

// 仕訳明細
export interface JournalEntryLine extends PrismaJournalEntryLine {
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
