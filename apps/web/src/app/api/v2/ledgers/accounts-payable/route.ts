import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import type { Partner, PayableEntry, JournalEntryLine } from '../../types';
import type { Database } from '@/lib/supabase/database.types';

interface AgingData {
  current: number;
  days30: number;
  days60: number;
  days90Plus: number;
}

interface PaymentSchedule {
  thisWeek: number;
  thisMonth: number;
  nextMonth: number;
  later: number;
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

    // Build query for accounts payable
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
      .eq('journal_entry_lines.accounts.subcategory', 'ACCOUNTS_PAYABLE')
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
      console.error('Error fetching payable entries:', entriesError);
      return NextResponse.json({ error: 'Failed to fetch payable entries' }, { status: 500 });
    }

    // Group entries by partner
    const partnerPayables = new Map<
      string,
      {
        partner: Partner | { id: string; name: string; code: string };
        entries: PayableEntry[];
        balance: number;
      }
    >();

    entries?.forEach((entry) => {
      const partnerKey = entry.partner_id || 'unknown';

      if (!partnerPayables.has(partnerKey)) {
        const partnerData = Array.isArray(entry.partners) ? entry.partners[0] : entry.partners;
        partnerPayables.set(partnerKey, {
          partner: partnerData || { id: partnerKey, name: 'Unknown', code: '' },
          entries: [],
          balance: 0,
        });
      }

      const payable = partnerPayables.get(partnerKey);
      if (payable) {
        entry.journal_entry_lines?.forEach((line: unknown) => {
          const typedLine = line as JournalEntryLine;
          if (typedLine.accounts?.subcategory === 'ACCOUNTS_PAYABLE') {
            const isCredit = (typedLine.credit_amount || 0) > 0;
            const amount = isCredit ? typedLine.credit_amount : typedLine.debit_amount;

            // Update balance (credit increases payables, debit decreases)
            if (isCredit) {
              payable.balance += amount || 0;
            } else {
              payable.balance -= amount || 0;
            }

            payable.entries.push({
              id: typedLine.id,
              date: entry.entry_date,
              entryNumber: entry.entry_number,
              description: typedLine.description || entry.description,
              dueDate: null,
              amount,
              bill: isCredit ? amount : null,
              payment: !isCredit ? amount : null,
              balance: payable.balance,
              partner: null, // Partner is already tracked at the parent level
            });
          }
        });
      }
    });

    // Convert to array and structure response
    const payables = Array.from(partnerPayables.values()).map(({ partner, entries, balance }) => {
      const totals = entries.reduce(
        (acc, entry) => ({
          bills: acc.bills + (entry.bill || 0),
          payments: acc.payments + (entry.payment || 0),
        }),
        { bills: 0, payments: 0 }
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
          totalBills: totals.bills,
          totalPayments: totals.payments,
          closingBalance: balance,
          daysOutstanding: calculateAverageDaysOutstanding(entries),
        },
      };
    });

    // Calculate aging analysis - map to expected structure
    const payablesForAging = payables.map((p) => ({
      entries: p.entries,
      balance: p.summary.closingBalance,
    }));
    const aging = calculateAging(payablesForAging);

    // Calculate payment schedule
    const paymentSchedule = calculatePaymentSchedule(payablesForAging);

    const response = {
      payables,
      aging,
      paymentSchedule,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      summary: {
        totalPayables: payables.reduce((sum, p) => sum + p.summary.closingBalance, 0),
        vendorCount: payables.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Accounts payable generation error:', error);
    return NextResponse.json({ error: 'Failed to generate accounts payable' }, { status: 500 });
  }
}

function calculateAverageDaysOutstanding(entries: PayableEntry[]): number {
  const bills = entries.filter((e) => e.bill);
  if (bills.length === 0) return 0;

  const today = new Date();
  const totalDays = bills.reduce((sum, bill) => {
    const billDate = new Date(bill.date);
    const days = Math.floor((today.getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24));
    return sum + days;
  }, 0);

  return Math.round(totalDays / bills.length);
}

function calculateAging(payables: Array<{ entries: PayableEntry[]; balance: number }>): AgingData {
  const aging = {
    current: 0, // 0-30 days
    days30: 0, // 31-60 days
    days60: 0, // 61-90 days
    days90Plus: 0, // 90+ days
  };

  const today = new Date();

  payables.forEach(({ entries }) => {
    entries.forEach((entry: PayableEntry) => {
      if (entry.bill && entry.balance > 0) {
        const billDate = new Date(entry.date);
        const daysDiff = Math.floor((today.getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff <= 30) {
          aging.current += entry.bill;
        } else if (daysDiff <= 60) {
          aging.days30 += entry.bill;
        } else if (daysDiff <= 90) {
          aging.days60 += entry.bill;
        } else {
          aging.days90Plus += entry.bill;
        }
      }
    });
  });

  return aging;
}

function calculatePaymentSchedule(
  payables: Array<{ entries: PayableEntry[]; balance: number }>
): PaymentSchedule {
  const schedule = {
    thisWeek: 0,
    nextWeek: 0,
    thisMonth: 0,
    nextMonth: 0,
    later: 0,
  };

  const today = new Date();
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));

  const endOfNextWeek = new Date(endOfWeek);
  endOfNextWeek.setDate(endOfWeek.getDate() + 7);

  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);

  payables.forEach(({ entries }) => {
    entries.forEach((entry: PayableEntry) => {
      if (entry.bill && entry.balance > 0) {
        // Assume payment terms of 30 days for simplicity
        const billDate = new Date(entry.date);
        const dueDate = new Date(billDate);
        dueDate.setDate(billDate.getDate() + 30);

        if (dueDate <= endOfWeek) {
          schedule.thisWeek += entry.balance;
        } else if (dueDate <= endOfNextWeek) {
          schedule.nextWeek += entry.balance;
        } else if (dueDate <= endOfMonth) {
          schedule.thisMonth += entry.balance;
        } else if (dueDate <= endOfNextMonth) {
          schedule.nextMonth += entry.balance;
        }
      }
    });
  });

  return schedule;
}
