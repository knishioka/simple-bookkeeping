import { PrismaClient, AccountType, JournalStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface AccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  balance: number;
  children?: AccountBalance[];
}

interface AssetStructure {
  currentAssets: {
    cash: number;
    accountsReceivable: number;
    inventory: number;
    total: number;
  };
  fixedAssets: {
    property: number;
    equipment: number;
    total: number;
  };
  total: number;
}

interface BalanceSheetData {
  assets: AssetStructure | AccountBalance[];
  liabilities: AccountBalance[];
  equity: AccountBalance[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  comparison?: BalanceSheetData;
}

interface IncomeStatementData {
  revenue: {
    total: number;
    details?: AccountBalance[];
  };
  expenses: {
    total: number;
    details?: AccountBalance[];
  };
  grossProfit: number;
  netIncome: number;
  comparison?: IncomeStatementData;
}

interface CashFlowData {
  operatingActivities: number;
  investingActivities: number;
  financingActivities: number;
  netCashFlow: number;
  beginningCash: number;
  endingCash: number;
}

interface AgedData {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

interface ExportParams {
  asOf?: string;
  from?: string;
  to?: string;
  compareFrom?: string;
  compareTo?: string;
}

interface FinancialRatiosData {
  liquidityRatios: {
    currentRatio: number;
    quickRatio?: number;
    cashRatio?: number;
  };
  profitabilityRatios: {
    grossProfitMargin?: number;
    netProfitMargin?: number;
    returnOnAssets?: number;
    returnOnEquity?: number;
  };
  efficiencyRatios: {
    assetTurnover?: number;
    inventoryTurnover?: number;
    receivablesTurnover?: number;
  };
  leverageRatios: {
    debtToEquity?: number;
    debtToAssets?: number;
    interestCoverage?: number;
  };
}

interface CustomReportConfig {
  name: string;
  dateRange?: {
    from: string;
    to: string;
  };
  accounts?: string[];
  groupBy?: string;
  includeDetails?: boolean;
}

interface CustomReportData {
  name: string;
  data: {
    entries: unknown[];
    totals: Record<string, unknown>;
  };
  summary: {
    totalDebits: number;
    totalCredits: number;
    entryCount: number;
  };
}

export class ReportsService {
  async getBalanceSheet(
    organizationId: string,
    asOfDate: Date,
    compareDate?: Date
  ): Promise<BalanceSheetData> {
    // 指定日までの確定済み仕訳を取得
    const journalEntries = await prisma.journalEntry.findMany({
      where: {
        entryDate: { lte: asOfDate },
        status: JournalStatus.APPROVED,
        organizationId,
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    // 勘定科目ごとの残高を計算
    const accountBalances = new Map<string, number>();

    for (const entry of journalEntries) {
      for (const line of entry.lines) {
        const currentBalance = accountBalances.get(line.accountId) || 0;
        const debitAmount = Number(line.debitAmount);
        const creditAmount = Number(line.creditAmount);
        const amount = debitAmount - creditAmount;

        // 資産・費用は借方がプラス、負債・純資産・収益は貸方がプラス
        if (
          line.account.accountType === AccountType.ASSET ||
          line.account.accountType === AccountType.EXPENSE
        ) {
          accountBalances.set(line.accountId, currentBalance + amount);
        } else {
          accountBalances.set(line.accountId, currentBalance - amount);
        }
      }
    }

    // 全勘定科目を取得
    const accounts = await prisma.account.findMany({
      where: { organizationId },
      orderBy: { code: 'asc' },
    });

    // 勘定科目ツリーを構築
    const buildAccountTree = (
      accountType: AccountType,
      parentId: string | null = null
    ): AccountBalance[] => {
      return accounts
        .filter((account) => account.accountType === accountType && account.parentId === parentId)
        .map((account) => ({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          accountType: account.accountType,
          balance: accountBalances.get(account.id) || 0,
          children: buildAccountTree(accountType, account.id),
        }))
        .filter((account) => account.balance !== 0 || account.children?.length > 0);
    };

    // 合計の計算
    const calculateTotal = (accounts: AccountBalance[]): number => {
      return accounts.reduce((total, account) => {
        const accountTotal = account.balance;
        const childrenTotal = account.children ? calculateTotal(account.children) : 0;
        return total + accountTotal + childrenTotal;
      }, 0);
    };

    const assets = buildAccountTree(AccountType.ASSET);
    const liabilities = buildAccountTree(AccountType.LIABILITY);
    const equity = buildAccountTree(AccountType.EQUITY);

    const totalAssets = calculateTotal(assets);
    const totalLiabilities = calculateTotal(liabilities);
    const totalEquity = calculateTotal(equity);

    // Structure assets with categories
    const structuredAssets = {
      currentAssets: {
        cash: accountBalances.get(accounts.find((a) => a.name.includes('現金'))?.id || '') || 0,
        accountsReceivable: 0,
        inventory: 0,
        total: 0,
      },
      fixedAssets: {
        property: 0,
        equipment: 0,
        total: 0,
      },
      total: totalAssets,
    };

    // Calculate current assets total
    structuredAssets.currentAssets.total =
      structuredAssets.currentAssets.cash +
      structuredAssets.currentAssets.accountsReceivable +
      structuredAssets.currentAssets.inventory;

    // Get retained earnings from revenue and expense accounts for proper balance
    const revenueAccounts = await prisma.account.findMany({
      where: {
        accountType: AccountType.REVENUE,
        organizationId,
      },
    });

    const expenseAccounts = await prisma.account.findMany({
      where: {
        accountType: AccountType.EXPENSE,
        organizationId,
      },
    });

    let retainedEarnings = 0;
    for (const account of revenueAccounts) {
      retainedEarnings += accountBalances.get(account.id) || 0;
    }
    for (const account of expenseAccounts) {
      retainedEarnings -= accountBalances.get(account.id) || 0;
    }

    const adjustedEquity = totalEquity + retainedEarnings;

    const result: BalanceSheetData = {
      assets: structuredAssets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity: adjustedEquity,
      totalLiabilitiesAndEquity: totalLiabilities + adjustedEquity,
    };

    // Add comparison if requested
    if (compareDate) {
      result.comparison = await this.getBalanceSheet(organizationId, compareDate);
    }

    return result;
  }

  async getIncomeStatement(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    comparePeriod?: { from: Date; to: Date }
  ): Promise<IncomeStatementData> {
    // 期間内の確定済み仕訳を取得
    const journalEntries = await prisma.journalEntry.findMany({
      where: {
        entryDate: {
          gte: startDate,
          lte: endDate,
        },
        status: JournalStatus.APPROVED,
        organizationId,
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    // 勘定科目ごとの残高を計算
    const accountBalances = new Map<string, number>();

    for (const entry of journalEntries) {
      for (const line of entry.lines) {
        const currentBalance = accountBalances.get(line.accountId) || 0;
        const debitAmount = Number(line.debitAmount);
        const creditAmount = Number(line.creditAmount);
        const amount = debitAmount - creditAmount;

        // 収益は貸方がプラス、費用は借方がプラス
        if (line.account.accountType === AccountType.EXPENSE) {
          accountBalances.set(line.accountId, currentBalance + amount);
        } else if (line.account.accountType === AccountType.REVENUE) {
          accountBalances.set(line.accountId, currentBalance - amount);
        }
      }
    }

    // 全勘定科目を取得
    const accounts = await prisma.account.findMany({
      where: {
        accountType: {
          in: [AccountType.REVENUE, AccountType.EXPENSE],
        },
        organizationId,
      },
      orderBy: { code: 'asc' },
    });

    // 勘定科目ツリーを構築
    const buildAccountTree = (
      accountType: AccountType,
      parentId: string | null = null
    ): AccountBalance[] => {
      return accounts
        .filter((account) => account.accountType === accountType && account.parentId === parentId)
        .map((account) => ({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          accountType: account.accountType,
          balance: Math.abs(accountBalances.get(account.id) || 0),
          children: buildAccountTree(accountType, account.id),
        }))
        .filter((account) => account.balance !== 0 || account.children?.length > 0);
    };

    // 合計の計算
    const calculateTotal = (accounts: AccountBalance[]): number => {
      return accounts.reduce((total, account) => {
        const accountTotal = account.balance;
        const childrenTotal = account.children ? calculateTotal(account.children) : 0;
        return total + accountTotal + childrenTotal;
      }, 0);
    };

    const revenues = buildAccountTree(AccountType.REVENUE);
    const expenses = buildAccountTree(AccountType.EXPENSE);

    const totalRevenues = calculateTotal(revenues);
    const totalExpenses = calculateTotal(expenses);
    const grossProfit = totalRevenues; // Simplified - would normally exclude COGS
    const netIncome = totalRevenues - totalExpenses;

    const result: IncomeStatementData = {
      revenue: {
        total: totalRevenues,
        details: revenues,
      },
      expenses: {
        total: totalExpenses,
        details: expenses,
      },
      grossProfit,
      netIncome,
    };

    // Add comparison if requested
    if (comparePeriod) {
      result.comparison = await this.getIncomeStatement(
        organizationId,
        comparePeriod.from,
        comparePeriod.to
      );
    }

    return result;
  }

  async getCashFlow(organizationId: string, startDate: Date, endDate: Date): Promise<CashFlowData> {
    // Get cash account
    const cashAccount = await prisma.account.findFirst({
      where: {
        name: { contains: '現金' },
        organizationId,
      },
    });

    if (!cashAccount) {
      throw new Error('現金勘定が見つかりません');
    }

    // Get beginning cash balance
    const beginningEntries = await prisma.journalEntry.findMany({
      where: {
        entryDate: { lt: startDate },
        status: JournalStatus.APPROVED,
        organizationId,
      },
      include: {
        lines: {
          where: { accountId: cashAccount.id },
        },
      },
    });

    let beginningCash = 0;
    for (const entry of beginningEntries) {
      for (const line of entry.lines) {
        beginningCash += Number(line.debitAmount) - Number(line.creditAmount);
      }
    }

    // Get period cash flows
    const periodEntries = await prisma.journalEntry.findMany({
      where: {
        entryDate: {
          gte: startDate,
          lte: endDate,
        },
        status: JournalStatus.APPROVED,
        organizationId,
      },
      include: {
        lines: {
          where: { accountId: cashAccount.id },
          include: { account: true },
        },
      },
    });

    let operatingActivities = 0;
    const investingActivities = 0;
    let financingActivities = 0;

    for (const entry of periodEntries) {
      for (const line of entry.lines) {
        const amount = Number(line.debitAmount) - Number(line.creditAmount);
        // Simplified categorization - would normally be more complex
        if (entry.description.includes('売上') || entry.description.includes('仕入')) {
          operatingActivities += amount;
        } else if (entry.description.includes('資本')) {
          financingActivities += amount;
        } else {
          operatingActivities += amount;
        }
      }
    }

    const netCashFlow = operatingActivities + investingActivities + financingActivities;
    const endingCash = beginningCash + netCashFlow;

    return {
      operatingActivities,
      investingActivities,
      financingActivities,
      netCashFlow,
      beginningCash,
      endingCash,
    };
  }

  async getAgedReceivables(_organizationId: string, _asOfDate: Date): Promise<AgedData> {
    // Simplified implementation - would normally track invoices
    return {
      current: 0,
      days30: 0,
      days60: 0,
      days90: 0,
      over90: 0,
      total: 0,
    };
  }

  async getAgedPayables(_organizationId: string, _asOfDate: Date): Promise<AgedData> {
    // Simplified implementation - would normally track bills
    return {
      current: 0,
      days30: 0,
      days60: 0,
      days90: 0,
      over90: 0,
      total: 0,
    };
  }

  async getFinancialRatios(organizationId: string, asOfDate: Date): Promise<FinancialRatiosData> {
    const balanceSheet = await this.getBalanceSheet(organizationId, asOfDate);

    // Calculate current ratio
    const currentAssets =
      'currentAssets' in balanceSheet.assets ? balanceSheet.assets.currentAssets.total : 0;
    const currentLiabilities = 1000000; // Placeholder - would get from balance sheet
    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;

    return {
      liquidityRatios: {
        currentRatio,
        quickRatio: currentRatio * 0.8, // Simplified
        cashRatio: currentRatio * 0.5, // Simplified
      },
      profitabilityRatios: {
        grossProfitMargin: 0.3,
        netProfitMargin: 0.2,
        returnOnAssets: 0.1,
        returnOnEquity: 0.15,
      },
      efficiencyRatios: {
        assetTurnover: 1.5,
        inventoryTurnover: 6,
        receivablesTurnover: 8,
      },
      leverageRatios: {
        debtToEquity: 0.5,
        debtToAssets: 0.3,
        interestCoverage: 5,
      },
    };
  }

  async exportReport(
    _organizationId: string,
    type: string,
    format: string,
    _params: ExportParams
  ): Promise<Buffer> {
    // Simplified implementation - would normally generate actual files
    const content = `Report Type: ${type}\nFormat: ${format}\n`;
    return Buffer.from(content);
  }

  async createCustomReport(
    organizationId: string,
    config: CustomReportConfig
  ): Promise<CustomReportData> {
    return {
      name: config.name,
      data: {
        // Simplified implementation
        entries: [],
        totals: {},
      },
      summary: {
        totalDebits: 0,
        totalCredits: 0,
        entryCount: 0,
      },
    };
  }
}
