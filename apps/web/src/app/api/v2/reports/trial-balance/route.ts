import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import type { TrialBalanceItem } from '../../types';
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

    // Build query
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
    } else if (date) {
      query = query.lte('entry_date', date);
    }

    const { data: entries, error: entriesError } = await query;

    if (entriesError) {
      console.error('Error fetching entries:', entriesError);
      return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
    }

    // Calculate account balances
    const accountBalances = new Map<string, TrialBalanceItem>();

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

          const existingBalance = accountBalances.get(accountId);
          if (existingBalance) {
            existingBalance.debitTotal += line.debit_amount || 0;
            existingBalance.creditTotal += line.credit_amount || 0;
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
              debitTotal: line.debit_amount || 0,
              creditTotal: line.credit_amount || 0,
              debitBalance: 0,
              creditBalance: 0,
            });
          }
        }
      );
    });

    // Calculate net balances
    accountBalances.forEach((balance) => {
      const netAmount = balance.debitTotal - balance.creditTotal;

      // Determine normal balance side based on account type
      const isDebitNormal = ['ASSET', 'EXPENSE'].includes(balance.account.account_type);

      if (isDebitNormal) {
        if (netAmount >= 0) {
          balance.debitBalance = netAmount;
          balance.creditBalance = 0;
        } else {
          balance.debitBalance = 0;
          balance.creditBalance = Math.abs(netAmount);
        }
      } else {
        if (netAmount <= 0) {
          balance.debitBalance = 0;
          balance.creditBalance = Math.abs(netAmount);
        } else {
          balance.debitBalance = netAmount;
          balance.creditBalance = 0;
        }
      }
    });

    // Convert to array and sort by account code
    const trialBalanceItems = Array.from(accountBalances.values())
      .filter((item) => item.debitTotal > 0 || item.creditTotal > 0) // Only include accounts with activity
      .sort((a, b) => a.account.code.localeCompare(b.account.code));

    // Calculate totals
    const totals = trialBalanceItems.reduce(
      (acc, item) => ({
        debitTotal: acc.debitTotal + item.debitTotal,
        creditTotal: acc.creditTotal + item.creditTotal,
        debitBalance: acc.debitBalance + item.debitBalance,
        creditBalance: acc.creditBalance + item.creditBalance,
      }),
      { debitTotal: 0, creditTotal: 0, debitBalance: 0, creditBalance: 0 }
    );

    const trialBalance = {
      period: periodId ? { periodId } : { date },
      items: trialBalanceItems,
      totals,
      isBalanced: Math.abs(totals.debitTotal - totals.creditTotal) < 0.01,
    };

    return NextResponse.json(trialBalance);
  } catch (error) {
    console.error('Trial balance generation error:', error);
    return NextResponse.json({ error: 'Failed to generate trial balance' }, { status: 500 });
  }
}
