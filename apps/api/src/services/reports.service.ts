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

interface BalanceSheetData {
  assets: AccountBalance[];
  liabilities: AccountBalance[];
  equity: AccountBalance[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

interface ProfitLossData {
  revenues: AccountBalance[];
  expenses: AccountBalance[];
  totalRevenues: number;
  totalExpenses: number;
  netIncome: number;
}

export class ReportsService {
  async getBalanceSheet(
    accountingPeriodId: string,
    asOfDate: Date,
    organizationId: string
  ): Promise<BalanceSheetData> {
    // 会計期間の検証
    const accountingPeriod = await prisma.accountingPeriod.findFirst({
      where: {
        id: accountingPeriodId,
        organizationId,
      },
    });

    if (!accountingPeriod) {
      throw new Error('会計期間が見つかりません');
    }

    // 指定日までの確定済み仕訳を取得
    const journalEntries = await prisma.journalEntry.findMany({
      where: {
        accountingPeriodId,
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

    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
    };
  }

  async getProfitLoss(
    accountingPeriodId: string,
    startDate: Date,
    endDate: Date,
    organizationId: string
  ): Promise<ProfitLossData> {
    // 会計期間の検証
    const accountingPeriod = await prisma.accountingPeriod.findFirst({
      where: {
        id: accountingPeriodId,
        organizationId,
      },
    });

    if (!accountingPeriod) {
      throw new Error('会計期間が見つかりません');
    }

    // 期間内の確定済み仕訳を取得
    const journalEntries = await prisma.journalEntry.findMany({
      where: {
        accountingPeriodId,
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
    const netIncome = totalRevenues - totalExpenses;

    return {
      revenues,
      expenses,
      totalRevenues,
      totalExpenses,
      netIncome,
    };
  }
}
