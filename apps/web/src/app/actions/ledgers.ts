'use server';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

const dateRangeSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '有効な日付形式（YYYY-MM-DD）を入力してください'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '有効な日付形式（YYYY-MM-DD）を入力してください'),
});

interface LedgerEntry {
  id: string;
  date: string;
  entryNumber: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
  counterAccountName?: string;
}

interface LedgerData {
  openingBalance: number;
  entries: LedgerEntry[];
  closingBalance: number;
}

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function getCashBook(
  startDate: string,
  endDate: string
): Promise<ActionResult<LedgerData>> {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: '認証が必要です' };
    }

    // Validate dates
    const { startDate: validStartDate, endDate: validEndDate } = dateRangeSchema.parse({
      startDate,
      endDate,
    });

    // TODO: Implement actual cash book data fetching from Supabase
    // This would involve:
    // 1. Fetching journal entries for cash account within date range
    // 2. Calculating running balances
    // 3. Getting opening and closing balances

    const mockData: LedgerData = {
      openingBalance: 1000000,
      entries: [
        {
          id: '1',
          date: validStartDate,
          entryNumber: 'JE-2024-001',
          description: '売上入金',
          debitAmount: 100000,
          creditAmount: 0,
          balance: 1100000,
          counterAccountName: '売上高',
        },
        {
          id: '2',
          date: validEndDate,
          entryNumber: 'JE-2024-002',
          description: '経費支払',
          debitAmount: 0,
          creditAmount: 50000,
          balance: 1050000,
          counterAccountName: '消耗品費',
        },
      ],
      closingBalance: 1050000,
    };

    return { success: true, data: mockData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || '入力値が不正です' };
    }
    console.error('Failed to fetch cash book:', error);
    return { success: false, error: '現金出納帳の取得に失敗しました' };
  }
}

export async function getBankBook(
  startDate: string,
  endDate: string
): Promise<ActionResult<LedgerData>> {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: '認証が必要です' };
    }

    // Validate dates
    const { startDate: validStartDate, endDate: validEndDate } = dateRangeSchema.parse({
      startDate,
      endDate,
    });

    // TODO: Implement actual bank book data fetching from Supabase
    // This would involve:
    // 1. Fetching journal entries for bank accounts within date range
    // 2. Calculating running balances
    // 3. Getting opening and closing balances

    const mockData: LedgerData = {
      openingBalance: 5000000,
      entries: [
        {
          id: '1',
          date: validStartDate,
          entryNumber: 'JE-2024-003',
          description: '売上振込',
          debitAmount: 500000,
          creditAmount: 0,
          balance: 5500000,
          counterAccountName: '売上高',
        },
        {
          id: '2',
          date: validEndDate,
          entryNumber: 'JE-2024-004',
          description: '仕入支払',
          debitAmount: 0,
          creditAmount: 300000,
          balance: 5200000,
          counterAccountName: '仕入高',
        },
      ],
      closingBalance: 5200000,
    };

    return { success: true, data: mockData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || '入力値が不正です' };
    }
    console.error('Failed to fetch bank book:', error);
    return { success: false, error: '預金出納帳の取得に失敗しました' };
  }
}

export async function getAccountsReceivable(
  startDate: string,
  endDate: string
): Promise<ActionResult<LedgerData>> {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: '認証が必要です' };
    }

    // Validate dates
    const { startDate: validStartDate, endDate: validEndDate } = dateRangeSchema.parse({
      startDate,
      endDate,
    });

    // TODO: Implement actual accounts receivable data fetching from Supabase
    // This would involve:
    // 1. Fetching journal entries for accounts receivable within date range
    // 2. Calculating running balances
    // 3. Getting opening and closing balances

    const mockData: LedgerData = {
      openingBalance: 2000000,
      entries: [
        {
          id: '1',
          date: validStartDate,
          entryNumber: 'JE-2024-005',
          description: '売上計上',
          debitAmount: 300000,
          creditAmount: 0,
          balance: 2300000,
          counterAccountName: '売上高',
        },
        {
          id: '2',
          date: validEndDate,
          entryNumber: 'JE-2024-006',
          description: '売掛金回収',
          debitAmount: 0,
          creditAmount: 500000,
          balance: 1800000,
          counterAccountName: '現金',
        },
      ],
      closingBalance: 1800000,
    };

    return { success: true, data: mockData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || '入力値が不正です' };
    }
    console.error('Failed to fetch accounts receivable:', error);
    return { success: false, error: '売掛金台帳の取得に失敗しました' };
  }
}

export async function getAccountsPayable(
  startDate: string,
  endDate: string
): Promise<ActionResult<LedgerData>> {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: '認証が必要です' };
    }

    // Validate dates
    const { startDate: validStartDate, endDate: validEndDate } = dateRangeSchema.parse({
      startDate,
      endDate,
    });

    // TODO: Implement actual accounts payable data fetching from Supabase
    // This would involve:
    // 1. Fetching journal entries for accounts payable within date range
    // 2. Calculating running balances
    // 3. Getting opening and closing balances

    const mockData: LedgerData = {
      openingBalance: 1500000,
      entries: [
        {
          id: '1',
          date: validStartDate,
          entryNumber: 'JE-2024-007',
          description: '仕入計上',
          debitAmount: 0,
          creditAmount: 200000,
          balance: 1700000,
          counterAccountName: '仕入高',
        },
        {
          id: '2',
          date: validEndDate,
          entryNumber: 'JE-2024-008',
          description: '買掛金支払',
          debitAmount: 400000,
          creditAmount: 0,
          balance: 1300000,
          counterAccountName: '現金',
        },
      ],
      closingBalance: 1300000,
    };

    return { success: true, data: mockData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || '入力値が不正です' };
    }
    console.error('Failed to fetch accounts payable:', error);
    return { success: false, error: '買掛金台帳の取得に失敗しました' };
  }
}

export async function exportLedgerToCSV(
  ledgerType: 'cash' | 'bank' | 'accounts-receivable' | 'accounts-payable',
  startDate: string,
  endDate: string
): Promise<ActionResult<string>> {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: '認証が必要です' };
    }

    // Validate dates
    dateRangeSchema.parse({ startDate, endDate });

    // TODO: Implement actual CSV export functionality
    // This would involve:
    // 1. Fetching the ledger data based on type
    // 2. Converting to CSV format
    // 3. Returning CSV string or file URL

    // For now, return a sample CSV header based on ledger type
    let csvContent = '';
    switch (ledgerType) {
      case 'cash':
        csvContent = 'Date,Entry Number,Description,Counter Account,Debit,Credit,Balance\\n';
        break;
      case 'bank':
        csvContent = 'Date,Entry Number,Description,Counter Account,Deposit,Withdrawal,Balance\\n';
        break;
      case 'accounts-receivable':
        csvContent = 'Date,Entry Number,Description,Counter Account,Sales,Collection,Balance\\n';
        break;
      case 'accounts-payable':
        csvContent = 'Date,Entry Number,Description,Counter Account,Purchase,Payment,Balance\\n';
        break;
    }

    return { success: true, data: csvContent };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || '入力値が不正です' };
    }
    console.error('Failed to export ledger:', error);
    return { success: false, error: 'エクスポートに失敗しました' };
  }
}
