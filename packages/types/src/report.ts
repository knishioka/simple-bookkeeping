/**
 * Financial report type definitions
 */

export interface AccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debitBalance: number;
  creditBalance: number;
  balance: number;
  children?: AccountBalance[];
}

export interface BalanceSheetData {
  assets: {
    current: AccountBalance[];
    fixed: AccountBalance[];
    totalAssets: number;
  };
  liabilities: {
    current: AccountBalance[];
    longTerm: AccountBalance[];
    totalLiabilities: number;
  };
  equity: {
    items: AccountBalance[];
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
}

export interface ProfitLossData {
  revenue: {
    operating: AccountBalance[];
    nonOperating: AccountBalance[];
    totalRevenue: number;
  };
  expenses: {
    operating: AccountBalance[];
    nonOperating: AccountBalance[];
    totalExpenses: number;
  };
  grossProfit: number;
  operatingProfit: number;
  ordinaryProfit: number;
  netProfit: number;
}

export interface TrialBalanceData {
  accounts: AccountBalance[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export interface ReportQuery {
  asOfDate?: string;
  startDate?: string;
  endDate?: string;
  includeSubAccounts?: boolean;
  excludeZeroBalance?: boolean;
}