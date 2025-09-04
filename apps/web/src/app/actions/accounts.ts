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

type Account = Database['public']['Tables']['accounts']['Row'];
type AccountInsert = Database['public']['Tables']['accounts']['Insert'];
type AccountUpdate = Database['public']['Tables']['accounts']['Update'];

/**
 * 勘定科目一覧を取得
 */
export async function getAccounts(
  organizationId: string,
  params?: QueryParams
): Promise<ActionResult<PaginatedResponse<Account>>> {
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
        'この組織の勘定科目を表示する権限がありません。'
      );
    }

    // ページネーション設定
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // クエリ構築
    let query = supabase
      .from('accounts')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId);

    // 検索条件
    if (params?.search) {
      query = query.or(`name.ilike.%${params.search}%,code.ilike.%${params.search}%`);
    }

    // ソート
    const orderBy = params?.orderBy || 'code';
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
 * 勘定科目を作成
 */
export async function createAccount(
  data: Omit<AccountInsert, 'id' | 'created_at' | 'updated_at'>
): Promise<ActionResult<Account>> {
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

    // 組織へのアクセス権限チェック（admin または accountant のみ作成可能）
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', data.organization_id)
      .single();

    if (orgError || !userOrg) {
      return createErrorResult(
        ERROR_CODES.FORBIDDEN,
        'この組織の勘定科目を作成する権限がありません。'
      );
    }

    if (userOrg.role === 'viewer') {
      return createErrorResult(
        ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        '閲覧者は勘定科目を作成できません。'
      );
    }

    // バリデーション
    if (!data.code || !data.name || !data.account_type || !data.category) {
      return createValidationErrorResult('必須項目が入力されていません。', {
        code: !data.code ? '勘定科目コードは必須です' : undefined,
        name: !data.name ? '勘定科目名は必須です' : undefined,
        account_type: !data.account_type ? '勘定科目区分は必須です' : undefined,
        category: !data.category ? 'カテゴリは必須です' : undefined,
      });
    }

    // 勘定科目コードの重複チェック
    const { data: existingAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('organization_id', data.organization_id)
      .eq('code', data.code)
      .single();

    if (existingAccount) {
      return createErrorResult(
        ERROR_CODES.ALREADY_EXISTS,
        `勘定科目コード「${data.code}」は既に使用されています。`
      );
    }

    // 親勘定科目の存在チェック
    if (data.parent_account_id) {
      const { data: parentAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('organization_id', data.organization_id)
        .eq('id', data.parent_account_id)
        .single();

      if (!parentAccount) {
        return createValidationErrorResult('指定された親勘定科目が存在しません。');
      }
    }

    // 勘定科目を作成
    const { data: newAccount, error } = await supabase
      .from('accounts')
      .insert(data)
      .select()
      .single();

    if (error) {
      return handleSupabaseError(error);
    }

    // キャッシュを再検証
    revalidatePath('/dashboard/accounts');
    revalidatePath(`/api/v1/accounts`);

    return createSuccessResult(newAccount);
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * 勘定科目を更新
 */
export async function updateAccount(
  id: string,
  organizationId: string,
  data: Omit<AccountUpdate, 'id' | 'organization_id' | 'created_at' | 'updated_at'>
): Promise<ActionResult<Account>> {
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
      return createErrorResult(
        ERROR_CODES.FORBIDDEN,
        'この組織の勘定科目を更新する権限がありません。'
      );
    }

    if (userOrg.role === 'viewer') {
      return createErrorResult(
        ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        '閲覧者は勘定科目を更新できません。'
      );
    }

    // 更新対象の勘定科目の存在チェック
    const { data: existingAccount } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (!existingAccount) {
      return createNotFoundResult('勘定科目');
    }

    // 勘定科目コードを変更する場合、重複チェック
    if (data.code && data.code !== existingAccount.code) {
      const { data: duplicateAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('code', data.code)
        .neq('id', id)
        .single();

      if (duplicateAccount) {
        return createErrorResult(
          ERROR_CODES.ALREADY_EXISTS,
          `勘定科目コード「${data.code}」は既に使用されています。`
        );
      }
    }

    // 親勘定科目の存在チェック
    if (data.parent_account_id) {
      // 自分自身を親にできない
      if (data.parent_account_id === id) {
        return createValidationErrorResult(
          '勘定科目を自分自身の親勘定科目に設定することはできません。'
        );
      }

      const { data: parentAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('id', data.parent_account_id)
        .single();

      if (!parentAccount) {
        return createValidationErrorResult('指定された親勘定科目が存在しません。');
      }
    }

    // 勘定科目を更新
    const { data: updatedAccount, error } = await supabase
      .from('accounts')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      return handleSupabaseError(error);
    }

    // キャッシュを再検証
    revalidatePath('/dashboard/accounts');
    revalidatePath(`/api/v1/accounts`);

    return createSuccessResult(updatedAccount);
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * 勘定科目を削除
 */
export async function deleteAccount(
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
      return createErrorResult(
        ERROR_CODES.FORBIDDEN,
        'この組織の勘定科目を削除する権限がありません。'
      );
    }

    if (userOrg.role !== 'admin') {
      return createErrorResult(
        ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        '管理者のみが勘定科目を削除できます。'
      );
    }

    // 削除対象の勘定科目の存在チェック
    const { data: existingAccount } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (!existingAccount) {
      return createNotFoundResult('勘定科目');
    }

    // 仕訳明細での使用チェック
    const { count } = await supabase
      .from('journal_entry_lines')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', id);

    if (count && count > 0) {
      return createErrorResult(
        ERROR_CODES.CONSTRAINT_VIOLATION,
        'この勘定科目は仕訳で使用されているため削除できません。'
      );
    }

    // 子勘定科目の存在チェック
    const { count: childCount } = await supabase
      .from('accounts')
      .select('id', { count: 'exact', head: true })
      .eq('parent_account_id', id);

    if (childCount && childCount > 0) {
      return createErrorResult(
        ERROR_CODES.CONSTRAINT_VIOLATION,
        'この勘定科目には子勘定科目が存在するため削除できません。'
      );
    }

    // 勘定科目を削除
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      return handleSupabaseError(error);
    }

    // キャッシュを再検証
    revalidatePath('/dashboard/accounts');
    revalidatePath(`/api/v1/accounts`);

    return createSuccessResult({ id });
  } catch (error) {
    return handleSupabaseError(error);
  }
}
