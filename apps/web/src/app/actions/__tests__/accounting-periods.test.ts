import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

import {
  getAccountingPeriods,
  createAccountingPeriod,
  updateAccountingPeriod,
  deleteAccountingPeriod,
  closeAccountingPeriod,
  getActiveAccountingPeriod,
} from '../accounting-periods';
import { auditEntityChange } from '../audit-logs';
import { ERROR_CODES } from '../types';
import * as rateLimiter from '../utils/rate-limiter';
import * as typeGuards from '../utils/type-guards';

// Mock dependencies
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('../audit-logs', () => ({
  auditEntityChange: jest.fn(),
}));

// Spy on rate limiter
jest.mock('../utils/rate-limiter', () => ({
  ...jest.requireActual('../utils/rate-limiter'),
  rateLimitMiddleware: jest.fn(),
}));

const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockAuditEntityChange = auditEntityChange as jest.MockedFunction<typeof auditEntityChange>;
const mockRateLimitMiddleware = rateLimiter.rateLimitMiddleware as jest.MockedFunction<
  typeof rateLimiter.rateLimitMiddleware
>;

describe('Accounting Periods Server Actions', () => {
  let mockSupabaseClient: any;

  // Helper function to create a chainable query mock
  const createQueryMock = (finalResult: any) => {
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnValue(Promise.resolve(finalResult)),
      single: jest.fn().mockResolvedValue(finalResult),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnValue(Promise.resolve(finalResult)),
      limit: jest.fn().mockReturnThis(),
    };

    // Make chainable methods return the query object
    Object.keys(query).forEach((key) => {
      if (key !== 'range' && key !== 'single' && key !== 'delete') {
        const originalFn = query[key as keyof typeof query];
        query[key as keyof typeof query] = jest.fn((...args) => {
          originalFn(...args);
          return query;
        });
      }
    });

    return query;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default rate limit mock - not exceeded
    mockRateLimitMiddleware.mockResolvedValue(undefined);

    // Create mock Supabase client
    mockSupabaseClient = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    };

    mockCreateClient.mockResolvedValue(mockSupabaseClient);
  });

  describe('getAccountingPeriods', () => {
    it('should return accounting periods with pagination', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockUserOrg = { role: 'admin' };
      const mockPeriods = [
        {
          id: 'period-1',
          name: '2024年度',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          organization_id: 'org-123',
          is_closed: false,
        },
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const periodsQuery = createQueryMock({
        data: mockPeriods,
        error: null,
        count: 1,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'accounting_periods') {
          return periodsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await getAccountingPeriods('org-123', {
        page: 1,
        pageSize: 20,
      });

      expect(result.success).toBe(true);
      expect(result.data?.items).toEqual(mockPeriods);
      expect(result.data?.pagination).toEqual({
        page: 1,
        pageSize: 20,
        totalCount: 1,
        totalPages: 1,
      });
    });

    it('should return unauthorized when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await getAccountingPeriods('org-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('should return forbidden when user has no access to organization', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: null, error: { message: 'Not found' } });
      mockSupabaseClient.from.mockReturnValue(userOrgQuery);

      const result = await getAccountingPeriods('org-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('should validate and reject SQL injection in orderBy parameter', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockUserOrg = { role: 'admin' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        return createQueryMock({ data: [], error: null, count: 0 });
      });

      const result = await getAccountingPeriods('org-123', {
        orderBy: 'name; DROP TABLE users; --',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('無効なソート条件');
    });

    it('should handle search parameter correctly', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockUserOrg = { role: 'viewer' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const periodsQuery = createQueryMock({
        data: [],
        error: null,
        count: 0,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'accounting_periods') {
          return periodsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      await getAccountingPeriods('org-123', {
        search: '2024',
      });

      expect(periodsQuery.ilike).toHaveBeenCalledWith('name', '%2024%');
    });
  });

  describe('createAccountingPeriod', () => {
    it('should create accounting period with valid data', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockUserOrg = { role: 'admin' };
      const mockNewPeriod = {
        id: 'period-new',
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        organization_id: 'org-123',
        is_closed: false,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const overlapQuery = createQueryMock({ data: [], error: null }); // No overlap
      const insertQuery = createQueryMock({ data: mockNewPeriod, error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'accounting_periods') {
          // First call is overlap check, second is insert
          if (insertQuery.insert.mock.calls.length === 0) {
            return overlapQuery;
          }
          return insertQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await createAccountingPeriod('org-123', {
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockNewPeriod);
      expect(mockAuditEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          entityType: 'accounting_period',
          entityId: 'period-new',
          organizationId: 'org-123',
        })
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/accounting-periods');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/journal-entries');
    });

    it('should reject invalid input data', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await createAccountingPeriod('org-123', {
        name: '', // Invalid - empty name
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject XSS attempts in name', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await createAccountingPeriod('org-123', {
        name: '<script>alert("XSS")</script>',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('使用できない文字');
    });

    it('should reject overlapping periods', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockUserOrg = { role: 'admin' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const overlapQuery = createQueryMock({
        data: [{ id: 'existing-period' }], // Has overlap
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'accounting_periods') {
          return overlapQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await createAccountingPeriod('org-123', {
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('重複');
    });

    it('should reject viewers from creating periods', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockUserOrg = { role: 'viewer' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      mockSupabaseClient.from.mockReturnValue(userOrgQuery);

      const result = await createAccountingPeriod('org-123', {
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('should handle audit log failures gracefully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockUserOrg = { role: 'admin' };
      const mockNewPeriod = {
        id: 'period-new',
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        organization_id: 'org-123',
        is_closed: false,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const overlapQuery = createQueryMock({ data: [], error: null });
      const insertQuery = createQueryMock({ data: mockNewPeriod, error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'accounting_periods') {
          if (insertQuery.insert.mock.calls.length === 0) {
            return overlapQuery;
          }
          return insertQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      // Simulate audit log failure
      mockAuditEntityChange.mockRejectedValueOnce(new Error('Audit log error'));

      const result = await createAccountingPeriod('org-123', {
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      });

      // Should still succeed despite audit log failure
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockNewPeriod);
    });
  });

  describe('updateAccountingPeriod', () => {
    it('should update accounting period with valid data', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockExistingPeriod = {
        id: 'period-1',
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        organization_id: 'org-123',
        is_closed: false,
        user_organizations: [{ role: 'admin' }],
      };
      const mockUpdatedPeriod = {
        ...mockExistingPeriod,
        name: '2024年度（更新）',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createQueryMock({ data: mockExistingPeriod, error: null });
      const updateQuery = createQueryMock({ data: mockUpdatedPeriod, error: null });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'accounting_periods') {
          callCount++;
          if (callCount === 1) {
            return fetchQuery; // First call is to fetch existing
          }
          return updateQuery; // Second call is to update
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await updateAccountingPeriod('period-1', {
        name: '2024年度（更新）',
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('2024年度（更新）');
      expect(mockAuditEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          entityType: 'accounting_period',
          entityId: 'period-1',
        })
      );
    });

    it('should reject updating closed period', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockExistingPeriod = {
        id: 'period-1',
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        organization_id: 'org-123',
        is_closed: true, // Closed period
        user_organizations: [{ role: 'admin' }],
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createQueryMock({ data: mockExistingPeriod, error: null });
      mockSupabaseClient.from.mockReturnValue(fetchQuery);

      const result = await updateAccountingPeriod('period-1', {
        name: '2024年度（更新）',
        is_closed: false, // Trying to reopen
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('閉じられた会計期間');
    });

    it('should use type guard for role extraction', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockExistingPeriod = {
        id: 'period-1',
        name: '2024年度',
        organization_id: 'org-123',
        user_organizations: [{ role: 'viewer' }],
      };

      const extractUserRoleSpy = jest.spyOn(typeGuards, 'extractUserRole');

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createQueryMock({ data: mockExistingPeriod, error: null });
      mockSupabaseClient.from.mockReturnValue(fetchQuery);

      const result = await updateAccountingPeriod('period-1', {
        name: '2024年度（更新）',
      });

      expect(extractUserRoleSpy).toHaveBeenCalledWith(mockExistingPeriod);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.FORBIDDEN);
    });
  });

  describe('deleteAccountingPeriod', () => {
    it('should apply rate limiting to delete operations', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Simulate rate limit exceeded
      mockRateLimitMiddleware.mockResolvedValueOnce({
        success: false,
        error: {
          code: ERROR_CODES.LIMIT_EXCEEDED,
          message: 'Rate limit exceeded',
          details: { retryAfter: 60 },
        },
      });

      const result = await deleteAccountingPeriod('period-1');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.LIMIT_EXCEEDED);
      expect(mockRateLimitMiddleware).toHaveBeenCalledWith(
        rateLimiter.RATE_LIMIT_CONFIGS.DELETE,
        'user-123'
      );
    });

    it('should delete accounting period when no journal entries exist', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockExistingPeriod = {
        id: 'period-1',
        name: '2024年度',
        organization_id: 'org-123',
        is_closed: false,
        user_organizations: [{ role: 'admin' }],
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createQueryMock({ data: mockExistingPeriod, error: null });
      const journalQuery = createQueryMock({ data: [], error: null }); // No journal entries
      const otherPeriodsQuery = createQueryMock({ data: [{ id: 'other' }], error: null });
      const deleteQuery = createQueryMock({ error: null });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'accounting_periods') {
          callCount++;
          if (callCount === 1) {
            return fetchQuery;
          } else if (callCount === 2) {
            return otherPeriodsQuery;
          } else {
            return deleteQuery;
          }
        }
        if (table === 'journal_entries') {
          return journalQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await deleteAccountingPeriod('period-1');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('period-1');
      expect(mockAuditEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE',
          entityType: 'accounting_period',
          entityId: 'period-1',
        })
      );
    });

    it('should reject deletion when journal entries exist', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockExistingPeriod = {
        id: 'period-1',
        name: '2024年度',
        organization_id: 'org-123',
        user_organizations: [{ role: 'admin' }],
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createQueryMock({ data: mockExistingPeriod, error: null });
      const journalQuery = createQueryMock({
        data: [{ id: 'journal-1' }], // Has journal entries
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'accounting_periods') {
          return fetchQuery;
        }
        if (table === 'journal_entries') {
          return journalQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await deleteAccountingPeriod('period-1');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('仕訳が存在');
    });

    it('should reject deletion of last active period', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockExistingPeriod = {
        id: 'period-1',
        name: '2024年度',
        organization_id: 'org-123',
        is_closed: false, // Active period
        user_organizations: [{ role: 'admin' }],
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createQueryMock({ data: mockExistingPeriod, error: null });
      const journalQuery = createQueryMock({ data: [], error: null });
      const otherPeriodsQuery = createQueryMock({ data: [], error: null }); // No other active periods

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'accounting_periods') {
          callCount++;
          if (callCount === 1) {
            return fetchQuery;
          } else {
            return otherPeriodsQuery;
          }
        }
        if (table === 'journal_entries') {
          return journalQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await deleteAccountingPeriod('period-1');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('最後のアクティブな会計期間');
    });

    it('should only allow admin to delete periods', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockExistingPeriod = {
        id: 'period-1',
        name: '2024年度',
        organization_id: 'org-123',
        user_organizations: [{ role: 'accountant' }], // Not admin
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createQueryMock({ data: mockExistingPeriod, error: null });
      mockSupabaseClient.from.mockReturnValue(fetchQuery);

      const result = await deleteAccountingPeriod('period-1');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });
  });

  describe('closeAccountingPeriod', () => {
    it('should close accounting period successfully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockExistingPeriod = {
        id: 'period-1',
        name: '2024年度',
        organization_id: 'org-123',
        is_closed: false,
        user_organizations: [{ role: 'admin' }],
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createQueryMock({ data: mockExistingPeriod, error: null });
      const journalQuery = createQueryMock({ data: [], error: null }); // No pending entries
      const updateQuery = createQueryMock({
        data: { ...mockExistingPeriod, is_closed: true },
        error: null,
      });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'accounting_periods') {
          callCount++;
          if (callCount === 1) {
            return fetchQuery;
          } else {
            return updateQuery;
          }
        }
        if (table === 'journal_entries') {
          return journalQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await closeAccountingPeriod('period-1');

      expect(result.success).toBe(true);
      expect(result.data?.is_closed).toBe(true);
    });

    it('should reject closing with pending journal entries', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockExistingPeriod = {
        id: 'period-1',
        name: '2024年度',
        organization_id: 'org-123',
        is_closed: false,
        user_organizations: [{ role: 'admin' }],
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createQueryMock({ data: mockExistingPeriod, error: null });
      const journalQuery = createQueryMock({
        data: [{ id: 'pending-1' }], // Has pending entries
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'accounting_periods') {
          return fetchQuery;
        }
        if (table === 'journal_entries') {
          return journalQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await closeAccountingPeriod('period-1');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('未承認の仕訳');
    });
  });

  describe('getActiveAccountingPeriod', () => {
    it('should return active accounting period for current date', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockUserOrg = { role: 'viewer' };
      const today = new Date().toISOString().split('T')[0];
      const mockActivePeriod = {
        id: 'period-1',
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        organization_id: 'org-123',
        is_closed: false,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const periodQuery = createQueryMock({ data: mockActivePeriod, error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'accounting_periods') {
          return periodQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await getActiveAccountingPeriod('org-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockActivePeriod);
      expect(periodQuery.eq).toHaveBeenCalledWith('is_closed', false);
      expect(periodQuery.lte).toHaveBeenCalledWith('start_date', today);
      expect(periodQuery.gte).toHaveBeenCalledWith('end_date', today);
    });

    it('should return null when no active period exists', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockUserOrg = { role: 'viewer' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const periodQuery = createQueryMock({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'accounting_periods') {
          return periodQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await getActiveAccountingPeriod('org-123');

      expect(result.success).toBe(true);
      expect(result.data).toBe(null);
    });
  });
});
