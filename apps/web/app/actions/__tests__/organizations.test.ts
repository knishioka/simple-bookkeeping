import { getDefaultUserOrganization } from '../organizations';

import { createServiceClient } from '@/lib/supabase/server';

// Mock dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
  createActionClient: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

const mockCreateServiceClient = createServiceClient as jest.MockedFunction<
  typeof createServiceClient
>;

describe('Organization Server Actions', () => {
  let mockServiceSupabaseClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock Service Supabase client
    mockServiceSupabaseClient = {
      from: jest.fn(),
    };

    mockCreateServiceClient.mockReturnValue(mockServiceSupabaseClient);
  });

  describe('getDefaultUserOrganization', () => {
    it('should successfully retrieve default organization', async () => {
      const mockUserId = 'user-123';
      const mockOrganization = {
        organization_id: 'org-456',
        role: 'admin' as const,
      };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockOrganization,
        error: null,
      });

      mockServiceSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      });

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      mockEq.mockReturnValueOnce({
        eq: mockEq,
      });

      mockEq.mockReturnValueOnce({
        single: mockSingle,
      });

      const result = await getDefaultUserOrganization(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockOrganization);
      expect(mockServiceSupabaseClient.from).toHaveBeenCalledWith('user_organizations');
      expect(mockSelect).toHaveBeenCalledWith('organization_id, role');
      expect(mockEq).toHaveBeenCalledWith('user_id', mockUserId);
      expect(mockEq).toHaveBeenCalledWith('is_default', true);
    });

    it('should handle database error', async () => {
      const mockUserId = 'user-123';
      const mockError = { message: 'Database connection failed', code: 'DB_ERROR' };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      mockServiceSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      });

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      mockEq.mockReturnValueOnce({
        eq: mockEq,
      });

      mockEq.mockReturnValueOnce({
        single: mockSingle,
      });

      const result = await getDefaultUserOrganization(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError.message);
      expect(result.data).toBeUndefined();
    });

    it('should handle no default organization found', async () => {
      const mockUserId = 'user-123';

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      mockServiceSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      });

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      mockEq.mockReturnValueOnce({
        eq: mockEq,
      });

      mockEq.mockReturnValueOnce({
        single: mockSingle,
      });

      const result = await getDefaultUserOrganization(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Default organization not found');
      expect(result.data).toBeUndefined();
    });

    it('should handle unexpected errors', async () => {
      const mockUserId = 'user-123';
      const unexpectedError = new Error('Unexpected error occurred');

      mockServiceSupabaseClient.from.mockImplementation(() => {
        throw unexpectedError;
      });

      const result = await getDefaultUserOrganization(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(unexpectedError.message);
      expect(result.data).toBeUndefined();
    });

    it('should use Service Role Key to bypass RLS', async () => {
      const mockUserId = 'user-123';
      const mockOrganization = {
        organization_id: 'org-456',
        role: 'viewer' as const,
      };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockOrganization,
        error: null,
      });

      mockServiceSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      });

      mockSelect.mockReturnValue({
        eq: mockEq,
      });

      mockEq.mockReturnValueOnce({
        eq: mockEq,
      });

      mockEq.mockReturnValueOnce({
        single: mockSingle,
      });

      await getDefaultUserOrganization(mockUserId);

      // Verify that Service Client was created (bypasses RLS)
      expect(mockCreateServiceClient).toHaveBeenCalled();
    });
  });
});
