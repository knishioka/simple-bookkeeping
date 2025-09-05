'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

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

import type { Database } from '@/lib/supabase/database.types';

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
