'use server';

import type { Database } from '@/lib/supabase/database.types';

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
import { createPartnerSchema, updatePartnerSchema } from './validation/partners';

type Partner = Database['public']['Tables']['partners']['Row'];
type PartnerInsert = Database['public']['Tables']['partners']['Insert'];
type PartnerUpdate = Database['public']['Tables']['partners']['Update'];
type PartnerType = 'customer' | 'supplier' | 'both';

interface PartnerTransaction {
  id: string;
  journal_entry_id: string;
  date: string;
  entry_number: string;
  description: string;
  account_code: string;
  account_name: string;
  debit_amount: number;
  credit_amount: number;
  balance?: number;
}

interface PartnerBalance {
  partner_id: string;
  partner_name: string;
  partner_type: PartnerType;
  total_receivable: number; // 売掛金残高
  total_payable: number; // 買掛金残高
  net_balance: number; // 差引残高
  last_transaction_date: string | null;
}

/**
 * 取引先一覧を取得
 */
export async function getPartners(
  organizationId: string,
  params?: QueryParams & { partner_type?: PartnerType; is_active?: boolean }
): Promise<ActionResult<PaginatedResponse<Partner>>> {
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
        'この組織の取引先を表示する権限がありません。'
      );
    }

    // ページネーション設定
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // クエリ構築
    let query = supabase
      .from('partners')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId);

    // 検索条件
    if (params?.search) {
      query = query.or(
        `name.ilike.%${params.search}%,name_kana.ilike.%${params.search}%,code.ilike.%${params.search}%`
      );
    }

    // パートナータイプでフィルター
    if (params?.partner_type) {
      query = query.eq('partner_type', params.partner_type);
    }

    // アクティブ状態でフィルター
    if (params?.is_active !== undefined) {
      query = query.eq('is_active', params.is_active);
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
 * 取引先詳細を取得
 */
export async function getPartner(
  id: string,
  organizationId: string
): Promise<ActionResult<Partner>> {
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
        'この組織の取引先を表示する権限がありません。'
      );
    }

    // 取引先を取得
    const { data: partner, error } = await supabase
      .from('partners')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return createNotFoundResult('取引先');
      }
      return handleSupabaseError(error);
    }

    if (!partner) {
      return createNotFoundResult('取引先');
    }

    return createSuccessResult(partner);
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * 取引先を作成
 */
export async function createPartner(
  data: Omit<PartnerInsert, 'id' | 'created_at' | 'updated_at'>
): Promise<ActionResult<Partner>> {
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
        'この組織の取引先を作成する権限がありません。'
      );
    }

    if (userOrg.role === 'viewer') {
      return createErrorResult(
        ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        '閲覧者は取引先を作成できません。'
      );
    }

    // Zodによるバリデーション
    const validationResult = createPartnerSchema.safeParse(data);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.reduce(
        (acc: Record<string, string>, error) => {
          const field = error.path[0] as string;
          acc[field] = error.message;
          return acc;
        },
        {} as Record<string, string>
      );
      return createValidationErrorResult('入力内容にエラーがあります。', errors);
    }

    const validatedData = validationResult.data;

    // 取引先コードの重複チェック
    const { data: existingPartner } = await supabase
      .from('partners')
      .select('id')
      .eq('organization_id', data.organization_id)
      .eq('code', validatedData.code)
      .single();

    if (existingPartner) {
      return createErrorResult(
        ERROR_CODES.ALREADY_EXISTS,
        `取引先コード「${validatedData.code}」は既に使用されています。`
      );
    }

    // 取引先を作成
    const { data: newPartner, error } = await supabase
      .from('partners')
      .insert({
        ...validatedData,
        organization_id: data.organization_id,
        is_active: validatedData.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      return handleSupabaseError(error);
    }

    // キャッシュを再検証
    revalidatePath('/dashboard/partners');

    return createSuccessResult(newPartner);
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * 取引先を更新
 */
export async function updatePartner(
  id: string,
  organizationId: string,
  data: Omit<PartnerUpdate, 'id' | 'organization_id' | 'created_at' | 'updated_at'>
): Promise<ActionResult<Partner>> {
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
        'この組織の取引先を更新する権限がありません。'
      );
    }

    if (userOrg.role === 'viewer') {
      return createErrorResult(
        ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        '閲覧者は取引先を更新できません。'
      );
    }

    // 更新対象の取引先の存在チェック
    const { data: existingPartner } = await supabase
      .from('partners')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (!existingPartner) {
      return createNotFoundResult('取引先');
    }

    // Zodによるバリデーション
    const validationResult = updatePartnerSchema.safeParse(data);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.reduce(
        (acc: Record<string, string>, error) => {
          const field = error.path[0] as string;
          acc[field] = error.message;
          return acc;
        },
        {} as Record<string, string>
      );
      return createValidationErrorResult('入力内容にエラーがあります。', errors);
    }

    const validatedData = validationResult.data;

    // 取引先コードを変更する場合、重複チェック
    if (validatedData.code && validatedData.code !== existingPartner.code) {
      const { data: duplicatePartner } = await supabase
        .from('partners')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('code', validatedData.code)
        .neq('id', id)
        .single();

      if (duplicatePartner) {
        return createErrorResult(
          ERROR_CODES.ALREADY_EXISTS,
          `取引先コード「${validatedData.code}」は既に使用されています。`
        );
      }
    }

    // 取引先を更新
    const { data: updatedPartner, error } = await supabase
      .from('partners')
      .update({
        ...validatedData,
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
    revalidatePath('/dashboard/partners');
    revalidatePath(`/dashboard/partners/${id}`);

    return createSuccessResult(updatedPartner);
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * 取引先を削除
 */
export async function deletePartner(
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
        'この組織の取引先を削除する権限がありません。'
      );
    }

    if (userOrg.role !== 'admin') {
      return createErrorResult(
        ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        '管理者のみが取引先を削除できます。'
      );
    }

    // 削除対象の取引先の存在チェック
    const { data: existingPartner } = await supabase
      .from('partners')
      .select('*')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (!existingPartner) {
      return createNotFoundResult('取引先');
    }

    // 仕訳明細での使用チェック
    const { count } = await supabase
      .from('journal_entry_lines')
      .select('id', { count: 'exact', head: true })
      .eq('partner_id', id);

    if (count && count > 0) {
      return createErrorResult(
        ERROR_CODES.CONSTRAINT_VIOLATION,
        'この取引先は仕訳で使用されているため削除できません。'
      );
    }

    // 取引先を削除
    const { error } = await supabase
      .from('partners')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) {
      return handleSupabaseError(error);
    }

    // キャッシュを再検証
    revalidatePath('/dashboard/partners');

    return createSuccessResult({ id });
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * 取引先の取引履歴を取得
 */
export async function getPartnerTransactions(
  partnerId: string,
  organizationId: string,
  params?: {
    from_date?: string;
    to_date?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<ActionResult<PaginatedResponse<PartnerTransaction>>> {
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
        'この組織の取引履歴を表示する権限がありません。'
      );
    }

    // 取引先の存在チェック
    const { data: partner } = await supabase
      .from('partners')
      .select('id, name')
      .eq('id', partnerId)
      .eq('organization_id', organizationId)
      .single();

    if (!partner) {
      return createNotFoundResult('取引先');
    }

    // ページネーション設定
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 仕訳明細と仕訳、勘定科目を結合して取得
    let query = supabase
      .from('journal_entry_lines')
      .select(
        `
        id,
        journal_entry_id,
        debit_amount,
        credit_amount,
        description,
        journal_entries!inner (
          date,
          entry_number,
          description,
          organization_id
        ),
        accounts!inner (
          code,
          name
        )
      `,
        { count: 'exact' }
      )
      .eq('partner_id', partnerId)
      .eq('journal_entries.organization_id', organizationId);

    // 日付範囲でフィルター
    if (params?.from_date) {
      query = query.gte('journal_entries.date', params.from_date);
    }
    if (params?.to_date) {
      query = query.lte('journal_entries.date', params.to_date);
    }

    // 日付の降順でソート
    query = query.order('journal_entries(date)', { ascending: false });

    // ページネーション適用
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return handleSupabaseError(error);
    }

    // データを整形
    const transactions: PartnerTransaction[] = (data || []).map((line) => {
      // Supabaseの結合クエリの結果を型アサーション
      const typedLine = line as unknown as {
        id: string;
        journal_entry_id: string;
        debit_amount: number;
        credit_amount: number;
        description: string | null;
        journal_entries: {
          date: string;
          entry_number: string;
          description: string;
        } | null;
        accounts: {
          code: string;
          name: string;
        } | null;
      };

      return {
        id: typedLine.id,
        journal_entry_id: typedLine.journal_entry_id,
        date: typedLine.journal_entries?.date || '',
        entry_number: typedLine.journal_entries?.entry_number || '',
        description: typedLine.description || typedLine.journal_entries?.description || '',
        account_code: typedLine.accounts?.code || '',
        account_name: typedLine.accounts?.name || '',
        debit_amount: typedLine.debit_amount,
        credit_amount: typedLine.credit_amount,
      };
    });

    // 残高を計算（累計）
    let balance = 0;
    for (const transaction of transactions.reverse()) {
      balance += transaction.debit_amount - transaction.credit_amount;
      transaction.balance = balance;
    }
    transactions.reverse();

    return createSuccessResult({
      items: transactions,
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
 * 取引先の残高を取得（売掛金・買掛金）
 */
export async function getPartnerBalance(
  partnerId: string,
  organizationId: string,
  asOfDate?: string
): Promise<ActionResult<PartnerBalance>> {
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
      return createErrorResult(ERROR_CODES.FORBIDDEN, 'この組織の残高を表示する権限がありません。');
    }

    // 取引先情報を取得
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, name, partner_type')
      .eq('id', partnerId)
      .eq('organization_id', organizationId)
      .single();

    if (partnerError || !partner) {
      return createNotFoundResult('取引先');
    }

    // 売掛金・買掛金に関連する勘定科目を取得
    const { data: receivableAccounts, error: receivableError } = await supabase
      .from('accounts')
      .select('id')
      .eq('organization_id', organizationId)
      .in('code', ['1210', '1211', '1212', '1213']); // 売掛金関連の勘定科目コード

    const { data: payableAccounts, error: payableError } = await supabase
      .from('accounts')
      .select('id')
      .eq('organization_id', organizationId)
      .in('code', ['2110', '2111', '2112', '2113']); // 買掛金関連の勘定科目コード

    if (receivableError || payableError) {
      return handleSupabaseError(receivableError || payableError);
    }

    const receivableAccountIds = (receivableAccounts || []).map((a) => a.id);
    const payableAccountIds = (payableAccounts || []).map((a) => a.id);

    // 仕訳明細から残高を集計
    let receivableQuery = supabase
      .from('journal_entry_lines')
      .select(
        `
        debit_amount,
        credit_amount,
        journal_entries!inner (
          date,
          organization_id
        )
      `
      )
      .eq('partner_id', partnerId)
      .eq('journal_entries.organization_id', organizationId);

    let payableQuery = supabase
      .from('journal_entry_lines')
      .select(
        `
        debit_amount,
        credit_amount,
        journal_entries!inner (
          date,
          organization_id
        )
      `
      )
      .eq('partner_id', partnerId)
      .eq('journal_entries.organization_id', organizationId);

    // 売掛金勘定でフィルター
    if (receivableAccountIds.length > 0) {
      receivableQuery = receivableQuery.in('account_id', receivableAccountIds);
    } else {
      receivableQuery = receivableQuery.eq('account_id', 'dummy'); // 該当なしにする
    }

    // 買掛金勘定でフィルター
    if (payableAccountIds.length > 0) {
      payableQuery = payableQuery.in('account_id', payableAccountIds);
    } else {
      payableQuery = payableQuery.eq('account_id', 'dummy'); // 該当なしにする
    }

    // 基準日でフィルター
    if (asOfDate) {
      receivableQuery = receivableQuery.lte('journal_entries.date', asOfDate);
      payableQuery = payableQuery.lte('journal_entries.date', asOfDate);
    }

    const [receivableResult, payableResult] = await Promise.all([receivableQuery, payableQuery]);

    if (receivableResult.error || payableResult.error) {
      return handleSupabaseError(receivableResult.error || payableResult.error);
    }

    // 売掛金残高を計算（借方 - 貸方）
    let totalReceivable = 0;
    for (const line of receivableResult.data || []) {
      totalReceivable += line.debit_amount - line.credit_amount;
    }

    // 買掛金残高を計算（貸方 - 借方）
    let totalPayable = 0;
    for (const line of payableResult.data || []) {
      totalPayable += line.credit_amount - line.debit_amount;
    }

    // 最終取引日を取得
    const { data: lastTransactionData } = await supabase
      .from('journal_entry_lines')
      .select(
        `
        journal_entry_id,
        journal_entries!inner (
          date,
          organization_id
        )
      `
      )
      .eq('partner_id', partnerId)
      .eq('journal_entries.organization_id', organizationId)
      .order('journal_entries(date)', { ascending: false })
      .limit(1)
      .single();

    // 取引データから日付を取得
    const lastTransactionDate = lastTransactionData
      ? (
          lastTransactionData as unknown as {
            journal_entry_id: string;
            journal_entries: {
              date: string;
              organization_id: string;
            } | null;
          }
        ).journal_entries?.date
      : null;

    const balance: PartnerBalance = {
      partner_id: partner.id,
      partner_name: partner.name,
      partner_type: partner.partner_type as PartnerType,
      total_receivable: totalReceivable,
      total_payable: totalPayable,
      net_balance: totalReceivable - totalPayable,
      last_transaction_date: lastTransactionDate || null,
    };

    return createSuccessResult(balance);
  } catch (error) {
    return handleSupabaseError(error);
  }
}
