// Common types for v2 API routes

// Database types
export interface AccountingPeriod {
  id: string;
  name: string;
  fiscal_year: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface Partner {
  id: string;
  code: string;
  name: string;
  name_kana?: string;
  tax_number?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  contact_person?: string;
  payment_terms?: number;
  credit_limit?: number;
  notes?: string;
  is_customer: boolean;
  is_supplier: boolean;
  organization_id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface PayableEntry {
  id: string;
  date: string;
  entryNumber: string;
  description: string;
  dueDate?: string | null;
  amount: number | null;
  bill?: number | null;
  payment?: number | null;
  balance: number;
  partner?: Partner | null;
}

export interface ReceivableEntry {
  id: string;
  date: string;
  entryNumber: string;
  description: string;
  dueDate?: string | null;
  amount: number | null;
  invoice?: number | null;
  payment?: number | null;
  balance: number;
  partner?: Partner | null;
}

export interface AccountBalance {
  id: string;
  code: string;
  name: string;
  account_type: string;
  category: string;
  subcategory: string;
  balance: number;
}

export interface JournalEntryLine {
  id: string;
  debit_amount: number | null;
  credit_amount: number | null;
  description?: string;
  account_id?: string;
  accounts?: {
    id: string;
    code: string;
    name: string;
    account_type: string;
    category: string;
    subcategory: string;
  };
  journal_entries?: {
    id: string;
    entry_date: string;
    entry_number: string;
    description: string;
    accounting_period_id: string;
    accounting_periods?: {
      id: string;
      name: string;
      fiscal_year: string;
    };
  };
}

export interface JournalEntry {
  id: string;
  entry_date: string;
  entry_number: string;
  description: string;
  accounting_period_id?: string;
  partner_id?: string | null;
  partners?: {
    id: string;
    name: string;
    code: string;
  } | null;
  journal_entry_lines?: JournalEntryLine[];
}

export interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
  category: string;
  subcategory: string;
  journal_entry_lines?: JournalEntryLine[];
}

export interface LedgerEntry {
  id: string;
  date: string;
  entryNumber: string;
  description: string;
  counterAccount?: {
    code: string;
    name: string;
  } | null;
  receipt?: number | null;
  payment?: number | null;
  deposit?: number | null;
  withdrawal?: number | null;
  invoice?: number | null;
  bill?: number | null;
  balance: number;
}

export interface CashMovement {
  description: string;
  category: 'operating' | 'investing' | 'financing';
  amount: number;
}

// Report type definitions
export interface BalanceSheetData {
  assets: {
    current: AccountBalance[];
    fixed: AccountBalance[];
    other: AccountBalance[];
    total: number;
  };
  liabilities: {
    current: AccountBalance[];
    longTerm: AccountBalance[];
    other: AccountBalance[];
    total: number;
  };
  equity: {
    capital: AccountBalance[];
    retained: AccountBalance[];
    other: AccountBalance[];
    total: number;
  };
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

export interface ProfitLossData {
  revenue: {
    sales: AccountBalance[];
    other: AccountBalance[];
    total: number;
  };
  expenses: {
    costOfSales: AccountBalance[];
    operating: AccountBalance[];
    financial: AccountBalance[];
    other: AccountBalance[];
    total: number;
  };
  grossProfit: number;
  operatingProfit: number;
  netProfit: number;
}

export interface TrialBalanceData {
  items: TrialBalanceItem[];
  totals: {
    debitTotal: number;
    creditTotal: number;
    debitBalance: number;
    creditBalance: number;
  };
  isBalanced: boolean;
}

export interface CashFlowData {
  operating: {
    receipts: ReportItem[];
    payments: ReportItem[];
    net: number;
  };
  investing: {
    receipts: ReportItem[];
    payments: ReportItem[];
    net: number;
  };
  financing: {
    receipts: ReportItem[];
    payments: ReportItem[];
    net: number;
  };
  beginningCash: number;
  endingCash: number;
  netChange: number;
}

export interface ReportItem {
  description: string;
  amount: number;
}

export interface TrialBalanceItem {
  account: {
    id: string;
    code: string;
    name: string;
    account_type: string;
    category: string;
    subcategory: string;
  };
  debitTotal: number;
  creditTotal: number;
  debitBalance: number;
  creditBalance: number;
}

export interface AgingAnalysis {
  current: number;
  days30: number;
  days60: number;
  days90Plus: number;
}

export interface PaymentSchedule {
  thisWeek: number;
  nextWeek: number;
  thisMonth: number;
  nextMonth: number;
}
