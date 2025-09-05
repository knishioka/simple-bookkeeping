import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

import {
  signUp,
  signIn,
  signOut,
  resetPassword,
  updatePassword,
  getCurrentUser,
  confirmEmail,
} from '../auth';
import { ERROR_CODES } from '../types';

// Mock dependencies
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('Auth Server Actions', () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock Supabase client
    mockSupabaseClient = {
      auth: {
        getUser: jest.fn(),
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        getSession: jest.fn(),
        resetPasswordForEmail: jest.fn(),
        updateUser: jest.fn(),
        verifyOtp: jest.fn(),
      },
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        single: jest.fn(),
      })),
    };

    mockCreateClient.mockResolvedValue(mockSupabaseClient);
  });

  describe('signUp', () => {
    const validInput = {
      email: 'test@example.com',
      password: 'SecurePassword123!',
      name: '山田太郎',
      organizationName: '株式会社テスト',
    };

    it('should successfully sign up a new user with organization', async () => {
      const mockUser = { id: 'user-123', email: validInput.email };

      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      // Mock organization creation
      fromMock.single.mockResolvedValueOnce({
        data: { id: 'org-123', name: validInput.organizationName },
        error: null,
      });

      // Mock user-organization association
      fromMock.single.mockResolvedValueOnce({
        error: null,
      });

      // Mock user table insert
      fromMock.single.mockResolvedValueOnce({
        error: null,
      });

      const result = await signUp(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: validInput.name,
        organizationId: 'org-123',
        role: 'admin',
      });

      expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
        email: validInput.email,
        password: validInput.password,
        options: {
          data: {
            name: validInput.name,
            display_name: validInput.name,
          },
        },
      });
    });

    it('should successfully sign up without organization', async () => {
      const inputWithoutOrg = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        name: '山田太郎',
      };

      const mockUser = { id: 'user-123', email: inputWithoutOrg.email };

      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock user table insert
      const fromMock = mockSupabaseClient.from();
      fromMock.single.mockResolvedValueOnce({
        error: null,
      });

      const result = await signUp(inputWithoutOrg);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: inputWithoutOrg.name,
        organizationId: undefined,
        role: undefined,
      });
    });

    it('should validate required fields', async () => {
      const invalidInput = {
        email: '',
        password: '',
        name: '',
      };

      const result = await signUp(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('必須項目が入力されていません');
      expect(result.error?.fieldErrors).toHaveProperty('email');
      expect(result.error?.fieldErrors).toHaveProperty('password');
      expect(result.error?.fieldErrors).toHaveProperty('name');
    });

    it('should validate email format', async () => {
      const invalidEmailInput = {
        email: 'not-an-email',
        password: 'SecurePassword123!',
        name: '山田太郎',
      };

      const result = await signUp(invalidEmailInput);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('メールアドレスの形式が正しくありません');
    });

    it('should validate password strength', async () => {
      const weakPasswordInput = {
        email: 'test@example.com',
        password: '1234567',
        name: '山田太郎',
      };

      const result = await signUp(weakPasswordInput);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('パスワードは8文字以上で入力してください');
    });

    it('should handle duplicate email registration', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: null,
        error: { message: 'User already registered' },
      });

      const result = await signUp(validInput);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.ALREADY_EXISTS);
      expect(result.error?.message).toContain('このメールアドレスは既に登録されています');
    });

    it('should handle organization creation failure gracefully', async () => {
      const mockUser = { id: 'user-123', email: validInput.email };

      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      // Organization creation fails
      fromMock.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Organization creation failed'),
      });

      const result = await signUp(validInput);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(result.error?.message).toContain(
        'ユーザーは作成されましたが、組織の作成に失敗しました'
      );
    });
  });

  describe('signIn', () => {
    const validCredentials = {
      email: 'test@example.com',
      password: 'SecurePassword123!',
    };

    it('should successfully sign in with valid credentials', async () => {
      const mockUser = { id: 'user-123', email: validCredentials.email };

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      // Mock user organization
      fromMock.single.mockResolvedValueOnce({
        data: { organization_id: 'org-123', role: 'admin' },
        error: null,
      });

      // Mock user data
      fromMock.single.mockResolvedValueOnce({
        data: { name: '山田太郎' },
        error: null,
      });

      const result = await signIn(validCredentials);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: '山田太郎',
        organizationId: 'org-123',
        role: 'admin',
      });

      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/');
    });

    it('should validate required fields', async () => {
      const invalidInput = {
        email: '',
        password: '',
      };

      const result = await signIn(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('必須項目が入力されていません');
      expect(result.error?.fieldErrors).toHaveProperty('email');
      expect(result.error?.fieldErrors).toHaveProperty('password');
    });

    it('should handle invalid credentials', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' },
      });

      const result = await signIn(validCredentials);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(result.error?.message).toContain('メールアドレスまたはパスワードが正しくありません');
    });

    it('should handle user without organization', async () => {
      const mockUser = { id: 'user-123', email: validCredentials.email };

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      // No organization found
      fromMock.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Not found'),
      });

      // Mock user data
      fromMock.single.mockResolvedValueOnce({
        data: { name: '山田太郎' },
        error: null,
      });

      const result = await signIn(validCredentials);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: '山田太郎',
        organizationId: undefined,
        role: undefined,
      });
    });

    it('should use user metadata when user table data not available', async () => {
      const mockUser = {
        id: 'user-123',
        email: validCredentials.email,
        user_metadata: { name: '田中花子' },
      };

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      fromMock.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Not found'),
      });

      fromMock.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Not found'),
      });

      const result = await signIn(validCredentials);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('田中花子');
    });
  });

  describe('signOut', () => {
    it('should successfully sign out authenticated user', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null,
      });

      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: null,
      });

      const result = await signOut();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true });
      expect(mockRevalidatePath).toHaveBeenCalledWith('/');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard');
    });

    it('should handle sign out when no session exists', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await signOut();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true });
      expect(mockSupabaseClient.auth.signOut).not.toHaveBeenCalled();
    });

    it('should handle sign out error', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null,
      });

      mockSupabaseClient.auth.signOut.mockResolvedValue({
        error: new Error('Sign out failed'),
      });

      const result = await signOut();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('resetPassword', () => {
    it('should successfully send password reset email', async () => {
      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        error: null,
      });

      const result = await resetPassword({ email: 'test@example.com' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true });
      expect(mockSupabaseClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/reset-password'),
        })
      );
    });

    it('should validate email is provided', async () => {
      const result = await resetPassword({ email: '' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('メールアドレスを入力してください');
    });

    it('should validate email format', async () => {
      const result = await resetPassword({ email: 'invalid-email' });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('メールアドレスの形式が正しくありません');
    });

    it('should always return success for security (even if user not found)', async () => {
      mockSupabaseClient.auth.resetPasswordForEmail.mockResolvedValue({
        error: new Error('User not found'),
      });

      const result = await resetPassword({ email: 'nonexistent@example.com' });

      // Always returns success to prevent user enumeration
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true });
    });
  });

  describe('updatePassword', () => {
    const validInput = {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword456!',
    };

    it('should successfully update password', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.auth.updateUser.mockResolvedValue({
        error: null,
      });

      const result = await updatePassword(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true });
      expect(mockSupabaseClient.auth.updateUser).toHaveBeenCalledWith({
        password: validInput.newPassword,
      });
    });

    it('should validate required fields', async () => {
      const invalidInput = {
        currentPassword: '',
        newPassword: '',
      };

      const result = await updatePassword(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('必須項目が入力されていません');
      expect(result.error?.fieldErrors).toHaveProperty('currentPassword');
      expect(result.error?.fieldErrors).toHaveProperty('newPassword');
    });

    it('should validate new password strength', async () => {
      const weakPasswordInput = {
        currentPassword: 'OldPassword123!',
        newPassword: '1234567',
      };

      const result = await updatePassword(weakPasswordInput);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('新しいパスワードは8文字以上で入力してください');
    });

    it('should prevent using same password', async () => {
      const samePasswordInput = {
        currentPassword: 'SamePassword123!',
        newPassword: 'SamePassword123!',
      };

      const result = await updatePassword(samePasswordInput);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain(
        '新しいパスワードは現在のパスワードと異なる必要があります'
      );
    });

    it('should require authentication', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const result = await updatePassword(validInput);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(result.error?.message).toContain('ログインが必要です');
    });

    it('should verify current password', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: new Error('Invalid password'),
      });

      const result = await updatePassword(validInput);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(result.error?.message).toContain('現在のパスワードが正しくありません');
    });
  });

  describe('getCurrentUser', () => {
    it('should return current authenticated user', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      fromMock.single.mockResolvedValueOnce({
        data: { organization_id: 'org-123', role: 'accountant' },
        error: null,
      });

      fromMock.single.mockResolvedValueOnce({
        data: { name: '山田太郎' },
        error: null,
      });

      const result = await getCurrentUser();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: '山田太郎',
        organizationId: 'org-123',
        role: 'accountant',
      });
    });

    it('should return null when not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const result = await getCurrentUser();

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should handle missing user data gracefully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { name: 'メタデータ名' },
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const fromMock = mockSupabaseClient.from();

      // No organization
      fromMock.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Not found'),
      });

      // No user data
      fromMock.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Not found'),
      });

      const result = await getCurrentUser();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: 'メタデータ名',
        organizationId: undefined,
        role: undefined,
      });
    });
  });

  describe('confirmEmail', () => {
    it('should successfully confirm email with valid token', async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        error: null,
      });

      const result = await confirmEmail('valid-token-hash');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true });
      expect(mockSupabaseClient.auth.verifyOtp).toHaveBeenCalledWith({
        token_hash: 'valid-token-hash',
        type: 'email',
      });
    });

    it('should validate token is provided', async () => {
      const result = await confirmEmail('');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.error?.message).toContain('確認トークンが必要です');
    });

    it('should handle invalid or expired token', async () => {
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        error: new Error('Token expired'),
      });

      const result = await confirmEmail('expired-token');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INVALID_OPERATION);
      expect(result.error?.message).toContain(
        'メールアドレスの確認に失敗しました。リンクの有効期限が切れている可能性があります'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockCreateClient.mockRejectedValue(new Error('Network error'));

      const result = await signIn({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    });

    it('should handle unexpected Supabase errors', async () => {
      mockSupabaseClient.auth.signUp.mockRejectedValue(new Error('Unexpected error occurred'));

      const result = await signUp({
        email: 'test@example.com',
        password: 'SecurePassword123!',
        name: '山田太郎',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    });

    it('should handle missing user in auth response', async () => {
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await signUp({
        email: 'test@example.com',
        password: 'SecurePassword123!',
        name: '山田太郎',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(result.error?.message).toContain('ユーザーの作成に失敗しました');
    });

    it('should handle missing user in sign in response', async () => {
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await signIn({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(result.error?.message).toContain('ログインに失敗しました');
    });
  });
});
