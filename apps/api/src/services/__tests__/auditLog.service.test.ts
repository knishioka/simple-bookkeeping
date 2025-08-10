import { AuditAction } from '@simple-bookkeeping/database';

import { prisma } from '../../lib/prisma';
import { auditLogService } from '../auditLog.service';

// Mock Prisma
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  prisma: {
    auditLog: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

// Mock json2csv
jest.mock('json2csv', () => ({
  parse: jest.fn((data) => {
    // Simple CSV mock implementation
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map((item: any) => Object.values(item).join(',')).join('\n');
    return `${headers}\n${rows}`;
  }),
}));

describe('AuditLogService', () => {
  const mockOrganizationId = 'org-123';
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuditLogs', () => {
    it('should return paginated audit logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          userId: mockUserId,
          action: AuditAction.CREATE,
          entityType: 'JournalEntry',
          entityId: 'je-1',
          oldValues: null,
          newValues: { amount: 1000 },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          createdAt: new Date(),
          organizationId: mockOrganizationId,
          user: {
            id: mockUserId,
            email: 'test@example.com',
            name: 'Test User',
          },
        },
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(1);

      const result = await auditLogService.getAuditLogs({
        organizationId: mockOrganizationId,
        page: 1,
        limit: 50,
      });

      expect(result.data).toEqual(mockLogs);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      });
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganizationId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 50,
      });
    });

    it('should filter by action', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await auditLogService.getAuditLogs({
        organizationId: mockOrganizationId,
        action: AuditAction.UPDATE,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: mockOrganizationId,
            action: AuditAction.UPDATE,
          },
        })
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await auditLogService.getAuditLogs({
        organizationId: mockOrganizationId,
        startDate,
        endDate,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: mockOrganizationId,
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        })
      );
    });
  });

  describe('getAuditLogById', () => {
    it('should return a single audit log', async () => {
      const mockLog = {
        id: 'log-1',
        userId: mockUserId,
        action: AuditAction.CREATE,
        entityType: 'JournalEntry',
        entityId: 'je-1',
        oldValues: null,
        newValues: { amount: 1000 },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date(),
        organizationId: mockOrganizationId,
        user: {
          id: mockUserId,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
      };

      (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue(mockLog);

      const result = await auditLogService.getAuditLogById('log-1', mockOrganizationId);

      expect(result).toEqual(mockLog);
      expect(prisma.auditLog.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'log-1',
          organizationId: mockOrganizationId,
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
    });

    it('should return null if log not found', async () => {
      (prisma.auditLog.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await auditLogService.getAuditLogById('non-existent', mockOrganizationId);

      expect(result).toBeNull();
    });
  });

  describe('exportAuditLogs', () => {
    it('should export audit logs as CSV', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          userId: mockUserId,
          action: AuditAction.CREATE,
          entityType: 'JournalEntry',
          entityId: 'je-1',
          oldValues: null,
          newValues: { amount: 1000 },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          createdAt: new Date('2024-01-15T10:00:00Z'),
          organizationId: mockOrganizationId,
          user: {
            email: 'test@example.com',
            name: 'Test User',
          },
        },
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);

      const result = await auditLogService.exportAuditLogs({
        organizationId: mockOrganizationId,
      });

      expect(result).toBeTruthy();
      expect(result).toContain('ユーザー');
      expect(result).toContain('操作');
      expect(result).toContain('対象');
    });
  });

  describe('getEntityTypes', () => {
    it('should return unique entity types', async () => {
      const mockEntityTypes = [
        { entityType: 'JournalEntry' },
        { entityType: 'Account' },
        { entityType: 'User' },
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockEntityTypes);

      const result = await auditLogService.getEntityTypes(mockOrganizationId);

      expect(result).toEqual(['JournalEntry', 'Account', 'User']);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { organizationId: mockOrganizationId },
        select: { entityType: true },
        distinct: ['entityType'],
      });
    });
  });

  describe('getStatistics', () => {
    it('should return audit log statistics', async () => {
      const mockGroupByResult = [
        { action: AuditAction.CREATE, entityType: 'JournalEntry', _count: 10 },
        { action: AuditAction.UPDATE, entityType: 'Account', _count: 5 },
        { action: AuditAction.DELETE, entityType: 'User', _count: 2 },
      ];

      const mockDailyStats = [
        { date: '2024-01-15', count: 8 },
        { date: '2024-01-14', count: 5 },
      ];

      (prisma.auditLog.groupBy as jest.Mock).mockResolvedValue(mockGroupByResult);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockDailyStats);

      const result = await auditLogService.getStatistics(mockOrganizationId, 30);

      expect(result.byAction).toEqual({
        [AuditAction.CREATE]: 10,
        [AuditAction.UPDATE]: 5,
        [AuditAction.DELETE]: 2,
      });
      expect(result.byEntityType).toEqual({
        JournalEntry: 10,
        Account: 5,
        User: 2,
      });
      expect(result.daily).toEqual(mockDailyStats);
    });
  });
});
