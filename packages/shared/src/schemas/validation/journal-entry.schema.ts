// JournalStatus enum (migrated from @simple-bookkeeping/types)
const JournalStatus = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  LOCKED: 'LOCKED',
} as const;

type JournalStatus = (typeof JournalStatus)[keyof typeof JournalStatus];
import { z } from 'zod';

import { FLOATING_POINT_TOLERANCE, REGEX_PATTERNS } from '../../constants';

// Base schemas for reuse
const dateSchema = z
  .string()
  .regex(REGEX_PATTERNS.DATE_ISO, 'Invalid date format. Use YYYY-MM-DD')
  .transform((val) => new Date(val))
  .refine((date) => !isNaN(date.getTime()), 'Invalid date');

const amountSchema = z
  .number()
  .min(0, 'Amount must be positive')
  .multipleOf(0.01, 'Amount must have at most 2 decimal places');

const uuidSchema = z.string().uuid('Invalid ID format');

// Journal entry line schema
export const journalEntryLineSchema = z.object({
  accountId: uuidSchema,
  debitAmount: amountSchema,
  creditAmount: amountSchema,
  description: z.string().max(500, 'Description too long').optional(),
  taxRate: z.number().min(0).max(100).optional(),
  accountCode: z.string().optional(),
  accountName: z.string().optional(),
});

// Validate that each line has either debit or credit, not both
const validateLineAmounts = (line: z.infer<typeof journalEntryLineSchema>) => {
  return (
    (line.debitAmount > 0 && line.creditAmount === 0) ||
    (line.debitAmount === 0 && line.creditAmount > 0)
  );
};

// Validate that total debits equal total credits
const validateBalance = (lines: z.infer<typeof journalEntryLineSchema>[]) => {
  const totalDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);
  return Math.abs(totalDebit - totalCredit) < FLOATING_POINT_TOLERANCE;
};

// Create journal entry schema
export const createJournalEntrySchema = z.object({
  entryDate: dateSchema,
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  documentNumber: z.string().max(50, 'Document number too long').optional(),
  lines: z
    .array(journalEntryLineSchema)
    .min(2, 'At least 2 lines required')
    .refine(
      (lines) => lines.every(validateLineAmounts),
      'Each line must have either debit or credit amount, not both'
    )
    .refine(validateBalance, 'Total debits must equal total credits'),
});

// Update journal entry schema (partial, for PATCH requests)
export const updateJournalEntrySchema = createJournalEntrySchema.partial().extend({
  lines: z
    .array(journalEntryLineSchema)
    .min(2, 'At least 2 lines required')
    .refine(
      (lines) => lines.every(validateLineAmounts),
      'Each line must have either debit or credit amount, not both'
    )
    .refine(validateBalance, 'Total debits must equal total credits')
    .optional(),
});

// Query parameters schema
export const journalEntryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.nativeEnum(JournalStatus).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  organizationId: uuidSchema.optional(),
});

// CSV import record schema
export const csvJournalEntrySchema = z.object({
  日付: z.string().refine((val) => !isNaN(new Date(val).getTime()), 'Invalid date format'),
  借方勘定: z.string().min(1, 'Debit account is required'),
  貸方勘定: z.string().min(1, 'Credit account is required'),
  金額: z
    .string()
    // eslint-disable-next-line security/detect-unsafe-regex -- simple decimal pattern with bounded precision
    .regex(/^\d+(?:\.\d{1,2})?$/, 'Invalid amount format')
    .transform(Number)
    .pipe(z.number().positive()),
  摘要: z.string().max(500).optional().default(''),
});

// Response schemas for type safety
export const journalEntryResponseSchema = z.object({
  id: uuidSchema,
  entryNumber: z.string(),
  entryDate: z.date(),
  description: z.string(),
  documentNumber: z.string().nullable(),
  status: z.nativeEnum(JournalStatus),
  organizationId: uuidSchema,
  accountingPeriodId: uuidSchema,
  createdById: uuidSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  lines: z.array(
    journalEntryLineSchema.extend({
      id: uuidSchema,
      journalEntryId: uuidSchema,
      lineNumber: z.number().int().positive(),
      account: z.object({
        id: uuidSchema,
        code: z.string(),
        name: z.string(),
      }),
    })
  ),
});

// Export types
export type JournalEntryLine = z.infer<typeof journalEntryLineSchema>;
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>;
export type JournalEntryQueryParams = z.infer<typeof journalEntryQuerySchema>;
export type CsvJournalEntryRecord = z.infer<typeof csvJournalEntrySchema>;
export type JournalEntryResponse = z.infer<typeof journalEntryResponseSchema>;

// Re-export JournalStatus for convenience
export { JournalStatus };
