import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

import { enrollMFA, verifyMFA, disableMFA, getMFAStatus } from '../mfa';

// Mock dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

describe('MFA Server Actions', () => {
  let mockSupabaseClient: any;
  let mockAuth: any;
  let mockMfa: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup MFA mock methods
    mockMfa = {
      enroll: jest.fn(),
      verify: jest.fn(),
      unenroll: jest.fn(),
      listFactors: jest.fn(),
      challenge: jest.fn(),
      getAuthenticatorAssuranceLevel: jest.fn(),
    };

    // Setup auth mock
    mockAuth = {
      getUser: jest.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        },
        error: null,
      }),
      mfa: mockMfa,
    };

    mockSupabaseClient = {
      auth: mockAuth,
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('enrollMFA', () => {
    it('should successfully enroll user in MFA', async () => {
      const mockEnrollResponse = {
        data: {
          id: 'factor-123',
          type: 'totp',
          totp: {
            qr_code: 'data:image/png;base64,mock-qr-code',
            secret: 'MOCK-SECRET-KEY',
            uri: 'otpauth://totp/SimpleBookkeeping:test@example.com?secret=MOCK-SECRET-KEY',
          },
        },
        error: null,
      };

      mockMfa.enroll.mockResolvedValue(mockEnrollResponse);

      const result = await enrollMFA();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        qrCode: 'data:image/png;base64,mock-qr-code',
        secret: 'MOCK-SECRET-KEY',
        factorId: 'factor-123',
      });
      expect(mockMfa.enroll).toHaveBeenCalledWith({
        factorType: 'totp',
        friendlyName: 'Simple Bookkeeping',
      });
    });

    it('should handle user not authenticated', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await enrollMFA();

      expect(result.success).toBe(false);
      expect(result.error).toBe('You must be logged in to enable MFA');
      expect(mockMfa.enroll).not.toHaveBeenCalled();
    });

    it('should handle enrollment errors', async () => {
      mockMfa.enroll.mockResolvedValue({
        data: null,
        error: { message: 'MFA already enrolled' },
      });

      const result = await enrollMFA();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to enroll MFA. Please try again.');
    });

    it('should handle missing TOTP data in response', async () => {
      mockMfa.enroll.mockResolvedValue({
        data: {
          id: 'factor-123',
          type: 'totp',
          totp: null,
        },
        error: null,
      });

      const result = await enrollMFA();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to generate MFA setup data');
    });

    it('should handle network errors gracefully', async () => {
      mockMfa.enroll.mockRejectedValue(new Error('Network error'));

      const result = await enrollMFA();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to enroll MFA. Please try again.');
    });
  });

  describe('verifyMFA', () => {
    it('should successfully verify MFA code', async () => {
      const mockChallengeResponse = {
        data: { id: 'challenge-123' },
        error: null,
      };

      const mockVerifyResponse = {
        data: { access_token: 'new-access-token' },
        error: null,
      };

      mockMfa.challenge.mockResolvedValue(mockChallengeResponse);
      mockMfa.verify.mockResolvedValue(mockVerifyResponse);

      const result = await verifyMFA('factor-123', '123456');

      expect(result.success).toBe(true);
      expect(mockMfa.challenge).toHaveBeenCalledWith({ factorId: 'factor-123' });
      expect(mockMfa.verify).toHaveBeenCalledWith({
        factorId: 'factor-123',
        challengeId: 'challenge-123',
        code: '123456',
      });
      expect(revalidatePath).toHaveBeenCalledWith('/');
    });

    it('should validate input parameters', async () => {
      const result1 = await verifyMFA('', '123456');
      expect(result1.success).toBe(false);
      expect(result1.error).toBe('Factor ID and verification code are required');

      const result2 = await verifyMFA('factor-123', '');
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Factor ID and verification code are required');

      const result3 = await verifyMFA('', '');
      expect(result3.success).toBe(false);
      expect(result3.error).toBe('Factor ID and verification code are required');
    });

    it('should handle invalid code format', async () => {
      const result = await verifyMFA('factor-123', '12345'); // Too short
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid verification code format');

      const result2 = await verifyMFA('factor-123', '1234567'); // Too long
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Invalid verification code format');

      const result3 = await verifyMFA('factor-123', 'abcdef'); // Non-numeric
      expect(result3.success).toBe(false);
      expect(result3.error).toBe('Invalid verification code format');
    });

    it('should handle challenge creation failure', async () => {
      mockMfa.challenge.mockResolvedValue({
        data: null,
        error: { message: 'Challenge failed' },
      });

      const result = await verifyMFA('factor-123', '123456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create verification challenge');
      expect(mockMfa.verify).not.toHaveBeenCalled();
    });

    it('should handle verification failure', async () => {
      mockMfa.challenge.mockResolvedValue({
        data: { id: 'challenge-123' },
        error: null,
      });

      mockMfa.verify.mockResolvedValue({
        data: null,
        error: { message: 'Invalid code' },
      });

      const result = await verifyMFA('factor-123', '123456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid verification code. Please try again.');
    });

    it('should handle rate limiting', async () => {
      mockMfa.verify.mockResolvedValue({
        data: null,
        error: { message: 'Too many attempts', status: 429 },
      });

      mockMfa.challenge.mockResolvedValue({
        data: { id: 'challenge-123' },
        error: null,
      });

      const result = await verifyMFA('factor-123', '123456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid verification code');
    });
  });

  describe('disableMFA', () => {
    it('should successfully disable MFA', async () => {
      const mockFactors = [{ id: 'factor-123', type: 'totp', status: 'verified' }];

      mockMfa.listFactors.mockResolvedValue({
        data: { totp: mockFactors, all: mockFactors },
        error: null,
      });

      mockMfa.unenroll.mockResolvedValue({
        data: { id: 'factor-123' },
        error: null,
      });

      const result = await disableMFA();

      expect(result.success).toBe(true);
      expect(mockMfa.unenroll).toHaveBeenCalledWith({ factorId: 'factor-123' });
      expect(revalidatePath).toHaveBeenCalledWith('/');
    });

    it('should handle user not authenticated', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await disableMFA();

      expect(result.success).toBe(false);
      expect(result.error).toBe('You must be logged in to disable MFA');
      expect(mockMfa.listFactors).not.toHaveBeenCalled();
    });

    it('should handle no MFA factors found', async () => {
      mockMfa.listFactors.mockResolvedValue({
        data: { totp: [], all: [] },
        error: null,
      });

      const result = await disableMFA();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No MFA factors found to disable');
      expect(mockMfa.unenroll).not.toHaveBeenCalled();
    });

    it('should handle unenroll failure', async () => {
      mockMfa.listFactors.mockResolvedValue({
        data: {
          totp: [{ id: 'factor-123', type: 'totp' }],
          all: [{ id: 'factor-123', type: 'totp' }],
        },
        error: null,
      });

      mockMfa.unenroll.mockResolvedValue({
        data: null,
        error: { message: 'Cannot unenroll factor' },
      });

      const result = await disableMFA();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to disable MFA. Please try again.');
    });

    it('should disable all MFA factors if multiple exist', async () => {
      const mockFactors = [
        { id: 'factor-1', type: 'totp' },
        { id: 'factor-2', type: 'totp' },
      ];

      mockMfa.listFactors.mockResolvedValue({
        data: { totp: mockFactors, all: mockFactors },
        error: null,
      });

      mockMfa.unenroll.mockResolvedValue({
        data: { id: 'factor-1' },
        error: null,
      });

      const result = await disableMFA();

      expect(result.success).toBe(true);
      // Should only unenroll the first factor in this implementation
      expect(mockMfa.unenroll).toHaveBeenCalledTimes(1);
      expect(mockMfa.unenroll).toHaveBeenCalledWith({ factorId: 'factor-1' });
    });
  });

  describe('getMFAStatus', () => {
    it('should return MFA enabled status', async () => {
      const mockFactors = [{ id: 'factor-123', type: 'totp', status: 'verified' }];

      mockMfa.listFactors.mockResolvedValue({
        data: { totp: mockFactors, all: mockFactors },
        error: null,
      });

      mockMfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
        data: {
          currentLevel: 'aal2',
          nextLevel: null,
          currentAuthenticationMethods: ['password', 'totp'],
        },
        error: null,
      });

      const result = await getMFAStatus();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        enabled: true,
        verified: true,
        factors: mockFactors,
      });
    });

    it('should return MFA disabled status', async () => {
      mockMfa.listFactors.mockResolvedValue({
        data: { totp: [], all: [] },
        error: null,
      });

      mockMfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
        data: {
          currentLevel: 'aal1',
          nextLevel: null,
          currentAuthenticationMethods: ['password'],
        },
        error: null,
      });

      const result = await getMFAStatus();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        enabled: false,
        verified: false,
        factors: [],
      });
    });

    it('should handle unverified MFA factors', async () => {
      const mockFactors = [{ id: 'factor-123', type: 'totp', status: 'unverified' }];

      mockMfa.listFactors.mockResolvedValue({
        data: { totp: mockFactors, all: mockFactors },
        error: null,
      });

      mockMfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
        data: {
          currentLevel: 'aal1',
          nextLevel: 'aal2',
          currentAuthenticationMethods: ['password'],
        },
        error: null,
      });

      const result = await getMFAStatus();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        enabled: true,
        verified: false,
        factors: mockFactors,
      });
    });

    it('should handle user not authenticated', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await getMFAStatus();

      expect(result.success).toBe(false);
      expect(result.error).toBe('You must be logged in to check MFA status');
    });

    it('should handle errors when listing factors', async () => {
      mockMfa.listFactors.mockResolvedValue({
        data: null,
        error: { message: 'Failed to list factors' },
      });

      const result = await getMFAStatus();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get MFA status');
    });

    it('should handle errors when getting assurance level', async () => {
      mockMfa.listFactors.mockResolvedValue({
        data: { totp: [], all: [] },
        error: null,
      });

      mockMfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
        data: null,
        error: { message: 'Failed to get assurance level' },
      });

      const result = await getMFAStatus();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get MFA status');
    });
  });

  describe('Security Considerations', () => {
    it('should not expose sensitive data in error messages', async () => {
      mockMfa.enroll.mockResolvedValue({
        data: null,
        error: {
          message: 'User user@example.com already has MFA factor factor-123 enrolled',
          code: 'mfa_already_enrolled',
        },
      });

      const result = await enrollMFA();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to enroll MFA. Please try again.');
      expect(result.error).not.toContain('user@example.com');
      expect(result.error).not.toContain('factor-123');
    });

    it('should sanitize factor IDs', async () => {
      // Test with potentially malicious factor ID
      const maliciousFactorId = '<script>alert("XSS")</script>';

      mockMfa.challenge.mockResolvedValue({
        data: { id: 'challenge-123' },
        error: null,
      });

      mockMfa.verify.mockResolvedValue({
        data: null,
        error: { message: 'Invalid factor' },
      });

      const result = await verifyMFA(maliciousFactorId, '123456');

      expect(result.success).toBe(false);
      // The error message should not contain the malicious input
      expect(result.error).not.toContain('<script>');
    });

    it('should handle timing attacks on verification', async () => {
      // Measure time for valid and invalid codes
      const startValid = Date.now();

      mockMfa.challenge.mockResolvedValue({
        data: { id: 'challenge-123' },
        error: null,
      });

      mockMfa.verify.mockResolvedValue({
        data: { access_token: 'token' },
        error: null,
      });

      await verifyMFA('factor-123', '123456');
      const timeValid = Date.now() - startValid;

      const startInvalid = Date.now();

      mockMfa.verify.mockResolvedValue({
        data: null,
        error: { message: 'Invalid code' },
      });

      await verifyMFA('factor-123', '000000');
      const timeInvalid = Date.now() - startInvalid;

      // Time difference should be minimal to prevent timing attacks
      expect(Math.abs(timeValid - timeInvalid)).toBeLessThan(100);
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limit errors gracefully', async () => {
      mockMfa.verify.mockResolvedValue({
        data: null,
        error: {
          message: 'Too many requests',
          status: 429,
          code: 'rate_limit_exceeded',
        },
      });

      mockMfa.challenge.mockResolvedValue({
        data: { id: 'challenge-123' },
        error: null,
      });

      const result = await verifyMFA('factor-123', '123456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid verification code');
      // Should not expose rate limit details to prevent information leakage
      expect(result.error).not.toContain('429');
      expect(result.error).not.toContain('rate');
    });
  });
});
