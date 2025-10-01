import { revalidatePath } from 'next/cache';

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
import { rateLimitMiddleware, RATE_LIMIT_CONFIGS } from '../utils/rate-limiter';
import * as typeGuards from '../utils/type-guards';

import { createClient } from '@/lib/supabase/server';
import { createSupabaseQueryMock } from '@/test-utils/supabase-mocks';

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

// Mock rate limiter with RATE_LIMIT_CONFIGS export
jest.mock('../utils/rate-limiter', () => ({
  rateLimitMiddleware: jest.fn(),
  RATE_LIMIT_CONFIGS: {
    DELETE: { limit: 5, windowMs: 60000 },
  },
}));

// Mock type guards - but keep extractUserRole working
jest.mock('../utils/type-guards', () => {
  const actual = jest.requireActual('../utils/type-guards');
  return {
    ...actual,
    extractUserRole: jest.fn(actual.extractUserRole),
  };
});

const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockAuditEntityChange = auditEntityChange as jest.MockedFunction<typeof auditEntityChange>;
const mockRateLimitMiddleware = rateLimitMiddleware as jest.MockedFunction<
  typeof rateLimitMiddleware
>;
const mockExtractUserRole = typeGuards.extractUserRole as jest.MockedFunction<
  typeof typeGuards.extractUserRole
>;

describe('Accounting Periods Server Actions', () => {
  let mockSupabaseClient: any;

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
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };
      const mockUserOrg = { role: 'admin' };
      const mockPeriods = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: '2024年度',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          organization_id: '550e8400-e29b-41d4-a716-446655440002',
          is_closed: false,
        },
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createSupabaseQueryMock({ data: mockUserOrg, error: null });
      const periodsQuery = createSupabaseQueryMock({
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
        return createSupabaseQueryMock({ data: null, error: null });
      });

      const result = await getAccountingPeriods('550e8400-e29b-41d4-a716-446655440002', {
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

      const result = await getAccountingPeriods('550e8400-e29b-41d4-a716-446655440002');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('should return forbidden when user has no access to organization', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createSupabaseQueryMock({ data: null, error: { message: 'Not found' } });
      mockSupabaseClient.from.mockReturnValue(userOrgQuery);

      const result = await getAccountingPeriods('550e8400-e29b-41d4-a716-446655440002');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('should accept valid orderBy parameters', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };
      const mockUserOrg = { role: 'admin' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createSupabaseQueryMock({ data: mockUserOrg, error: null });
      const periodsQuery = createSupabaseQueryMock({ data: [], error: null, count: 0 });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        return periodsQuery;
      });

      const result = await getAccountingPeriods('550e8400-e29b-41d4-a716-446655440002', {
        orderBy: 'name',
      });

      expect(result.success).toBe(true);
      expect(periodsQuery.order).toHaveBeenCalledWith('name', { ascending: false });
    });

    it('should handle search parameter correctly', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };
      const mockUserOrg = { role: 'viewer' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createSupabaseQueryMock({ data: mockUserOrg, error: null });
      const periodsQuery = createSupabaseQueryMock({
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
        return createSupabaseQueryMock({ data: null, error: null });
      });

      await getAccountingPeriods('550e8400-e29b-41d4-a716-446655440002', {
        search: '2024',
      });

      expect(periodsQuery.ilike).toHaveBeenCalledWith('name', '%2024%');
    });
  });

  describe('createAccountingPeriod', () => {
    it('should create accounting period with valid data', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };
      const mockUserOrg = { role: 'admin' };
      const mockNewPeriod = {
        id: '660e8400-e29b-41d4-a716-446655440000',
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
        is_closed: false,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createSupabaseQueryMock({ data: mockUserOrg, error: null });
      let periodCallCount = 0;

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'accounting_periods') {
          periodCallCount++;
          // First call is overlap check
          if (periodCallCount === 1) {
            return createSupabaseQueryMock({ data: [], error: null });
          }
          // Second call is insert
          return {
            ...createSupabaseQueryMock({ data: mockNewPeriod, error: null }),
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockNewPeriod, error: null }),
          };
        }
        return createSupabaseQueryMock({ data: null, error: null });
      });

      const result = await createAccountingPeriod('550e8400-e29b-41d4-a716-446655440002', {
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockNewPeriod);
      // Audit log is not implemented in the current version
      expect(mockAuditEntityChange).not.toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/accounting-periods');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/journal-entries');
    });

    it('should reject invalid input data', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await createAccountingPeriod('550e8400-e29b-41d4-a716-446655440002', {
        name: '', // Invalid - empty name
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should reject XSS attempts in name', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await createAccountingPeriod('550e8400-e29b-41d4-a716-446655440002', {
        name: '<script>alert("XSS")</script>',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('使用できない文字');
    });

    it('should reject overlapping periods', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };
      const mockUserOrg = { role: 'admin' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createSupabaseQueryMock({ data: mockUserOrg, error: null });
      const overlapQuery = createSupabaseQueryMock({
        data: [{ id: '550e8400-e29b-41d4-a716-446655440099' }], // Has overlap
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'accounting_periods') {
          return overlapQuery;
        }
        return createSupabaseQueryMock({ data: null, error: null });
      });

      const result = await createAccountingPeriod('550e8400-e29b-41d4-a716-446655440002', {
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('指定された期間は既存の会計期間と重複しています');
    });

    it('should reject viewers from creating periods', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };
      const mockUserOrg = { role: 'viewer' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createSupabaseQueryMock({ data: mockUserOrg, error: null });
      mockSupabaseClient.from.mockReturnValue(userOrgQuery);

      const result = await createAccountingPeriod('550e8400-e29b-41d4-a716-446655440002', {
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('should handle database insertion correctly', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };
      const mockUserOrg = { role: 'admin' };
      const mockNewPeriod = {
        id: '660e8400-e29b-41d4-a716-446655440000',
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
        is_closed: false,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createSupabaseQueryMock({ data: mockUserOrg, error: null });
      let periodCallCount = 0;

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'accounting_periods') {
          periodCallCount++;
          // First call is overlap check
          if (periodCallCount === 1) {
            return createSupabaseQueryMock({ data: [], error: null });
          }
          // Second call is insert
          return {
            ...createSupabaseQueryMock({ data: mockNewPeriod, error: null }),
            insert: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockNewPeriod, error: null }),
          };
        }
        return createSupabaseQueryMock({ data: null, error: null });
      });

      const result = await createAccountingPeriod('550e8400-e29b-41d4-a716-446655440002', {
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      });

      // Should succeed
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockNewPeriod);
    });
  });

  describe('updateAccountingPeriod', () => {
    it('should update accounting period with valid data', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };
      const mockExistingPeriod = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
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
            const query = createSupabaseQueryMock({ data: mockExistingPeriod, error: null });
            // Override single to ensure it returns the proper data
            query.single = jest.fn().mockResolvedValue({ data: mockExistingPeriod, error: null });
            return query;
          }
          // Second call is to update
          const query = createSupabaseQueryMock({ data: mockUpdatedPeriod, error: null });
          query.single = jest.fn().mockResolvedValue({ data: mockUpdatedPeriod, error: null });
          return query;
        }
        return createSupabaseQueryMock({ data: null, error: null });
      });

      const result = await updateAccountingPeriod('550e8400-e29b-41d4-a716-446655440001', {
        name: '2024年度（更新）',
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('2024年度（更新）');
      // Audit log is not implemented in the current version
      expect(mockAuditEntityChange).not.toHaveBeenCalled();
    });

    it('should reject updating closed period', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };
      const mockExistingPeriod = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
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
            ...createSupabaseQueryMock({ data: mockExistingPeriod, error: null }),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockExistingPeriod, error: null }),
          };
        }
        return createSupabaseQueryMock({ data: null, error: null });
      });

      const result = await updateAccountingPeriod('550e8400-e29b-41d4-a716-446655440001', {
        name: '2024年度（更新）',
        is_closed: false, // Trying to reopen
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('閉じられた会計期間');
    });

    it('should use type guard for role extraction', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };
      const mockExistingPeriod = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: '2024年度',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
        user_organizations: [{ role: 'viewer' }],
      };

      const extractUserRoleSpy = jest.spyOn(typeGuards, 'extractUserRole');

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createSupabaseQueryMock({ data: mockExistingPeriod, error: null });
      mockSupabaseClient.from.mockReturnValue(fetchQuery);

      const result = await updateAccountingPeriod('550e8400-e29b-41d4-a716-446655440001', {
        name: '2024年度（更新）',
      });

      expect(extractUserRoleSpy).toHaveBeenCalledWith(mockExistingPeriod);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.FORBIDDEN);
    });
  });

  describe('deleteAccountingPeriod', () => {
    it('should apply rate limiting to delete operations', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };

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

      const result = await deleteAccountingPeriod('550e8400-e29b-41d4-a716-446655440001');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.LIMIT_EXCEEDED);
      expect(mockRateLimitMiddleware).toHaveBeenCalledWith(
        RATE_LIMIT_CONFIGS.DELETE,
        '550e8400-e29b-41d4-a716-446655440003'
      );
    });

    it('should delete accounting period when no journal entries exist', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };
      const mockExistingPeriod = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: '2024年度',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
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
              ...createSupabaseQueryMock({ data: mockExistingPeriod, error: null }),
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: mockExistingPeriod, error: null }),
            };
          } else if (callCount === 2) {
            // Check for other periods
            return createSupabaseQueryMock({
              data: [{ id: '550e8400-e29b-41d4-a716-446655440092' }],
              error: null,
            });
          } else {
            // Delete period
            return {
              ...createSupabaseQueryMock({
                data: { id: '550e8400-e29b-41d4-a716-446655440001' },
                error: null,
              }),
              delete: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { id: '550e8400-e29b-41d4-a716-446655440001' },
                error: null,
              }),
            };
          }
        }
        if (table === 'journal_entries') {
          return createSupabaseQueryMock({ data: [], error: null });
        }
        return createSupabaseQueryMock({ data: null, error: null });
      });

      const result = await deleteAccountingPeriod('550e8400-e29b-41d4-a716-446655440001');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('550e8400-e29b-41d4-a716-446655440001');
      // Audit log is not implemented in the current version
      expect(mockAuditEntityChange).not.toHaveBeenCalled();
    });

    it('should reject deletion when journal entries exist', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };
      const mockExistingPeriod = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: '2024年度',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
        user_organizations: [{ role: 'admin' }],
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createSupabaseQueryMock({ data: mockExistingPeriod, error: null });
      const journalQuery = createSupabaseQueryMock({
        data: [{ id: '550e8400-e29b-41d4-a716-446655440090' }], // Has journal entries
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'accounting_periods') {
          return fetchQuery;
        }
        if (table === 'journal_entries') {
          return journalQuery;
        }
        return createSupabaseQueryMock({ data: null, error: null });
      });

      const result = await deleteAccountingPeriod('550e8400-e29b-41d4-a716-446655440001');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('仕訳が存在');
    });

    it('should reject deletion of last active period', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };
      const mockExistingPeriod = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: '2024年度',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
        is_closed: false, // Active period
        user_organizations: [{ role: 'admin' }],
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createSupabaseQueryMock({ data: mockExistingPeriod, error: null });
      const journalQuery = createSupabaseQueryMock({ data: [], error: null });
      const otherPeriodsQuery = createSupabaseQueryMock({ data: [], error: null }); // No other active periods

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
        return createSupabaseQueryMock({ data: null, error: null });
      });

      const result = await deleteAccountingPeriod('550e8400-e29b-41d4-a716-446655440001');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('最後のアクティブな会計期間');
    });

    it('should only allow admin to delete periods', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };
      const mockExistingPeriod = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: '2024年度',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
        user_organizations: [{ role: 'accountant' }], // Not admin
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createSupabaseQueryMock({ data: mockExistingPeriod, error: null });
      mockSupabaseClient.from.mockReturnValue(fetchQuery);

      const result = await deleteAccountingPeriod('550e8400-e29b-41d4-a716-446655440001');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });
  });

  describe('closeAccountingPeriod', () => {
    it('should close accounting period successfully', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };
      const mockExistingPeriod = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: '2024年度',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
        is_closed: false,
        user_organizations: [{ role: 'admin' }],
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createSupabaseQueryMock({ data: mockExistingPeriod, error: null });
      const journalQuery = createSupabaseQueryMock({ data: [], error: null }); // No pending entries
      const updateQuery = createSupabaseQueryMock({
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
        return createSupabaseQueryMock({ data: null, error: null });
      });

      const result = await closeAccountingPeriod('550e8400-e29b-41d4-a716-446655440001');

      expect(result.success).toBe(true);
      expect(result.data?.is_closed).toBe(true);
    });

    it('should reject closing with pending journal entries', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };
      const mockExistingPeriod = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: '2024年度',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
        is_closed: false,
        user_organizations: [{ role: 'admin' }],
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createSupabaseQueryMock({ data: mockExistingPeriod, error: null });
      const journalQuery = createSupabaseQueryMock({
        data: [{ id: '550e8400-e29b-41d4-a716-446655440091' }], // Has pending entries
        error: null,
      });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'accounting_periods') {
          return fetchQuery;
        }
        if (table === 'journal_entries') {
          return journalQuery;
        }
        return createSupabaseQueryMock({ data: null, error: null });
      });

      const result = await closeAccountingPeriod('550e8400-e29b-41d4-a716-446655440001');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('未承認の仕訳');
    });
  });

  describe('getActiveAccountingPeriod', () => {
    it('should return active accounting period for current date', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };
      const mockUserOrg = { role: 'viewer' };
      const today = new Date().toISOString().split('T')[0];
      const mockActivePeriod = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
        is_closed: false,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createSupabaseQueryMock({ data: mockUserOrg, error: null });
      const periodQuery = createSupabaseQueryMock({ data: mockActivePeriod, error: null });

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'user_organizations') {
          return userOrgQuery;
        }
        if (table === 'accounting_periods') {
          return periodQuery;
        }
        return createSupabaseQueryMock({ data: null, error: null });
      });

      const result = await getActiveAccountingPeriod('550e8400-e29b-41d4-a716-446655440002');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockActivePeriod);
      expect(periodQuery.eq).toHaveBeenCalledWith('is_closed', false);
      expect(periodQuery.lte).toHaveBeenCalledWith('start_date', today);
      expect(periodQuery.gte).toHaveBeenCalledWith('end_date', today);
    });

    it('should return null when no active period exists', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'test@example.com' };
      const mockUserOrg = { role: 'viewer' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const userOrgQuery = createSupabaseQueryMock({ data: mockUserOrg, error: null });
      const periodQuery = createSupabaseQueryMock({
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
        return createSupabaseQueryMock({ data: null, error: null });
      });

      const result = await getActiveAccountingPeriod('550e8400-e29b-41d4-a716-446655440002');

      expect(result.success).toBe(true);
      expect(result.data).toBe(null);
    });
  });

  describe('reopenAccountingPeriod', () => {
    it('should reopen a closed accounting period for admin', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'admin@example.com' };
      const mockPeriod = {
        id: '770e8400-e29b-41d4-a716-446655440000',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        is_closed: true,
        closed_at: '2024-12-31T23:59:59Z',
        closed_by: '880e8400-e29b-41d4-a716-446655440000',
        user_organizations: { role: 'admin' },
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createSupabaseQueryMock({
        data: mockPeriod,
        error: null,
      });

      const updateQuery = createSupabaseQueryMock({
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
        return createSupabaseQueryMock({ data: null, error: null });
      });

      mockExtractUserRole.mockReturnValue('admin');

      const result = await reopenAccountingPeriod('770e8400-e29b-41d4-a716-446655440000');

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
      const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        email: 'accountant@example.com',
      };
      const mockPeriod = {
        id: '770e8400-e29b-41d4-a716-446655440000',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
        name: '2024年度',
        is_closed: true,
        user_organizations: { role: 'accountant' },
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createSupabaseQueryMock({
        data: mockPeriod,
        error: null,
      });

      mockSupabaseClient.from.mockImplementation(() => fetchQuery);
      mockExtractUserRole.mockReturnValue('accountant');

      const result = await reopenAccountingPeriod('770e8400-e29b-41d4-a716-446655440000');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
      expect(result.error?.message).toContain('管理者権限が必要');
    });

    it('should return error when period is already open', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'admin@example.com' };
      const mockPeriod = {
        id: '770e8400-e29b-41d4-a716-446655440000',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
        name: '2024年度',
        is_closed: false,
        user_organizations: { role: 'admin' },
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createSupabaseQueryMock({
        data: mockPeriod,
        error: null,
      });

      mockSupabaseClient.from.mockImplementation(() => fetchQuery);
      mockExtractUserRole.mockReturnValue('admin');

      const result = await reopenAccountingPeriod('770e8400-e29b-41d4-a716-446655440000');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('既に開いています');
    });

    it('should handle database errors gracefully', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'admin@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const errorQuery = createSupabaseQueryMock({
        data: null,
        error: new Error('Database connection failed'),
      });

      mockSupabaseClient.from.mockImplementation(() => errorQuery);

      const result = await reopenAccountingPeriod('770e8400-e29b-41d4-a716-446655440000');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.NOT_FOUND);
    });
  });

  describe('activateAccountingPeriod', () => {
    it('should activate (open) a closed accounting period', async () => {
      const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        email: 'accountant@example.com',
      };
      const mockPeriod = {
        id: '770e8400-e29b-41d4-a716-446655440000',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        is_closed: true,
        closed_at: '2024-12-31T23:59:59Z',
        closed_by: '880e8400-e29b-41d4-a716-446655440000',
        user_organizations: { role: 'accountant' },
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createSupabaseQueryMock({
        data: mockPeriod,
        error: null,
      });

      const updateQuery = createSupabaseQueryMock({
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
        return createSupabaseQueryMock({ data: null, error: null });
      });

      mockExtractUserRole.mockReturnValue('accountant');

      const result = await activateAccountingPeriod('770e8400-e29b-41d4-a716-446655440000');

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
      const mockUser = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        email: 'accountant@example.com',
      };
      const mockPeriod = {
        id: '770e8400-e29b-41d4-a716-446655440000',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
        name: '2024年度',
        is_closed: false,
        user_organizations: { role: 'accountant' },
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createSupabaseQueryMock({
        data: mockPeriod,
        error: null,
      });

      mockSupabaseClient.from.mockImplementation(() => fetchQuery);
      mockExtractUserRole.mockReturnValue('accountant');

      const result = await activateAccountingPeriod('770e8400-e29b-41d4-a716-446655440000');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPeriod);
      // Should not attempt to update
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1);
    });

    it('should reject viewer role from activating periods', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'viewer@example.com' };
      const mockPeriod = {
        id: '770e8400-e29b-41d4-a716-446655440000',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
        name: '2024年度',
        is_closed: true,
        user_organizations: { role: 'viewer' },
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createSupabaseQueryMock({
        data: mockPeriod,
        error: null,
      });

      mockSupabaseClient.from.mockImplementation(() => fetchQuery);
      mockExtractUserRole.mockReturnValue('viewer');

      const result = await activateAccountingPeriod('123e4567-e89b-12d3-a456-426614174000');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('should validate period ID format', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'admin@example.com' };

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
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'admin@example.com' };
      const mockPeriod = {
        id: '770e8400-e29b-41d4-a716-446655440000',
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
        name: '2024年度',
        is_closed: true,
        user_organizations: { role: 'admin' },
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fetchQuery = createSupabaseQueryMock({
        data: mockPeriod,
        error: null,
      });

      const updateQuery = createSupabaseQueryMock({
        data: null,
        error: { code: '23505', message: 'Unique constraint violation' },
      });

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? fetchQuery : updateQuery;
      });

      mockExtractUserRole.mockReturnValue('admin');

      const result = await activateAccountingPeriod('770e8400-e29b-41d4-a716-446655440000');

      expect(result.success).toBe(false);
    });
  });

  describe('Edge Cases and Boundary Testing', () => {
    it('should handle maximum date range (2 years)', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'admin@example.com' };
      const twoYearsFromNow = new Date();
      twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const orgQuery = createSupabaseQueryMock({
        data: { role: 'admin' },
        error: null,
      });

      const overlapQuery = createSupabaseQueryMock({
        data: [],
        error: null,
      });

      const createQuery = createSupabaseQueryMock({
        data: {
          id: '990e8400-e29b-41d4-a716-446655440000',
          organization_id: '550e8400-e29b-41d4-a716-446655440002',
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
        return createSupabaseQueryMock({ data: null, error: null });
      });

      const result = await createAccountingPeriod('550e8400-e29b-41d4-a716-446655440002', {
        name: '長期計画',
        start_date: new Date().toISOString().split('T')[0],
        end_date: twoYearsFromNow.toISOString().split('T')[0],
      });

      expect(result.success).toBe(true);
    });

    it('should handle special characters in period names', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'admin@example.com' };
      const specialName = '2024年度 (第1四半期) - 特別会計期間';

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const orgQuery = createSupabaseQueryMock({
        data: { role: 'admin' },
        error: null,
      });

      const overlapQuery = createSupabaseQueryMock({
        data: [],
        error: null,
      });

      const createQuery = createSupabaseQueryMock({
        data: {
          id: '990e8400-e29b-41d4-a716-446655440000',
          organization_id: '550e8400-e29b-41d4-a716-446655440002',
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
        return createSupabaseQueryMock({ data: null, error: null });
      });

      const result = await createAccountingPeriod('550e8400-e29b-41d4-a716-446655440002', {
        name: specialName,
        start_date: '2024-01-01',
        end_date: '2024-03-31',
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe(specialName);
    });

    it('should handle pagination with large datasets', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'viewer@example.com' };
      const mockPeriods = Array.from({ length: 100 }, (_, i) => ({
        id: `aa0e8400-e29b-41d4-a716-4466554400${String(i).padStart(2, '0')}`,
        organization_id: '550e8400-e29b-41d4-a716-446655440002',
        name: `Period ${i}`,
        start_date: `2024-${String((i % 12) + 1).padStart(2, '0')}-01`,
        end_date: `2024-${String((i % 12) + 1).padStart(2, '0')}-28`,
        is_closed: i % 2 === 0,
      }));

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const orgQuery = createSupabaseQueryMock({
        data: { role: 'viewer' },
        error: null,
      });

      const periodsQuery = {
        ...createSupabaseQueryMock({
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
        return createSupabaseQueryMock({ data: null, error: null });
      });

      const result = await getAccountingPeriods('550e8400-e29b-41d4-a716-446655440002', {
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
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'admin@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const query = createSupabaseQueryMock({
        data: [],
        error: null,
        count: 0,
      });

      mockSupabaseClient.from.mockImplementation(() => query);

      await getAccountingPeriods('550e8400-e29b-41d4-a716-446655440002');

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(30000); // 30 seconds
    });

    it('should handle rate limiting correctly', async () => {
      const mockUser = { id: '550e8400-e29b-41d4-a716-446655440003', email: 'admin@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockRateLimitMiddleware.mockResolvedValueOnce({
        success: false,
        error: {
          code: ERROR_CODES.LIMIT_EXCEEDED,
          message: 'Too many requests',
          details: { retryAfter: 60 },
        },
      });

      // Use a valid UUID format
      const result = await deleteAccountingPeriod('123e4567-e89b-12d3-a456-426614174000');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.LIMIT_EXCEEDED);
    });
  });
});
