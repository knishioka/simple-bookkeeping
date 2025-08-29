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
    const date = searchParams.get('date');

    if (!periodId && !date) {
      return NextResponse.json({ error: 'Either periodId or date is required' }, { status: 400 });
    }

    // Get accounting period
    let accountingPeriod;
    if (periodId) {
      const { data, error } = await supabase
        .from('accounting_periods')
        .select('*')
        .eq('id', periodId)
        .single();

      if (error) {
        return NextResponse.json({ error: 'Period not found' }, { status: 404 });
      }
      accountingPeriod = data;
    } else if (date) {
      const { data, error } = await supabase
        .from('accounting_periods')
        .select('*')
        .lte('start_date', date)
        .gte('end_date', date)
        .single();

      if (error) {
        return NextResponse.json({ error: 'No period found for the given date' }, { status: 404 });
      }
      accountingPeriod = data;
    }

    if (!accountingPeriod) {
      return NextResponse.json({ error: 'Accounting period not found' }, { status: 404 });
    }

    // Get all accounts with their balances
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select(
        `
        *,
        journal_entry_lines!inner (
          debit_amount,
          credit_amount,
          journal_entries!inner (
            entry_date,
            accounting_period_id
          )
        )
      `
      )
      .eq('journal_entry_lines.journal_entries.accounting_period_id', accountingPeriod.id)
      .order('code');

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    // Calculate balances for each account
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

    accounts?.forEach((account) => {
      const lines = account.journal_entry_lines || [];
      let balance = 0;

      lines.forEach((line: { debit_amount?: number | null; credit_amount?: number | null }) => {
        if (account.account_type === 'ASSET' || account.account_type === 'EXPENSE') {
          balance += (line.debit_amount || 0) - (line.credit_amount || 0);
        } else {
          balance += (line.credit_amount || 0) - (line.debit_amount || 0);
        }
      });

      const existingBalance = accountBalances.get(account.id);
      if (existingBalance) {
        existingBalance.balance += balance;
      } else {
        accountBalances.set(account.id, {
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
    });

    // Structure the balance sheet
    const balanceSheet = {
      period: accountingPeriod,
      assets: {
        current: [] as Array<{
          id: string;
          code: string;
          name: string;
          account_type: string;
          category: string;
          subcategory: string;
          balance: number;
        }>,
        fixed: [] as Array<{
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
      liabilities: {
        current: [] as Array<{
          id: string;
          code: string;
          name: string;
          account_type: string;
          category: string;
          subcategory: string;
          balance: number;
        }>,
        longTerm: [] as Array<{
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
      equity: {
        capital: [] as Array<{
          id: string;
          code: string;
          name: string;
          account_type: string;
          category: string;
          subcategory: string;
          balance: number;
        }>,
        retainedEarnings: [] as Array<{
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
      total: {
        assets: 0,
        liabilitiesAndEquity: 0,
      },
    };

    // Categorize accounts
    accountBalances.forEach(({ account, balance }) => {
      if (balance === 0) return; // Skip accounts with zero balance

      switch (account.account_type) {
        case 'ASSET':
          if (account.subcategory === 'CURRENT') {
            balanceSheet.assets.current.push({ ...account, balance });
            balanceSheet.assets.total += balance;
          } else {
            balanceSheet.assets.fixed.push({ ...account, balance });
            balanceSheet.assets.total += balance;
          }
          break;
        case 'LIABILITY':
          if (account.subcategory === 'CURRENT') {
            balanceSheet.liabilities.current.push({ ...account, balance });
            balanceSheet.liabilities.total += balance;
          } else {
            balanceSheet.liabilities.longTerm.push({ ...account, balance });
            balanceSheet.liabilities.total += balance;
          }
          break;
        case 'EQUITY':
          if (account.subcategory === 'CAPITAL') {
            balanceSheet.equity.capital.push({ ...account, balance });
            balanceSheet.equity.total += balance;
          } else {
            balanceSheet.equity.retainedEarnings.push({ ...account, balance });
            balanceSheet.equity.total += balance;
          }
          break;
      }
    });

    balanceSheet.total.assets = balanceSheet.assets.total;
    balanceSheet.total.liabilitiesAndEquity =
      balanceSheet.liabilities.total + balanceSheet.equity.total;

    return NextResponse.json(balanceSheet);
  } catch (error) {
    console.error('Balance sheet generation error:', error);
    return NextResponse.json({ error: 'Failed to generate balance sheet' }, { status: 500 });
  }
}
