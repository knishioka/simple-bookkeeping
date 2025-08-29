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
    const accountId = searchParams.get('accountId'); // Specific bank account
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Build query for bank accounts
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
          account_id,
          accounts!inner (
            id,
            code,
            name,
            subcategory
          )
        )
      `
      )
      .eq('journal_entry_lines.accounts.subcategory', 'BANK')
      .order('entry_date', { ascending: false })
      .order('entry_number', { ascending: false });

    if (accountId) {
      query = query.eq('journal_entry_lines.account_id', accountId);
    }
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
      console.error('Error fetching bank entries:', entriesError);
      return NextResponse.json({ error: 'Failed to fetch bank entries' }, { status: 500 });
    }

    // Group entries by bank account
    const bankAccounts = new Map<
      string,
      {
        account: {
          id: string;
          code: string;
          name: string;
          subcategory: string;
        };
        entries: LedgerEntry[];
        balance: number;
      }
    >();

    entries?.forEach((entry) => {
      // @ts-expect-error - Supabase query result typing needs refinement
      entry.journal_entry_lines?.forEach(
        (line: {
          id: string;
          debit_amount?: number | null;
          credit_amount?: number | null;
          description?: string;
          account_id: string;
          accounts: {
            id: string;
            code: string;
            name: string;
            subcategory: string;
          };
        }) => {
          // Only process bank account lines
          if (line.accounts.subcategory === 'BANK') {
            const accountKey = line.account_id;

            if (!bankAccounts.has(accountKey)) {
              bankAccounts.set(accountKey, {
                account: line.accounts,
                entries: [],
                balance: 0,
              });
            }

            const bankAccount = bankAccounts.get(accountKey)!;
            const isDebit = (line.debit_amount || 0) > 0;
            const amount = isDebit ? line.debit_amount : line.credit_amount;

            // Update balance
            if (isDebit) {
              bankAccount.balance += amount || 0;
            } else {
              bankAccount.balance -= amount || 0;
            }

            // Find corresponding account
            const otherLines = entry.journal_entry_lines?.filter(
              (l: { id: string }) => l.id !== line.id
            );
            const firstOtherLine = otherLines?.[0];
            const counterAccount = firstOtherLine?.accounts || null;

            bankAccount.entries.push({
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
              deposit: isDebit ? amount : null,
              withdrawal: !isDebit ? amount : null,
              balance: bankAccount.balance,
            });
          }
        }
      );
    });

    // Convert to array and structure response
    const bankBooks = Array.from(bankAccounts.values()).map(({ account, entries, balance }) => {
      const totals = entries.reduce(
        (acc, entry) => ({
          deposits: acc.deposits + (entry.deposit || 0),
          withdrawals: acc.withdrawals + (entry.withdrawal || 0),
        }),
        { deposits: 0, withdrawals: 0 }
      );

      return {
        account: {
          id: account.id,
          code: account.code,
          name: account.name,
        },
        entries,
        summary: {
          openingBalance: 0, // Would need to calculate from previous transactions
          totalDeposits: totals.deposits,
          totalWithdrawals: totals.withdrawals,
          closingBalance: balance,
        },
      };
    });

    const response = {
      bankBooks,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Bank book generation error:', error);
    return NextResponse.json({ error: 'Failed to generate bank book' }, { status: 500 });
  }
}
