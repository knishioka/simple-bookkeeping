// Temporary type definitions until build issues are resolved
export const AccountType = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE',
} as const;

export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const AccountTypeLabels: Record<AccountType, string> = {
  ASSET: '資産',
  LIABILITY: '負債',
  EQUITY: '純資産',
  REVENUE: '収益',
  EXPENSE: '費用',
};

export interface Account {
  id: string;
  code: string;
  name: string;
  accountType: AccountType;
  parentId?: string | null;
  organizationId: string;
  isActive: boolean;
  isSystem: boolean;
  description?: string | null;
  organizationType?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
