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

interface TrialBalanceData {
  accounts: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    accountType: AccountType;
    debitBalance: number;
    creditBalance: number;
  }>;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
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
    // Categorize assets based on account code ranges
    const currentAssetAccounts = accounts.filter(
      (a) => a.accountType === AccountType.ASSET && a.code >= '1000' && a.code < '1500'
    );
    const fixedAssetAccounts = accounts.filter(
      (a) => a.accountType === AccountType.ASSET && a.code >= '1500' && a.code < '2000'
    );

    // Calculate cash-related accounts (現金、預金系)
    const cashAndBankIds = accounts
      .filter(
        (a) => a.accountType === AccountType.ASSET && a.code >= '1000' && a.code <= '1133' // 現金〜外貨預金
      )
      .map((a) => a.id);
    const cashTotal = cashAndBankIds.reduce((sum, id) => sum + (accountBalances.get(id) || 0), 0);

    // Calculate accounts receivable (売掛金、受取手形等)
    const receivableIds = accounts
      .filter(
        (a) => a.accountType === AccountType.ASSET && a.code >= '1140' && a.code <= '1142' // 売掛金〜電子記録債権
      )
      .map((a) => a.id);
    const receivableTotal = receivableIds.reduce(
      (sum, id) => sum + (accountBalances.get(id) || 0),
      0
    );

    // Calculate inventory (商品、製品、原材料等)
    const inventoryIds = accounts
      .filter(
        (a) => a.accountType === AccountType.ASSET && a.code >= '1150' && a.code <= '1154' // 商品〜貯蔵品
      )
      .map((a) => a.id);
    const inventoryTotal = inventoryIds.reduce(
      (sum, id) => sum + (accountBalances.get(id) || 0),
      0
    );

    // Calculate all current assets
    const currentAssetsTotal = currentAssetAccounts.reduce(
      (sum, account) => sum + (accountBalances.get(account.id) || 0),
      0
    );

    // Calculate property (土地、建物)
    const propertyIds = accounts
      .filter(
        (a) =>
          a.accountType === AccountType.ASSET &&
          ((a.code >= '1510' && a.code <= '1513') || a.code === '1532') // 建物系、土地
      )
      .map((a) => a.id);
    const propertyTotal = propertyIds.reduce((sum, id) => sum + (accountBalances.get(id) || 0), 0);

    // Calculate equipment (車両、工具器具備品等)
    const equipmentIds = accounts
      .filter(
        (a) =>
          a.accountType === AccountType.ASSET &&
          ((a.code >= '1520' && a.code <= '1531') || a.code === '1533') // 車両〜リース資産、建設仮勘定
      )
      .map((a) => a.id);
    const equipmentTotal = equipmentIds.reduce(
      (sum, id) => sum + (accountBalances.get(id) || 0),
      0
    );

    // Calculate all fixed assets
    const fixedAssetsTotal = fixedAssetAccounts.reduce(
      (sum, account) => sum + (accountBalances.get(account.id) || 0),
      0
    );

    const structuredAssets = {
      currentAssets: {
        cash: cashTotal,
        accountsReceivable: receivableTotal,
        inventory: inventoryTotal,
        total: currentAssetsTotal,
      },
      fixedAssets: {
        property: propertyTotal,
        equipment: equipmentTotal,
        total: fixedAssetsTotal,
      },
      total: totalAssets,
    };

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

    // Get current year's income statement (assuming fiscal year from Jan 1 to asOfDate)
    const yearStart = new Date(asOfDate.getFullYear(), 0, 1);
    const incomeStatement = await this.getIncomeStatement(organizationId, yearStart, asOfDate);

    // Extract values from balance sheet
    const currentAssets =
      'currentAssets' in balanceSheet.assets ? balanceSheet.assets.currentAssets.total : 0;
    const totalAssets = balanceSheet.totalAssets;
    const totalLiabilities = balanceSheet.totalLiabilities;
    const totalEquity = balanceSheet.totalEquity;

    // Categorize liabilities into current and long-term based on account codes
    const accounts = await prisma.account.findMany({
      where: { organizationId },
      orderBy: { code: 'asc' },
    });

    // Get journal entries for balance calculations
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

    // Calculate account balances for liabilities
    const liabilityBalances = new Map<string, number>();
    for (const entry of journalEntries) {
      for (const line of entry.lines) {
        if (line.account.accountType === AccountType.LIABILITY) {
          const currentBalance = liabilityBalances.get(line.accountId) || 0;
          const amount = Number(line.debitAmount) - Number(line.creditAmount);
          liabilityBalances.set(line.accountId, currentBalance - amount);
        }
      }
    }

    // Current liabilities: codes 2000-2499 (流動負債)
    const currentLiabilitiesAccounts = accounts.filter(
      (a) => a.accountType === AccountType.LIABILITY && a.code >= '2000' && a.code < '2500'
    );
    const currentLiabilities = currentLiabilitiesAccounts.reduce(
      (sum, account) => sum + Math.abs(liabilityBalances.get(account.id) || 0),
      0
    );

    // Extract income statement values
    const totalRevenue = incomeStatement.revenue.total;
    const netIncome = incomeStatement.netIncome;
    const grossProfit = incomeStatement.grossProfit;

    // Get specific values for ratio calculations
    const cash =
      'currentAssets' in balanceSheet.assets ? balanceSheet.assets.currentAssets.cash : 0;
    const accountsReceivable =
      'currentAssets' in balanceSheet.assets
        ? balanceSheet.assets.currentAssets.accountsReceivable
        : 0;
    const inventory =
      'currentAssets' in balanceSheet.assets ? balanceSheet.assets.currentAssets.inventory : 0;

    // Calculate liquidity ratios
    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
    const quickAssets = currentAssets - inventory;
    const quickRatio = currentLiabilities > 0 ? quickAssets / currentLiabilities : 0;
    const cashRatio = currentLiabilities > 0 ? cash / currentLiabilities : 0;

    // Calculate profitability ratios
    const grossProfitMargin = totalRevenue > 0 ? grossProfit / totalRevenue : 0;
    const netProfitMargin = totalRevenue > 0 ? netIncome / totalRevenue : 0;
    const returnOnAssets = totalAssets > 0 ? netIncome / totalAssets : 0;
    const returnOnEquity = totalEquity > 0 ? netIncome / totalEquity : 0;

    // Calculate efficiency ratios
    const assetTurnover = totalAssets > 0 ? totalRevenue / totalAssets : 0;
    // For inventory turnover, we need cost of goods sold (COGS)
    // Simplified: assuming COGS is approximately 70% of revenue for now
    const estimatedCOGS = totalRevenue * 0.7;
    const inventoryTurnover = inventory > 0 ? estimatedCOGS / inventory : 0;
    const receivablesTurnover = accountsReceivable > 0 ? totalRevenue / accountsReceivable : 0;

    // Calculate leverage ratios
    const debtToEquity = totalEquity > 0 ? totalLiabilities / totalEquity : 0;
    const debtToAssets = totalAssets > 0 ? totalLiabilities / totalAssets : 0;

    // Interest coverage: EBIT / Interest Expense
    // For now, we'll estimate interest expense from financial expense accounts
    const interestExpenseAccounts = accounts.filter(
      (a) => a.accountType === AccountType.EXPENSE && (a.code === '8110' || a.code === '8120') // 支払利息等
    );
    let interestExpense = 0;
    for (const entry of journalEntries) {
      for (const line of entry.lines) {
        if (interestExpenseAccounts.some((a) => a.id === line.accountId)) {
          interestExpense += Number(line.debitAmount) - Number(line.creditAmount);
        }
      }
    }
    const ebit = netIncome + interestExpense; // Simplified EBIT calculation
    const interestCoverage = interestExpense > 0 ? ebit / interestExpense : 0;

    return {
      liquidityRatios: {
        currentRatio: Math.round(currentRatio * 100) / 100,
        quickRatio: Math.round(quickRatio * 100) / 100,
        cashRatio: Math.round(cashRatio * 100) / 100,
      },
      profitabilityRatios: {
        grossProfitMargin: Math.round(grossProfitMargin * 1000) / 1000,
        netProfitMargin: Math.round(netProfitMargin * 1000) / 1000,
        returnOnAssets: Math.round(returnOnAssets * 1000) / 1000,
        returnOnEquity: Math.round(returnOnEquity * 1000) / 1000,
      },
      efficiencyRatios: {
        assetTurnover: Math.round(assetTurnover * 100) / 100,
        inventoryTurnover: Math.round(inventoryTurnover * 100) / 100,
        receivablesTurnover: Math.round(receivablesTurnover * 100) / 100,
      },
      leverageRatios: {
        debtToEquity: Math.round(debtToEquity * 100) / 100,
        debtToAssets: Math.round(debtToAssets * 100) / 100,
        interestCoverage: Math.round(interestCoverage * 100) / 100,
      },
    };
  }

  async exportReport(
    organizationId: string,
    type: string,
    format: string,
    params: ExportParams
  ): Promise<Buffer> {
    // Get report data based on type
    let reportData: any;

    switch (type) {
      case 'balance-sheet': {
        const asOfDate = params.asOf ? new Date(params.asOf) : new Date();
        reportData = await this.getBalanceSheet(organizationId, asOfDate);
        break;
      }
      case 'income-statement':
      case 'profit-loss': {
        if (!params.from || !params.to) {
          throw new Error('開始日と終了日を指定してください');
        }
        const startDate = new Date(params.from);
        const endDate = new Date(params.to);
        reportData = await this.getIncomeStatement(organizationId, startDate, endDate);
        break;
      }
      case 'trial-balance': {
        const asOfDate = params.asOf ? new Date(params.asOf) : new Date();
        reportData = await this.getTrialBalance(organizationId, asOfDate);
        break;
      }
      default:
        throw new Error(`サポートされていないレポートタイプ: ${type}`);
    }

    // Generate export based on format
    switch (format) {
      case 'csv':
        return this.generateCsvReport(type, reportData);
      case 'pdf':
        // TODO: PDF generation implementation
        throw new Error('PDF形式は現在開発中です');
      case 'xlsx':
      case 'excel':
        // TODO: Excel generation implementation
        throw new Error('Excel形式は現在開発中です');
      default:
        throw new Error(`サポートされていない形式: ${format}`);
    }
  }

  private generateCsvReport(
    type: string,
    data: BalanceSheetData | IncomeStatementData | TrialBalanceData
  ): Buffer {
    let csvContent: string;

    switch (type) {
      case 'balance-sheet':
        csvContent = this.generateBalanceSheetCsv(data as BalanceSheetData);
        break;
      case 'income-statement':
      case 'profit-loss':
        csvContent = this.generateIncomeStatementCsv(data as IncomeStatementData);
        break;
      case 'trial-balance':
        csvContent = this.generateTrialBalanceCsv(data as TrialBalanceData);
        break;
      default:
        throw new Error(`サポートされていないレポートタイプ: ${type}`);
    }

    // Add BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';
    return Buffer.from(bom + csvContent, 'utf-8');
  }

  private generateBalanceSheetCsv(data: BalanceSheetData): string {
    const rows: (string | number)[][] = [];

    // Header
    rows.push(['貸借対照表']);
    rows.push(['']);

    // Assets section
    rows.push(['資産の部']);
    rows.push(['勘定科目コード', '勘定科目名', '金額']);

    if (Array.isArray(data.assets)) {
      this.addAccountRows(rows, data.assets, 0);
    }
    rows.push(['', '資産合計', data.totalAssets]);
    rows.push(['']);

    // Liabilities section
    rows.push(['負債の部']);
    rows.push(['勘定科目コード', '勘定科目名', '金額']);
    this.addAccountRows(rows, data.liabilities, 0);
    rows.push(['', '負債合計', data.totalLiabilities]);
    rows.push(['']);

    // Equity section
    rows.push(['純資産の部']);
    rows.push(['勘定科目コード', '勘定科目名', '金額']);
    this.addAccountRows(rows, data.equity, 0);
    rows.push(['', '純資産合計', data.totalEquity]);
    rows.push(['']);

    rows.push(['', '負債・純資産合計', data.totalLiabilitiesAndEquity]);

    // Convert to CSV string
    return rows
      .map((row) =>
        row
          .map((cell) => {
            const value = cell?.toString() || '';
            // Escape quotes and wrap in quotes if contains comma or quote
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(',')
      )
      .join('\n');
  }

  private generateIncomeStatementCsv(data: IncomeStatementData): string {
    const rows: (string | number)[][] = [];

    // Header
    rows.push(['損益計算書']);
    rows.push(['']);

    // Revenue section
    rows.push(['収益']);
    rows.push(['勘定科目コード', '勘定科目名', '金額']);
    if (data.revenue.details) {
      this.addAccountRows(rows, data.revenue.details, 0);
    }
    rows.push(['', '収益合計', data.revenue.total]);
    rows.push(['']);

    // Expenses section
    rows.push(['費用']);
    rows.push(['勘定科目コード', '勘定科目名', '金額']);
    if (data.expenses.details) {
      this.addAccountRows(rows, data.expenses.details, 0);
    }
    rows.push(['', '費用合計', data.expenses.total]);
    rows.push(['']);

    rows.push(['', '売上総利益', data.grossProfit]);
    rows.push(['', '当期純利益', data.netIncome]);

    // Convert to CSV string
    return rows
      .map((row) =>
        row
          .map((cell) => {
            const value = cell?.toString() || '';
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(',')
      )
      .join('\n');
  }

  private generateTrialBalanceCsv(data: TrialBalanceData): string {
    const rows: (string | number)[][] = [];

    // Header
    rows.push(['試算表']);
    rows.push(['']);
    rows.push(['勘定科目コード', '勘定科目名', '借方残高', '貸方残高']);

    // Add account data
    if (data.accounts) {
      for (const account of data.accounts) {
        rows.push([
          account.accountCode,
          account.accountName,
          account.debitBalance || 0,
          account.creditBalance || 0,
        ]);
      }
    }

    rows.push(['']);
    rows.push(['', '合計', data.totalDebits || 0, data.totalCredits || 0]);

    // Convert to CSV string
    return rows
      .map((row) =>
        row
          .map((cell) => {
            const value = cell?.toString() || '';
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(',')
      )
      .join('\n');
  }

  private addAccountRows(
    rows: (string | number)[][],
    accounts: AccountBalance[],
    level: number
  ): void {
    const indent = '  '.repeat(level);
    for (const account of accounts) {
      rows.push([account.accountCode, indent + account.accountName, account.balance]);
      if (account.children && account.children.length > 0) {
        this.addAccountRows(rows, account.children, level + 1);
      }
    }
  }

  async getTrialBalance(organizationId: string, asOfDate: Date): Promise<TrialBalanceData> {
    const accounts = await prisma.account.findMany({
      where: { organizationId },
      orderBy: { code: 'asc' },
    });

    const entries = await prisma.journalEntry.findMany({
      where: {
        organizationId,
        entryDate: { lte: asOfDate },
        status: JournalStatus.APPROVED,
      },
      include: { lines: true },
    });

    const accountBalances = new Map<string, { debit: number; credit: number }>();

    // Initialize all accounts
    for (const account of accounts) {
      accountBalances.set(account.id, { debit: 0, credit: 0 });
    }

    // Calculate balances
    for (const entry of entries) {
      for (const line of entry.lines) {
        const balance = accountBalances.get(line.accountId);
        if (balance) {
          balance.debit += Number(line.debitAmount);
          balance.credit += Number(line.creditAmount);
        }
      }
    }

    // Format for output
    const trialBalanceAccounts = accounts
      .map((account) => {
        const balance = accountBalances.get(account.id) || { debit: 0, credit: 0 };
        const netBalance = balance.debit - balance.credit;

        return {
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          accountType: account.accountType,
          debitBalance: netBalance > 0 ? netBalance : 0,
          creditBalance: netBalance < 0 ? Math.abs(netBalance) : 0,
        };
      })
      .filter((account) => account.debitBalance !== 0 || account.creditBalance !== 0);

    const totalDebits = trialBalanceAccounts.reduce((sum, acc) => sum + acc.debitBalance, 0);
    const totalCredits = trialBalanceAccounts.reduce((sum, acc) => sum + acc.creditBalance, 0);

    return {
      accounts: trialBalanceAccounts,
      totalDebits,
      totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
    };
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
