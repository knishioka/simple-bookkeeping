import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import type { Database } from '@/lib/supabase/database.types';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const periodId = searchParams.get('periodId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!periodId && (!startDate || !endDate)) {
      return NextResponse.json(
        { error: 'Either periodId or both startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Build query conditions
    let query = supabase.from('journal_entries').select(`
        *,
        journal_entry_lines!inner (
          debit_amount,
          credit_amount,
          accounts!inner (
            id,
            code,
            name,
            account_type,
            category,
            subcategory
          )
        )
      `);

    if (periodId) {
      query = query.eq('accounting_period_id', periodId);
    } else {
      query = query.gte('entry_date', startDate!).lte('entry_date', endDate!);
    }

    const { data: entries, error: entriesError } = await query;

    if (entriesError) {
      console.error('Error fetching entries:', entriesError);
      return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
    }

    // Calculate account balances
    const accountBalances = new Map<
      string,
      {
        account: {
          id: string;
          code: string;
          name: string;
          account_type: string;
          category: string;
          subcategory: string;
        };
        balance: number;
      }
    >();

    entries?.forEach((entry) => {
      entry.journal_entry_lines?.forEach(
        (line: {
          debit_amount?: number | null;
          credit_amount?: number | null;
          accounts: {
            id: string;
            code: string;
            name: string;
            account_type: string;
            category: string;
            subcategory: string;
          };
        }) => {
          const account = line.accounts;
          const accountId = account.id;

          let balance = 0;
          if (account.account_type === 'REVENUE') {
            balance = (line.credit_amount || 0) - (line.debit_amount || 0);
          } else if (account.account_type === 'EXPENSE') {
            balance = (line.debit_amount || 0) - (line.credit_amount || 0);
          } else {
            return; // Skip non-P&L accounts
          }

          const existingBalance = accountBalances.get(accountId);
          if (existingBalance) {
            existingBalance.balance += balance;
          } else {
            accountBalances.set(accountId, {
              account: {
                id: account.id,
                code: account.code,
                name: account.name,
                account_type: account.account_type,
                category: account.category,
                subcategory: account.subcategory,
              },
              balance,
            });
          }
        }
      );
    });

    // Structure the profit & loss statement
    const profitLoss = {
      period: periodId ? { periodId } : { startDate, endDate },
      revenue: {
        sales: [] as Array<{
          id: string;
          code: string;
          name: string;
          account_type: string;
          category: string;
          subcategory: string;
          balance: number;
        }>,
        other: [] as Array<{
          id: string;
          code: string;
          name: string;
          account_type: string;
          category: string;
          subcategory: string;
          balance: number;
        }>,
        total: 0,
      },
      expenses: {
        costOfSales: [] as Array<{
          id: string;
          code: string;
          name: string;
          account_type: string;
          category: string;
          subcategory: string;
          balance: number;
        }>,
        operating: [] as Array<{
          id: string;
          code: string;
          name: string;
          account_type: string;
          category: string;
          subcategory: string;
          balance: number;
        }>,
        financial: [] as Array<{
          id: string;
          code: string;
          name: string;
          account_type: string;
          category: string;
          subcategory: string;
          balance: number;
        }>,
        other: [] as Array<{
          id: string;
          code: string;
          name: string;
          account_type: string;
          category: string;
          subcategory: string;
          balance: number;
        }>,
        total: 0,
      },
      grossProfit: 0,
      operatingProfit: 0,
      netProfit: 0,
    };

    // Categorize accounts
    accountBalances.forEach(({ account, balance }) => {
      if (balance === 0) return; // Skip accounts with zero balance

      if (account.account_type === 'REVENUE') {
        if (account.subcategory === 'SALES') {
          profitLoss.revenue.sales.push({ ...account, balance });
        } else {
          profitLoss.revenue.other.push({ ...account, balance });
        }
        profitLoss.revenue.total += balance;
      } else if (account.account_type === 'EXPENSE') {
        switch (account.subcategory) {
          case 'COST_OF_SALES':
            profitLoss.expenses.costOfSales.push({ ...account, balance });
            break;
          case 'OPERATING':
            profitLoss.expenses.operating.push({ ...account, balance });
            break;
          case 'FINANCIAL':
            profitLoss.expenses.financial.push({ ...account, balance });
            break;
          default:
            profitLoss.expenses.other.push({ ...account, balance });
        }
        profitLoss.expenses.total += balance;
      }
    });

    // Calculate profit metrics
    const costOfSalesTotal = profitLoss.expenses.costOfSales.reduce(
      (sum, item) => sum + item.balance,
      0
    );
    profitLoss.grossProfit = profitLoss.revenue.total - costOfSalesTotal;

    const operatingExpensesTotal = profitLoss.expenses.operating.reduce(
      (sum, item) => sum + item.balance,
      0
    );
    profitLoss.operatingProfit = profitLoss.grossProfit - operatingExpensesTotal;

    profitLoss.netProfit = profitLoss.revenue.total - profitLoss.expenses.total;

    return NextResponse.json(profitLoss);
  } catch (error) {
    console.error('Profit & loss generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate profit & loss statement' },
      { status: 500 }
    );
  }
}
