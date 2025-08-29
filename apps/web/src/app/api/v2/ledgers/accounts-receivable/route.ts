import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import type { Partner, ReceivableEntry, JournalEntryLine } from '../../types';
import type { Database } from '@/lib/supabase/database.types';

interface AgingData {
  current: number;
  days30: number;
  days60: number;
  days90Plus: number;
}

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
    const partnerId = searchParams.get('partnerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Build query for accounts receivable
    let query = supabase
      .from('journal_entries')
      .select(
        `
        id,
        entry_date,
        entry_number,
        description,
        partner_id,
        partners (
          id,
          name,
          code
        ),
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
      .eq('journal_entry_lines.accounts.subcategory', 'ACCOUNTS_RECEIVABLE')
      .order('entry_date', { ascending: false })
      .order('entry_number', { ascending: false });

    if (partnerId) {
      query = query.eq('partner_id', partnerId);
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
      console.error('Error fetching receivable entries:', entriesError);
      return NextResponse.json({ error: 'Failed to fetch receivable entries' }, { status: 500 });
    }

    // Group entries by partner
    const partnerReceivables = new Map<
      string,
      {
        partner: Partner | { id: string; name: string; code: string };
        entries: ReceivableEntry[];
        balance: number;
      }
    >();

    entries?.forEach((entry) => {
      const partnerKey = entry.partner_id || 'unknown';

      if (!partnerReceivables.has(partnerKey)) {
        const partnerData = Array.isArray(entry.partners) ? entry.partners[0] : entry.partners;
        partnerReceivables.set(partnerKey, {
          partner: partnerData || { id: partnerKey, name: 'Unknown', code: '' },
          entries: [],
          balance: 0,
        });
      }

      const receivable = partnerReceivables.get(partnerKey)!;

      entry.journal_entry_lines?.forEach((line: unknown) => {
        const typedLine = line as JournalEntryLine;
        if (typedLine.accounts?.subcategory === 'ACCOUNTS_RECEIVABLE') {
          const isDebit = (typedLine.debit_amount || 0) > 0;
          const amount = isDebit ? typedLine.debit_amount : typedLine.credit_amount;

          // Update balance (debit increases receivables, credit decreases)
          if (isDebit) {
            receivable.balance += amount || 0;
          } else {
            receivable.balance -= amount || 0;
          }

          receivable.entries.push({
            id: typedLine.id,
            date: entry.entry_date,
            entryNumber: entry.entry_number,
            description: typedLine.description || entry.description,
            dueDate: null, // TODO: Add due date field from entry
            amount,
            invoice: isDebit ? amount : null,
            payment: !isDebit ? amount : null,
            balance: receivable.balance,
            partner: null, // Partner is already tracked at the parent level
          });
        }
      });
    });

    // Convert to array and structure response
    const receivables = Array.from(partnerReceivables.values()).map(
      ({ partner, entries, balance }) => {
        const totals = entries.reduce(
          (acc, entry) => ({
            invoices: acc.invoices + (entry.invoice || 0),
            payments: acc.payments + (entry.payment || 0),
          }),
          { invoices: 0, payments: 0 }
        );

        return {
          partner: {
            id: partner.id,
            code: partner.code,
            name: partner.name,
          },
          entries,
          summary: {
            openingBalance: 0, // Would need to calculate from previous transactions
            totalInvoices: totals.invoices,
            totalPayments: totals.payments,
            closingBalance: balance,
            daysOutstanding: calculateAverageDaysOutstanding(entries),
          },
        };
      }
    );

    // Calculate aging analysis - map to expected structure
    const receivablesForAging = receivables.map((r) => ({
      entries: r.entries,
      balance: r.summary.closingBalance,
    }));
    const aging = calculateAging(receivablesForAging);

    const response = {
      receivables,
      aging,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      summary: {
        totalReceivables: receivables.reduce((sum, r) => sum + r.summary.closingBalance, 0),
        partnerCount: receivables.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Accounts receivable generation error:', error);
    return NextResponse.json({ error: 'Failed to generate accounts receivable' }, { status: 500 });
  }
}

function calculateAverageDaysOutstanding(entries: ReceivableEntry[]): number {
  // Simplified calculation - would need more sophisticated logic in production
  const invoices = entries.filter((e) => e.invoice);
  if (invoices.length === 0) return 0;

  const today = new Date();
  const totalDays = invoices.reduce((sum, invoice) => {
    const invoiceDate = new Date(invoice.date);
    const days = Math.floor((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
    return sum + days;
  }, 0);

  return Math.round(totalDays / invoices.length);
}

function calculateAging(
  receivables: Array<{ entries: ReceivableEntry[]; balance: number }>
): AgingData {
  const aging = {
    current: 0, // 0-30 days
    days30: 0, // 31-60 days
    days60: 0, // 61-90 days
    days90Plus: 0, // 90+ days
  };

  const today = new Date();

  receivables.forEach(({ entries }) => {
    entries.forEach((entry: ReceivableEntry) => {
      if (entry.invoice && entry.balance > 0) {
        const invoiceDate = new Date(entry.date);
        const daysDiff = Math.floor(
          (today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff <= 30) {
          aging.current += entry.invoice;
        } else if (daysDiff <= 60) {
          aging.days30 += entry.invoice;
        } else if (daysDiff <= 90) {
          aging.days60 += entry.invoice;
        } else {
          aging.days90Plus += entry.invoice;
        }
      }
    });
  });

  return aging;
}
