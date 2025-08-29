import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import type { JournalEntryLine } from '../../types';
import type { Database } from '@/lib/supabase/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

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
    const accountId = searchParams.get('accountId');
    const accountCode = searchParams.get('accountCode');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    if (!accountId && !accountCode) {
      return NextResponse.json(
        { error: 'Either accountId or accountCode is required' },
        { status: 400 }
      );
    }

    // Get the account
    let accountQuery = supabase.from('accounts').select('*');

    if (accountId) {
      accountQuery = accountQuery.eq('id', accountId);
    } else if (accountCode) {
      accountQuery = accountQuery.eq('code', accountCode);
    }

    const { data: account, error: accountError } = await accountQuery.single();

    if (accountError || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Build query for journal entries
    let query = supabase
      .from('journal_entry_lines')
      .select(
        `
        id,
        debit_amount,
        credit_amount,
        description,
        journal_entries!inner (
          id,
          entry_date,
          entry_number,
          description,
          accounting_period_id,
          accounting_periods (
            id,
            name,
            fiscal_year
          )
        )
      `
      )
      .eq('account_id', account.id)
      .order('journal_entries.entry_date', { ascending: true })
      .order('journal_entries.entry_number', { ascending: true });

    if (startDate) {
      query = query.gte('journal_entries.entry_date', startDate);
    }
    if (endDate) {
      query = query.lte('journal_entries.entry_date', endDate);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: lines, error: linesError, count } = await query;

    if (linesError) {
      console.error('Error fetching ledger entries:', linesError);
      return NextResponse.json({ error: 'Failed to fetch ledger entries' }, { status: 500 });
    }

    // Calculate running balance
    let runningBalance = 0;
    const isDebitNormal = ['ASSET', 'EXPENSE'].includes(account.account_type);

    // Get opening balance (would need to query transactions before startDate)
    const openingBalance = await calculateOpeningBalance(
      supabase,
      account.id,
      startDate,
      isDebitNormal
    );
    runningBalance = openingBalance;

    // Transform entries with running balance
    const typedLines = lines as unknown as JournalEntryLine[];
    const ledgerEntries =
      typedLines?.map((line: JournalEntryLine) => {
        const debitAmount = line.debit_amount || 0;
        const creditAmount = line.credit_amount || 0;

        // Update running balance based on account type
        if (isDebitNormal) {
          runningBalance += debitAmount - creditAmount;
        } else {
          runningBalance += creditAmount - debitAmount;
        }

        return {
          id: line.id,
          date: line.journal_entries?.entry_date || '',
          entryNumber: line.journal_entries?.entry_number || '',
          description: line.description || line.journal_entries?.description || '',
          reference: line.journal_entries?.id || '',
          period: line.journal_entries?.accounting_periods?.name || '',
          debit: debitAmount || null,
          credit: creditAmount || null,
          balance: Math.abs(runningBalance),
          balanceType:
            runningBalance >= 0 ? (isDebitNormal ? 'Dr' : 'Cr') : isDebitNormal ? 'Cr' : 'Dr',
        };
      }) || [];

    // Calculate totals
    const totals = ledgerEntries.reduce(
      (acc, entry) => ({
        debits: acc.debits + (entry.debit || 0),
        credits: acc.credits + (entry.credit || 0),
      }),
      { debits: 0, credits: 0 }
    );

    const generalLedger = {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.account_type,
        normalBalance: isDebitNormal ? 'Debit' : 'Credit',
      },
      entries: ledgerEntries,
      summary: {
        openingBalance: Math.abs(openingBalance),
        openingBalanceType:
          openingBalance >= 0 ? (isDebitNormal ? 'Dr' : 'Cr') : isDebitNormal ? 'Cr' : 'Dr',
        totalDebits: totals.debits,
        totalCredits: totals.credits,
        closingBalance: Math.abs(runningBalance),
        closingBalanceType:
          runningBalance >= 0 ? (isDebitNormal ? 'Dr' : 'Cr') : isDebitNormal ? 'Cr' : 'Dr',
        netChange: Math.abs(runningBalance - openingBalance),
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };

    return NextResponse.json(generalLedger);
  } catch (error) {
    console.error('General ledger generation error:', error);
    return NextResponse.json({ error: 'Failed to generate general ledger' }, { status: 500 });
  }
}

async function calculateOpeningBalance(
  supabase: SupabaseClient<Database>,
  accountId: string,
  startDate: string | null,
  isDebitNormal: boolean
): Promise<number> {
  if (!startDate) return 0;

  const { data: lines, error } = await supabase
    .from('journal_entry_lines')
    .select(
      `
      debit_amount,
      credit_amount,
      journal_entries!inner (
        entry_date
      )
    `
    )
    .eq('account_id', accountId)
    .lt('journal_entries.entry_date', startDate);

  if (error || !lines) return 0;

  let balance = 0;
  lines.forEach((line: { debit_amount?: number | null; credit_amount?: number | null }) => {
    const debitAmount = line.debit_amount || 0;
    const creditAmount = line.credit_amount || 0;

    if (isDebitNormal) {
      balance += debitAmount - creditAmount;
    } else {
      balance += creditAmount - debitAmount;
    }
  });

  return balance;
}
