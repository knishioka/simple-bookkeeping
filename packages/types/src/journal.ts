/**
 * Journal entry type definitions
 */

export interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: Date;
  description: string;
  status: JournalEntryStatus;
  organizationId: string;
  createdById: string;
  approvedById?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  lines: JournalEntryLine[];
  createdBy?: {
    id: string;
    name: string;
  };
  approvedBy?: {
    id: string;
    name: string;
  };
}

export type JournalEntryStatus = 'draft' | 'approved' | 'cancelled';

export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
  lineNumber: number;
  account?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface CreateJournalEntryDto {
  entryDate: string;
  description: string;
  lines: CreateJournalEntryLineDto[];
}

export interface CreateJournalEntryLineDto {
  accountId: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
}

export interface UpdateJournalEntryDto {
  entryDate?: string;
  description?: string;
  lines?: CreateJournalEntryLineDto[];
}

export interface JournalEntryFilter {
  startDate?: string;
  endDate?: string;
  accountId?: string;
  status?: JournalEntryStatus;
  searchTerm?: string;
}
