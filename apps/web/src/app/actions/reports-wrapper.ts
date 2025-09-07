'use server';

import { getCurrentOrganizationId } from '@/lib/organization';

import * as reportsActions from './reports';
import { ActionResult, createErrorResult, ERROR_CODES } from './types';

import type { BalanceSheet, IncomeStatement, TrialBalance, GeneralLedgerAccount } from './reports';

/**
 * 貸借対照表を取得（組織ID自動取得版）
 */
export async function getBalanceSheetWithAuth(
  reportDate: string,
  accountingPeriodId?: string
): Promise<ActionResult<BalanceSheet>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return reportsActions.getBalanceSheet(organizationId, reportDate, accountingPeriodId);
}

/**
 * 損益計算書を取得（組織ID自動取得版）
 */
export async function getIncomeStatementWithAuth(
  startDate: string,
  endDate: string,
  accountingPeriodId?: string
): Promise<ActionResult<IncomeStatement>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return reportsActions.getIncomeStatement(organizationId, startDate, endDate, accountingPeriodId);
}

/**
 * 試算表を取得（組織ID自動取得版）
 */
export async function getTrialBalanceWithAuth(
  startDate: string,
  endDate: string,
  accountingPeriodId?: string
): Promise<ActionResult<TrialBalance>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return reportsActions.getTrialBalance(organizationId, startDate, endDate, accountingPeriodId);
}

/**
 * 総勘定元帳を取得（組織ID自動取得版）
 */
export async function getGeneralLedgerWithAuth(
  startDate: string,
  endDate: string,
  accountIds?: string[],
  accountingPeriodId?: string
): Promise<ActionResult<GeneralLedgerAccount[]>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  const result = await reportsActions.getGeneralLedger(
    organizationId,
    startDate,
    endDate,
    accountIds,
    accountingPeriodId
  );

  if (result.success) {
    // Extract the accounts array from the GeneralLedger object
    return {
      success: true,
      data: result.data.accounts,
    };
  }

  return result as ActionResult<GeneralLedgerAccount[]>;
}

/**
 * キャッシュフロー計算書を取得（組織ID自動取得版）
 */
export async function getCashFlowStatementWithAuth(
  startDate: string,
  endDate: string,
  accountingPeriodId?: string
): Promise<ActionResult<unknown>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return reportsActions.getCashFlowStatement(
    organizationId,
    startDate,
    endDate,
    accountingPeriodId
  );
}
