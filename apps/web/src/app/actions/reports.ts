'use server';

import { createClient } from '@/lib/supabase/server';

import {
  ActionResult,
  createSuccessResult,
  createErrorResult,
  createUnauthorizedResult,
  handleSupabaseError,
  ERROR_CODES,
  createValidationErrorResult,
} from './types';

// Types for report data
interface AccountBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  category: string;
  subCategory: string | null;
  debitBalance: number;
  creditBalance: number;
  netBalance: number;
}

interface BalanceSheetItem {
  category: string;
  subCategory: string | null;
  accountCode: string;
  accountName: string;
  amount: number;
}

interface BalanceSheet {
  reportDate: string;
  organizationId: string;
  assets: {
    current: BalanceSheetItem[];
    fixed: BalanceSheetItem[];
    deferred: BalanceSheetItem[];
    totalAssets: number;
  };
  liabilities: {
    current: BalanceSheetItem[];
    fixed: BalanceSheetItem[];
    totalLiabilities: number;
  };
  equity: {
    capital: BalanceSheetItem[];
    retainedEarnings: BalanceSheetItem[];
    currentPeriodIncome: number;
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
}

interface IncomeStatementItem {
  category: string;
  subCategory: string | null;
  accountCode: string;
  accountName: string;
  amount: number;
}

interface IncomeStatement {
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  organizationId: string;
  revenue: {
    salesRevenue: IncomeStatementItem[];
    otherRevenue: IncomeStatementItem[];
    totalRevenue: number;
  };
  expenses: {
    costOfSales: IncomeStatementItem[];
    sellingExpenses: IncomeStatementItem[];
    administrativeExpenses: IncomeStatementItem[];
    otherExpenses: IncomeStatementItem[];
    totalExpenses: number;
  };
  operatingIncome: number;
  nonOperating: {
    income: IncomeStatementItem[];
    expenses: IncomeStatementItem[];
    netNonOperating: number;
  };
  ordinaryIncome: number;
  extraordinary: {
    gains: IncomeStatementItem[];
    losses: IncomeStatementItem[];
    netExtraordinary: number;
  };
  incomeBeforeTax: number;
  taxExpense: number;
  netIncome: number;
}

interface TrialBalanceItem {
  accountCode: string;
  accountName: string;
  accountType: string;
  category: string;
  beginningDebit: number;
  beginningCredit: number;
  periodDebit: number;
  periodCredit: number;
  endingDebit: number;
  endingCredit: number;
}

interface TrialBalance {
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  organizationId: string;
  items: TrialBalanceItem[];
  totals: {
    beginningDebit: number;
    beginningCredit: number;
    periodDebit: number;
    periodCredit: number;
    endingDebit: number;
    endingCredit: number;
  };
}

interface GeneralLedgerEntry {
  entryDate: string;
  entryNumber: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
}

interface GeneralLedgerAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  openingBalance: number;
  entries: GeneralLedgerEntry[];
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
}

interface GeneralLedger {
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  organizationId: string;
  accounts: GeneralLedgerAccount[];
}

interface CashFlowItem {
  category: string;
  description: string;
  amount: number;
}

interface CashFlowStatement {
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  organizationId: string;
  operating: {
    items: CashFlowItem[];
    netCashFromOperating: number;
  };
  investing: {
    items: CashFlowItem[];
    netCashFromInvesting: number;
  };
  financing: {
    items: CashFlowItem[];
    netCashFromFinancing: number;
  };
  beginningCash: number;
  netChange: number;
  endingCash: number;
}

// Helper function to check user permissions
async function checkUserPermissions(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  organizationId: string
): Promise<{ hasAccess: boolean; error?: ActionResult<never> }> {
  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      hasAccess: false,
      error: createUnauthorizedResult(),
    };
  }

  // Check organization access
  const { data: userOrg, error: orgError } = await supabase
    .from('user_organizations')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .single();

  if (orgError || !userOrg) {
    return {
      hasAccess: false,
      error: createErrorResult(
        ERROR_CODES.FORBIDDEN,
        'この組織のレポートを表示する権限がありません。'
      ),
    };
  }

  return { hasAccess: true };
}

/**
 * 貸借対照表（バランスシート）を生成
 * Generate balance sheet report showing assets, liabilities, and equity
 */
export async function getBalanceSheet(
  organizationId: string,
  reportDate: string,
  accountingPeriodId?: string
): Promise<ActionResult<BalanceSheet>> {
  try {
    const supabase = await createClient();

    // Check permissions
    const permissionCheck = await checkUserPermissions(supabase, organizationId);
    if (!permissionCheck.hasAccess && permissionCheck.error) {
      return permissionCheck.error;
    }

    // Validate report date
    if (!reportDate || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      return createValidationErrorResult('有効な日付を指定してください（YYYY-MM-DD形式）');
    }

    // Build query for account balances up to report date
    let balanceQuery = supabase
      .from('journal_entry_lines')
      .select(
        `
        account_id,
        debit_amount,
        credit_amount,
        journal_entries!inner(
          entry_date,
          status,
          organization_id,
          accounting_period_id
        ),
        accounts!inner(
          id,
          code,
          name,
          account_type,
          category,
          sub_category
        )
      `
      )
      .eq('journal_entries.organization_id', organizationId)
      .eq('journal_entries.status', 'approved')
      .lte('journal_entries.entry_date', reportDate);

    if (accountingPeriodId) {
      balanceQuery = balanceQuery.eq('journal_entries.accounting_period_id', accountingPeriodId);
    }

    const { data: balanceData, error: balanceError } = await balanceQuery;

    if (balanceError) {
      return handleSupabaseError(balanceError);
    }

    // Process and aggregate balances by account
    const accountBalances = new Map<string, AccountBalance>();

    balanceData?.forEach((line) => {
      const accountId = line.account_id;
      const account = Array.isArray(line.accounts) ? line.accounts[0] : line.accounts;

      if (!account) return;

      if (!accountBalances.has(accountId)) {
        accountBalances.set(accountId, {
          accountId,
          accountCode: account.code,
          accountName: account.name,
          accountType: account.account_type,
          category: account.category,
          subCategory: account.sub_category,
          debitBalance: 0,
          creditBalance: 0,
          netBalance: 0,
        });
      }

      const balance = accountBalances.get(accountId);
      if (!balance) return;
      balance.debitBalance += line.debit_amount || 0;
      balance.creditBalance += line.credit_amount || 0;

      // Calculate net balance based on account type (Japanese accounting)
      // Assets and expenses have debit normal balance
      // Liabilities, equity, and revenue have credit normal balance
      if (account && (account.account_type === 'asset' || account.account_type === 'expense')) {
        balance.netBalance = balance.debitBalance - balance.creditBalance;
      } else {
        balance.netBalance = balance.creditBalance - balance.debitBalance;
      }
    });

    // Organize into balance sheet structure
    const balanceSheet: BalanceSheet = {
      reportDate,
      organizationId,
      assets: {
        current: [],
        fixed: [],
        deferred: [],
        totalAssets: 0,
      },
      liabilities: {
        current: [],
        fixed: [],
        totalLiabilities: 0,
      },
      equity: {
        capital: [],
        retainedEarnings: [],
        currentPeriodIncome: 0,
        totalEquity: 0,
      },
      totalLiabilitiesAndEquity: 0,
    };

    // Categorize accounts into balance sheet sections
    accountBalances.forEach((balance) => {
      if (balance.netBalance === 0) return; // Skip zero balances

      const item: BalanceSheetItem = {
        category: balance.category,
        subCategory: balance.subCategory,
        accountCode: balance.accountCode,
        accountName: balance.accountName,
        amount: Math.abs(balance.netBalance),
      };

      switch (balance.accountType) {
        case 'asset':
          if (balance.category === '流動資産') {
            balanceSheet.assets.current.push(item);
          } else if (balance.category === '固定資産') {
            balanceSheet.assets.fixed.push(item);
          } else if (balance.category === '繰延資産') {
            balanceSheet.assets.deferred.push(item);
          }
          balanceSheet.assets.totalAssets += item.amount;
          break;

        case 'liability':
          if (balance.category === '流動負債') {
            balanceSheet.liabilities.current.push(item);
          } else if (balance.category === '固定負債') {
            balanceSheet.liabilities.fixed.push(item);
          }
          balanceSheet.liabilities.totalLiabilities += item.amount;
          break;

        case 'equity':
          if (balance.category === '資本金') {
            balanceSheet.equity.capital.push(item);
          } else if (balance.category === '利益剰余金') {
            balanceSheet.equity.retainedEarnings.push(item);
          }
          balanceSheet.equity.totalEquity += item.amount;
          break;
      }
    });

    // Calculate current period income (revenue - expenses)
    let currentIncome = 0;
    accountBalances.forEach((balance) => {
      if (balance.accountType === 'revenue') {
        currentIncome += balance.netBalance;
      } else if (balance.accountType === 'expense') {
        currentIncome -= balance.netBalance;
      }
    });

    balanceSheet.equity.currentPeriodIncome = currentIncome;
    balanceSheet.equity.totalEquity += currentIncome;
    balanceSheet.totalLiabilitiesAndEquity =
      balanceSheet.liabilities.totalLiabilities + balanceSheet.equity.totalEquity;

    // Sort items by account code
    balanceSheet.assets.current.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    balanceSheet.assets.fixed.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    balanceSheet.assets.deferred.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    balanceSheet.liabilities.current.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    balanceSheet.liabilities.fixed.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    balanceSheet.equity.capital.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    balanceSheet.equity.retainedEarnings.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    return createSuccessResult(balanceSheet);
  } catch (error) {
    console.error('Error generating balance sheet:', error);
    return createErrorResult(
      ERROR_CODES.INTERNAL_ERROR,
      '貸借対照表の生成中にエラーが発生しました。'
    );
  }
}

/**
 * 損益計算書を生成
 * Generate income statement (profit and loss) report
 */
export async function getIncomeStatement(
  organizationId: string,
  startDate: string,
  endDate: string,
  accountingPeriodId?: string
): Promise<ActionResult<IncomeStatement>> {
  try {
    const supabase = await createClient();

    // Check permissions
    const permissionCheck = await checkUserPermissions(supabase, organizationId);
    if (!permissionCheck.hasAccess && permissionCheck.error) {
      return permissionCheck.error;
    }

    // Validate dates
    if (
      !startDate ||
      !endDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
    ) {
      return createValidationErrorResult('有効な日付範囲を指定してください（YYYY-MM-DD形式）');
    }

    if (startDate > endDate) {
      return createValidationErrorResult('開始日は終了日より前である必要があります。');
    }

    // Get journal entry lines for the period
    let incomeQuery = supabase
      .from('journal_entry_lines')
      .select(
        `
        account_id,
        debit_amount,
        credit_amount,
        journal_entries!inner(
          entry_date,
          status,
          organization_id,
          accounting_period_id
        ),
        accounts!inner(
          id,
          code,
          name,
          account_type,
          category,
          sub_category
        )
      `
      )
      .eq('journal_entries.organization_id', organizationId)
      .eq('journal_entries.status', 'approved')
      .gte('journal_entries.entry_date', startDate)
      .lte('journal_entries.entry_date', endDate);

    if (accountingPeriodId) {
      incomeQuery = incomeQuery.eq('journal_entries.accounting_period_id', accountingPeriodId);
    }

    const { data: incomeData, error: incomeError } = await incomeQuery;

    if (incomeError) {
      return handleSupabaseError(incomeError);
    }

    // Process and aggregate amounts by account
    const accountTotals = new Map<
      string,
      {
        account: Record<string, unknown>;
        amount: number;
      }
    >();

    incomeData?.forEach((line) => {
      const accountId = line.account_id;
      const account = Array.isArray(line.accounts) ? line.accounts[0] : line.accounts;

      if (!account) return;

      if (!accountTotals.has(accountId)) {
        accountTotals.set(accountId, {
          account,
          amount: 0,
        });
      }

      const total = accountTotals.get(accountId);
      if (!total) return;

      // For revenue accounts, credit increases the balance
      // For expense accounts, debit increases the balance
      if (account && account.account_type === 'revenue') {
        total.amount += (line.credit_amount || 0) - (line.debit_amount || 0);
      } else if (account && account.account_type === 'expense') {
        total.amount += (line.debit_amount || 0) - (line.credit_amount || 0);
      }
    });

    // Initialize income statement structure
    const incomeStatement: IncomeStatement = {
      reportPeriod: {
        startDate,
        endDate,
      },
      organizationId,
      revenue: {
        salesRevenue: [],
        otherRevenue: [],
        totalRevenue: 0,
      },
      expenses: {
        costOfSales: [],
        sellingExpenses: [],
        administrativeExpenses: [],
        otherExpenses: [],
        totalExpenses: 0,
      },
      operatingIncome: 0,
      nonOperating: {
        income: [],
        expenses: [],
        netNonOperating: 0,
      },
      ordinaryIncome: 0,
      extraordinary: {
        gains: [],
        losses: [],
        netExtraordinary: 0,
      },
      incomeBeforeTax: 0,
      taxExpense: 0,
      netIncome: 0,
    };

    // Categorize accounts into income statement sections
    accountTotals.forEach(({ account, amount }) => {
      if (amount === 0) return; // Skip zero amounts

      const item: IncomeStatementItem = {
        category: account.category as string,
        subCategory: account.sub_category as string | null,
        accountCode: account.code as string,
        accountName: account.name as string,
        amount: Math.abs(amount),
      };

      if (account && account.account_type === 'revenue') {
        if (account.category === '売上高') {
          incomeStatement.revenue.salesRevenue.push(item);
        } else {
          incomeStatement.revenue.otherRevenue.push(item);
        }
        incomeStatement.revenue.totalRevenue += item.amount;
      } else if (account && account.account_type === 'expense') {
        if (account.category === '売上原価') {
          incomeStatement.expenses.costOfSales.push(item);
        } else if (account.category === '販売費') {
          incomeStatement.expenses.sellingExpenses.push(item);
        } else if (account.category === '一般管理費') {
          incomeStatement.expenses.administrativeExpenses.push(item);
        } else if (account.category === '営業外費用') {
          incomeStatement.nonOperating.expenses.push(item);
          incomeStatement.nonOperating.netNonOperating -= item.amount;
        } else if (account.category === '特別損失') {
          incomeStatement.extraordinary.losses.push(item);
          incomeStatement.extraordinary.netExtraordinary -= item.amount;
        } else if (account.category === '法人税等') {
          incomeStatement.taxExpense = item.amount;
        } else {
          incomeStatement.expenses.otherExpenses.push(item);
        }

        if (
          account.category !== '営業外費用' &&
          account.category !== '特別損失' &&
          account.category !== '法人税等'
        ) {
          incomeStatement.expenses.totalExpenses += item.amount;
        }
      }
    });

    // Look for non-operating income and extraordinary gains
    accountTotals.forEach(({ account, amount }) => {
      if (account && account.account_type === 'revenue') {
        if (account.category === '営業外収益') {
          const item: IncomeStatementItem = {
            category: account.category as string,
            subCategory: account.sub_category as string | null,
            accountCode: account.code as string,
            accountName: account.name as string,
            amount: Math.abs(amount),
          };
          incomeStatement.nonOperating.income.push(item);
          incomeStatement.nonOperating.netNonOperating += item.amount;
        } else if (account.category === '特別利益') {
          const item: IncomeStatementItem = {
            category: account.category as string,
            subCategory: account.sub_category as string | null,
            accountCode: account.code as string,
            accountName: account.name as string,
            amount: Math.abs(amount),
          };
          incomeStatement.extraordinary.gains.push(item);
          incomeStatement.extraordinary.netExtraordinary += item.amount;
        }
      }
    });

    // Calculate summary amounts
    incomeStatement.operatingIncome =
      incomeStatement.revenue.totalRevenue - incomeStatement.expenses.totalExpenses;
    incomeStatement.ordinaryIncome =
      incomeStatement.operatingIncome + incomeStatement.nonOperating.netNonOperating;
    incomeStatement.incomeBeforeTax =
      incomeStatement.ordinaryIncome + incomeStatement.extraordinary.netExtraordinary;
    incomeStatement.netIncome = incomeStatement.incomeBeforeTax - incomeStatement.taxExpense;

    // Sort items by account code
    incomeStatement.revenue.salesRevenue.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    incomeStatement.revenue.otherRevenue.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    incomeStatement.expenses.costOfSales.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    incomeStatement.expenses.sellingExpenses.sort((a, b) =>
      a.accountCode.localeCompare(b.accountCode)
    );
    incomeStatement.expenses.administrativeExpenses.sort((a, b) =>
      a.accountCode.localeCompare(b.accountCode)
    );
    incomeStatement.expenses.otherExpenses.sort((a, b) =>
      a.accountCode.localeCompare(b.accountCode)
    );
    incomeStatement.nonOperating.income.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    incomeStatement.nonOperating.expenses.sort((a, b) =>
      a.accountCode.localeCompare(b.accountCode)
    );
    incomeStatement.extraordinary.gains.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    incomeStatement.extraordinary.losses.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    return createSuccessResult(incomeStatement);
  } catch (error) {
    console.error('Error generating income statement:', error);
    return createErrorResult(
      ERROR_CODES.INTERNAL_ERROR,
      '損益計算書の生成中にエラーが発生しました。'
    );
  }
}

/**
 * 試算表を生成
 * Generate trial balance report showing debit and credit totals
 */
export async function getTrialBalance(
  organizationId: string,
  startDate: string,
  endDate: string,
  accountingPeriodId?: string
): Promise<ActionResult<TrialBalance>> {
  try {
    const supabase = await createClient();

    // Check permissions
    const permissionCheck = await checkUserPermissions(supabase, organizationId);
    if (!permissionCheck.hasAccess && permissionCheck.error) {
      return permissionCheck.error;
    }

    // Validate dates
    if (
      !startDate ||
      !endDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
    ) {
      return createValidationErrorResult('有効な日付範囲を指定してください（YYYY-MM-DD形式）');
    }

    if (startDate > endDate) {
      return createValidationErrorResult('開始日は終了日より前である必要があります。');
    }

    // Get all accounts for the organization
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('organization_id', organizationId)
      .order('code');

    if (accountsError) {
      return handleSupabaseError(accountsError);
    }

    // Get beginning balances (all entries before start date)
    let beginningQuery = supabase
      .from('journal_entry_lines')
      .select(
        `
        account_id,
        debit_amount,
        credit_amount,
        journal_entries!inner(
          entry_date,
          status,
          organization_id,
          accounting_period_id
        )
      `
      )
      .eq('journal_entries.organization_id', organizationId)
      .eq('journal_entries.status', 'approved')
      .lt('journal_entries.entry_date', startDate);

    if (accountingPeriodId) {
      beginningQuery = beginningQuery.eq(
        'journal_entries.accounting_period_id',
        accountingPeriodId
      );
    }

    const { data: beginningData, error: beginningError } = await beginningQuery;

    if (beginningError) {
      return handleSupabaseError(beginningError);
    }

    // Get period transactions
    let periodQuery = supabase
      .from('journal_entry_lines')
      .select(
        `
        account_id,
        debit_amount,
        credit_amount,
        journal_entries!inner(
          entry_date,
          status,
          organization_id,
          accounting_period_id
        )
      `
      )
      .eq('journal_entries.organization_id', organizationId)
      .eq('journal_entries.status', 'approved')
      .gte('journal_entries.entry_date', startDate)
      .lte('journal_entries.entry_date', endDate);

    if (accountingPeriodId) {
      periodQuery = periodQuery.eq('journal_entries.accounting_period_id', accountingPeriodId);
    }

    const { data: periodData, error: periodError } = await periodQuery;

    if (periodError) {
      return handleSupabaseError(periodError);
    }

    // Calculate balances for each account
    const accountBalances = new Map<
      string,
      {
        beginningDebit: number;
        beginningCredit: number;
        periodDebit: number;
        periodCredit: number;
      }
    >();

    // Initialize all accounts
    accounts?.forEach((account) => {
      accountBalances.set(account.id, {
        beginningDebit: 0,
        beginningCredit: 0,
        periodDebit: 0,
        periodCredit: 0,
      });
    });

    // Process beginning balances
    beginningData?.forEach((line) => {
      const balance = accountBalances.get(line.account_id);
      if (balance) {
        balance.beginningDebit += line.debit_amount || 0;
        balance.beginningCredit += line.credit_amount || 0;
      }
    });

    // Process period transactions
    periodData?.forEach((line) => {
      const balance = accountBalances.get(line.account_id);
      if (balance) {
        balance.periodDebit += line.debit_amount || 0;
        balance.periodCredit += line.credit_amount || 0;
      }
    });

    // Build trial balance items
    const items: TrialBalanceItem[] = [];
    const totals = {
      beginningDebit: 0,
      beginningCredit: 0,
      periodDebit: 0,
      periodCredit: 0,
      endingDebit: 0,
      endingCredit: 0,
    };

    accounts?.forEach((account) => {
      const balance = accountBalances.get(account.id);
      if (!balance) return;

      // Calculate ending balance
      const endingDebit = balance.beginningDebit + balance.periodDebit;
      const endingCredit = balance.beginningCredit + balance.periodCredit;

      // Skip accounts with no activity
      if (endingDebit === 0 && endingCredit === 0) return;

      const item: TrialBalanceItem = {
        accountCode: account.code,
        accountName: account.name,
        accountType: account.account_type,
        category: account.category,
        beginningDebit: balance.beginningDebit,
        beginningCredit: balance.beginningCredit,
        periodDebit: balance.periodDebit,
        periodCredit: balance.periodCredit,
        endingDebit,
        endingCredit,
      };

      items.push(item);

      // Update totals
      totals.beginningDebit += balance.beginningDebit;
      totals.beginningCredit += balance.beginningCredit;
      totals.periodDebit += balance.periodDebit;
      totals.periodCredit += balance.periodCredit;
      totals.endingDebit += endingDebit;
      totals.endingCredit += endingCredit;
    });

    const trialBalance: TrialBalance = {
      reportPeriod: {
        startDate,
        endDate,
      },
      organizationId,
      items,
      totals,
    };

    return createSuccessResult(trialBalance);
  } catch (error) {
    console.error('Error generating trial balance:', error);
    return createErrorResult(ERROR_CODES.INTERNAL_ERROR, '試算表の生成中にエラーが発生しました。');
  }
}

/**
 * 総勘定元帳を生成
 * Generate general ledger report showing all transactions by account
 */
export async function getGeneralLedger(
  organizationId: string,
  startDate: string,
  endDate: string,
  accountIds?: string[],
  accountingPeriodId?: string
): Promise<ActionResult<GeneralLedger>> {
  try {
    const supabase = await createClient();

    // Check permissions
    const permissionCheck = await checkUserPermissions(supabase, organizationId);
    if (!permissionCheck.hasAccess && permissionCheck.error) {
      return permissionCheck.error;
    }

    // Validate dates
    if (
      !startDate ||
      !endDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
    ) {
      return createValidationErrorResult('有効な日付範囲を指定してください（YYYY-MM-DD形式）');
    }

    if (startDate > endDate) {
      return createValidationErrorResult('開始日は終了日より前である必要があります。');
    }

    // Get accounts
    let accountsQuery = supabase.from('accounts').select('*').eq('organization_id', organizationId);

    if (accountIds && accountIds.length > 0) {
      accountsQuery = accountsQuery.in('id', accountIds);
    }

    const { data: accounts, error: accountsError } = await accountsQuery.order('code');

    if (accountsError) {
      return handleSupabaseError(accountsError);
    }

    // Get journal entries with lines for the period
    let entriesQuery = supabase
      .from('journal_entries')
      .select(
        `
        id,
        entry_number,
        entry_date,
        description,
        journal_entry_lines(
          account_id,
          debit_amount,
          credit_amount,
          description
        )
      `
      )
      .eq('organization_id', organizationId)
      .eq('status', 'approved')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .order('entry_date')
      .order('entry_number');

    if (accountingPeriodId) {
      entriesQuery = entriesQuery.eq('accounting_period_id', accountingPeriodId);
    }

    const { data: entries, error: entriesError } = await entriesQuery;

    if (entriesError) {
      return handleSupabaseError(entriesError);
    }

    // Get opening balances (transactions before start date)
    let openingQuery = supabase
      .from('journal_entry_lines')
      .select(
        `
        account_id,
        debit_amount,
        credit_amount,
        journal_entries!inner(
          entry_date,
          status,
          organization_id,
          accounting_period_id
        )
      `
      )
      .eq('journal_entries.organization_id', organizationId)
      .eq('journal_entries.status', 'approved')
      .lt('journal_entries.entry_date', startDate);

    if (accountingPeriodId) {
      openingQuery = openingQuery.eq('journal_entries.accounting_period_id', accountingPeriodId);
    }

    if (accountIds && accountIds.length > 0) {
      openingQuery = openingQuery.in('account_id', accountIds);
    }

    const { data: openingData, error: openingError } = await openingQuery;

    if (openingError) {
      return handleSupabaseError(openingError);
    }

    // Calculate opening balances
    const openingBalances = new Map<string, number>();
    openingData?.forEach((line) => {
      const current = openingBalances.get(line.account_id) || 0;
      const debit = line.debit_amount || 0;
      const credit = line.credit_amount || 0;
      openingBalances.set(line.account_id, current + debit - credit);
    });

    // Build general ledger for each account
    const ledgerAccounts: GeneralLedgerAccount[] = [];

    accounts?.forEach((account) => {
      const openingBalance = openingBalances.get(account.id) || 0;
      let runningBalance = openingBalance;
      const accountEntries: GeneralLedgerEntry[] = [];
      let totalDebits = 0;
      let totalCredits = 0;

      // Process journal entries for this account
      entries?.forEach((entry) => {
        const lines = entry.journal_entry_lines?.filter((line) => line.account_id === account.id);

        lines?.forEach((line) => {
          const debit = line.debit_amount || 0;
          const credit = line.credit_amount || 0;

          // Update running balance
          if (account.account_type === 'asset' || account.account_type === 'expense') {
            runningBalance += debit - credit;
          } else {
            runningBalance += credit - debit;
          }

          totalDebits += debit;
          totalCredits += credit;

          accountEntries.push({
            entryDate: entry.entry_date,
            entryNumber: entry.entry_number,
            description: line.description || entry.description,
            debitAmount: debit,
            creditAmount: credit,
            balance: Math.abs(runningBalance),
          });
        });
      });

      // Only include accounts with activity
      if (accountEntries.length > 0 || openingBalance !== 0) {
        ledgerAccounts.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          accountType: account.account_type,
          openingBalance: Math.abs(openingBalance),
          entries: accountEntries,
          closingBalance: Math.abs(runningBalance),
          totalDebits,
          totalCredits,
        });
      }
    });

    const generalLedger: GeneralLedger = {
      reportPeriod: {
        startDate,
        endDate,
      },
      organizationId,
      accounts: ledgerAccounts,
    };

    return createSuccessResult(generalLedger);
  } catch (error) {
    console.error('Error generating general ledger:', error);
    return createErrorResult(
      ERROR_CODES.INTERNAL_ERROR,
      '総勘定元帳の生成中にエラーが発生しました。'
    );
  }
}

/**
 * キャッシュフロー計算書を生成
 * Generate cash flow statement showing cash movements
 */
export async function getCashFlowStatement(
  organizationId: string,
  startDate: string,
  endDate: string,
  accountingPeriodId?: string
): Promise<ActionResult<CashFlowStatement>> {
  try {
    const supabase = await createClient();

    // Check permissions
    const permissionCheck = await checkUserPermissions(supabase, organizationId);
    if (!permissionCheck.hasAccess && permissionCheck.error) {
      return permissionCheck.error;
    }

    // Validate dates
    if (
      !startDate ||
      !endDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
    ) {
      return createValidationErrorResult('有効な日付範囲を指定してください（YYYY-MM-DD形式）');
    }

    if (startDate > endDate) {
      return createValidationErrorResult('開始日は終了日より前である必要があります。');
    }

    // Get cash and cash equivalent accounts
    const { data: cashAccounts, error: cashAccountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('organization_id', organizationId)
      .in('sub_category', ['現金', '預金', '現金同等物']);

    if (cashAccountsError) {
      return handleSupabaseError(cashAccountsError);
    }

    const cashAccountIds = cashAccounts?.map((a) => a.id) || [];

    // Get beginning cash balance
    let beginningQuery = supabase
      .from('journal_entry_lines')
      .select(
        `
        account_id,
        debit_amount,
        credit_amount,
        journal_entries!inner(
          entry_date,
          status,
          organization_id,
          accounting_period_id
        )
      `
      )
      .eq('journal_entries.organization_id', organizationId)
      .eq('journal_entries.status', 'approved')
      .lt('journal_entries.entry_date', startDate)
      .in('account_id', cashAccountIds);

    if (accountingPeriodId) {
      beginningQuery = beginningQuery.eq(
        'journal_entries.accounting_period_id',
        accountingPeriodId
      );
    }

    const { data: beginningData, error: beginningError } = await beginningQuery;

    if (beginningError) {
      return handleSupabaseError(beginningError);
    }

    let beginningCash = 0;
    beginningData?.forEach((line) => {
      beginningCash += (line.debit_amount || 0) - (line.credit_amount || 0);
    });

    // Get all journal entries for the period with account details
    let periodQuery = supabase
      .from('journal_entries')
      .select(
        `
        id,
        entry_number,
        entry_date,
        description,
        journal_entry_lines(
          account_id,
          debit_amount,
          credit_amount,
          accounts!inner(
            id,
            code,
            name,
            account_type,
            category,
            sub_category
          )
        )
      `
      )
      .eq('organization_id', organizationId)
      .eq('status', 'approved')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate);

    if (accountingPeriodId) {
      periodQuery = periodQuery.eq('accounting_period_id', accountingPeriodId);
    }

    const { data: periodEntries, error: periodError } = await periodQuery;

    if (periodError) {
      return handleSupabaseError(periodError);
    }

    // Initialize cash flow categories
    const operatingItems: CashFlowItem[] = [];
    const investingItems: CashFlowItem[] = [];
    const financingItems: CashFlowItem[] = [];

    let netCashFromOperating = 0;
    let netCashFromInvesting = 0;
    let netCashFromFinancing = 0;

    // Categorize cash flows based on Japanese GAAP
    periodEntries?.forEach((entry) => {
      const cashLines = entry.journal_entry_lines?.filter((line) =>
        cashAccountIds.includes(line.account_id)
      );

      if (!cashLines || cashLines.length === 0) return;

      // Calculate net cash change for this entry
      let cashChange = 0;
      cashLines.forEach((line) => {
        cashChange += (line.debit_amount || 0) - (line.credit_amount || 0);
      });

      if (cashChange === 0) return;

      // Find the offsetting account to determine category
      const nonCashLines = entry.journal_entry_lines?.filter(
        (line) => !cashAccountIds.includes(line.account_id)
      );

      if (nonCashLines && nonCashLines.length > 0) {
        const primaryAccountData = nonCashLines[0].accounts;
        const primaryAccount = Array.isArray(primaryAccountData)
          ? primaryAccountData[0]
          : primaryAccountData;

        if (!primaryAccount) return;

        // Categorize based on account type and category
        let category: 'operating' | 'investing' | 'financing' = 'operating';

        if (primaryAccount.category === '固定資産' || primaryAccount.category === '投資有価証券') {
          category = 'investing';
        } else if (
          primaryAccount.category === '借入金' ||
          primaryAccount.category === '資本金' ||
          primaryAccount.category === '配当金'
        ) {
          category = 'financing';
        }

        const item: CashFlowItem = {
          category: primaryAccount.name as string,
          description: entry.description,
          amount: cashChange,
        };

        switch (category) {
          case 'operating':
            operatingItems.push(item);
            netCashFromOperating += cashChange;
            break;
          case 'investing':
            investingItems.push(item);
            netCashFromInvesting += cashChange;
            break;
          case 'financing':
            financingItems.push(item);
            netCashFromFinancing += cashChange;
            break;
        }
      }
    });

    const netChange = netCashFromOperating + netCashFromInvesting + netCashFromFinancing;
    const endingCash = beginningCash + netChange;

    const cashFlowStatement: CashFlowStatement = {
      reportPeriod: {
        startDate,
        endDate,
      },
      organizationId,
      operating: {
        items: operatingItems,
        netCashFromOperating,
      },
      investing: {
        items: investingItems,
        netCashFromInvesting,
      },
      financing: {
        items: financingItems,
        netCashFromFinancing,
      },
      beginningCash,
      netChange,
      endingCash,
    };

    return createSuccessResult(cashFlowStatement);
  } catch (error) {
    console.error('Error generating cash flow statement:', error);
    return createErrorResult(
      ERROR_CODES.INTERNAL_ERROR,
      'キャッシュフロー計算書の生成中にエラーが発生しました。'
    );
  }
}
