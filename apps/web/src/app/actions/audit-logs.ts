'use server';

import { headers } from 'next/headers';

import { createClient } from '@/lib/supabase/server';

import {
  ActionResult,
  createSuccessResult,
  createErrorResult,
  createUnauthorizedResult,
  createValidationErrorResult,
  handleSupabaseError,
  ERROR_CODES,
  PaginatedResponse,
  PaginationInfo,
} from './types';
import { withRateLimit, RATE_LIMIT_CONFIGS } from './utils/rate-limiter';

/**
 * 監査ログのアクション種別
 */
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE';

/**
 * エンティティタイプ
 */
export type EntityType =
  | 'account'
  | 'journal_entry'
  | 'journal_entry_line'
  | 'organization'
  | 'user'
  | 'accounting_period'
  | 'report';

/**
 * 監査ログエントリの型定義
 */
export interface AuditLog {
  id: string;
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  organizationId: string;
  createdAt: string;
  // Joined data
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

/**
 * 監査ログのフィルタリングパラメータ
 */
export interface AuditLogFilter {
  startDate?: string;
  endDate?: string;
  userId?: string;
  entityType?: EntityType;
  entityId?: string;
  action?: AuditAction;
  page?: number;
  pageSize?: number;
}

/**
 * 監査ログのエクスポート形式
 */
export interface ExportOptions {
  format: 'csv' | 'json';
  includeUserDetails?: boolean;
}

/**
 * 組織の監査ログを取得
 * ページネーションとフィルタリングをサポート
 * Rate limited: 100 requests per minute
 */
export const getAuditLogs = withRateLimit(async function getAuditLogsImpl(
  organizationId: string,
  filter?: AuditLogFilter
): Promise<ActionResult<PaginatedResponse<AuditLog>>> {
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

    // RLS will handle permission checks based on user role
    // No manual authorization check needed

    // ページネーション設定
    const page = filter?.page || 1;
    const pageSize = filter?.pageSize || 50;
    const offset = (page - 1) * pageSize;

    // クエリの構築 - RLS will filter based on user permissions
    let query = supabase
      .from('audit_logs')
      .select('*, users!user_id (id, email, name)', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    // フィルタリング条件の適用
    if (filter?.startDate) {
      query = query.gte('created_at', filter.startDate);
    }
    if (filter?.endDate) {
      query = query.lte('created_at', filter.endDate);
    }
    if (filter?.userId) {
      query = query.eq('user_id', filter.userId);
    }
    if (filter?.entityType) {
      query = query.eq('entity_type', filter.entityType);
    }
    if (filter?.entityId) {
      query = query.eq('entity_id', filter.entityId);
    }
    if (filter?.action) {
      query = query.eq('action', filter.action);
    }

    // ページネーション
    query = query.range(offset, offset + pageSize - 1);

    const { data: logs, error: logsError, count } = await query;

    if (logsError) {
      // Check for RLS permission denied error
      if (logsError.code === '42501') {
        return createErrorResult(
          ERROR_CODES.INSUFFICIENT_PERMISSIONS,
          '監査ログの閲覧には管理者または経理担当者権限が必要です。'
        );
      }
      return handleSupabaseError(logsError);
    }

    // データのフォーマット
    const formattedLogs: AuditLog[] = (logs || []).map(
      (
        log: Record<string, unknown> & {
          id: string;
          user_id: string;
          action: AuditAction;
          entity_type: string;
          entity_id: string;
          old_values?: Record<string, unknown>;
          new_values?: Record<string, unknown>;
          description?: string;
          ip_address?: string;
          user_agent?: string;
          organization_id: string;
          created_at: string;
          users?: { id: string; email: string; name?: string };
        }
      ) => ({
        id: log.id,
        userId: log.user_id,
        action: log.action,
        entityType: log.entity_type,
        entityId: log.entity_id,
        oldValues: log.old_values,
        newValues: log.new_values,
        description: log.description,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        organizationId: log.organization_id,
        createdAt: log.created_at,
        user: log.users
          ? {
              id: log.users.id,
              email: log.users.email,
              name: log.users.name,
            }
          : undefined,
      })
    );

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    const pagination: PaginationInfo = {
      page,
      pageSize,
      totalCount,
      totalPages,
    };

    return createSuccessResult({
      items: formattedLogs,
      pagination,
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return createErrorResult(
      ERROR_CODES.INTERNAL_ERROR,
      '監査ログの取得中にエラーが発生しました。'
    );
  }
}, RATE_LIMIT_CONFIGS.READ);

/**
 * 監査ログエントリを作成（内部使用のみ）
 * 他のServer Actionsから呼び出される
 * Note: Not rate limited as it's internal only
 */
export async function createAuditLog(params: {
  userId: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  organizationId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  description?: string;
}): Promise<ActionResult<AuditLog>> {
  try {
    const supabase = await createClient();

    // リクエスト情報の取得
    let ipAddress: string | undefined;
    let userAgent: string | undefined;

    try {
      const headersList = await headers();
      // IP アドレスの取得（プロキシ経由の場合も考慮）
      ipAddress =
        headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
        headersList.get('x-real-ip') ||
        headersList.get('cf-connecting-ip') ||
        undefined;
      userAgent = headersList.get('user-agent') || undefined;
    } catch (error) {
      // headers() が使用できない場合はスキップ
      console.warn('Unable to get request headers:', error);
    }

    // 監査ログの作成
    const { data: auditLog, error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: params.userId,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        organization_id: params.organizationId,
        old_values: params.oldValues || null,
        new_values: params.newValues || null,
        description: params.description || null,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating audit log:', error);
      return handleSupabaseError(error);
    }

    return createSuccessResult({
      id: auditLog.id,
      userId: auditLog.user_id,
      action: auditLog.action,
      entityType: auditLog.entity_type,
      entityId: auditLog.entity_id,
      oldValues: auditLog.old_values,
      newValues: auditLog.new_values,
      description: auditLog.description,
      ipAddress: auditLog.ip_address,
      userAgent: auditLog.user_agent,
      organizationId: auditLog.organization_id,
      createdAt: auditLog.created_at,
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
    return createErrorResult(
      ERROR_CODES.INTERNAL_ERROR,
      '監査ログの作成中にエラーが発生しました。'
    );
  }
}

/**
 * 特定エンティティの監査ログを取得
 */
export async function getAuditLogsByEntity(
  organizationId: string,
  entityType: EntityType,
  entityId: string,
  options?: {
    page?: number;
    pageSize?: number;
  }
): Promise<ActionResult<PaginatedResponse<AuditLog>>> {
  return getAuditLogs(organizationId, {
    entityType,
    entityId,
    page: options?.page,
    pageSize: options?.pageSize,
  });
}

/**
 * 特定ユーザーのアクションによる監査ログを取得
 * Rate limited: 100 requests per minute
 */
export const getAuditLogsByUser = withRateLimit(async function getAuditLogsByUserImpl(
  organizationId: string,
  userId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<ActionResult<PaginatedResponse<AuditLog>>> {
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

    // RLS will handle permission checks
    // Users can view their own logs, admins/accountants can view all

    return getAuditLogs(organizationId, {
      userId,
      startDate: options?.startDate,
      endDate: options?.endDate,
      page: options?.page,
      pageSize: options?.pageSize,
    });
  } catch (error) {
    console.error('Error fetching user audit logs:', error);
    return createErrorResult(
      ERROR_CODES.INTERNAL_ERROR,
      'ユーザー監査ログの取得中にエラーが発生しました。'
    );
  }
}, RATE_LIMIT_CONFIGS.READ);

/**
 * 監査ログをエクスポート（コンプライアンス/レポート用）
 * Rate limited: 3 requests per minute (sensitive operation)
 */
export const exportAuditLogs = withRateLimit(async function exportAuditLogsImpl(
  organizationId: string,
  filter?: AuditLogFilter,
  options?: ExportOptions
): Promise<ActionResult<string | unknown[]>> {
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

    // RLS will handle admin-only permission check
    // Only admins can export audit logs

    // エクスポート用にページサイズを大きく設定
    const exportFilter = {
      ...filter,
      pageSize: 10000, // 大量エクスポートに対応
    };

    // データ取得
    const result = await getAuditLogs(organizationId, exportFilter);
    if (!result.success) {
      // Check if it's a permission error
      if (result.error?.code === ERROR_CODES.INSUFFICIENT_PERMISSIONS) {
        return createErrorResult(
          ERROR_CODES.INSUFFICIENT_PERMISSIONS,
          '監査ログのエクスポートには管理者権限が必要です。'
        );
      }
      return result;
    }

    const logs = result.data.items;
    const format = options?.format || 'json';

    if (format === 'json') {
      // JSON形式でエクスポート
      if (options?.includeUserDetails) {
        return createSuccessResult(logs);
      } else {
        // ユーザー詳細を除外
        const simplifiedLogs = logs.map(({ user: _user, ...log }) => log);
        return createSuccessResult(simplifiedLogs);
      }
    } else if (format === 'csv') {
      // CSV形式でエクスポート
      const csvHeaders = [
        'ID',
        'Date',
        'User ID',
        options?.includeUserDetails ? 'User Email' : null,
        options?.includeUserDetails ? 'User Name' : null,
        'Action',
        'Entity Type',
        'Entity ID',
        'Description',
        'IP Address',
        'User Agent',
      ]
        .filter(Boolean)
        .join(',');

      const csvRows = logs.map((log) => {
        const row = [
          log.id,
          log.createdAt,
          log.userId,
          options?.includeUserDetails ? log.user?.email || '' : null,
          options?.includeUserDetails ? log.user?.name || '' : null,
          log.action,
          log.entityType,
          log.entityId,
          log.description ? `"${log.description.replace(/"/g, '""')}"` : '',
          log.ipAddress || '',
          log.userAgent ? `"${log.userAgent.replace(/"/g, '""')}"` : '',
        ].filter((_, index) => {
          // フィルタリングでnullの列を除外
          if (!options?.includeUserDetails && (index === 3 || index === 4)) {
            return false;
          }
          return true;
        });
        return row.join(',');
      });

      const csv = [csvHeaders, ...csvRows].join('\n');
      return createSuccessResult(csv);
    } else {
      return createValidationErrorResult('無効なエクスポート形式です。');
    }
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    return createErrorResult(
      ERROR_CODES.INTERNAL_ERROR,
      '監査ログのエクスポート中にエラーが発生しました。'
    );
  }
}, RATE_LIMIT_CONFIGS.SENSITIVE);

/**
 * 組織で使用されているエンティティタイプの一覧を取得
 * Rate limited: 100 requests per minute
 */
export const getEntityTypes = withRateLimit(async function getEntityTypesImpl(
  organizationId: string
): Promise<ActionResult<string[]>> {
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

    // RLS will handle permission checks
    // Only admins and accountants can view entity types

    // エンティティタイプの一覧を取得（重複を除外）
    const { data: entityTypes, error } = await supabase
      .from('audit_logs')
      .select('entity_type')
      .eq('organization_id', organizationId)
      .order('entity_type');

    if (error) {
      // Check for RLS permission denied error
      if (error.code === '42501') {
        return createErrorResult(
          ERROR_CODES.INSUFFICIENT_PERMISSIONS,
          'エンティティタイプの取得には管理者または経理担当者権限が必要です。'
        );
      }
      return handleSupabaseError(error);
    }

    // 重複を除外してユニークなエンティティタイプのリストを作成
    const uniqueEntityTypes = Array.from(
      new Set(entityTypes?.map((row) => row.entity_type) || [])
    ).filter(Boolean);

    return createSuccessResult(uniqueEntityTypes);
  } catch (error) {
    console.error('Error fetching entity types:', error);
    return createErrorResult(
      ERROR_CODES.INTERNAL_ERROR,
      'エンティティタイプの取得中にエラーが発生しました。'
    );
  }
}, RATE_LIMIT_CONFIGS.READ);

/**
 * ヘルパー関数：エンティティ変更の監査ログを記録
 * 他のServer Actionsから呼び出される
 */
export async function auditEntityChange(params: {
  user: { id: string };
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  organizationId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  description?: string;
}): Promise<void> {
  try {
    await createAuditLog({
      userId: params.user.id,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      organizationId: params.organizationId,
      oldValues: params.oldValues,
      newValues: params.newValues,
      description: params.description,
    });
  } catch (error) {
    // 監査ログの失敗は本処理に影響させない
    // エラーの詳細をログに記録
    console.error('Failed to create audit log:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      params: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: params.user.id,
        organizationId: params.organizationId,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
