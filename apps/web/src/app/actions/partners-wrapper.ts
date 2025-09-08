'use server';

import { getCurrentOrganizationId } from '@/lib/organization';

import * as partnersActions from './partners';
import {
  ActionResult,
  QueryParams,
  PaginatedResponse,
  createErrorResult,
  ERROR_CODES,
} from './types';

import type { Database } from '@/lib/supabase/database.types';

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
  total_receivable: number;
  total_payable: number;
  net_balance: number;
  last_transaction_date: string | null;
}

/**
 * 取引先一覧を取得（組織ID自動取得版）
 */
export async function getPartnersWithAuth(
  params?: QueryParams & { partner_type?: PartnerType; is_active?: boolean }
): Promise<ActionResult<PaginatedResponse<Partner>>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return partnersActions.getPartners(organizationId, params);
}

/**
 * 取引先詳細を取得（組織ID自動取得版）
 */
export async function getPartnerWithAuth(id: string): Promise<ActionResult<Partner>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return partnersActions.getPartner(id, organizationId);
}

/**
 * 取引先を作成（組織ID自動取得版）
 */
export async function createPartnerWithAuth(
  data: Omit<PartnerInsert, 'id' | 'organization_id' | 'created_at' | 'updated_at'>
): Promise<ActionResult<Partner>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return partnersActions.createPartner({
    ...data,
    organization_id: organizationId,
  });
}

/**
 * 取引先を更新（組織ID自動取得版）
 */
export async function updatePartnerWithAuth(
  id: string,
  data: Omit<PartnerUpdate, 'id' | 'organization_id' | 'created_at' | 'updated_at'>
): Promise<ActionResult<Partner>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return partnersActions.updatePartner(id, organizationId, data);
}

/**
 * 取引先を削除（組織ID自動取得版）
 */
export async function deletePartnerWithAuth(id: string): Promise<ActionResult<{ id: string }>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return partnersActions.deletePartner(id, organizationId);
}

/**
 * 取引先の取引履歴を取得（組織ID自動取得版）
 */
export async function getPartnerTransactionsWithAuth(
  partnerId: string,
  params?: {
    from_date?: string;
    to_date?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<ActionResult<PaginatedResponse<PartnerTransaction>>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return partnersActions.getPartnerTransactions(partnerId, organizationId, params);
}

/**
 * 取引先の残高を取得（組織ID自動取得版）
 */
export async function getPartnerBalanceWithAuth(
  partnerId: string,
  asOfDate?: string
): Promise<ActionResult<PartnerBalance>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return partnersActions.getPartnerBalance(partnerId, organizationId, asOfDate);
}
