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
 * CSVファイルから勘定科目をインポート
 */
export async function importAccountsFromCSV(
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

    if (!file || !organizationId) {
      return createValidationErrorResult('ファイルと組織IDは必須です。');
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
        'この組織の勘定科目をインポートする権限がありません。'
      );
    }

    if (userOrg.role === 'viewer') {
      return createErrorResult(
        ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        '閲覧者は勘定科目をインポートできません。'
      );
    }

    // ファイルサイズチェック（5MB制限）
    if (file.size > 5 * 1024 * 1024) {
      return createValidationErrorResult('ファイルサイズは5MB以下にしてください。');
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
    const successfulImports: Account[] = [];
    const accountTypeMap: Record<string, string> = {
      ASSET: 'asset',
      LIABILITY: 'liability',
      EQUITY: 'equity',
      REVENUE: 'revenue',
      EXPENSE: 'expense',
      資産: 'asset',
      負債: 'liability',
      資本: 'equity',
      純資産: 'equity',
      収益: 'revenue',
      費用: 'expense',
    };

    const categoryMap: Record<string, string> = {
      asset: 'current_assets',
      liability: 'current_liabilities',
      equity: 'capital',
      revenue: 'sales',
      expense: 'operating_expenses',
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2; // ヘッダー行を考慮

      try {
        // 必須フィールドのチェック
        const code = record.code || record.コード || record['勘定科目コード'];
        const name = record.name || record.名称 || record['勘定科目名'];
        const accountTypeRaw =
          record.accountType || record.type || record['勘定科目区分'] || record.区分;

        if (!code || !name || !accountTypeRaw) {
          errors.push({
            row: rowNumber,
            error: '必須項目（code, name, accountType）が不足しています。',
          });
          continue;
        }

        // 勘定科目タイプの変換
        const accountType =
          accountTypeMap[accountTypeRaw.toUpperCase()] || accountTypeMap[accountTypeRaw];
        if (!accountType) {
          errors.push({
            row: rowNumber,
            error: `不正な勘定科目区分: ${accountTypeRaw}`,
          });
          continue;
        }

        // カテゴリーの決定
        const category = categoryMap[accountType];

        // 勘定科目コードの重複チェック
        const { data: existingAccount } = await supabase
          .from('accounts')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('code', code)
          .single();

        if (existingAccount) {
          errors.push({
            row: rowNumber,
            error: `勘定科目コード「${code}」は既に使用されています。`,
          });
          continue;
        }

        // 勘定科目を作成
        const { data: newAccount, error: createError } = await supabase
          .from('accounts')
          .insert({
            organization_id: organizationId,
            code,
            name,
            account_type: accountType,
            category,
            description: record.description || record.備考 || null,
            is_active: true,
          })
          .select()
          .single();

        if (createError) {
          errors.push({
            row: rowNumber,
            error: `作成エラー: ${createError.message}`,
          });
          continue;
        }

        successfulImports.push(newAccount);
      } catch (error) {
        errors.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : '不明なエラーが発生しました。',
        });
      }
    }

    // キャッシュを再検証
    if (successfulImports.length > 0) {
      revalidatePath('/dashboard/accounts');
      revalidatePath(`/api/v1/accounts`);
    }

    return createSuccessResult({
      imported: successfulImports.length,
      errors,
    });
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
