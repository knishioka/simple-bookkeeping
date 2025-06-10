// Common types used across the application
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    total?: number;
    limit?: number;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

// Re-export Prisma types that are commonly used
export type {
  User,
  Account,
  AccountType,
  JournalEntry,
  JournalStatus,
  JournalEntryLine,
  Partner,
  PartnerType,
  AccountingPeriod,
  UserRole,
} from '@simple-bookkeeping/database';
