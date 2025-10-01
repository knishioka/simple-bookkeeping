/**
 * 監査ログシステム統合例
 *
 * このファイルは、既存のServer Actionsに監査ログを統合する方法を示す例です。
 * 実際の実装では、各Server Actionファイルに直接統合してください。
 */

'use server';

import { auditEntityChange } from './audit-logs';
import {
  ActionResult,
  createSuccessResult,
  createUnauthorizedResult,
  handleSupabaseError,
} from './types';

import { createClient } from '@/lib/supabase/server';

/**
 * 勘定科目作成の例（監査ログ付き）
 */
export async function createAccountWithAudit(data: {
  code: string;
  name: string;
  account_type: string;
  category: string;
  organization_id: string;
  parent_account_id?: string;
  is_active?: boolean;
}): Promise<ActionResult<Record<string, unknown>>> {
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

    // 勘定科目を作成
    const { data: newAccount, error } = await supabase
      .from('accounts')
      .insert(data)
      .select()
      .single();

    if (error) {
      return handleSupabaseError(error);
    }

    // 監査ログを記録（非同期で実行、エラーがあっても本処理は継続）
    await auditEntityChange({
      user: { id: user.id },
      action: 'CREATE',
      entityType: 'account',
      entityId: newAccount.id,
      organizationId: data.organization_id,
      newValues: newAccount,
      description: `勘定科目「${newAccount.name}」を作成しました`,
    });

    return createSuccessResult(newAccount);
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * 勘定科目更新の例（監査ログ付き）
 */
export async function updateAccountWithAudit(
  accountId: string,
  organizationId: string,
  updates: {
    name?: string;
    is_active?: boolean;
    category?: string;
  }
): Promise<ActionResult<Record<string, unknown>>> {
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

    // 更新前のデータを取得
    const { data: oldAccount, error: fetchError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError) {
      return handleSupabaseError(fetchError);
    }

    // 勘定科目を更新
    const { data: updatedAccount, error: updateError } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', accountId)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (updateError) {
      return handleSupabaseError(updateError);
    }

    // 監査ログを記録
    await auditEntityChange({
      user: { id: user.id },
      action: 'UPDATE',
      entityType: 'account',
      entityId: accountId,
      organizationId,
      oldValues: oldAccount,
      newValues: updatedAccount,
      description: `勘定科目「${updatedAccount.name}」を更新しました`,
    });

    return createSuccessResult(updatedAccount);
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * 勘定科目削除の例（監査ログ付き）
 */
export async function deleteAccountWithAudit(
  accountId: string,
  organizationId: string
): Promise<ActionResult<void>> {
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

    // 削除前のデータを取得
    const { data: accountToDelete, error: fetchError } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError) {
      return handleSupabaseError(fetchError);
    }

    // 勘定科目を削除
    const { error: deleteError } = await supabase
      .from('accounts')
      .delete()
      .eq('id', accountId)
      .eq('organization_id', organizationId);

    if (deleteError) {
      return handleSupabaseError(deleteError);
    }

    // 監査ログを記録
    await auditEntityChange({
      user: { id: user.id },
      action: 'DELETE',
      entityType: 'account',
      entityId: accountId,
      organizationId,
      oldValues: accountToDelete,
      description: `勘定科目「${accountToDelete.name}」を削除しました`,
    });

    return createSuccessResult(undefined);
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * 仕訳承認の例（監査ログ付き）
 */
export async function approveJournalEntryWithAudit(
  entryId: string,
  organizationId: string
): Promise<ActionResult<Record<string, unknown>>> {
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

    // 承認前の状態を取得
    const { data: oldEntry, error: fetchError } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', entryId)
      .eq('organization_id', organizationId)
      .single();

    if (fetchError) {
      return handleSupabaseError(fetchError);
    }

    // 仕訳を承認
    const { data: approvedEntry, error: approveError } = await supabase
      .from('journal_entries')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (approveError) {
      return handleSupabaseError(approveError);
    }

    // 監査ログを記録
    await auditEntityChange({
      user: { id: user.id },
      action: 'APPROVE',
      entityType: 'journal_entry',
      entityId: entryId,
      organizationId,
      oldValues: { status: oldEntry.status },
      newValues: {
        status: approvedEntry.status,
        approved_by: approvedEntry.approved_by,
        approved_at: approvedEntry.approved_at,
      },
      description: `仕訳「${approvedEntry.description}」を承認しました`,
    });

    return createSuccessResult(approvedEntry);
  } catch (error) {
    return handleSupabaseError(error);
  }
}
