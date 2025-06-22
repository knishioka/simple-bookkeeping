/**
 * Ledger type definitions
 */

export interface LedgerEntry {
  id: string;
  entryDate: string;
  entryNumber: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
  accountId?: string;
  accountCode?: string;
  accountName?: string;
  counterAccountName?: string;
  journalEntry?: {
    id: string;
    description: string;
  };
}

export interface LedgerQuery {
  accountId?: string;
  accountCode?: string;
  startDate: string;
  endDate: string;
}

export interface CashBookData {
  openingBalance: number;
  entries: LedgerEntry[];
  closingBalance: number;
}

export interface BankBookData {
  accountId: string;
  accountName: string;
  openingBalance: number;
  entries: LedgerEntry[];
  closingBalance: number;
}

export interface AccountsReceivableData {
  entries: LedgerEntry[];
  totalBalance: number;
  byAccount: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    balance: number;
  }>;
}

export interface AccountsPayableData {
  entries: LedgerEntry[];
  totalBalance: number;
  byAccount: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    balance: number;
  }>;
}
