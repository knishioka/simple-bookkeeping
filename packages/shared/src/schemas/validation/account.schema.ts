import { z } from 'zod';

import { ACCOUNT_CODE_MAX_LENGTH, ACCOUNT_NAME_MAX_LENGTH, REGEX_PATTERNS } from '../../constants';

// Define AccountType enum locally to avoid circular dependency
export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
}

// Base schemas
const uuidSchema = z.string().uuid('Invalid ID format');

// Account code schema with specific validation
export const accountCodeSchema = z
  .string()
  .min(1, 'Account code is required')
  .max(
    ACCOUNT_CODE_MAX_LENGTH,
    `Account code must be ${ACCOUNT_CODE_MAX_LENGTH} characters or less`
  )
  .regex(REGEX_PATTERNS.ACCOUNT_CODE, 'Account code must contain only numbers');

// Account name schema
export const accountNameSchema = z
  .string()
  .min(1, 'Account name is required')
  .max(
    ACCOUNT_NAME_MAX_LENGTH,
    `Account name must be ${ACCOUNT_NAME_MAX_LENGTH} characters or less`
  )
  .trim();

// Create account schema
export const createAccountSchema = z.object({
  code: accountCodeSchema,
  name: accountNameSchema,
  accountType: z.nativeEnum(AccountType, {
    message: 'Invalid account type',
  }),
  parentId: uuidSchema.nullable().optional(),
  description: z.string().max(500, 'Description too long').optional(),
  isActive: z.boolean().optional().default(true),
});

// Update account schema (partial)
export const updateAccountSchema = z.object({
  name: accountNameSchema.optional(),
  description: z.string().max(500, 'Description too long').optional(),
  parentId: uuidSchema.nullable().optional(),
  isActive: z.boolean().optional(),
});

// Account query parameters
export const accountQuerySchema = z.object({
  type: z.nativeEnum(AccountType).optional(),
  active: z
    .string()
    .transform((val) => val === 'true')
    .pipe(z.boolean())
    .optional(),
  parentId: uuidSchema.nullable().optional(),
  search: z.string().max(100).optional(),
});

// Account with balance schema (for reports)
interface AccountWithBalanceType {
  id: string;
  code: string;
  name: string;
  accountType: AccountType;
  parentId: string | null;
  balance: number;
  debitTotal: number;
  creditTotal: number;
  children?: AccountWithBalanceType[];
}

export const accountWithBalanceSchema: z.ZodSchema<AccountWithBalanceType> = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
  accountType: z.nativeEnum(AccountType),
  parentId: uuidSchema.nullable(),
  balance: z.number(),
  debitTotal: z.number(),
  creditTotal: z.number(),
  children: z.array(z.lazy(() => accountWithBalanceSchema)).optional(),
});

// Validation helpers
export const validateAccountHierarchy = (
  accountType: AccountType,
  parentAccountType?: AccountType
): boolean => {
  if (!parentAccountType) return true;
  return accountType === parentAccountType;
};

// Export types
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type AccountQueryParams = z.infer<typeof accountQuerySchema>;
export type AccountWithBalance = z.infer<typeof accountWithBalanceSchema>;
