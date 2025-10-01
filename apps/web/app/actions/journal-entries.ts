'use server';

import type { Database } from '@/lib/supabase/database.types';

import { revalidatePath } from 'next/cache';

import {
  ActionResult,
  QueryParams,
  PaginatedResponse,
  createSuccessResult,
  createErrorResult,
  createUnauthorizedResult,
  createNotFoundResult,
  createValidationErrorResult,
  handleSupabaseError,
  ERROR_CODES,
} from './types';

import { createClient } from '@/lib/supabase/server';

type JournalEntry = Database['public']['Tables']['journal_entries']['Row'];
type JournalEntryInsert = Database['public']['Tables']['journal_entries']['Insert'];
type JournalEntryUpdate = Database['public']['Tables']['journal_entries']['Update'];
type JournalEntryLine = Database['public']['Tables']['journal_entry_lines']['Row'];
type JournalEntryLineInsert = Database['public']['Tables']['journal_entry_lines']['Insert'];

interface JournalEntryWithLines extends JournalEntry {
  lines: JournalEntryLine[];
}

interface CreateJournalEntryInput {
  entry: Omit<JournalEntryInsert, 'id' | 'created_at' | 'updated_at' | 'created_by'>;
  lines: Omit<JournalEntryLineInsert, 'id' | 'journal_entry_id' | 'created_at' | 'updated_at'>[];
}

interface UpdateJournalEntryInput {
  entry: Omit<
    JournalEntryUpdate,
    'id' | 'organization_id' | 'created_at' | 'updated_at' | 'created_by'
  >;
  lines?: Omit<JournalEntryLineInsert, 'id' | 'journal_entry_id' | 'created_at' | 'updated_at'>[];
}

/**
 * 仕訳一覧を取得
 */
export async function getJournalEntries(
  organizationId: string,
  params?: QueryParams & {
    accountingPeriodId?: string;
    status?: JournalEntry['status'];
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<ActionResult<PaginatedResponse<JournalEntry>>> {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return createUnauthorizedResult();
    }

    // 組織へのアクセス権限チェック
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (orgError || !userOrg) {
      return createErrorResult(ERROR_CODES.FORBIDDEN, 'この組織の仕訳を表示する権限がありません。');
    }

    // ページネーション設定
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // クエリ構築
    let query = supabase
      .from('journal_entries')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId);

    // フィルタ条件
    if (params?.accountingPeriodId) {
      query = query.eq('accounting_period_id', params.accountingPeriodId);
    }

    if (params?.status) {
      query = query.eq('status', params.status);
    }

    if (params?.dateFrom) {
      query = query.gte('entry_date', params.dateFrom);
    }

    if (params?.dateTo) {
      query = query.lte('entry_date', params.dateTo);
    }

    // 検索条件
    if (params?.search) {
      query = query.or(
        `entry_number.ilike.%${params.search}%,description.ilike.%${params.search}%`
      );
    }

    // ソート
    const orderBy = params?.orderBy || 'entry_date';
    const orderDirection = params?.orderDirection === 'desc';
    query = query.order(orderBy, { ascending: !orderDirection });

    // ページネーション適用
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return handleSupabaseError(error);
    }

    return createSuccessResult({
      items: data || [],
      pagination: {
        page,
        pageSize,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * 仕訳を作成（複合トランザクション）
 */
export async function createJournalEntry(
  input: CreateJournalEntryInput
): Promise<ActionResult<JournalEntryWithLines>> {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return createUnauthorizedResult();
    }

    const { entry, lines } = input;

    // 組織へのアクセス権限チェック（admin または accountant のみ作成可能）
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', entry.organization_id)
      .single();

    if (orgError || !userOrg) {
      return createErrorResult(ERROR_CODES.FORBIDDEN, 'この組織の仕訳を作成する権限がありません。');
    }

    if (userOrg.role === 'viewer') {
      return createErrorResult(
        ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        '閲覧者は仕訳を作成できません。'
      );
    }

    // バリデーション
    if (!entry.entry_number || !entry.entry_date || !entry.description) {
      return createValidationErrorResult('必須項目が入力されていません。', {
        entry_number: !entry.entry_number ? '仕訳番号は必須です' : undefined,
        entry_date: !entry.entry_date ? '仕訳日付は必須です' : undefined,
        description: !entry.description ? '摘要は必須です' : undefined,
      });
    }

    if (!lines || lines.length === 0) {
      return createValidationErrorResult('仕訳明細が入力されていません。');
    }

    // 貸借バランスチェック
    const totalDebit = lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return createValidationErrorResult('貸借が一致しません。', {
        debit: totalDebit,
        credit: totalCredit,
        difference: totalDebit - totalCredit,
      });
    }

    // 会計期間の有効性チェック
    const { data: accountingPeriod } = await supabase
      .from('accounting_periods')
      .select('*')
      .eq('id', entry.accounting_period_id)
      .eq('organization_id', entry.organization_id)
      .single();

    if (!accountingPeriod) {
      return createValidationErrorResult('指定された会計期間が存在しません。');
    }

    if (accountingPeriod.is_closed) {
      return createErrorResult(
        ERROR_CODES.INVALID_OPERATION,
        'この会計期間は既に締められています。'
      );
    }

    // 仕訳日付が会計期間内かチェック
    if (
      entry.entry_date < accountingPeriod.start_date ||
      entry.entry_date > accountingPeriod.end_date
    ) {
      return createValidationErrorResult('仕訳日付が会計期間の範囲外です。', {
        entry_date: entry.entry_date,
        period_start: accountingPeriod.start_date,
        period_end: accountingPeriod.end_date,
      });
    }

    // 勘定科目の存在チェック
    const accountIds = Array.from(new Set(lines.map((line) => line.account_id)));
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id')
      .eq('organization_id', entry.organization_id)
      .in('id', accountIds);

    if (accountsError || !accounts || accounts.length !== accountIds.length) {
      return createValidationErrorResult('指定された勘定科目が存在しません。');
    }

    // 取引先の存在チェック（指定されている場合）
    const partnerIds = lines
      .filter((line) => line.partner_id)
      .map((line) => line.partner_id as string);

    if (partnerIds.length > 0) {
      const uniquePartnerIds = Array.from(new Set(partnerIds));
      const { data: partners } = await supabase
        .from('partners')
        .select('id')
        .eq('organization_id', entry.organization_id)
        .in('id', uniquePartnerIds);

      if (!partners || partners.length !== uniquePartnerIds.length) {
        return createValidationErrorResult('指定された取引先が存在しません。');
      }
    }

    // トランザクション開始（仕訳と明細を同時に作成）
    // 仕訳を作成
    const { data: newEntry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        ...entry,
        created_by: user.id,
        status: entry.status || 'draft',
      })
      .select()
      .single();

    if (entryError || !newEntry) {
      return handleSupabaseError(entryError);
    }

    // 仕訳明細を作成
    const linesWithEntryId = lines.map((line, index) => ({
      ...line,
      journal_entry_id: newEntry.id,
      line_number: line.line_number || index + 1,
    }));

    const { data: newLines, error: linesError } = await supabase
      .from('journal_entry_lines')
      .insert(linesWithEntryId)
      .select();

    if (linesError) {
      // エラーが発生した場合、作成した仕訳を削除
      await supabase.from('journal_entries').delete().eq('id', newEntry.id);

      return handleSupabaseError(linesError);
    }

    // キャッシュを再検証
    revalidatePath('/dashboard/journal-entries');
    revalidatePath(`/api/v1/journal-entries`);

    return createSuccessResult({
      ...newEntry,
      lines: newLines || [],
    });
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * 仕訳を更新
 */
export async function updateJournalEntry(
  id: string,
  organizationId: string,
  input: UpdateJournalEntryInput
): Promise<ActionResult<JournalEntryWithLines>> {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return createUnauthorizedResult();
    }

    // 組織へのアクセス権限チェック（admin または accountant のみ更新可能）
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (orgError || !userOrg) {
      return createErrorResult(ERROR_CODES.FORBIDDEN, 'この組織の仕訳を更新する権限がありません。');
    }

    if (userOrg.role === 'viewer') {
      return createErrorResult(
        ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        '閲覧者は仕訳を更新できません。'
      );
    }

    const { entry, lines } = input;

    // 更新対象の仕訳の存在チェック
    const { data: existingEntry } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (!existingEntry) {
      return createNotFoundResult('仕訳');
    }

    // 承認済みの仕訳は更新不可
    if (existingEntry.status === 'approved') {
      return createErrorResult(ERROR_CODES.INVALID_OPERATION, '承認済みの仕訳は更新できません。');
    }

    // 明細を更新する場合のバリデーション
    if (lines && lines.length > 0) {
      // 貸借バランスチェック
      const totalDebit = lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
      const totalCredit = lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return createValidationErrorResult('貸借が一致しません。', {
          debit: totalDebit,
          credit: totalCredit,
          difference: totalDebit - totalCredit,
        });
      }

      // 勘定科目の存在チェック
      const accountIds = Array.from(new Set(lines.map((line) => line.account_id)));
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('organization_id', organizationId)
        .in('id', accountIds);

      if (!accounts || accounts.length !== accountIds.length) {
        return createValidationErrorResult('指定された勘定科目が存在しません。');
      }
    }

    // 仕訳を更新
    const { data: updatedEntry, error: updateError } = await supabase
      .from('journal_entries')
      .update({
        ...entry,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (updateError) {
      return handleSupabaseError(updateError);
    }

    let updatedLines: JournalEntryLine[] = [];

    // 明細を更新する場合
    if (lines) {
      // 既存の明細を削除
      const { error: deleteError } = await supabase
        .from('journal_entry_lines')
        .delete()
        .eq('journal_entry_id', id);

      if (deleteError) {
        return handleSupabaseError(deleteError);
      }

      // 新しい明細を作成
      const linesWithEntryId = lines.map((line, index) => ({
        ...line,
        journal_entry_id: id,
        line_number: line.line_number || index + 1,
      }));

      const { data: newLines, error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(linesWithEntryId)
        .select();

      if (linesError) {
        return handleSupabaseError(linesError);
      }

      updatedLines = newLines || [];
    } else {
      // 明細を更新しない場合は既存の明細を取得
      const { data: existingLines } = await supabase
        .from('journal_entry_lines')
        .select('*')
        .eq('journal_entry_id', id)
        .order('line_number');

      updatedLines = existingLines || [];
    }

    // キャッシュを再検証
    revalidatePath('/dashboard/journal-entries');
    revalidatePath(`/api/v1/journal-entries`);

    return createSuccessResult({
      ...updatedEntry,
      lines: updatedLines,
    });
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * CSVファイルから仕訳をインポート
 */
export async function importJournalEntriesFromCSV(
  formData: FormData
): Promise<ActionResult<{ imported: number; errors: Array<{ row: number; error: string }> }>> {
  try {
    const { parse } = await import('csv-parse');
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return createUnauthorizedResult();
    }

    // フォームデータから必要な情報を取得
    const file = formData.get('file') as File;
    const organizationId = formData.get('organizationId') as string;
    const accountingPeriodId = formData.get('accountingPeriodId') as string;

    if (!file || !organizationId || !accountingPeriodId) {
      return createValidationErrorResult('ファイル、組織ID、会計期間IDは必須です。');
    }

    // 組織へのアクセス権限チェック（admin または accountant のみインポート可能）
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (orgError || !userOrg) {
      return createErrorResult(
        ERROR_CODES.FORBIDDEN,
        'この組織の仕訳をインポートする権限がありません。'
      );
    }

    if (userOrg.role === 'viewer') {
      return createErrorResult(
        ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        '閲覧者は仕訳をインポートできません。'
      );
    }

    // ファイルサイズチェック（5MB制限）
    if (file.size > 5 * 1024 * 1024) {
      return createValidationErrorResult('ファイルサイズは5MB以下にしてください。');
    }

    // 会計期間の有効性チェック
    const { data: accountingPeriod } = await supabase
      .from('accounting_periods')
      .select('*')
      .eq('id', accountingPeriodId)
      .eq('organization_id', organizationId)
      .single();

    if (!accountingPeriod) {
      return createValidationErrorResult('指定された会計期間が存在しません。');
    }

    if (accountingPeriod.is_closed) {
      return createErrorResult(
        ERROR_CODES.INVALID_OPERATION,
        'この会計期間は既に締められています。'
      );
    }

    // 勘定科目マップを事前に作成
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, code, name')
      .eq('organization_id', organizationId);

    const accountMap = new Map<string, string>();
    if (accounts) {
      accounts.forEach((account) => {
        accountMap.set(account.code, account.id);
        accountMap.set(account.name, account.id);
      });
    }

    // CSVファイルを読み込み
    const text = await file.text();

    // CSVパース
    interface CSVRecord {
      [key: string]: string | undefined;
    }
    const records: CSVRecord[] = await new Promise((resolve, reject) => {
      const output: CSVRecord[] = [];
      const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });

      parser.on('readable', function () {
        let record;
        while ((record = parser.read()) !== null) {
          output.push(record);
        }
      });

      parser.on('error', function (err) {
        reject(err);
      });

      parser.on('end', function () {
        resolve(output);
      });

      parser.write(text);
      parser.end();
    });

    if (records.length === 0) {
      return createValidationErrorResult('CSVファイルにデータが含まれていません。');
    }

    // バリデーションとインポート処理
    const errors: Array<{ row: number; error: string }> = [];
    let successfulImports = 0;
    let currentEntryNumber = 1;

    // 最新の仕訳番号を取得
    const { data: latestEntry } = await supabase
      .from('journal_entries')
      .select('entry_number')
      .eq('organization_id', organizationId)
      .eq('accounting_period_id', accountingPeriodId)
      .order('entry_number', { ascending: false })
      .limit(1)
      .single();

    if (latestEntry) {
      const match = latestEntry.entry_number.match(/\d+/);
      if (match) {
        currentEntryNumber = parseInt(match[0], 10) + 1;
      }
    }

    // 日付形式の解析関数
    const parseDate = (dateStr: string): string | null => {
      if (!dateStr) return null;

      // YYYY-MM-DD形式
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }

      // YYYY/MM/DD形式
      if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) {
        return dateStr.replace(/\//g, '-');
      }

      // DD/MM/YYYY形式（日本式）
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }

      return null;
    };

    // 金額の解析関数
    const parseAmount = (amountStr: string): number => {
      if (!amountStr) return 0;
      // カンマと円記号を除去
      const cleaned = amountStr.replace(/[,¥￥]/g, '');
      const amount = parseFloat(cleaned);
      return isNaN(amount) ? 0 : amount;
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2; // ヘッダー行を考慮

      try {
        // 必須フィールドのチェック
        const dateStr = record['日付'] || record.date || record.entry_date;
        const debitAccountStr = record['借方勘定'] || record.debit_account || record['借方'];
        const creditAccountStr = record['貸方勘定'] || record.credit_account || record['貸方'];
        const amountStr = record['金額'] || record.amount;
        const description = record['摘要'] || record.description || record.memo || '';

        if (!dateStr || !debitAccountStr || !creditAccountStr || !amountStr) {
          errors.push({
            row: rowNumber,
            error: '必須項目（日付、借方勘定、貸方勘定、金額）が不足しています。',
          });
          continue;
        }

        // 日付の解析
        const entryDate = parseDate(dateStr);
        if (!entryDate) {
          errors.push({
            row: rowNumber,
            error: `不正な日付形式: ${dateStr}`,
          });
          continue;
        }

        // 日付が会計期間内かチェック
        if (entryDate < accountingPeriod.start_date || entryDate > accountingPeriod.end_date) {
          errors.push({
            row: rowNumber,
            error: `日付が会計期間外です: ${dateStr}`,
          });
          continue;
        }

        // 金額の解析
        const amount = parseAmount(amountStr);
        if (amount <= 0) {
          errors.push({
            row: rowNumber,
            error: `不正な金額: ${amountStr}`,
          });
          continue;
        }

        // 勘定科目IDの取得
        const debitAccountId = accountMap.get(debitAccountStr);
        const creditAccountId = accountMap.get(creditAccountStr);

        if (!debitAccountId) {
          errors.push({
            row: rowNumber,
            error: `借方勘定科目が見つかりません: ${debitAccountStr}`,
          });
          continue;
        }

        if (!creditAccountId) {
          errors.push({
            row: rowNumber,
            error: `貸方勘定科目が見つかりません: ${creditAccountStr}`,
          });
          continue;
        }

        // 仕訳番号の生成
        const entryNumber = `JE-${String(currentEntryNumber).padStart(6, '0')}`;

        // 仕訳を作成
        const { data: newEntry, error: entryError } = await supabase
          .from('journal_entries')
          .insert({
            organization_id: organizationId,
            accounting_period_id: accountingPeriodId,
            entry_number: entryNumber,
            entry_date: entryDate,
            description: description || `インポート仕訳 ${rowNumber}`,
            status: 'draft',
            created_by: user.id,
          })
          .select()
          .single();

        if (entryError || !newEntry) {
          errors.push({
            row: rowNumber,
            error: `仕訳作成エラー: ${entryError?.message || '不明なエラー'}`,
          });
          continue;
        }

        // 仕訳明細を作成
        const lines = [
          {
            journal_entry_id: newEntry.id,
            line_number: 1,
            account_id: debitAccountId,
            debit_amount: amount,
            credit_amount: 0,
            description,
          },
          {
            journal_entry_id: newEntry.id,
            line_number: 2,
            account_id: creditAccountId,
            debit_amount: 0,
            credit_amount: amount,
            description,
          },
        ];

        const { error: linesError } = await supabase.from('journal_entry_lines').insert(lines);

        if (linesError) {
          // エラーが発生した場合、作成した仕訳を削除
          await supabase.from('journal_entries').delete().eq('id', newEntry.id);

          errors.push({
            row: rowNumber,
            error: `仕訳明細作成エラー: ${linesError.message}`,
          });
          continue;
        }

        successfulImports++;
        currentEntryNumber++;
      } catch (error) {
        errors.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : '不明なエラーが発生しました。',
        });
      }
    }

    // キャッシュを再検証
    if (successfulImports > 0) {
      revalidatePath('/dashboard/journal-entries');
      revalidatePath(`/api/v1/journal-entries`);
    }

    return createSuccessResult({
      imported: successfulImports,
      errors,
    });
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * 仕訳を削除
 */
export async function deleteJournalEntry(
  id: string,
  organizationId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return createUnauthorizedResult();
    }

    // 組織へのアクセス権限チェック（admin のみ削除可能）
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (orgError || !userOrg) {
      return createErrorResult(ERROR_CODES.FORBIDDEN, 'この組織の仕訳を削除する権限がありません。');
    }

    if (userOrg.role !== 'admin') {
      return createErrorResult(
        ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        '管理者のみが仕訳を削除できます。'
      );
    }

    // 削除対象の仕訳の存在チェック
    const { data: existingEntry } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (!existingEntry) {
      return createNotFoundResult('仕訳');
    }

    // 承認済みの仕訳は削除不可
    if (existingEntry.status === 'approved') {
      return createErrorResult(ERROR_CODES.INVALID_OPERATION, '承認済みの仕訳は削除できません。');
    }

    // 仕訳明細を先に削除（外部キー制約のため）
    const { error: linesDeleteError } = await supabase
      .from('journal_entry_lines')
      .delete()
      .eq('journal_entry_id', id);

    if (linesDeleteError) {
      return handleSupabaseError(linesDeleteError);
    }

    // 仕訳を削除
    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      return handleSupabaseError(error);
    }

    // キャッシュを再検証
    revalidatePath('/dashboard/journal-entries');
    revalidatePath(`/api/v1/journal-entries`);

    return createSuccessResult({ id });
  } catch (error) {
    return handleSupabaseError(error);
  }
}
