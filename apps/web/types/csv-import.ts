// Type definitions for CSV import feature

// Database table types (temporary until migration is applied)
export interface ImportHistory {
  id: string;
  organization_id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  csv_format: string | null;
  total_rows: number;
  imported_rows: number;
  failed_rows: number;
  status: ImportStatus;
  error_message: string | null;
  file_data: { rows: ParsedCsvRow[]; template?: string } | null;
  created_at: string;
  updated_at: string;
}

export interface ImportHistoryInsert {
  id?: string;
  organization_id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  csv_format?: string | null;
  total_rows?: number;
  imported_rows?: number;
  failed_rows?: number;
  status?: ImportStatus;
  error_message?: string | null;
  file_data?: { rows: ParsedCsvRow[]; template?: string } | null;
}

export interface ImportHistoryUpdate {
  organization_id?: string;
  user_id?: string;
  file_name?: string;
  file_size?: number;
  csv_format?: string | null;
  total_rows?: number;
  imported_rows?: number;
  failed_rows?: number;
  status?: ImportStatus;
  error_message?: string | null;
  file_data?: { rows: ParsedCsvRow[]; template?: string } | null;
}

export interface ImportRule {
  id: string;
  organization_id: string;
  description_pattern: string;
  account_id: string;
  contra_account_id: string;
  confidence: number | null;
  usage_count: number;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ImportRuleInsert {
  id?: string;
  organization_id: string;
  description_pattern: string;
  account_id: string;
  contra_account_id: string;
  confidence?: number | null;
  usage_count?: number;
  is_active?: boolean | null;
}

export interface ImportRuleUpdate {
  organization_id?: string;
  description_pattern?: string;
  account_id?: string;
  contra_account_id?: string;
  confidence?: number | null;
  usage_count?: number;
  is_active?: boolean | null;
}

export interface CsvTemplate {
  id: string;
  bank_name: string;
  template_name: string;
  column_mappings: CsvColumnMapping;
  date_format: string;
  amount_column: string;
  description_column: string;
  type_column: string | null;
  balance_column: string | null;
  skip_rows: number;
  encoding: string | null;
  delimiter: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface CsvTemplateInsert {
  id?: string;
  bank_name: string;
  template_name: string;
  column_mappings: CsvColumnMapping;
  date_format?: string;
  amount_column: string;
  description_column: string;
  type_column?: string | null;
  balance_column?: string | null;
  skip_rows?: number;
  encoding?: string | null;
  delimiter?: string | null;
  is_active?: boolean | null;
}

// Import status enum
export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Parsed CSV row structure
export interface ParsedCsvRow {
  date: Date;
  description: string;
  amount: number;
  type?: 'income' | 'expense';
  balance?: number;
  originalRow: Record<string, string>; // Keep original data for reference
}

// CSV preview data structure
export interface CsvPreviewData {
  rows: ParsedCsvRow[];
  columns: string[];
  totalRows: number;
  template: CsvTemplate | null;
  errors?: string[];
}

// Account mapping for import preview
export interface AccountMapping {
  rowIndex: number;
  accountId: string;
  contraAccountId: string;
  confidence?: number;
  isDuplicate?: boolean;
  duplicateDetails?: {
    journalEntryId: string;
    date: Date;
    amount: number;
    description: string;
  };
}

// Import execution request
export interface ImportExecutionRequest {
  importId: string;
  mappings: AccountMapping[];
  skipDuplicates?: boolean;
  createRulesFromMappings?: boolean;
}

// Import summary after execution
export interface ImportSummary {
  totalRows: number;
  importedRows: number;
  failedRows: number;
  skippedRows: number;
  createdJournalEntries: string[];
  errors?: Array<{
    row: number;
    error: string;
  }>;
}

// CSV column mapping configuration
export interface CsvColumnMapping {
  date: string;
  description: string;
  amount?: string;
  deposit?: string;
  withdrawal?: string;
  balance?: string;
  type?: string;
}

// CSV parse options
export interface CsvParseOptions {
  encoding?: 'UTF-8' | 'Shift-JIS' | 'EUC-JP' | 'ISO-2022-JP';
  delimiter?: string;
  skipRows?: number;
  dateFormat?: string;
  hasHeaders?: boolean;
  maxRows?: number;
}

// File validation result
export interface FileValidationResult {
  isValid: boolean;
  fileSize: number;
  mimeType: string;
  errors?: string[];
  warnings?: string[];
}

// Import rule creation request
export interface ImportRuleCreateRequest {
  descriptionPattern: string;
  accountId: string;
  contraAccountId: string;
  confidence?: number;
}

// Account suggestion from rules
export interface AccountSuggestion {
  accountId: string;
  contraAccountId: string;
  confidence: number;
  ruleId?: string;
  reason?: string;
}
