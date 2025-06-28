// Query parameters for journal entries
export interface JournalEntryQueryParams {
  from?: string;
  to?: string;
  status?: string;
  page?: string;
  limit?: string;
}

// Typed where clause for journal entry queries
export interface JournalEntryWhereInput {
  organizationId: string;
  entryDate?: {
    gte?: Date;
    lte?: Date;
  };
  status?: 'DRAFT' | 'APPROVED' | 'LOCKED';
  id?: string;
  entryNumber?: string;
  createdById?: string;
  accountingPeriodId?: string;
}

// Line item for creating/updating journal entries
export interface JournalEntryLineInput {
  accountId: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
  accountCode?: string;
  accountName?: string;
}

// API response types
export interface JournalEntryListResponse {
  data: Array<{
    id: string;
    entryNumber: string;
    entryDate: Date;
    description: string;
    status: 'DRAFT' | 'APPROVED' | 'LOCKED';
    organizationId: string;
    accountingPeriodId: string;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    lines: Array<{
      id: string;
      journalEntryId: string;
      accountId: string;
      debitAmount: number;
      creditAmount: number;
      description: string;
      lineNumber: number;
      account: {
        id: string;
        code: string;
        name: string;
      };
    }>;
    createdBy: {
      id: string;
      name: string;
    };
  }>;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface JournalEntryResponse {
  data: {
    id: string;
    entryNumber: string;
    entryDate: Date;
    description: string;
    status: 'DRAFT' | 'APPROVED' | 'LOCKED';
    organizationId: string;
    accountingPeriodId: string;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    lines: Array<{
      id: string;
      journalEntryId: string;
      accountId: string;
      debitAmount: number;
      creditAmount: number;
      description: string;
      lineNumber: number;
      account: {
        id: string;
        code: string;
        name: string;
      };
    }>;
  };
}

// Error response for CSV imports
export interface CsvImportError {
  code: 'CSV_INVALID_COLUMN_NAME' | 'CSV_PARSE_ERROR' | 'CSV_IMPORT_ERROR';
  message: string;
  details?: {
    errors: string[];
  };
}
