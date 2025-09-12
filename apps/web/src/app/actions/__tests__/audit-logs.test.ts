import { headers } from 'next/headers';

import { createClient } from '@/lib/supabase/server';

import {
  getAuditLogs,
  createAuditLog,
  getAuditLogsByEntity,
  getAuditLogsByUser,
  exportAuditLogs,
  getEntityTypes,
  auditEntityChange,
} from '../audit-logs';
import { ERROR_CODES } from '../types';

// Mock dependencies
jest.mock('next/headers', () => ({
  headers: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

const mockHeaders = headers as jest.MockedFunction<typeof headers>;
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

// Mock console methods

describe('Audit Logs Server Actions', () => {
  let mockSupabaseClient: any;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  // Helper function to create a chainable query mock
  const createQueryMock = (finalResult: any) => {
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(finalResult),
      insert: jest.fn().mockReturnThis(),
    };

    // Make chainable methods return the query object
    Object.keys(query).forEach((key) => {
      if (key !== 'single') {
        const originalFn = query[key as keyof typeof query];
        query[key as keyof typeof query] = jest.fn((...args) => {
          originalFn(...args);
          return query;
        });
      }
    });

    return query;
  };

  // Helper function to create audit logs query mock with proper chaining
  const createAuditLogsQueryMock = (data: any, error: any = null, count: number | null = null) => {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({ data, error, count }),
      single: jest.fn().mockResolvedValue({ data, error }),
      insert: jest.fn().mockReturnThis(),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup console spies
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Create mock Supabase client
    mockSupabaseClient = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    };

    mockCreateClient.mockResolvedValue(mockSupabaseClient);

    // Default headers mock
    mockHeaders.mockResolvedValue({
      get: jest.fn((header) => {
        if (header === 'x-forwarded-for') return '192.168.1.1';
        if (header === 'user-agent') return 'Mozilla/5.0';
        return null;
      }),
    } as any);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('getAuditLogs', () => {
    it('should return audit logs with pagination', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'test@example.com' };
      const mockUserOrg = { role: 'admin' };
      const mockLogs = [
        {
          id: 'log-1',
          user_id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
          action: 'CREATE',
          entity_type: 'account',
          entity_id: 'acc-1',
          organization_id: '83e58256-5905-47e5-bc00-74cd776abd13',
          created_at: '2024-01-01T10:00:00Z',
          description: 'Created account',
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          users: {
            id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
            email: 'test@example.com',
            name: 'Test User',
          },
        },
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const logsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: mockLogs, error: null, count: 1 }),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await getAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13', {
        page: 1,
        pageSize: 50,
      });

      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(1);
      expect(result.data?.items[0]).toMatchObject({
        id: 'log-1',
        userId: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
        action: 'CREATE',
        entityType: 'account',
        entityId: 'acc-1',
        user: {
          id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
          email: 'test@example.com',
          name: 'Test User',
        },
      });
      expect(result.data?.pagination).toEqual({
        page: 1,
        pageSize: 50,
        totalCount: 1,
        totalPages: 1,
      });
    });

    it('should apply filters correctly', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'test@example.com' };
      const mockUserOrg = { role: 'accountant' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const logsQuery = {
        ...createQueryMock({ data: [], error: null, count: 0 }),
        range: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      await getAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13', {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        userId: 'c83ac4fb-328c-4f07-94cb-cb122e416db1',
        entityType: 'journal_entry',
        entityId: 'je-1',
        action: 'UPDATE',
      });

      expect(logsQuery.gte).toHaveBeenCalledWith('created_at', '2024-01-01');
      expect(logsQuery.lte).toHaveBeenCalledWith('created_at', '2024-12-31');
      expect(logsQuery.eq).toHaveBeenCalledWith('user_id', 'c83ac4fb-328c-4f07-94cb-cb122e416db1');
      expect(logsQuery.eq).toHaveBeenCalledWith('entity_type', 'journal_entry');
      expect(logsQuery.eq).toHaveBeenCalledWith('entity_id', 'je-1');
      expect(logsQuery.eq).toHaveBeenCalledWith('action', 'UPDATE');
    });

    it('should return unauthorized when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await getAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('should return forbidden when user has no access to organization', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'test@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: null, error: { message: 'Not found' } });
      mockSupabaseClient.from.mockReturnValue(userOrgQuery);

      const result = await getAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('should reject viewers from accessing audit logs', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'test@example.com' };
      const mockUserOrg = { role: 'viewer' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      mockSupabaseClient.from.mockReturnValue(userOrgQuery);

      const result = await getAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
      expect(result.error?.message).toContain('管理者または経理担当者権限が必要');
    });

    it('should handle database errors gracefully', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'test@example.com' };
      const mockUserOrg = { role: 'admin' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const logsQuery = createAuditLogsQueryMock(null, { message: 'Database error' });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await getAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13');

      expect(result.success).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle unexpected errors', async () => {
      mockCreateClient.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await getAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching audit logs:', expect.any(Error));
    });
  });

  describe('createAuditLog', () => {
    it('should create audit log with request headers', async () => {
      const mockAuditLog = {
        id: 'log-new',
        user_id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
        action: 'CREATE',
        entity_type: 'account',
        entity_id: 'acc-1',
        organization_id: '83e58256-5905-47e5-bc00-74cd776abd13',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        created_at: '2024-01-01T10:00:00Z',
      };

      const insertQuery = createQueryMock({ data: mockAuditLog, error: null });
      mockSupabaseClient.from.mockReturnValue(insertQuery);

      const result = await createAuditLog({
        userId: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
        action: 'CREATE',
        entityType: 'account',
        entityId: 'acc-1',
        organizationId: '83e58256-5905-47e5-bc00-74cd776abd13',
        description: 'Created new account',
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        id: 'log-new',
        userId: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
        action: 'CREATE',
        entityType: 'account',
        entityId: 'acc-1',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(insertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
          action: 'CREATE',
          entity_type: 'account',
          entity_id: 'acc-1',
          organization_id: '83e58256-5905-47e5-bc00-74cd776abd13',
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
        })
      );
    });

    it('should handle missing headers gracefully', async () => {
      mockHeaders.mockRejectedValueOnce(new Error('Headers not available'));

      const mockAuditLog = {
        id: 'log-new',
        user_id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
        action: 'CREATE',
        entity_type: 'account',
        entity_id: 'acc-1',
        organization_id: '83e58256-5905-47e5-bc00-74cd776abd13',
        ip_address: null,
        user_agent: null,
        created_at: '2024-01-01T10:00:00Z',
      };

      const insertQuery = createQueryMock({ data: mockAuditLog, error: null });
      mockSupabaseClient.from.mockReturnValue(insertQuery);

      const result = await createAuditLog({
        userId: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
        action: 'CREATE',
        entityType: 'account',
        entityId: 'acc-1',
        organizationId: '83e58256-5905-47e5-bc00-74cd776abd13',
      });

      expect(result.success).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Unable to get request headers:',
        expect.any(Error)
      );
      expect(insertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ip_address: null,
          user_agent: null,
        })
      );
    });

    it('should extract IP from different header formats', async () => {
      // Test x-forwarded-for with multiple IPs
      mockHeaders.mockResolvedValueOnce({
        get: jest.fn((header) => {
          if (header === 'x-forwarded-for') return '10.0.0.1, 10.0.0.2, 10.0.0.3';
          return null;
        }),
      } as any);

      const insertQuery = createQueryMock({ data: { id: 'log-1' }, error: null });
      mockSupabaseClient.from.mockReturnValue(insertQuery);

      await createAuditLog({
        userId: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
        action: 'CREATE',
        entityType: 'account',
        entityId: 'acc-1',
        organizationId: '83e58256-5905-47e5-bc00-74cd776abd13',
      });

      expect(insertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ip_address: '10.0.0.1', // Should take first IP
        })
      );
    });

    it('should handle database errors', async () => {
      const insertQuery = createQueryMock({ data: null, error: { message: 'Insert failed' } });
      mockSupabaseClient.from.mockReturnValue(insertQuery);

      const result = await createAuditLog({
        userId: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
        action: 'CREATE',
        entityType: 'account',
        entityId: 'acc-1',
        organizationId: '83e58256-5905-47e5-bc00-74cd776abd13',
      });

      expect(result.success).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error creating audit log:', expect.any(Object));
    });
  });

  describe('auditEntityChange', () => {
    it('should create audit log silently', async () => {
      const mockAuditLog = {
        id: 'log-new',
        user_id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
        action: 'UPDATE',
        entity_type: 'account',
        entity_id: 'acc-1',
        organization_id: '83e58256-5905-47e5-bc00-74cd776abd13',
        created_at: '2024-01-01T10:00:00Z',
      };

      const insertQuery = createQueryMock({ data: mockAuditLog, error: null });
      mockSupabaseClient.from.mockReturnValue(insertQuery);

      await auditEntityChange({
        user: { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5' },
        action: 'UPDATE',
        entityType: 'account',
        entityId: 'acc-1',
        organizationId: '83e58256-5905-47e5-bc00-74cd776abd13',
        oldValues: { name: 'Old Name' },
        newValues: { name: 'New Name' },
        description: 'Updated account name',
      });

      expect(insertQuery.insert).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle failures gracefully without throwing', async () => {
      const insertQuery = createQueryMock({ data: null, error: { message: 'Insert failed' } });
      mockSupabaseClient.from.mockReturnValue(insertQuery);

      // Should not throw
      await expect(
        auditEntityChange({
          user: { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5' },
          action: 'DELETE',
          entityType: 'account',
          entityId: 'acc-1',
          organizationId: '83e58256-5905-47e5-bc00-74cd776abd13',
        })
      ).resolves.not.toThrow();

      // The actual implementation logs the error internally within createAuditLog
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle audit log creation failure silently', async () => {
      const insertQuery = createQueryMock({ data: null, error: { message: 'Insert failed' } });
      mockSupabaseClient.from.mockReturnValue(insertQuery);

      await auditEntityChange({
        user: { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5' },
        action: 'CREATE',
        entityType: 'journal_entry',
        entityId: 'je-1',
        organizationId: '83e58256-5905-47e5-bc00-74cd776abd13',
      });

      // The actual implementation logs the error internally
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('getAuditLogsByUser', () => {
    it('should allow admin or accountant to view their own logs', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'test@example.com' };
      const mockUserOrg = { role: 'accountant' }; // Accountant can see logs

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const logsQuery = createAuditLogsQueryMock([], null, 0);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await getAuditLogsByUser(
        '83e58256-5905-47e5-bc00-74cd776abd13',
        'fcdec6df-4d44-4bc6-b7c7-c5b58efface5'
      ); // Same user

      expect(result.success).toBe(true);
    });

    it('should prevent viewers from viewing other users logs', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'test@example.com' };
      const mockUserOrg = { role: 'viewer' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      mockSupabaseClient.from.mockReturnValue(userOrgQuery);

      const result = await getAuditLogsByUser(
        '83e58256-5905-47e5-bc00-74cd776abd13',
        'c83ac4fb-328c-4f07-94cb-cb122e416db1'
      ); // Different user

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
      expect(result.error?.message).toContain('他のユーザーの監査ログ');
    });

    it('should allow admin to view any user logs', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'admin@example.com' };
      const mockUserOrg = { role: 'admin' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const logsQuery = {
        ...createQueryMock({ data: [], error: null, count: 0 }),
        range: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await getAuditLogsByUser(
        '83e58256-5905-47e5-bc00-74cd776abd13',
        'c83ac4fb-328c-4f07-94cb-cb122e416db1'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('exportAuditLogs', () => {
    it('should export logs as JSON', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'admin@example.com' };
      const mockUserOrg = { role: 'admin' };
      const mockLogs = [
        {
          id: 'log-1',
          user_id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
          action: 'CREATE',
          entity_type: 'account',
          entity_id: 'acc-1',
          organization_id: '83e58256-5905-47e5-bc00-74cd776abd13',
          created_at: '2024-01-01T10:00:00Z',
          description: 'Created account',
          users: { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'test@example.com' },
        },
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const logsQuery = createAuditLogsQueryMock(mockLogs, null, 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await exportAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13', undefined, {
        format: 'json',
        includeUserDetails: true,
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should export logs as CSV', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'admin@example.com' };
      const mockUserOrg = { role: 'admin' };
      const mockLogs = [
        {
          id: 'log-1',
          user_id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
          action: 'CREATE',
          entity_type: 'account',
          entity_id: 'acc-1',
          organization_id: '83e58256-5905-47e5-bc00-74cd776abd13',
          created_at: '2024-01-01T10:00:00Z',
          description: 'Created "special" account',
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0 "test"',
          users: {
            id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
            email: 'test@example.com',
            name: 'Test User',
          },
        },
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const logsQuery = createAuditLogsQueryMock(mockLogs, null, 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await exportAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13', undefined, {
        format: 'csv',
        includeUserDetails: true,
      });

      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string');
      expect(result.data).toContain('ID,Date,User ID,User Email,User Name');
      expect(result.data).toContain('log-1');
      expect(result.data).toContain('test@example.com');
      // Check CSV escaping
      expect(result.data).toContain('"Created ""special"" account"');
      expect(result.data).toContain('"Mozilla/5.0 ""test"""');
    });

    it('should exclude user details when requested', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'admin@example.com' };
      const mockUserOrg = { role: 'admin' };
      const mockLogs = [
        {
          id: 'log-1',
          user_id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
          action: 'CREATE',
          entity_type: 'account',
          entity_id: 'acc-1',
          organization_id: '83e58256-5905-47e5-bc00-74cd776abd13',
          created_at: '2024-01-01T10:00:00Z',
          users: { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'test@example.com' },
        },
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const logsQuery = createAuditLogsQueryMock(mockLogs, null, 1);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await exportAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13', undefined, {
        format: 'json',
        includeUserDetails: false,
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        const exportedLog = (result.data as any[])[0];
        expect(exportedLog).not.toHaveProperty('user');
      }
    });

    it('should only allow admin to export', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'test@example.com' };
      const mockUserOrg = { role: 'accountant' }; // Not admin

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      mockSupabaseClient.from.mockReturnValue(userOrgQuery);

      const result = await exportAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
      expect(result.error?.message).toContain('管理者権限が必要');
    });

    it('should reject invalid export format', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'admin@example.com' };
      const mockUserOrg = { role: 'admin' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const logsQuery = {
        ...createQueryMock({ data: [], error: null, count: 0 }),
        range: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await exportAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13', undefined, {
        format: 'xml' as any, // Invalid format
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('無効なエクスポート形式');
    });
  });

  describe('getEntityTypes', () => {
    it('should return unique entity types', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'test@example.com' };
      const mockUserOrg = { role: 'admin' };
      const mockEntityTypes = [
        { entity_type: 'account' },
        { entity_type: 'account' },
        { entity_type: 'journal_entry' },
        { entity_type: 'journal_entry' },
        { entity_type: 'user' },
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const entityTypesQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockEntityTypes, error: null }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'audit_logs') {
          return entityTypesQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await getEntityTypes('83e58256-5905-47e5-bc00-74cd776abd13');

      expect(result.success).toBe(true);
      // Since the mock returns the original data with duplicates,
      // the implementation should return unique values
      expect(result.data).toEqual(['account', 'journal_entry', 'user']);
      expect(result.data).toHaveLength(3); // Should be unique
    });

    it('should handle empty entity types', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'test@example.com' };
      const mockUserOrg = { role: 'accountant' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const entityTypesQuery = createQueryMock({ data: [], error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'audit_logs') {
          return entityTypesQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await getEntityTypes('83e58256-5905-47e5-bc00-74cd776abd13');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should require admin or accountant role', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'test@example.com' };
      const mockUserOrg = { role: 'viewer' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      mockSupabaseClient.from.mockReturnValue(userOrgQuery);

      const result = await getEntityTypes('83e58256-5905-47e5-bc00-74cd776abd13');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });
  });

  describe('getAuditLogsByEntity', () => {
    it('should delegate to getAuditLogs with correct filters', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'test@example.com' };
      const mockUserOrg = { role: 'admin' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const logsQuery = createAuditLogsQueryMock([], null, 0);

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      await getAuditLogsByEntity('83e58256-5905-47e5-bc00-74cd776abd13', 'journal_entry', 'je-1', {
        page: 2,
        pageSize: 25,
      });

      expect(logsQuery.eq).toHaveBeenCalledWith('entity_type', 'journal_entry');
      expect(logsQuery.eq).toHaveBeenCalledWith('entity_id', 'je-1');
      expect(logsQuery.range).toHaveBeenCalledWith(25, 49); // page 2, size 25
    });
  });

  describe('Edge Cases and Boundary Testing', () => {
    it('should handle maximum page size correctly', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'admin@example.com' };
      const largeLogs = Array.from({ length: 1000 }, (_, i) => ({
        id: `log-${i}`,
        user_id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
        action: 'UPDATE',
        entity_type: 'account',
        entity_id: `account-${i}`,
        organization_id: '83e58256-5905-47e5-bc00-74cd776abd13',
        created_at: new Date(Date.now() - i * 1000).toISOString(),
      }));

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const orgQuery = createQueryMock({
        data: { role: 'admin' },
        error: null,
      });

      const logsQuery = {
        ...createQueryMock({
          data: largeLogs.slice(0, 100),
          error: null,
          count: 1000,
        }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: largeLogs.slice(0, 100),
          error: null,
          count: 1000,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return orgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await getAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13', { pageSize: 100 });

      expect(result.success).toBe(true);
      expect(result.data?.items.length).toBe(100);
      expect(result.data?.pagination.totalCount).toBe(1000);
      expect(result.data?.pagination.totalPages).toBe(10);
    });

    it('should handle date range filters across timezones', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'admin@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const orgQuery = createQueryMock({
        data: { role: 'admin' },
        error: null,
      });

      const logsQuery = {
        ...createQueryMock({
          data: [],
          error: null,
          count: 0,
        }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return orgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const startDate = '2024-01-01T00:00:00Z';
      const endDate = '2024-12-31T23:59:59Z';

      await getAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13', {
        startDate,
        endDate,
      });

      expect(logsQuery.gte).toHaveBeenCalledWith('created_at', startDate);
      expect(logsQuery.lte).toHaveBeenCalledWith('created_at', endDate);
    });

    it('should handle special characters in entity IDs', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'admin@example.com' };
      const specialEntityId = 'entity-with-\'quotes"-and-<tags>';

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const orgQuery = createQueryMock({
        data: { role: 'admin' },
        error: null,
      });

      const logsQuery = {
        ...createQueryMock({
          data: [
            {
              id: 'log-1',
              user_id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
              action: 'CREATE',
              entity_type: 'account',
              entity_id: specialEntityId,
              organization_id: '83e58256-5905-47e5-bc00-74cd776abd13',
              created_at: new Date().toISOString(),
            },
          ],
          error: null,
          count: 1,
        }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'log-1',
              user_id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
              action: 'CREATE',
              entity_type: 'account',
              entity_id: specialEntityId,
              organization_id: '83e58256-5905-47e5-bc00-74cd776abd13',
              created_at: new Date().toISOString(),
            },
          ],
          error: null,
          count: 1,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return orgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await getAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13', {
        entityId: specialEntityId,
      });

      expect(result.success).toBe(true);
      expect(logsQuery.eq).toHaveBeenCalledWith('entity_id', specialEntityId);
    });

    it('should handle null values in audit log fields', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'admin@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const logsWithNulls = [
        {
          id: 'log-1',
          user_id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
          action: 'DELETE',
          entity_type: 'account',
          entity_id: '07e99801-2c11-47de-8df3-efbbb1c3ee6d',
          organization_id: '83e58256-5905-47e5-bc00-74cd776abd13',
          created_at: new Date().toISOString(),
          old_values: null,
          new_values: null,
          description: null,
          ip_address: null,
          user_agent: null,
          users: null,
        },
      ];

      const orgQuery = createQueryMock({
        data: { role: 'admin' },
        error: null,
      });

      const logsQuery = {
        ...createQueryMock({
          data: logsWithNulls,
          error: null,
          count: 1,
        }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: logsWithNulls,
          error: null,
          count: 1,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return orgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await getAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13');

      expect(result.success).toBe(true);
      expect(result.data?.items[0]).toMatchObject({
        id: 'log-1',
        userId: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
        action: 'DELETE',
        entityType: 'account',
        entityId: '07e99801-2c11-47de-8df3-efbbb1c3ee6d',
        organizationId: '83e58256-5905-47e5-bc00-74cd776abd13',
        oldValues: null,
        newValues: null,
        description: null,
        ipAddress: null,
        userAgent: null,
        user: undefined,
      });
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle large CSV exports efficiently', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'admin@example.com' };
      const largeLogs = Array.from({ length: 5000 }, (_, i) => ({
        id: `log-${i}`,
        user_id: `user-${i % 10}`,
        action: ['CREATE', 'UPDATE', 'DELETE'][i % 3],
        entity_type: ['account', 'journal_entry', 'user'][i % 3],
        entity_id: `entity-${i}`,
        organization_id: '83e58256-5905-47e5-bc00-74cd776abd13',
        created_at: new Date(Date.now() - i * 60000).toISOString(),
        description: `Action ${i} performed`,
        ip_address: `192.168.1.${i % 255}`,
        user_agent: 'Mozilla/5.0',
        users: {
          id: `user-${i % 10}`,
          email: `user${i % 10}@example.com`,
          name: `User ${i % 10}`,
        },
      }));

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const orgQuery = createQueryMock({
        data: { role: 'admin' },
        error: null,
      });

      const logsQuery = {
        ...createQueryMock({ data: largeLogs, error: null, count: 5000 }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: largeLogs, error: null, count: 5000 }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return orgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const startTime = Date.now();
      const result = await exportAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13', undefined, {
        format: 'csv',
        includeUserDetails: true,
      });
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string');

      const csv = result.data as string;
      const lines = csv.split('\n');
      expect(lines.length).toBe(5001); // Header + 5000 data rows

      // Performance check - should complete within 5 seconds
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should complete all operations within 30 seconds', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'admin@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const orgQuery = createQueryMock({
        data: { role: 'admin' },
        error: null,
      });

      const logsQuery = createQueryMock({
        data: [],
        error: null,
        count: 0,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return orgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const startTime = Date.now();

      // Run multiple operations in parallel
      await Promise.all([
        getAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13'),
        getAuditLogsByUser(
          '83e58256-5905-47e5-bc00-74cd776abd13',
          'fcdec6df-4d44-4bc6-b7c7-c5b58efface5'
        ),
        getAuditLogsByEntity('83e58256-5905-47e5-bc00-74cd776abd13', 'account', 'acc-1'),
        getEntityTypes('83e58256-5905-47e5-bc00-74cd776abd13'),
      ]);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(30000); // 30 seconds
    });
  });

  describe('Security and Validation', () => {
    it('should prevent SQL injection in filter parameters', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'admin@example.com' };
      const maliciousInput = "'; DROP TABLE audit_logs; --";

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const orgQuery = createQueryMock({
        data: { role: 'admin' },
        error: null,
      });

      const logsQuery = {
        ...createQueryMock({
          data: [],
          error: null,
          count: 0,
        }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return orgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await getAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13', {
        entityId: maliciousInput,
      });

      expect(result.success).toBe(true);
      // Supabase should handle parameterization safely
      expect(logsQuery.eq).toHaveBeenCalledWith('entity_id', maliciousInput);
    });

    it('should sanitize CSV output to prevent formula injection', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'admin@example.com' };
      const dangerousDescription = '=1+1';

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const orgQuery = createQueryMock({
        data: { role: 'admin' },
        error: null,
      });

      const mockLogs = [
        {
          id: 'log-1',
          user_id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
          action: 'UPDATE',
          entity_type: 'account',
          entity_id: 'acc-1',
          organization_id: '83e58256-5905-47e5-bc00-74cd776abd13',
          created_at: new Date().toISOString(),
          description: dangerousDescription,
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          users: null,
        },
      ];

      const logsQuery = {
        ...createQueryMock({ data: mockLogs, error: null, count: 1 }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: mockLogs, error: null, count: 1 }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return orgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await exportAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13', undefined, {
        format: 'csv',
      });

      expect(result.success).toBe(true);
      const csv = result.data as string;

      // Check that dangerous formula is properly quoted
      expect(csv).toContain('"=1+1"');
    });

    it('should validate action types are from allowed enum', async () => {
      const mockUser = { id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5', email: 'admin@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const orgQuery = createQueryMock({
        data: { role: 'admin' },
        error: null,
      });

      const logsQuery = createQueryMock({
        data: [],
        error: null,
        count: 0,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return orgQuery;
        }
        if (table === 'audit_logs') {
          return logsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const validActions = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE'];

      for (const action of validActions) {
        const result = await getAuditLogs('83e58256-5905-47e5-bc00-74cd776abd13', {
          action: action as any,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Concurrent Access and Race Conditions', () => {
    it('should handle concurrent audit log creation', async () => {
      const createPromises = Array.from({ length: 10 }, (_, i) =>
        createAuditLog({
          userId: `user-${i}`,
          action: 'CREATE',
          entityType: 'account',
          entityId: `account-${i}`,
          organizationId: '83e58256-5905-47e5-bc00-74cd776abd13',
          description: `Concurrent create ${i}`,
        })
      );

      mockSupabaseClient.from.mockImplementation(() => {
        const logData = {
          id: `log-${Math.random()}`,
          user_id: 'fcdec6df-4d44-4bc6-b7c7-c5b58efface5',
          action: 'CREATE',
          entity_type: 'account',
          entity_id: '07e99801-2c11-47de-8df3-efbbb1c3ee6d',
          organization_id: '83e58256-5905-47e5-bc00-74cd776abd13',
          created_at: new Date().toISOString(),
        };
        return {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: logData, error: null }),
        };
      });

      const results = await Promise.all(createPromises);

      expect(results.every((r) => r.success)).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(10);
    });
  });
});
