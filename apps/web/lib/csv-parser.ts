import type {
  CsvTemplate,
  ParsedCsvRow,
  CsvParseOptions,
  CsvColumnMapping,
} from '@/types/csv-import';

import { parse } from 'csv-parse/sync';
import * as iconv from 'iconv-lite';

/**
 * Sanitize CSV values to prevent formula injection
 * Detects values starting with formula characters and prepends a single quote to escape them
 */
function sanitizeCsvValue(value: string): string {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trimStart();
  const dangerousChars = ['=', '+', '-', '@', '|', '%'];

  // Check if the value starts with any dangerous character
  if (dangerousChars.some((char) => trimmedValue.startsWith(char))) {
    // Special case: Allow negative numbers (e.g., "-123.45")
    // Use a safer regex pattern to avoid ReDoS vulnerability
    if (trimmedValue.startsWith('-')) {
      const numericPart = trimmedValue.substring(1);
      // Check if the rest is a valid number (digits optionally followed by a decimal point and more digits)
      if (/^\d+$/.test(numericPart) || /^\d+\.\d+$/.test(numericPart)) {
        return value;
      }
    }
    // Escape by prepending a single quote
    return `'${value}`;
  }

  return value;
}

/**
 * Parse CSV data with encoding support
 */
export async function parseCsvData(
  buffer: Buffer,
  options: CsvParseOptions = {}
): Promise<{ data: Record<string, string>[]; errors: string[] }> {
  const errors: string[] = [];
  const {
    encoding = 'UTF-8',
    delimiter = ',',
    skipRows = 0,
    hasHeaders = true,
    maxRows = 1000,
  } = options;

  try {
    // Decode buffer with specified encoding
    let csvString: string;
    if (encoding === 'UTF-8') {
      csvString = buffer.toString('utf-8');
    } else {
      // Use iconv-lite for Japanese encodings
      csvString = iconv.decode(buffer, encoding);
    }

    // Parse CSV
    const parseOptions = {
      delimiter,
      from_line: skipRows + 1,
      relax_quotes: true,
      skip_empty_lines: true,
      trim: true,
      columns: hasHeaders,
      to: maxRows ? skipRows + maxRows + (hasHeaders ? 1 : 0) : undefined,
    };

    let data = parse(csvString, parseOptions) as unknown as Record<string, string>[];

    // Sanitize all string values to prevent CSV injection
    data = data.map((row) => {
      const sanitizedRow: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        sanitizedRow[key] = typeof value === 'string' ? sanitizeCsvValue(value) : value;
      }
      return sanitizedRow;
    });

    return { data, errors };
  } catch (error) {
    errors.push(`CSV parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { data: [], errors };
  }
}

/**
 * Convert raw CSV rows to ParsedCsvRow format using template mappings
 */
export function convertToParsedRows(
  rawRows: Record<string, string>[],
  template: CsvTemplate | null,
  dateFormat: string = 'YYYY-MM-DD'
): ParsedCsvRow[] {
  if (!rawRows || rawRows.length === 0) {
    return [];
  }

  const mappings = template?.column_mappings as CsvColumnMapping | null;
  const rows: ParsedCsvRow[] = [];

  for (const rawRow of rawRows) {
    try {
      const parsedRow = parseRowWithTemplate(rawRow, mappings, dateFormat);
      if (parsedRow) {
        rows.push(parsedRow);
      }
    } catch (error) {
      console.error('Error parsing row:', error, rawRow);
      // Continue processing other rows
    }
  }

  return rows;
}

/**
 * Parse a single row using template mappings
 */
function parseRowWithTemplate(
  rawRow: Record<string, string>,
  mappings: CsvColumnMapping | null,
  dateFormat: string
): ParsedCsvRow | null {
  // Get date
  const dateStr = mappings?.date
    ? rawRow[mappings.date]
    : rawRow.date || rawRow.Date || rawRow['日付'] || rawRow['取引日'];
  if (!dateStr) {
    return null;
  }
  const date = parseDate(dateStr, dateFormat);
  if (!date) {
    return null;
  }

  // Get description
  let description = mappings?.description
    ? rawRow[mappings.description]
    : rawRow.description ||
      rawRow.Description ||
      rawRow['摘要'] ||
      rawRow['内容'] ||
      rawRow['お取引内容'];

  if (!description) {
    return null;
  }

  // Sanitize description to prevent CSV injection
  description = sanitizeCsvValue(description);

  // Get amount
  let amount = 0;
  let type: 'income' | 'expense' | undefined;

  // Check for separate deposit/withdrawal columns
  const depositCol = mappings?.deposit;
  const withdrawalCol = mappings?.withdrawal;

  if (
    depositCol &&
    withdrawalCol &&
    rawRow[depositCol] !== undefined &&
    rawRow[withdrawalCol] !== undefined
  ) {
    const deposit = parseAmount(rawRow[depositCol]);
    const withdrawal = parseAmount(rawRow[withdrawalCol]);

    if (deposit > 0) {
      amount = deposit;
      type = 'income';
    } else if (withdrawal > 0) {
      amount = withdrawal;
      type = 'expense';
    }
  } else {
    // Single amount column
    const amountCol = mappings?.amount
      ? rawRow[mappings.amount]
      : rawRow.amount || rawRow.Amount || rawRow['金額'] || rawRow['利用金額'];

    amount = parseAmount(amountCol);

    // Determine type from sign or type column
    if (mappings?.type && rawRow[mappings.type]) {
      const typeValue = rawRow[mappings.type];
      type = determineTransactionType(typeValue);
    } else if (amount < 0) {
      type = 'expense';
      amount = Math.abs(amount);
    } else {
      type = 'income';
    }
  }

  // Get balance if available
  const balanceCol = mappings?.balance;
  const balance = balanceCol && rawRow[balanceCol] ? parseAmount(rawRow[balanceCol]) : undefined;

  return {
    date,
    description: description.trim(),
    amount,
    type,
    balance,
    originalRow: rawRow,
  };
}

/**
 * Parse date string based on format
 */
function parseDate(dateStr: string, format: string): Date | null {
  if (!dateStr) {
    return null;
  }

  // Clean date string
  dateStr = dateStr.trim().replace(/[年月日]/g, '/');

  try {
    // Split date parts
    let year: number, month: number, day: number;

    if (format === 'YYYY/MM/DD' || format === 'YYYY-MM-DD') {
      const parts = dateStr.split(/[/-]/);
      if (parts.length !== 3) return null;
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else if (format === 'DD/MM/YYYY' || format === 'DD-MM-YYYY') {
      const parts = dateStr.split(/[/-]/);
      if (parts.length !== 3) return null;
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    } else if (format === 'MM/DD/YYYY' || format === 'MM-DD-YYYY') {
      const parts = dateStr.split(/[/-]/);
      if (parts.length !== 3) return null;
      month = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
    } else {
      // Default to ISO format
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
      return null;
    }

    // Validate date parts
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return null;
    }

    // Handle 2-digit years
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }

    // Create date (month is 0-indexed in JavaScript)
    const date = new Date(year, month - 1, day);

    // Validate the date is valid
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }

    return date;
  } catch {
    return null;
  }
}

/**
 * Parse amount string to number
 */
function parseAmount(amountStr: string | number | undefined): number {
  if (typeof amountStr === 'number') {
    return amountStr;
  }

  if (!amountStr || amountStr === '' || amountStr === '-') {
    return 0;
  }

  // Convert to string and clean
  let cleaned = String(amountStr)
    .replace(/[￥¥$,，、]/g, '') // Remove currency symbols and commas
    .replace(/\s/g, '') // Remove spaces
    .trim();

  // Handle parentheses for negative numbers
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = `-${cleaned.slice(1, -1)}`;
  }

  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : amount;
}

/**
 * Determine transaction type from type column value
 */
function determineTransactionType(typeValue: string): 'income' | 'expense' | undefined {
  const value = typeValue.toLowerCase().trim();

  // Common patterns for income
  if (
    value.includes('入金') ||
    value.includes('入') ||
    value.includes('収入') ||
    value.includes('deposit') ||
    value.includes('credit') ||
    value.includes('in') ||
    value === '+'
  ) {
    return 'income';
  }

  // Common patterns for expense
  if (
    value.includes('出金') ||
    value.includes('出') ||
    value.includes('支出') ||
    value.includes('引き落とし') ||
    value.includes('withdrawal') ||
    value.includes('debit') ||
    value.includes('out') ||
    value === '-'
  ) {
    return 'expense';
  }

  return undefined;
}

/**
 * Detect CSV template from file content
 */
export async function detectCsvTemplate(
  buffer: Buffer,
  templates: CsvTemplate[]
): Promise<CsvTemplate | null> {
  // Try to parse with UTF-8 first to check headers
  const { data: utf8Data } = await parseCsvData(buffer, {
    encoding: 'UTF-8',
    maxRows: 2,
  });

  // Also try Shift-JIS for Japanese banks
  const { data: sjisData } = await parseCsvData(buffer, {
    encoding: 'Shift-JIS',
    maxRows: 2,
  });

  // Get headers from both encodings
  const utf8Headers = utf8Data.length > 0 ? Object.keys(utf8Data[0]) : [];
  const sjisHeaders = sjisData.length > 0 ? Object.keys(sjisData[0]) : [];

  // Check each template
  for (const template of templates) {
    const mappings = template.column_mappings as CsvColumnMapping;
    const requiredColumns = [
      mappings.date,
      mappings.description,
      mappings.amount || mappings.deposit || mappings.withdrawal,
    ].filter(Boolean);

    // Check if all required columns exist in either encoding
    const utf8Match = requiredColumns.every((col) => col && utf8Headers.includes(col));
    const sjisMatch = requiredColumns.every((col) => col && sjisHeaders.includes(col));

    if (utf8Match || sjisMatch) {
      return template;
    }
  }

  return null;
}

/**
 * Validate CSV file
 */
export function validateCsvFile(file: File): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check file type
  if (!file.name.toLowerCase().endsWith('.csv')) {
    errors.push('File must be a CSV file');
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    errors.push(
      `File size exceeds 10MB limit (current: ${(file.size / 1024 / 1024).toFixed(2)}MB)`
    );
  }

  // Check MIME type
  const validMimeTypes = ['text/csv', 'application/csv', 'text/plain'];
  if (!validMimeTypes.includes(file.type) && file.type !== '') {
    errors.push(`Invalid file type: ${file.type}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
