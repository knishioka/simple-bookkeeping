/**
 * Journal entry type definitions
 */

// Enum definitions that match Prisma schema
export const JournalStatus = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  LOCKED: 'LOCKED',
} as const;

export type JournalStatus = (typeof JournalStatus)[keyof typeof JournalStatus];

// DTO types for journal entries
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
