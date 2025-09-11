import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

import {
  getAccountingPeriods,
  createAccountingPeriod,
  updateAccountingPeriod,
  deleteAccountingPeriod,
  closeAccountingPeriod,
  getActiveAccountingPeriod,
  reopenAccountingPeriod,
  activateAccountingPeriod,
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

// Mock type guards
jest.mock('../utils/type-guards', () => ({
  ...jest.requireActual('../utils/type-guards'),
  extractUserRole: jest.fn(),
}));

const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockAuditEntityChange = auditEntityChange as jest.MockedFunction<typeof auditEntityChange>;
const mockRateLimitMiddleware = rateLimiter.rateLimitMiddleware as jest.MockedFunction<
  typeof rateLimiter.rateLimitMiddleware
>;
const mockExtractUserRole = typeGuards.extractUserRole as jest.MockedFunction<
  typeof typeGuards.extractUserRole
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

    it('should accept valid orderBy parameters', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockUserOrg = { role: 'admin' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createQueryMock({ data: mockUserOrg, error: null });
      const periodsQuery = createQueryMock({ data: [], error: null, count: 0 });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        return periodsQuery;
      });

      const result = await getAccountingPeriods('org-123', {
        orderBy: 'name',
      });

      expect(result.success).toBe(true);
      expect(periodsQuery.order).toHaveBeenCalledWith('name', { ascending: false });
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
      let periodCallCount = 0;

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'accounting_periods') {
          periodCallCount++;
          // First call is overlap check
          if (periodCallCount === 1) {
            return createQueryMock({ data: [], error: null });
          }
          // Second call is insert
          return {
            ...createQueryMock({ data: mockNewPeriod, error: null }),
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockNewPeriod, error: null }),
          };
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
      expect(result.error?.message).toContain('指定された期間は既存の会計期間と重複しています');
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
      let periodCallCount = 0;

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'accounting_periods') {
          periodCallCount++;
          // First call is overlap check
          if (periodCallCount === 1) {
            return createQueryMock({ data: [], error: null });
          }
          // Second call is insert
          return {
            ...createQueryMock({ data: mockNewPeriod, error: null }),
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockNewPeriod, error: null }),
          };
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

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'accounting_periods') {
          callCount++;
          if (callCount === 1) {
            // First call is to fetch existing with user_organizations join
            return {
              ...createQueryMock({ data: mockExistingPeriod, error: null }),
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: mockExistingPeriod, error: null }),
            };
          }
          // Second call is to update
          return {
            ...createQueryMock({ data: mockUpdatedPeriod, error: null }),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockUpdatedPeriod, error: null }),
          };
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

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'accounting_periods') {
          return {
            ...createQueryMock({ data: mockExistingPeriod, error: null }),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockExistingPeriod, error: null }),
          };
        }
        return createQueryMock({ data: null, error: null });
      });

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

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'accounting_periods') {
          callCount++;
          if (callCount === 1) {
            // Fetch existing period
            return {
              ...createQueryMock({ data: mockExistingPeriod, error: null }),
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: mockExistingPeriod, error: null }),
            };
          } else if (callCount === 2) {
            // Check for other periods
            return createQueryMock({ data: [{ id: 'other' }], error: null });
          } else {
            // Delete period
            return {
              ...createQueryMock({ data: { id: 'period-1' }, error: null }),
              delete: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: { id: 'period-1' }, error: null }),
            };
          }
        }
        if (table === 'journal_entries') {
          return createQueryMock({ data: [], error: null });
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

  describe('reopenAccountingPeriod', () => {
    it('should reopen a closed accounting period for admin', async () => {
      const mockUser = { id: 'user-123', email: 'admin@example.com' };
      const mockPeriod = {
        id: 'period-123',
        organization_id: 'org-123',
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        is_closed: true,
        closed_at: '2024-12-31T23:59:59Z',
        closed_by: 'user-456',
        user_organizations: { role: 'admin' },
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createQueryMock({
        data: mockPeriod,
        error: null,
      });

      const updateQuery = createQueryMock({
        data: {
          ...mockPeriod,
          is_closed: false,
          closed_at: null,
          closed_by: null,
        },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'accounting_periods') {
          if (mockSupabaseClient.from.mock.calls.length === 1) {
            return fetchQuery;
          }
          return updateQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      mockExtractUserRole.mockReturnValue('admin');

      const result = await reopenAccountingPeriod('period-123');

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        is_closed: false,
        closed_at: null,
        closed_by: null,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/accounting-periods');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/journal-entries');
    });

    it('should return error when user is not admin', async () => {
      const mockUser = { id: 'user-123', email: 'accountant@example.com' };
      const mockPeriod = {
        id: 'period-123',
        organization_id: 'org-123',
        name: '2024年度',
        is_closed: true,
        user_organizations: { role: 'accountant' },
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createQueryMock({
        data: mockPeriod,
        error: null,
      });

      mockSupabaseClient.from.mockImplementation(() => fetchQuery);
      mockExtractUserRole.mockReturnValue('accountant');

      const result = await reopenAccountingPeriod('period-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
      expect(result.error?.message).toContain('管理者権限が必要');
    });

    it('should return error when period is already open', async () => {
      const mockUser = { id: 'user-123', email: 'admin@example.com' };
      const mockPeriod = {
        id: 'period-123',
        organization_id: 'org-123',
        name: '2024年度',
        is_closed: false,
        user_organizations: { role: 'admin' },
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createQueryMock({
        data: mockPeriod,
        error: null,
      });

      mockSupabaseClient.from.mockImplementation(() => fetchQuery);
      mockExtractUserRole.mockReturnValue('admin');

      const result = await reopenAccountingPeriod('period-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('既に開いています');
    });

    it('should handle database errors gracefully', async () => {
      const mockUser = { id: 'user-123', email: 'admin@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const errorQuery = createQueryMock({
        data: null,
        error: new Error('Database connection failed'),
      });

      mockSupabaseClient.from.mockImplementation(() => errorQuery);

      const result = await reopenAccountingPeriod('period-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.NOT_FOUND);
    });
  });

  describe('activateAccountingPeriod', () => {
    it('should activate (open) a closed accounting period', async () => {
      const mockUser = { id: 'user-123', email: 'accountant@example.com' };
      const mockPeriod = {
        id: 'period-123',
        organization_id: 'org-123',
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        is_closed: true,
        closed_at: '2024-12-31T23:59:59Z',
        closed_by: 'user-456',
        user_organizations: { role: 'accountant' },
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createQueryMock({
        data: mockPeriod,
        error: null,
      });

      const updateQuery = createQueryMock({
        data: {
          ...mockPeriod,
          is_closed: false,
          closed_at: null,
          closed_by: null,
        },
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'accounting_periods') {
          if (mockSupabaseClient.from.mock.calls.length === 1) {
            return fetchQuery;
          }
          return updateQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      mockExtractUserRole.mockReturnValue('accountant');

      const result = await activateAccountingPeriod('period-123');

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        is_closed: false,
        closed_at: null,
        closed_by: null,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/accounting-periods');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/settings/accounting-periods');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/journal-entries');
    });

    it('should return existing period if already open', async () => {
      const mockUser = { id: 'user-123', email: 'accountant@example.com' };
      const mockPeriod = {
        id: 'period-123',
        organization_id: 'org-123',
        name: '2024年度',
        is_closed: false,
        user_organizations: { role: 'accountant' },
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createQueryMock({
        data: mockPeriod,
        error: null,
      });

      mockSupabaseClient.from.mockImplementation(() => fetchQuery);
      mockExtractUserRole.mockReturnValue('accountant');

      const result = await activateAccountingPeriod('period-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPeriod);
      // Should not attempt to update
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1);
    });

    it('should reject viewer role from activating periods', async () => {
      const mockUser = { id: 'user-123', email: 'viewer@example.com' };
      const mockPeriod = {
        id: 'period-123',
        organization_id: 'org-123',
        name: '2024年度',
        is_closed: true,
        user_organizations: { role: 'viewer' },
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createQueryMock({
        data: mockPeriod,
        error: null,
      });

      mockSupabaseClient.from.mockImplementation(() => fetchQuery);
      mockExtractUserRole.mockReturnValue('viewer');

      const result = await activateAccountingPeriod('period-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('should validate period ID format', async () => {
      const mockUser = { id: 'user-123', email: 'admin@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Test with invalid UUID format
      const result = await activateAccountingPeriod('invalid-uuid');

      // Should still proceed but fail at DB level
      expect(result.success).toBe(false);
    });

    it('should handle concurrent activation attempts', async () => {
      const mockUser = { id: 'user-123', email: 'admin@example.com' };
      const mockPeriod = {
        id: 'period-123',
        organization_id: 'org-123',
        name: '2024年度',
        is_closed: true,
        user_organizations: { role: 'admin' },
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createQueryMock({
        data: mockPeriod,
        error: null,
      });

      const updateQuery = createQueryMock({
        data: null,
        error: { code: '23505', message: 'Unique constraint violation' },
      });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? fetchQuery : updateQuery;
      });

      mockExtractUserRole.mockReturnValue('admin');

      const result = await activateAccountingPeriod('period-123');

      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases and Boundary Testing', () => {
    it('should handle maximum date range (2 years)', async () => {
      const mockUser = { id: 'user-123', email: 'admin@example.com' };
      const twoYearsFromNow = new Date();
      twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const orgQuery = createQueryMock({
        data: { role: 'admin' },
        error: null,
      });

      const overlapQuery = createQueryMock({
        data: [],
        error: null,
      });

      const createQuery = createQueryMock({
        data: {
          id: 'new-period',
          organization_id: 'org-123',
          name: '長期計画',
          start_date: new Date().toISOString().split('T')[0],
          end_date: twoYearsFromNow.toISOString().split('T')[0],
          is_closed: false,
        },
        error: null,
      });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return orgQuery;
        }
        if (table === 'accounting_periods') {
          callCount++;
          if (callCount === 1) {
            return overlapQuery;
          }
          return createQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await createAccountingPeriod('org-123', {
        name: '長期計画',
        start_date: new Date().toISOString().split('T')[0],
        end_date: twoYearsFromNow.toISOString().split('T')[0],
      });

      expect(result.success).toBe(true);
    });

    it('should handle special characters in period names', async () => {
      const mockUser = { id: 'user-123', email: 'admin@example.com' };
      const specialName = '2024年度 (第1四半期) & 特別会計期間';

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const orgQuery = createQueryMock({
        data: { role: 'admin' },
        error: null,
      });

      const overlapQuery = createQueryMock({
        data: [],
        error: null,
      });

      const createQuery = createQueryMock({
        data: {
          id: 'new-period',
          organization_id: 'org-123',
          name: specialName,
          start_date: '2024-01-01',
          end_date: '2024-03-31',
          is_closed: false,
        },
        error: null,
      });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return orgQuery;
        }
        if (table === 'accounting_periods') {
          callCount++;
          if (callCount === 1) {
            return overlapQuery;
          }
          return createQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await createAccountingPeriod('org-123', {
        name: specialName,
        start_date: '2024-01-01',
        end_date: '2024-03-31',
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe(specialName);
    });

    it('should handle pagination with large datasets', async () => {
      const mockUser = { id: 'user-123', email: 'viewer@example.com' };
      const mockPeriods = Array.from({ length: 100 }, (_, i) => ({
        id: `period-${i}`,
        organization_id: 'org-123',
        name: `Period ${i}`,
        start_date: `2024-${String((i % 12) + 1).padStart(2, '0')}-01`,
        end_date: `2024-${String((i % 12) + 1).padStart(2, '0')}-28`,
        is_closed: i % 2 === 0,
      }));

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const orgQuery = createQueryMock({
        data: { role: 'viewer' },
        error: null,
      });

      const periodsQuery = {
        ...createQueryMock({
          data: mockPeriods.slice(40, 60),
          error: null,
          count: 100,
        }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: mockPeriods.slice(40, 60),
          error: null,
          count: 100,
        }),
      };

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return orgQuery;
        }
        if (table === 'accounting_periods') {
          return periodsQuery;
        }
        return createQueryMock({ data: null, error: null });
      });

      const result = await getAccountingPeriods('org-123', {
        page: 3,
        pageSize: 20,
      });

      expect(result.success).toBe(true);
      expect(result.data?.items.length).toBe(20);
      expect(result.data?.pagination.totalCount).toBe(100);
      expect(result.data?.pagination.totalPages).toBe(5);
      expect(result.data?.pagination.page).toBe(3);
    });
  });

  describe('Performance and Timeout Tests', () => {
    it('should complete within timeout limit (30 seconds)', async () => {
      const startTime = Date.now();
      const mockUser = { id: 'user-123', email: 'admin@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const query = createQueryMock({
        data: [],
        error: null,
        count: 0,
      });

      mockSupabaseClient.from.mockImplementation(() => query);

      await getAccountingPeriods('org-123');

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(30000); // 30 seconds
    });

    it('should handle rate limiting correctly', async () => {
      const mockUser = { id: 'user-123', email: 'admin@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockRateLimitMiddleware.mockResolvedValueOnce({
        success: false,
        error: {
          code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
          message: 'Too many requests',
        },
      });

      const result = await deleteAccountingPeriod('period-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED);
    });
  });
});
