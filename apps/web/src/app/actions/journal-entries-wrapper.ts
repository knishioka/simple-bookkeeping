'use server';

import { getCurrentOrganizationId } from '@/lib/organization';

import * as journalEntriesActions from './journal-entries';
import {
  ActionResult,
  QueryParams,
  PaginatedResponse,
  createErrorResult,
  ERROR_CODES,
} from './types';

import type { Database } from '@/lib/supabase/database.types';

type JournalEntry = Database['public']['Tables']['journal_entries']['Row'];
type JournalEntryLine = Database['public']['Tables']['journal_entry_lines']['Row'];

// Extended types for frontend compatibility
interface JournalEntryWithLines extends JournalEntry {
  lines: (JournalEntryLine & {
    account?: {
      id: string;
      code: string;
      name: string;
    };
  })[];
  totalAmount?: number;
}

/**
 * 仕訳一覧を取得（組織ID自動取得版）
 */
export async function getJournalEntriesWithAuth(
  params?: QueryParams & {
    accountingPeriodId?: string;
    status?: JournalEntry['status'];
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<ActionResult<PaginatedResponse<JournalEntryWithLines>>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  // Get journal entries
  const result = await journalEntriesActions.getJournalEntries(organizationId, params);

  if (!result.success) {
    return result as ActionResult<PaginatedResponse<JournalEntryWithLines>>;
  }

  // Fetch lines and account info for each entry
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const entriesWithLines = await Promise.all(
    result.data.items.map(async (entry) => {
      const { data: lines } = await supabase
        .from('journal_entry_lines')
        .select(
          `
          *,
          accounts (
            id,
            code,
            name
          )
        `
        )
        .eq('journal_entry_id', entry.id);

      const totalAmount =
        lines?.reduce((sum, line) => {
          return sum + (line.debit_amount || 0);
        }, 0) || 0;

      return {
        ...entry,
        lines:
          lines?.map((line) => ({
            ...line,
            account: line.accounts as
              | {
                  id: string;
                  code: string;
                  name: string;
                }
              | undefined,
          })) || [],
        totalAmount,
      };
    })
  );

  return {
    success: true,
    data: {
      items: entriesWithLines,
      pagination: result.data.pagination,
    },
  };
}

/**
 * 仕訳を承認（組織ID自動取得版）
 * Note: This needs to be implemented as a Server Action
 */
export async function approveJournalEntryWithAuth(id: string): Promise<ActionResult<JournalEntry>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  // For now, update the status to 'approved'
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '認証が必要です。');
  }

  const { data, error } = await supabase
    .from('journal_entries')
    .update({
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', organizationId)
    .select()
    .single();

  if (error) {
    return createErrorResult(ERROR_CODES.DATABASE_ERROR, '仕訳の承認に失敗しました。');
  }

  return {
    success: true,
    data: data as JournalEntry,
  };
}

/**
 * 仕訳を作成（組織ID自動取得版）
 */
export async function createJournalEntryWithAuth(
  data: Parameters<typeof journalEntriesActions.createJournalEntry>[0]
): Promise<ActionResult<JournalEntryWithLines>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  // Add organization_id to the entry data
  const dataWithOrg = {
    ...data,
    entry: {
      ...data.entry,
      organization_id: organizationId,
    },
  };

  return journalEntriesActions.createJournalEntry(dataWithOrg);
}

/**
 * 仕訳を更新（組織ID自動取得版）
 */
export async function updateJournalEntryWithAuth(
  id: string,
  data: Parameters<typeof journalEntriesActions.updateJournalEntry>[2]
): Promise<ActionResult<JournalEntryWithLines>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return journalEntriesActions.updateJournalEntry(id, organizationId, data);
}

/**
 * 仕訳を削除（組織ID自動取得版）
 */
export async function deleteJournalEntryWithAuth(
  id: string
): Promise<ActionResult<{ id: string }>> {
  const organizationId = await getCurrentOrganizationId();

  if (!organizationId) {
    return createErrorResult(ERROR_CODES.UNAUTHORIZED, '組織が選択されていません。');
  }

  return journalEntriesActions.deleteJournalEntry(id, organizationId);
}
