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

    // ユーザーのデフォルト組織を取得
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .single();

    if (orgError || !userOrg) {
      return { success: false, error: '組織情報の取得に失敗しました' };
    }

    // 現金勘定を取得（通常、コード '1010' または名前 '現金'）
    const { data: cashAccount, error: accountError } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('organization_id', userOrg.organization_id)
      .or(`code.eq.1010,name.eq.現金`)
      .single();

    if (accountError || !cashAccount) {
      return { success: false, error: '現金勘定が見つかりません' };
    }

    // 開始日前の残高を計算（開始残高）
    const { data: openingBalanceData } = await supabase
      .from('journal_entry_lines')
      .select(
        `
        debit_amount,
        credit_amount,
        journal_entries!inner(
          entry_date,
          organization_id,
          status
        )
      `
      )
      .eq('account_id', cashAccount.id)
      .eq('journal_entries.organization_id', userOrg.organization_id)
      .eq('journal_entries.status', 'approved')
      .lt('journal_entries.entry_date', validStartDate);

    let openingBalance = 0;
    if (openingBalanceData) {
      openingBalance = openingBalanceData.reduce(
        (sum, line) => sum + (line.debit_amount || 0) - (line.credit_amount || 0),
        0
      );
    }

    // 期間内の仕訳を取得（明細を含む）
    const { data: journalEntries, error: entriesError } = await supabase
      .from('journal_entries')
      .select(
        `
        id,
        entry_number,
        entry_date,
        description,
        journal_entry_lines!inner(
          id,
          account_id,
          debit_amount,
          credit_amount,
          description,
          accounts!inner(
            id,
            name
          )
        )
      `
      )
      .eq('organization_id', userOrg.organization_id)
      .eq('status', 'approved')
      .gte('entry_date', validStartDate)
      .lte('entry_date', validEndDate)
      .order('entry_date', { ascending: true });

    if (entriesError) {
      console.error('Failed to fetch journal entries:', entriesError);
      return { success: false, error: '仕訳データの取得に失敗しました' };
    }

    // エントリーを構築
    let runningBalance = openingBalance;
    const entries: LedgerEntry[] = [];

    for (const journalEntry of journalEntries || []) {
      const lines = journalEntry.journal_entry_lines as unknown as Array<{
        id: string;
        account_id: string;
        debit_amount: number;
        credit_amount: number;
        description: string | null;
        accounts: { id: string; name: string };
      }>;

      // 現金勘定の明細を探す
      const cashLine = lines.find((line) => line.account_id === cashAccount.id);
      if (!cashLine) continue;

      // 相手勘定を探す（現金勘定以外の最初の明細）
      const counterLine = lines.find((line) => line.account_id !== cashAccount.id);
      const counterAccountName = counterLine?.accounts?.name || '不明';

      // 残高を計算
      runningBalance += (cashLine.debit_amount || 0) - (cashLine.credit_amount || 0);

      entries.push({
        id: cashLine.id,
        date: journalEntry.entry_date,
        entryNumber: journalEntry.entry_number,
        description: cashLine.description || journalEntry.description,
        debitAmount: cashLine.debit_amount || 0,
        creditAmount: cashLine.credit_amount || 0,
        balance: runningBalance,
        counterAccountName,
      });
    }

    const closingBalance = runningBalance;

    return {
      success: true,
      data: {
        openingBalance,
        entries,
        closingBalance,
      },
    };
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

    // ユーザーのデフォルト組織を取得
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .single();

    if (orgError || !userOrg) {
      return { success: false, error: '組織情報の取得に失敗しました' };
    }

    // 預金勘定を取得（通常、コード '1020' または名前に '預金' を含む）
    const { data: bankAccounts, error: accountError } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('organization_id', userOrg.organization_id)
      .or(`code.like.102%,name.like.%預金%`);

    if (accountError || !bankAccounts || bankAccounts.length === 0) {
      return { success: false, error: '預金勘定が見つかりません' };
    }

    // 複数の預金口座がある場合は、最初のものを使用
    const bankAccountIds = bankAccounts.map((acc) => acc.id);

    // 開始日前の残高を計算（開始残高）
    const { data: openingBalanceData } = await supabase
      .from('journal_entry_lines')
      .select(
        `
        debit_amount,
        credit_amount,
        journal_entries!inner(
          entry_date,
          organization_id,
          status
        )
      `
      )
      .in('account_id', bankAccountIds)
      .eq('journal_entries.organization_id', userOrg.organization_id)
      .eq('journal_entries.status', 'approved')
      .lt('journal_entries.entry_date', validStartDate);

    let openingBalance = 0;
    if (openingBalanceData) {
      openingBalance = openingBalanceData.reduce(
        (sum, line) => sum + (line.debit_amount || 0) - (line.credit_amount || 0),
        0
      );
    }

    // 期間内の仕訳明細を取得
    const { data: journalLines, error: linesError } = await supabase
      .from('journal_entry_lines')
      .select(
        `
        id,
        journal_entry_id,
        debit_amount,
        credit_amount,
        description,
        journal_entries!inner(
          entry_number,
          entry_date,
          description,
          organization_id,
          status
        ),
        accounts!inner(
          id,
          name
        )
      `
      )
      .in('account_id', bankAccountIds)
      .eq('journal_entries.organization_id', userOrg.organization_id)
      .eq('journal_entries.status', 'approved')
      .gte('journal_entries.entry_date', validStartDate)
      .lte('journal_entries.entry_date', validEndDate)
      .order('journal_entries.entry_date', { ascending: true });

    if (linesError) {
      console.error('Failed to fetch journal lines:', linesError);
      return { success: false, error: '仕訳明細の取得に失敗しました' };
    }

    // 相手勘定を取得して、エントリーを構築
    let runningBalance = openingBalance;
    const entries: LedgerEntry[] = [];

    for (const line of journalLines || []) {
      const journalEntry = line.journal_entries as unknown as {
        entry_date: string;
        entry_number: string;
        description: string;
      };

      // この仕訳の他の明細行から相手勘定を取得
      const { data: counterLines } = await supabase
        .from('journal_entry_lines')
        .select(
          `
          accounts!inner(
            name
          )
        `
        )
        .eq('journal_entry_id', line.journal_entry_id)
        .not('account_id', 'in', `(${bankAccountIds.join(',')})`)
        .limit(1)
        .single();

      const counterAccountName = (counterLines?.accounts as { name?: string })?.name || '不明';

      // 残高を計算
      runningBalance += (line.debit_amount || 0) - (line.credit_amount || 0);

      entries.push({
        id: line.id,
        date: journalEntry.entry_date,
        entryNumber: journalEntry.entry_number,
        description: line.description || journalEntry.description,
        debitAmount: line.debit_amount || 0,
        creditAmount: line.credit_amount || 0,
        balance: runningBalance,
        counterAccountName,
      });
    }

    const closingBalance = runningBalance;

    return {
      success: true,
      data: {
        openingBalance,
        entries,
        closingBalance,
      },
    };
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

    // ユーザーのデフォルト組織を取得
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .single();

    if (orgError || !userOrg) {
      return { success: false, error: '組織情報の取得に失敗しました' };
    }

    // 売掛金勘定を取得（通常、コード '1130' または名前 '売掛金'）
    const { data: receivableAccounts, error: accountError } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('organization_id', userOrg.organization_id)
      .or(`code.like.113%,name.like.%売掛%`);

    if (accountError || !receivableAccounts || receivableAccounts.length === 0) {
      return { success: false, error: '売掛金勘定が見つかりません' };
    }

    const receivableAccountIds = receivableAccounts.map((acc) => acc.id);

    // 開始日前の残高を計算（開始残高）
    const { data: openingBalanceData } = await supabase
      .from('journal_entry_lines')
      .select(
        `
        debit_amount,
        credit_amount,
        journal_entries!inner(
          entry_date,
          organization_id,
          status
        )
      `
      )
      .in('account_id', receivableAccountIds)
      .eq('journal_entries.organization_id', userOrg.organization_id)
      .eq('journal_entries.status', 'approved')
      .lt('journal_entries.entry_date', validStartDate);

    let openingBalance = 0;
    if (openingBalanceData) {
      openingBalance = openingBalanceData.reduce(
        (sum, line) => sum + (line.debit_amount || 0) - (line.credit_amount || 0),
        0
      );
    }

    // 期間内の仕訳明細を取得
    const { data: journalLines, error: linesError } = await supabase
      .from('journal_entry_lines')
      .select(
        `
        id,
        journal_entry_id,
        debit_amount,
        credit_amount,
        description,
        partner_id,
        journal_entries!inner(
          entry_number,
          entry_date,
          description,
          organization_id,
          status
        ),
        accounts!inner(
          id,
          name
        ),
        partners(
          name
        )
      `
      )
      .in('account_id', receivableAccountIds)
      .eq('journal_entries.organization_id', userOrg.organization_id)
      .eq('journal_entries.status', 'approved')
      .gte('journal_entries.entry_date', validStartDate)
      .lte('journal_entries.entry_date', validEndDate)
      .order('journal_entries.entry_date', { ascending: true });

    if (linesError) {
      console.error('Failed to fetch journal lines:', linesError);
      return { success: false, error: '仕訳明細の取得に失敗しました' };
    }

    // 相手勘定を取得して、エントリーを構築
    let runningBalance = openingBalance;
    const entries: LedgerEntry[] = [];

    for (const line of journalLines || []) {
      const journalEntry = line.journal_entries as unknown as {
        entry_date: string;
        entry_number: string;
        description: string;
      };

      // この仕訳の他の明細行から相手勘定を取得
      const { data: counterLines } = await supabase
        .from('journal_entry_lines')
        .select(
          `
          accounts!inner(
            name
          )
        `
        )
        .eq('journal_entry_id', line.journal_entry_id)
        .not('account_id', 'in', `(${receivableAccountIds.join(',')})`)
        .limit(1)
        .single();

      const counterAccountName = (counterLines?.accounts as { name?: string })?.name || '不明';
      const partnerName = (line.partners as { name?: string })?.name || '';

      // 残高を計算
      runningBalance += (line.debit_amount || 0) - (line.credit_amount || 0);

      entries.push({
        id: line.id,
        date: journalEntry.entry_date,
        entryNumber: journalEntry.entry_number,
        description: `${line.description || journalEntry.description}${partnerName ? ` (取引先: ${partnerName})` : ''}`,
        debitAmount: line.debit_amount || 0,
        creditAmount: line.credit_amount || 0,
        balance: runningBalance,
        counterAccountName,
      });
    }

    const closingBalance = runningBalance;

    return {
      success: true,
      data: {
        openingBalance,
        entries,
        closingBalance,
      },
    };
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

    // ユーザーのデフォルト組織を取得
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .single();

    if (orgError || !userOrg) {
      return { success: false, error: '組織情報の取得に失敗しました' };
    }

    // 買掛金勘定を取得（通常、コード '2110' または名前 '買掛金'）
    const { data: payableAccounts, error: accountError } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('organization_id', userOrg.organization_id)
      .or(`code.like.211%,name.like.%買掛%`);

    if (accountError || !payableAccounts || payableAccounts.length === 0) {
      return { success: false, error: '買掛金勘定が見つかりません' };
    }

    const payableAccountIds = payableAccounts.map((acc) => acc.id);

    // 開始日前の残高を計算（開始残高）
    const { data: openingBalanceData } = await supabase
      .from('journal_entry_lines')
      .select(
        `
        debit_amount,
        credit_amount,
        journal_entries!inner(
          entry_date,
          organization_id,
          status
        )
      `
      )
      .in('account_id', payableAccountIds)
      .eq('journal_entries.organization_id', userOrg.organization_id)
      .eq('journal_entries.status', 'approved')
      .lt('journal_entries.entry_date', validStartDate);

    let openingBalance = 0;
    if (openingBalanceData) {
      // 買掛金は負債なので、貸方 - 借方
      openingBalance = openingBalanceData.reduce(
        (sum, line) => sum + (line.credit_amount || 0) - (line.debit_amount || 0),
        0
      );
    }

    // 期間内の仕訳明細を取得
    const { data: journalLines, error: linesError } = await supabase
      .from('journal_entry_lines')
      .select(
        `
        id,
        journal_entry_id,
        debit_amount,
        credit_amount,
        description,
        partner_id,
        journal_entries!inner(
          entry_number,
          entry_date,
          description,
          organization_id,
          status
        ),
        accounts!inner(
          id,
          name
        ),
        partners(
          name
        )
      `
      )
      .in('account_id', payableAccountIds)
      .eq('journal_entries.organization_id', userOrg.organization_id)
      .eq('journal_entries.status', 'approved')
      .gte('journal_entries.entry_date', validStartDate)
      .lte('journal_entries.entry_date', validEndDate)
      .order('journal_entries.entry_date', { ascending: true });

    if (linesError) {
      console.error('Failed to fetch journal lines:', linesError);
      return { success: false, error: '仕訳明細の取得に失敗しました' };
    }

    // 相手勘定を取得して、エントリーを構築
    let runningBalance = openingBalance;
    const entries: LedgerEntry[] = [];

    for (const line of journalLines || []) {
      const journalEntry = line.journal_entries as unknown as {
        entry_date: string;
        entry_number: string;
        description: string;
      };

      // この仕訳の他の明細行から相手勘定を取得
      const { data: counterLines } = await supabase
        .from('journal_entry_lines')
        .select(
          `
          accounts!inner(
            name
          )
        `
        )
        .eq('journal_entry_id', line.journal_entry_id)
        .not('account_id', 'in', `(${payableAccountIds.join(',')})`)
        .limit(1)
        .single();

      const counterAccountName = (counterLines?.accounts as { name?: string })?.name || '不明';
      const partnerName = (line.partners as { name?: string })?.name || '';

      // 残高を計算（買掛金は負債なので、貸方 - 借方）
      runningBalance += (line.credit_amount || 0) - (line.debit_amount || 0);

      entries.push({
        id: line.id,
        date: journalEntry.entry_date,
        entryNumber: journalEntry.entry_number,
        description: `${line.description || journalEntry.description}${partnerName ? ` (取引先: ${partnerName})` : ''}`,
        debitAmount: line.debit_amount || 0,
        creditAmount: line.credit_amount || 0,
        balance: runningBalance,
        counterAccountName,
      });
    }

    const closingBalance = runningBalance;

    return {
      success: true,
      data: {
        openingBalance,
        entries,
        closingBalance,
      },
    };
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

    // 実際の台帳データを取得
    let ledgerResult: ActionResult<LedgerData>;
    let headers: string;

    switch (ledgerType) {
      case 'cash':
        ledgerResult = await getCashBook(startDate, endDate);
        headers = '日付,仕訳番号,摘要,相手勘定,借方金額,貸方金額,残高';
        break;
      case 'bank':
        ledgerResult = await getBankBook(startDate, endDate);
        headers = '日付,仕訳番号,摘要,相手勘定,入金,出金,残高';
        break;
      case 'accounts-receivable':
        ledgerResult = await getAccountsReceivable(startDate, endDate);
        headers = '日付,仕訳番号,摘要,相手勘定,売上,回収,残高';
        break;
      case 'accounts-payable':
        ledgerResult = await getAccountsPayable(startDate, endDate);
        headers = '日付,仕訳番号,摘要,相手勘定,仕入,支払,残高';
        break;
    }

    if (!ledgerResult.success || !ledgerResult.data) {
      return { success: false, error: ledgerResult.error || '台帳データの取得に失敗しました' };
    }

    const { openingBalance, entries, closingBalance } = ledgerResult.data;

    // CSV生成
    let csvContent = `${headers}\n`;

    // 開始残高
    csvContent += `${startDate},-,開始残高,-,-,-,${openingBalance}\n`;

    // エントリー
    for (const entry of entries) {
      const date = entry.date;
      const entryNumber = entry.entryNumber;
      const description = entry.description.replace(/"/g, '""'); // エスケープ
      const counterAccount = entry.counterAccountName || '';
      const debitAmount = entry.debitAmount || 0;
      const creditAmount = entry.creditAmount || 0;
      const balance = entry.balance;

      csvContent += `${date},${entryNumber},"${description}",${counterAccount},${debitAmount},${creditAmount},${balance}\n`;
    }

    // 終了残高
    csvContent += `${endDate},-,終了残高,-,-,-,${closingBalance}\n`;

    return { success: true, data: csvContent };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || '入力値が不正です' };
    }
    console.error('Failed to export ledger:', error);
    return { success: false, error: 'エクスポートに失敗しました' };
  }
}
