import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import type { CashMovement, ReportItem } from '../../types';
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

    // Build query for cash-related accounts
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

    // Initialize cash flow categories
    const cashFlow = {
      period: periodId ? { periodId } : { startDate, endDate },
      operating: {
        receipts: [] as ReportItem[],
        payments: [] as ReportItem[],
        net: 0,
      },
      investing: {
        receipts: [] as ReportItem[],
        payments: [] as ReportItem[],
        net: 0,
      },
      financing: {
        receipts: [] as ReportItem[],
        payments: [] as ReportItem[],
        net: 0,
      },
      beginningCash: 0,
      endingCash: 0,
      netChange: 0,
    };

    // Track cash movements
    const cashMovements = new Map<string, CashMovement>();

    // Analyze each journal entry for cash impact
    entries?.forEach((entry) => {
      let cashImpact = 0;
      const nonCashAccounts: Array<{
        id: string;
        code: string;
        name: string;
        account_type: string;
        category: string;
        subcategory: string;
      }> = [];

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

          // Check if it's a cash account
          if (account.subcategory === 'CASH' || account.subcategory === 'BANK') {
            cashImpact += (line.debit_amount || 0) - (line.credit_amount || 0);
          } else {
            nonCashAccounts.push(account);
          }
        }
      );

      if (cashImpact !== 0) {
        // Determine category based on non-cash accounts
        let category: 'operating' | 'investing' | 'financing' = 'operating';

        nonCashAccounts.forEach((account) => {
          if (account.subcategory === 'FIXED_ASSET' || account.subcategory === 'INVESTMENT') {
            category = 'investing';
          } else if (account.subcategory === 'LOAN' || account.subcategory === 'CAPITAL') {
            category = 'financing';
          }
        });

        const existing = cashMovements.get(entry.id);
        if (existing) {
          existing.amount += cashImpact;
        } else {
          cashMovements.set(entry.id, {
            description: entry.description || 'Cash transaction',
            category,
            amount: cashImpact,
          });
        }
      }
    });

    // Categorize cash movements
    cashMovements.forEach((movement) => {
      const item = {
        description: movement.description,
        amount: Math.abs(movement.amount),
      };

      const categoryKey = movement.category as 'operating' | 'investing' | 'financing';
      if (movement.amount > 0) {
        // Cash inflow (receipt)
        cashFlow[categoryKey].receipts.push(item);
      } else {
        // Cash outflow (payment)
        cashFlow[categoryKey].payments.push(item);
      }
    });

    // Calculate net amounts for each category
    ['operating', 'investing', 'financing'].forEach((category) => {
      const cat = category as 'operating' | 'investing' | 'financing';
      const receiptsTotal = cashFlow[cat].receipts.reduce((sum, item) => sum + item.amount, 0);
      const paymentsTotal = cashFlow[cat].payments.reduce((sum, item) => sum + item.amount, 0);
      cashFlow[cat].net = receiptsTotal - paymentsTotal;
    });

    // Calculate net change in cash
    cashFlow.netChange = cashFlow.operating.net + cashFlow.investing.net + cashFlow.financing.net;

    // Get beginning cash balance (would need to query previous period)
    // For now, we'll set it to 0 or fetch from a separate query
    cashFlow.beginningCash = 0;
    cashFlow.endingCash = cashFlow.beginningCash + cashFlow.netChange;

    return NextResponse.json(cashFlow);
  } catch (error) {
    console.error('Cash flow generation error:', error);
    return NextResponse.json({ error: 'Failed to generate cash flow statement' }, { status: 500 });
  }
}
