import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import type { LedgerEntry } from '../../types';
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Build query for cash accounts
    let query = supabase
      .from('journal_entries')
      .select(
        `
        id,
        entry_date,
        entry_number,
        description,
        journal_entry_lines!inner (
          id,
          debit_amount,
          credit_amount,
          description,
          accounts!inner (
            id,
            code,
            name,
            subcategory
          )
        )
      `
      )
      .or(
        'journal_entry_lines.accounts.subcategory.eq.CASH,journal_entry_lines.accounts.subcategory.eq.PETTY_CASH'
      )
      .order('entry_date', { ascending: false })
      .order('entry_number', { ascending: false });

    if (startDate) {
      query = query.gte('entry_date', startDate);
    }
    if (endDate) {
      query = query.lte('entry_date', endDate);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: entries, error: entriesError, count } = await query;

    if (entriesError) {
      console.error('Error fetching cash entries:', entriesError);
      return NextResponse.json({ error: 'Failed to fetch cash entries' }, { status: 500 });
    }

    // Transform entries into cash book format
    const cashBookEntries: LedgerEntry[] = [];
    let runningBalance = 0;

    // Get opening balance (would need to query previous transactions)
    // For now, we'll start with 0
    const openingBalance = 0;
    runningBalance = openingBalance;

    entries?.forEach((entry) => {
      const typedLines = entry.journal_entry_lines as unknown as Array<{
        id: string;
        debit_amount?: number | null;
        credit_amount?: number | null;
        description?: string;
        accounts: {
          id: string;
          code: string;
          name: string;
          subcategory: string;
        };
      }>;
      typedLines?.forEach((line) => {
        // Only process cash account lines
        if (line.accounts.subcategory === 'CASH' || line.accounts.subcategory === 'PETTY_CASH') {
          const isDebit = (line.debit_amount || 0) > 0;
          const amount = isDebit ? line.debit_amount : line.credit_amount;

          // Update running balance
          if (isDebit) {
            runningBalance += amount || 0;
          } else {
            runningBalance -= amount || 0;
          }

          // Find corresponding account (the other side of the entry)
          const otherLines = entry.journal_entry_lines?.filter(
            (l: { id: string }) => l.id !== line.id
          );
          const firstOtherLine = otherLines?.[0];
          const counterAccount = firstOtherLine?.accounts || null;

          cashBookEntries.push({
            id: line.id,
            date: entry.entry_date,
            entryNumber: entry.entry_number,
            description: line.description || entry.description,
            counterAccount: counterAccount
              ? {
                  code: (counterAccount as unknown as { code: string; name: string }).code,
                  name: (counterAccount as unknown as { code: string; name: string }).name,
                }
              : null,
            receipt: isDebit ? amount : null,
            payment: !isDebit ? amount : null,
            balance: runningBalance,
          });
        }
      });
    });

    // Calculate totals
    const totals = cashBookEntries.reduce(
      (acc, entry) => ({
        receipts: acc.receipts + (entry.receipt || 0),
        payments: acc.payments + (entry.payment || 0),
      }),
      { receipts: 0, payments: 0 }
    );

    const cashBook = {
      entries: cashBookEntries,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      summary: {
        openingBalance,
        totalReceipts: totals.receipts,
        totalPayments: totals.payments,
        closingBalance: runningBalance,
      },
    };

    return NextResponse.json(cashBook);
  } catch (error) {
    console.error('Cash book generation error:', error);
    return NextResponse.json({ error: 'Failed to generate cash book' }, { status: 500 });
  }
}
