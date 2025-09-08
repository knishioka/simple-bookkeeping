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
  createForbiddenResult,
  handleSupabaseError,
  ERROR_CODES,
} from './types';

import type { Database } from '@/lib/supabase/database.types';

type AccountingPeriod = Database['public']['Tables']['accounting_periods']['Row'];
type AccountingPeriodInsert = Database['public']['Tables']['accounting_periods']['Insert'];
type AccountingPeriodUpdate = Database['public']['Tables']['accounting_periods']['Update'];

/**
 * 会計期間の日付重複チェック
 */
async function checkPeriodOverlap(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  organizationId: string,
  startDate: string,
  endDate: string,
  excludeId?: string
): Promise<boolean> {
  let query = supabase
    .from('accounting_periods')
    .select('id')
    .eq('organization_id', organizationId)
    .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error checking period overlap:', error);
    return true; // エラーの場合は安全のため重複ありとする
  }

  return (data?.length ?? 0) > 0;
}

/**
 * 会計期間一覧を取得（ページネーション付き）
 */
export async function getAccountingPeriods(
  organizationId: string,
  params?: QueryParams
): Promise<ActionResult<PaginatedResponse<AccountingPeriod>>> {
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
      return createErrorResult(
        ERROR_CODES.FORBIDDEN,
        'この組織の会計期間を表示する権限がありません。'
      );
    }

    // ページネーション設定
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // クエリ構築
    let query = supabase
      .from('accounting_periods')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId);

    // 検索条件
    if (params?.search) {
      query = query.ilike('name', `%${params.search}%`);
    }

    // ソート（デフォルトは開始日の降順）
    const orderBy = params?.orderBy || 'start_date';
    const orderDirection = params?.orderDirection === 'asc';
    query = query.order(orderBy, { ascending: orderDirection });

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
    return createErrorResult(ERROR_CODES.INTERNAL_ERROR, 'システムエラーが発生しました。', error);
  }
}

/**
 * 現在のアクティブな会計期間を取得
 */
export async function getActiveAccountingPeriod(
  organizationId: string
): Promise<ActionResult<AccountingPeriod | null>> {
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
      return createErrorResult(
        ERROR_CODES.FORBIDDEN,
        'この組織の会計期間を表示する権限がありません。'
      );
    }

    // 現在の日付を取得
    const today = new Date().toISOString().split('T')[0];

    // アクティブな期間を取得（閉じられておらず、期間内のもの）
    const { data, error } = await supabase
      .from('accounting_periods')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_closed', false)
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // レコードが見つからない場合はnullを返す
      if (error.code === 'PGRST116') {
        return createSuccessResult(null);
      }
      return handleSupabaseError(error);
    }

    return createSuccessResult(data);
  } catch (error) {
    return createErrorResult(ERROR_CODES.INTERNAL_ERROR, 'システムエラーが発生しました。', error);
  }
}

/**
 * 新規会計期間を作成
 */
export async function createAccountingPeriod(
  organizationId: string,
  data: Omit<AccountingPeriodInsert, 'organization_id' | 'id' | 'created_at' | 'updated_at'>
): Promise<ActionResult<AccountingPeriod>> {
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

    // 組織へのアクセス権限チェック（admin または accountant のみ）
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single();

    if (orgError || !userOrg || userOrg.role === 'viewer') {
      return createForbiddenResult();
    }

    // 入力検証
    if (!data.name || !data.start_date || !data.end_date) {
      return createValidationErrorResult('名称、開始日、終了日は必須項目です。');
    }

    // 日付の妥当性チェック
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);

    if (startDate >= endDate) {
      return createValidationErrorResult('開始日は終了日より前である必要があります。');
    }

    // 期間が1年を超える場合は警告（エラーにはしない）
    const oneYearLater = new Date(startDate);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    if (endDate > oneYearLater) {
      console.warn('会計期間が1年を超えています:', data.name);
    }

    // 期間の重複チェック
    const hasOverlap = await checkPeriodOverlap(
      supabase,
      organizationId,
      data.start_date,
      data.end_date
    );

    if (hasOverlap) {
      return createValidationErrorResult('指定された期間は既存の会計期間と重複しています。');
    }

    // 会計期間を作成
    const { data: newPeriod, error: createError } = await supabase
      .from('accounting_periods')
      .insert({
        ...data,
        organization_id: organizationId,
        is_closed: false,
      })
      .select()
      .single();

    if (createError) {
      return handleSupabaseError(createError);
    }

    // 関連画面の再検証
    revalidatePath('/dashboard/accounting-periods');
    revalidatePath('/dashboard/journal-entries');

    return createSuccessResult(newPeriod);
  } catch (error) {
    return createErrorResult(ERROR_CODES.INTERNAL_ERROR, 'システムエラーが発生しました。', error);
  }
}

/**
 * 会計期間を更新
 */
export async function updateAccountingPeriod(
  periodId: string,
  data: Omit<AccountingPeriodUpdate, 'id' | 'organization_id' | 'created_at' | 'updated_at'>
): Promise<ActionResult<AccountingPeriod>> {
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

    // 既存の会計期間を取得
    const { data: existingPeriod, error: fetchError } = await supabase
      .from('accounting_periods')
      .select('*, user_organizations!inner(role)')
      .eq('id', periodId)
      .eq('user_organizations.user_id', user.id)
      .single();

    if (fetchError || !existingPeriod) {
      return createNotFoundResult('会計期間');
    }

    // 権限チェック（admin または accountant のみ）
    const userRole = (
      existingPeriod as Record<string, unknown> & { user_organizations: Array<{ role: string }> }
    ).user_organizations[0]?.role;
    if (userRole === 'viewer') {
      return createForbiddenResult();
    }

    // 閉じられた期間は基本的に更新不可
    if (existingPeriod.is_closed && !data.is_closed) {
      return createValidationErrorResult('閉じられた会計期間は更新できません。');
    }

    // 日付が変更される場合の検証
    if (data.start_date || data.end_date) {
      const startDate = data.start_date || existingPeriod.start_date;
      const endDate = data.end_date || existingPeriod.end_date;

      // 日付の妥当性チェック
      if (new Date(startDate) >= new Date(endDate)) {
        return createValidationErrorResult('開始日は終了日より前である必要があります。');
      }

      // 重複チェック
      const hasOverlap = await checkPeriodOverlap(
        supabase,
        existingPeriod.organization_id,
        startDate,
        endDate,
        periodId
      );

      if (hasOverlap) {
        return createValidationErrorResult('指定された期間は他の会計期間と重複しています。');
      }

      // 仕訳がある場合、期間外になる仕訳がないかチェック
      const { data: journalEntries, error: journalError } = await supabase
        .from('journal_entries')
        .select('id, entry_date')
        .eq('accounting_period_id', periodId)
        .or(`entry_date.lt.${startDate},entry_date.gt.${endDate}`);

      if (!journalError && journalEntries && journalEntries.length > 0) {
        return createValidationErrorResult(
          '変更後の期間外となる仕訳が存在するため、期間を変更できません。'
        );
      }
    }

    // 更新実行
    const { data: updatedPeriod, error: updateError } = await supabase
      .from('accounting_periods')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', periodId)
      .select()
      .single();

    if (updateError) {
      return handleSupabaseError(updateError);
    }

    // 関連画面の再検証
    revalidatePath('/dashboard/accounting-periods');
    revalidatePath('/dashboard/journal-entries');

    return createSuccessResult(updatedPeriod);
  } catch (error) {
    return createErrorResult(ERROR_CODES.INTERNAL_ERROR, 'システムエラーが発生しました。', error);
  }
}

/**
 * 会計期間を閉じる（以降の仕訳入力を防ぐ）
 */
export async function closeAccountingPeriod(
  periodId: string
): Promise<ActionResult<AccountingPeriod>> {
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

    // 既存の会計期間を取得
    const { data: existingPeriod, error: fetchError } = await supabase
      .from('accounting_periods')
      .select('*, user_organizations!inner(role)')
      .eq('id', periodId)
      .eq('user_organizations.user_id', user.id)
      .single();

    if (fetchError || !existingPeriod) {
      return createNotFoundResult('会計期間');
    }

    // 権限チェック（admin または accountant のみ）
    const userRole = (
      existingPeriod as Record<string, unknown> & { user_organizations: Array<{ role: string }> }
    ).user_organizations[0]?.role;
    if (userRole === 'viewer') {
      return createForbiddenResult();
    }

    // すでに閉じられている場合
    if (existingPeriod.is_closed) {
      return createValidationErrorResult('この会計期間は既に閉じられています。');
    }

    // 未承認の仕訳がないかチェック
    const { data: pendingEntries, error: pendingError } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('accounting_period_id', periodId)
      .in('status', ['draft', 'pending'])
      .limit(1);

    if (!pendingError && pendingEntries && pendingEntries.length > 0) {
      return createValidationErrorResult(
        '未承認の仕訳が存在するため、会計期間を閉じることができません。'
      );
    }

    // 会計期間を閉じる
    const { data: closedPeriod, error: updateError } = await supabase
      .from('accounting_periods')
      .update({
        is_closed: true,
        closed_at: new Date().toISOString(),
        closed_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', periodId)
      .select()
      .single();

    if (updateError) {
      return handleSupabaseError(updateError);
    }

    // 関連画面の再検証
    revalidatePath('/dashboard/accounting-periods');
    revalidatePath('/dashboard/journal-entries');

    return createSuccessResult(closedPeriod);
  } catch (error) {
    return createErrorResult(ERROR_CODES.INTERNAL_ERROR, 'システムエラーが発生しました。', error);
  }
}

/**
 * 閉じられた会計期間を再度開く（管理者のみ）
 */
export async function reopenAccountingPeriod(
  periodId: string
): Promise<ActionResult<AccountingPeriod>> {
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

    // 既存の会計期間を取得
    const { data: existingPeriod, error: fetchError } = await supabase
      .from('accounting_periods')
      .select('*, user_organizations!inner(role)')
      .eq('id', periodId)
      .eq('user_organizations.user_id', user.id)
      .single();

    if (fetchError || !existingPeriod) {
      return createNotFoundResult('会計期間');
    }

    // 権限チェック（admin のみ）
    const userRole = (
      existingPeriod as Record<string, unknown> & { user_organizations: Array<{ role: string }> }
    ).user_organizations[0]?.role;
    if (userRole !== 'admin') {
      return createErrorResult(
        ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        '会計期間を再度開くには管理者権限が必要です。'
      );
    }

    // 開いている場合
    if (!existingPeriod.is_closed) {
      return createValidationErrorResult('この会計期間は既に開いています。');
    }

    // 会計期間を再度開く
    const { data: openedPeriod, error: updateError } = await supabase
      .from('accounting_periods')
      .update({
        is_closed: false,
        closed_at: null,
        closed_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', periodId)
      .select()
      .single();

    if (updateError) {
      return handleSupabaseError(updateError);
    }

    // 関連画面の再検証
    revalidatePath('/dashboard/accounting-periods');
    revalidatePath('/dashboard/journal-entries');

    return createSuccessResult(openedPeriod);
  } catch (error) {
    return createErrorResult(ERROR_CODES.INTERNAL_ERROR, 'システムエラーが発生しました。', error);
  }
}

/**
 * 会計期間を有効化（アクティブにする）
 * 注: 現在のスキーマではis_activeフィールドがないため、
 * 有効化は「現在の日付が期間内にあり、かつ閉じられていない」状態として扱う
 */
export async function activateAccountingPeriod(
  periodId: string
): Promise<ActionResult<AccountingPeriod>> {
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

    // 既存の会計期間を取得
    const { data: existingPeriod, error: fetchError } = await supabase
      .from('accounting_periods')
      .select('*, user_organizations!inner(role)')
      .eq('id', periodId)
      .eq('user_organizations.user_id', user.id)
      .single();

    if (fetchError || !existingPeriod) {
      return createNotFoundResult('会計期間');
    }

    // 権限チェック（admin または accountant のみ）
    const userRole = (
      existingPeriod as Record<string, unknown> & { user_organizations: Array<{ role: string }> }
    ).user_organizations[0]?.role;
    if (userRole === 'viewer') {
      return createForbiddenResult();
    }

    // すでに開いている場合は、そのまま返す
    if (!existingPeriod.is_closed) {
      return createSuccessResult(existingPeriod);
    }

    // 会計期間を開く（有効化）
    const { data: activatedPeriod, error: updateError } = await supabase
      .from('accounting_periods')
      .update({
        is_closed: false,
        closed_at: null,
        closed_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', periodId)
      .select()
      .single();

    if (updateError) {
      return handleSupabaseError(updateError);
    }

    // 関連画面の再検証
    revalidatePath('/dashboard/accounting-periods');
    revalidatePath('/dashboard/settings/accounting-periods');
    revalidatePath('/dashboard/journal-entries');

    return createSuccessResult(activatedPeriod);
  } catch (error) {
    return createErrorResult(ERROR_CODES.INTERNAL_ERROR, 'システムエラーが発生しました。', error);
  }
}

/**
 * 会計期間を削除（仕訳がない場合のみ）
 */
export async function deleteAccountingPeriod(
  periodId: string
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

    // 既存の会計期間を取得
    const { data: existingPeriod, error: fetchError } = await supabase
      .from('accounting_periods')
      .select('*, user_organizations!inner(role)')
      .eq('id', periodId)
      .eq('user_organizations.user_id', user.id)
      .single();

    if (fetchError || !existingPeriod) {
      return createNotFoundResult('会計期間');
    }

    // 権限チェック（admin のみ）
    const userRole = (
      existingPeriod as Record<string, unknown> & { user_organizations: Array<{ role: string }> }
    ).user_organizations[0]?.role;
    if (userRole !== 'admin') {
      return createErrorResult(
        ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        '会計期間を削除するには管理者権限が必要です。'
      );
    }

    // 仕訳が存在するかチェック
    const { data: journalEntries, error: journalError } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('accounting_period_id', periodId)
      .limit(1);

    if (!journalError && journalEntries && journalEntries.length > 0) {
      return createValidationErrorResult('この会計期間には仕訳が存在するため削除できません。');
    }

    // 他にアクティブな会計期間があるか確認
    const { data: otherPeriods, error: otherError } = await supabase
      .from('accounting_periods')
      .select('id')
      .eq('organization_id', existingPeriod.organization_id)
      .eq('is_closed', false)
      .neq('id', periodId)
      .limit(1);

    if (otherError) {
      return handleSupabaseError(otherError);
    }

    // 削除しようとしている期間が唯一のアクティブな期間の場合
    if (!existingPeriod.is_closed && (!otherPeriods || otherPeriods.length === 0)) {
      return createValidationErrorResult('最後のアクティブな会計期間は削除できません。');
    }

    // 会計期間を削除
    const { error: deleteError } = await supabase
      .from('accounting_periods')
      .delete()
      .eq('id', periodId);

    if (deleteError) {
      return handleSupabaseError(deleteError);
    }

    // 関連画面の再検証
    revalidatePath('/dashboard/accounting-periods');

    return createSuccessResult({ id: periodId });
  } catch (error) {
    return createErrorResult(ERROR_CODES.INTERNAL_ERROR, 'システムエラーが発生しました。', error);
  }
}
