'use server';

import { getCurrentOrganizationId } from '@/lib/organization';

import * as accountingPeriodsActions from './accounting-periods';
import {
  ActionResult,
  QueryParams,
  PaginatedResponse,
  createErrorResult,
  ERROR_CODES,
} from './types';

import type { Database } from '@/lib/supabase/database.types';

type AccountingPeriod = Database['public']['Tables']['accounting_periods']['Row'];
type AccountingPeriodInsert = Database['public']['Tables']['accounting_periods']['Insert'];
type AccountingPeriodUpdate = Database['public']['Tables']['accounting_periods']['Update'];

/**
 * 会計期間一覧を取得（組織ID自動取得版）
 */
export async function getAccountingPeriodsWithAuth(
  params?: QueryParams
): Promise<ActionResult<PaginatedResponse<AccountingPeriod>>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return accountingPeriodsActions.getAccountingPeriods(organizationId, params);
}

/**
 * 現在のアクティブな会計期間を取得（組織ID自動取得版）
 */
export async function getActiveAccountingPeriodWithAuth(): Promise<
  ActionResult<AccountingPeriod | null>
> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return accountingPeriodsActions.getActiveAccountingPeriod(organizationId);
}

/**
 * 新規会計期間を作成（組織ID自動取得版）
 */
export async function createAccountingPeriodWithAuth(
  data: Omit<AccountingPeriodInsert, 'organization_id' | 'id' | 'created_at' | 'updated_at'>
): Promise<ActionResult<AccountingPeriod>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return accountingPeriodsActions.createAccountingPeriod(organizationId, data);
}

/**
 * 会計期間を更新（組織ID自動取得版）
 */
export async function updateAccountingPeriodWithAuth(
  periodId: string,
  data: Omit<AccountingPeriodUpdate, 'id' | 'organization_id' | 'created_at' | 'updated_at'>
): Promise<ActionResult<AccountingPeriod>> {
  return accountingPeriodsActions.updateAccountingPeriod(periodId, data);
}

/**
 * 会計期間を閉じる（組織ID自動取得版）
 */
export async function closeAccountingPeriodWithAuth(
  periodId: string
): Promise<ActionResult<AccountingPeriod>> {
  return accountingPeriodsActions.closeAccountingPeriod(periodId);
}

/**
 * 閉じられた会計期間を再度開く（組織ID自動取得版）
 */
export async function reopenAccountingPeriodWithAuth(
  periodId: string
): Promise<ActionResult<AccountingPeriod>> {
  return accountingPeriodsActions.reopenAccountingPeriod(periodId);
}

/**
 * 会計期間を削除（組織ID自動取得版）
 */
export async function deleteAccountingPeriodWithAuth(
  periodId: string
): Promise<ActionResult<{ id: string }>> {
  return accountingPeriodsActions.deleteAccountingPeriod(periodId);
}

/**
 * 会計期間を有効化（組織ID自動取得版）
 * 指定された会計期間をアクティブにする
 */
export async function activateAccountingPeriodWithAuth(
  periodId: string
): Promise<ActionResult<AccountingPeriod>> {
  return accountingPeriodsActions.activateAccountingPeriod(periodId);
}
