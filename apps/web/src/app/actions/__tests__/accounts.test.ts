import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

import { getAccounts, createAccount, updateAccount, deleteAccount } from '../accounts';
import { ERROR_CODES } from '../types';

// Mock dependencies
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('Accounts Server Actions', () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock Supabase client with chainable methods
    mockSupabaseClient = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    };

    mockCreateClient.mockResolvedValue(mockSupabaseClient);
  });

  describe('getAccounts', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockOrganizationId = 'org-123';

    it('should successfully fetch accounts with default pagination', async () => {
      // Mock auth
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock user organization check
      const mockUserOrg = { role: 'admin' };
      const userOrgQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockUserOrg,
          error: null,
        }),
      };

      // Mock accounts query
      const mockAccounts = [
        { id: 'acc-1', code: '1110', name: '現金', account_type: 'asset' },
        { id: 'acc-2', code: '2110', name: '買掛金', account_type: 'liability' },
      ];

      const accountsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: mockAccounts,
          error: null,
          count: 2,
        }),
      };

      mockSupabaseClient.from.mockReturnValueOnce(userOrgQuery).mockReturnValueOnce(accountsQuery);

      const result = await getAccounts(mockOrganizationId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        items: mockAccounts,
        pagination: {
          page: 1,
          pageSize: 50,
          totalCount: 2,
          totalPages: 1,
        },
      });
    });

    it('should return unauthorized when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const result = await getAccounts(mockOrganizationId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(result.error?.message).toContain('認証が必要です');
    });

    it('should return forbidden when user has no access to organization', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Not found'),
      });

      const result = await getAccounts(mockOrganizationId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.FORBIDDEN);
      expect(result.error?.message).toContain('この組織の勘定科目を表示する権限がありません');
    });

    it('should apply search filter correctly', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'viewer' },
        error: null,
      });

      const accountsQueryMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      };

      mockSupabaseClient.from.mockReturnValueOnce(accountsQueryMock);

      await getAccounts(mockOrganizationId, { search: 'cash' });

      expect(accountsQueryMock.or).toHaveBeenCalledWith('name.ilike.%cash%,code.ilike.%cash%');
    });

    it('should handle pagination parameters', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'accountant' },
        error: null,
      });

      const accountsQueryMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 100,
        }),
      };

      mockSupabaseClient.from.mockReturnValueOnce(accountsQueryMock);

      const result = await getAccounts(mockOrganizationId, {
        page: 2,
        pageSize: 20,
        orderBy: 'name',
        orderDirection: 'desc',
      });

      expect(accountsQueryMock.range).toHaveBeenCalledWith(20, 39); // Page 2 with size 20
      expect(accountsQueryMock.order).toHaveBeenCalledWith('name', { ascending: false });
      expect(result.data?.pagination).toEqual({
        page: 2,
        pageSize: 20,
        totalCount: 100,
        totalPages: 5,
      });
    });
  });

  describe('createAccount', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockAccountData = {
      organization_id: 'org-123',
      code: '1110',
      name: '現金',
      account_type: 'asset' as const,
      category: '流動資産',
      is_active: true,
    };

    it('should successfully create an account', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock organization access check
      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      // Mock duplicate code check
      fromMock.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Not found'),
      });

      // Mock insert
      const newAccount = { id: 'acc-new', ...mockAccountData };
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: newAccount,
          error: null,
        }),
      });

      const result = await createAccount(mockAccountData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(newAccount);
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/accounts');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/api/v1/accounts');
    });

    it('should return validation error for missing required fields', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'accountant' },
        error: null,
      });

      const incompleteData = {
        organization_id: 'org-123',
        code: '',
        name: '',
        account_type: null as any,
        category: '',
      };

      const result = await createAccount(incompleteData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('必須項目が入力されていません');
      expect(result.error?.fieldErrors).toHaveProperty('code');
      expect(result.error?.fieldErrors).toHaveProperty('name');
      expect(result.error?.fieldErrors).toHaveProperty('account_type');
      expect(result.error?.fieldErrors).toHaveProperty('category');
    });

    it('should prevent viewers from creating accounts', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'viewer' },
        error: null,
      });

      const result = await createAccount(mockAccountData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
      expect(result.error?.message).toContain('閲覧者は勘定科目を作成できません');
    });

    it('should check for duplicate account codes', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      // Mock duplicate code found
      fromMock.single.mockResolvedValueOnce({
        data: { id: 'existing-acc' },
        error: null,
      });

      const result = await createAccount(mockAccountData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.ALREADY_EXISTS);
      expect(result.error?.message).toContain('勘定科目コード「1110」は既に使用されています');
    });

    it('should validate parent account exists', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      // Mock no duplicate
      fromMock.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Not found'),
      });

      // Mock parent not found
      fromMock.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Not found'),
      });

      const dataWithParent = {
        ...mockAccountData,
        parent_account_id: 'parent-123',
      };

      const result = await createAccount(dataWithParent);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('指定された親勘定科目が存在しません');
    });
  });

  describe('updateAccount', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const accountId = 'acc-123';
    const organizationId = 'org-123';
    const updateData = {
      name: '更新された現金',
      description: '新しい説明',
    };

    it('should successfully update an account', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      // Mock org access check
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'accountant' },
        error: null,
      });

      // Mock existing account check
      const existingAccount = {
        id: accountId,
        code: '1110',
        name: '現金',
      };
      fromMock.single.mockResolvedValueOnce({
        data: existingAccount,
        error: null,
      });

      // Mock update
      const updatedAccount = { ...existingAccount, ...updateData };
      mockSupabaseClient.from.mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: updatedAccount,
          error: null,
        }),
      });

      const result = await updateAccount(accountId, organizationId, updateData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedAccount);
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/accounts');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/api/v1/accounts');
    });

    it('should prevent viewers from updating accounts', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'viewer' },
        error: null,
      });

      const result = await updateAccount(accountId, organizationId, updateData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
      expect(result.error?.message).toContain('閲覧者は勘定科目を更新できません');
    });

    it('should return not found for non-existent account', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      fromMock.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Not found'),
      });

      const result = await updateAccount(accountId, organizationId, updateData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.NOT_FOUND);
      expect(result.error?.message).toContain('勘定科目が見つかりません');
    });

    it('should check for duplicate codes when updating code', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      fromMock.single.mockResolvedValueOnce({
        data: { id: accountId, code: '1110', name: '現金' },
        error: null,
      });

      // Mock duplicate found
      const duplicateQueryMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'other-acc' },
          error: null,
        }),
      };

      mockSupabaseClient.from.mockReturnValueOnce(duplicateQueryMock);

      const result = await updateAccount(accountId, organizationId, { code: '2110' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.ALREADY_EXISTS);
      expect(result.error?.message).toContain('勘定科目コード「2110」は既に使用されています');
    });

    it('should prevent setting self as parent', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      fromMock.single.mockResolvedValueOnce({
        data: { id: accountId, code: '1110', name: '現金' },
        error: null,
      });

      const result = await updateAccount(accountId, organizationId, {
        parent_account_id: accountId,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain(
        '勘定科目を自分自身の親勘定科目に設定することはできません'
      );
    });
  });

  describe('deleteAccount', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const accountId = 'acc-123';
    const organizationId = 'org-123';

    it('should successfully delete an account', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      // Mock org access - only admin can delete
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      // Mock existing account
      fromMock.single.mockResolvedValueOnce({
        data: { id: accountId, code: '1110', name: '現金' },
        error: null,
      });

      // Mock journal lines check - no usage
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: null,
          count: 0,
        }),
      });

      // Mock child accounts check - no children
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: null,
          count: 0,
        }),
      });

      // Mock delete
      mockSupabaseClient.from.mockReturnValueOnce({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      });

      const result = await deleteAccount(accountId, organizationId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: accountId });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/accounts');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/api/v1/accounts');
    });

    it('should prevent non-admins from deleting accounts', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      // Accountant role cannot delete
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'accountant' },
        error: null,
      });

      const result = await deleteAccount(accountId, organizationId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
      expect(result.error?.message).toContain('管理者のみが勘定科目を削除できます');
    });

    it('should prevent deletion when account is used in journal entries', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      fromMock.single.mockResolvedValueOnce({
        data: { id: accountId, code: '1110', name: '現金' },
        error: null,
      });

      // Mock journal lines check - found usage
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: null,
          count: 5,
        }),
      });

      const result = await deleteAccount(accountId, organizationId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.CONSTRAINT_VIOLATION);
      expect(result.error?.message).toContain(
        'この勘定科目は仕訳で使用されているため削除できません'
      );
    });

    it('should prevent deletion when account has child accounts', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      fromMock.single.mockResolvedValueOnce({
        data: { id: accountId, code: '1000', name: '流動資産' },
        error: null,
      });

      // Mock no journal usage
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: null,
          count: 0,
        }),
      });

      // Mock child accounts exist
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: null,
          count: 3,
        }),
      });

      const result = await deleteAccount(accountId, organizationId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.CONSTRAINT_VIOLATION);
      expect(result.error?.message).toContain(
        'この勘定科目には子勘定科目が存在するため削除できません'
      );
    });

    it('should return not found for non-existent account', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      fromMock.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Not found'),
      });

      const result = await deleteAccount(accountId, organizationId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.NOT_FOUND);
      expect(result.error?.message).toContain('勘定科目が見つかりません');
    });
  });

  describe('Error Handling', () => {
    it('should handle Supabase errors gracefully', async () => {
      const supabaseError = {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
        details: 'Key already exists',
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      });

      fromMock.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Not found'),
      });

      mockSupabaseClient.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: supabaseError,
        }),
      });

      const result = await createAccount({
        organization_id: 'org-123',
        code: '1110',
        name: '現金',
        account_type: 'asset' as const,
        category: '流動資産',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle network errors', async () => {
      mockCreateClient.mockRejectedValue(new Error('Network error'));

      const result = await getAccounts('org-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    });
  });
});
