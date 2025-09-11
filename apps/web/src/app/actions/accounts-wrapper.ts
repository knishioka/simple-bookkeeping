'use server';

import { getCurrentOrganizationId } from '@/lib/organization';

import * as accountsActions from './accounts';
import {
  ActionResult,
  QueryParams,
  PaginatedResponse,
  createErrorResult,
  ERROR_CODES,
} from './types';

import type { Database } from '@/lib/supabase/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];
type AccountInsert = Database['public']['Tables']['accounts']['Insert'];
type AccountUpdate = Database['public']['Tables']['accounts']['Update'];

/**
 * 勘定科目一覧を取得（組織ID自動取得版）
 */
export async function getAccountsWithAuth(
  params?: QueryParams
): Promise<ActionResult<PaginatedResponse<Account>>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return accountsActions.getAccounts(organizationId, params);
}

/**
 * 勘定科目を作成（組織ID自動取得版）
 */
export async function createAccountWithAuth(
  data: Omit<AccountInsert, 'id' | 'organization_id' | 'created_at' | 'updated_at'>
): Promise<ActionResult<Account>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return accountsActions.createAccount({
    ...data,
    organization_id: organizationId,
  } as Omit<AccountInsert, 'id' | 'created_at' | 'updated_at'>);
}

/**
 * 勘定科目を更新（組織ID自動取得版）
 */
export async function updateAccountWithAuth(
  id: string,
  data: Omit<AccountUpdate, 'id' | 'organization_id' | 'created_at' | 'updated_at'>
): Promise<ActionResult<Account>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return accountsActions.updateAccount(id, organizationId, data);
}

/**
 * 勘定科目を削除（組織ID自動取得版）
 */
export async function deleteAccountWithAuth(id: string): Promise<ActionResult<{ id: string }>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return accountsActions.deleteAccount(id, organizationId);
}

/**
 * CSVファイルから勘定科目をインポート（組織ID自動取得版）
 */
export async function importAccountsFromCSVWithAuth(
  formData: FormData
): Promise<ActionResult<{ imported: number; errors: Array<{ row: number; error: string }> }>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  // FormDataに組織IDを追加
  formData.append('organizationId', organizationId);

  return accountsActions.importAccountsFromCSV(formData);
}
