/**
 * Account type definitions
 */

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type AccountCategory =
  | 'current_asset'
  | 'fixed_asset'
  | 'current_liability'
  | 'long_term_liability'
  | 'equity'
  | 'operating_revenue'
  | 'operating_expense'
  | 'non_operating_revenue'
  | 'non_operating_expense';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  category: AccountCategory;
  description?: string;
  isActive: boolean;
  organizationId: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
  parent?: Account;
  children?: Account[];
}

export interface CreateAccountDto {
  code: string;
  name: string;
  type: AccountType;
  category: AccountCategory;
  description?: string;
  parentId?: string;
}

export interface UpdateAccountDto {
  code?: string;
  name?: string;
  type?: AccountType;
  category?: AccountCategory;
  description?: string;
  isActive?: boolean;
  parentId?: string;
}

export interface AccountWithBalance extends Account {
  balance: number;
  debitTotal: number;
  creditTotal: number;
}
