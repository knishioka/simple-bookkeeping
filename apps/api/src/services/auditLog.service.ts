import { AuditAction, Prisma, AuditLog } from '@simple-bookkeeping/database';
import { parse } from 'json2csv';

import { prisma } from '../lib/prisma';

export interface AuditLogFilter {
  organizationId: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'action' | 'entityType';
  sortOrder?: 'asc' | 'desc';
}

export interface AuditLogWithUser extends AuditLog {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface PaginatedAuditLogs {
  data: AuditLogWithUser[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class AuditLogService {
  /**
   * Get paginated audit logs with filters
   */
  async getAuditLogs(filter: AuditLogFilter): Promise<PaginatedAuditLogs> {
    const page = filter.page || 1;
    const limit = filter.limit || 50;
    const skip = (page - 1) * limit;
    const sortBy = filter.sortBy || 'createdAt';
    const sortOrder = filter.sortOrder || 'desc';

    const where: Prisma.AuditLogWhereInput = {
      organizationId: filter.organizationId,
    };

    if (filter.userId) {
      where.userId = filter.userId;
    }

    if (filter.entityType) {
      where.entityType = filter.entityType;
    }

    if (filter.entityId) {
      where.entityId = filter.entityId;
    }

    if (filter.action) {
      where.action = filter.action;
    }

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) {
        where.createdAt.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.createdAt.lte = filter.endDate;
      }
    }

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data: data as unknown as AuditLogWithUser[],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single audit log by ID
   */
  async getAuditLogById(id: string, organizationId: string): Promise<AuditLogWithUser | null> {
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    return auditLog as unknown as AuditLogWithUser | null;
  }

  /**
   * Export audit logs as CSV
   */
  async exportAuditLogs(filter: AuditLogFilter): Promise<string> {
    // Remove pagination for export

    const where: Prisma.AuditLogWhereInput = {
      organizationId: filter.organizationId,
    };

    if (filter.userId) {
      where.userId = filter.userId;
    }

    if (filter.entityType) {
      where.entityType = filter.entityType;
    }

    if (filter.entityId) {
      where.entityId = filter.entityId;
    }

    if (filter.action) {
      where.action = filter.action;
    }

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) {
        where.createdAt.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.createdAt.lte = filter.endDate;
      }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform data for CSV export
    const csvData = logs.map((log) => ({
      日時: new Date(log.createdAt).toLocaleString('ja-JP'),
      ユーザー: log.user.email,
      氏名: log.user.name || '-',
      操作: this.getActionLabel(log.action),
      対象: this.getEntityTypeLabel(log.entityType),
      対象ID: log.entityId,
      IPアドレス: log.ipAddress || '-',
      ユーザーエージェント: log.userAgent || '-',
    }));

    // Generate CSV
    const csv = parse(csvData, {
      fields: [
        '日時',
        'ユーザー',
        '氏名',
        '操作',
        '対象',
        '対象ID',
        'IPアドレス',
        'ユーザーエージェント',
      ],
    });

    return csv;
  }

  /**
   * Get entity types that have audit logs
   */
  async getEntityTypes(organizationId: string): Promise<string[]> {
    const result = await prisma.auditLog.findMany({
      where: { organizationId },
      select: { entityType: true },
      distinct: ['entityType'],
    });

    return result.map((r) => r.entityType);
  }

  /**
   * Get audit log statistics
   */
  async getStatistics(
    organizationId: string,
    days: number = 30
  ): Promise<{
    byAction: Record<string, number>;
    byEntityType: Record<string, number>;
    daily: unknown;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await prisma.auditLog.groupBy({
      by: ['action', 'entityType'],
      where: {
        organizationId,
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    const dailyStats = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM audit_logs
      WHERE organization_id = ${organizationId}
        AND created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    return {
      byAction: stats.reduce(
        (acc, stat) => {
          if (!acc[stat.action]) acc[stat.action] = 0;
          acc[stat.action] += stat._count;
          return acc;
        },
        {} as Record<string, number>
      ),
      byEntityType: stats.reduce(
        (acc, stat) => {
          if (!acc[stat.entityType]) acc[stat.entityType] = 0;
          acc[stat.entityType] += stat._count;
          return acc;
        },
        {} as Record<string, number>
      ),
      daily: dailyStats,
    };
  }

  /**
   * Get action label for display
   */
  private getActionLabel(action: AuditAction): string {
    const labels: Record<AuditAction, string> = {
      [AuditAction.CREATE]: '作成',
      [AuditAction.UPDATE]: '更新',
      [AuditAction.DELETE]: '削除',
      [AuditAction.APPROVE]: '承認',
    };
    return labels[action] || action;
  }

  /**
   * Get entity type label for display
   */
  private getEntityTypeLabel(entityType: string): string {
    const labels: Record<string, string> = {
      JournalEntry: '仕訳',
      Account: '勘定科目',
      User: 'ユーザー',
      Organization: '組織',
      AccountingPeriod: '会計期間',
      Authentication: '認証',
    };
    return labels[entityType] || entityType;
  }
}

export const auditLogService = new AuditLogService();
