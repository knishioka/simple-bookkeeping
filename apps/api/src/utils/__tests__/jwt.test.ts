// Setup test environment variables first
import '../../test-utils/env-setup';

import { verify } from 'jsonwebtoken';

import { generateTokens, verifyRefreshToken } from '../jwt';

interface JWTPayload {
  sub: string;
  email?: string;
  organizationId?: string;
  role?: string;
}

describe('JWT Utils', () => {
  const userId = 'test-user-id';
  const email = 'test@example.com';
  const organizationId = 'test-org-id';
  const role = 'ADMIN';

  // Set up test environment variables
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-with-sufficient-length-for-security-purposes';
    process.env.JWT_REFRESH_SECRET =
      'test-refresh-secret-with-sufficient-length-for-security-purposes';
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', () => {
      const { accessToken, refreshToken } = generateTokens(userId, email, organizationId, role);

      expect(accessToken).toBeTruthy();
      expect(refreshToken).toBeTruthy();

      // Verify access token
      const decodedAccess = verify(accessToken, process.env.JWT_SECRET as string) as JWTPayload;
      expect(decodedAccess.sub).toBe(userId);
      expect(decodedAccess.email).toBe(email);
      expect(decodedAccess.organizationId).toBe(organizationId);
      expect(decodedAccess.role).toBe(role);

      // Verify refresh token
      const decodedRefresh = verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET as string
      ) as JWTPayload;
      expect(decodedRefresh.sub).toBe(userId);
    });

    it('should throw error when JWT_SECRET is not set in production environment', () => {
      // Save original values
      const originalSecret = process.env.JWT_SECRET;
      const originalNodeEnv = process.env.NODE_ENV;

      // Set NODE_ENV to production to test the error case
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      expect(() => {
        generateTokens(userId, email, organizationId, role);
      }).toThrow('JWT_SECRET environment variable is required');

      // Restore original values
      process.env.JWT_SECRET = originalSecret;
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should use fallback secret in test environment when JWT_SECRET is not set', () => {
      // Save original values
      const originalSecret = process.env.JWT_SECRET;
      const originalRefreshSecret = process.env.JWT_REFRESH_SECRET;
      const originalNodeEnv = process.env.NODE_ENV;

      // Clear secrets but keep test environment
      process.env.NODE_ENV = 'test';
      delete process.env.JWT_SECRET;
      delete process.env.JWT_REFRESH_SECRET;

      // Should not throw error in test environment
      const { accessToken, refreshToken } = generateTokens(userId, email, organizationId, role);

      expect(accessToken).toBeTruthy();
      expect(refreshToken).toBeTruthy();

      // Verify tokens work with fallback secrets
      const decodedAccess = verify(accessToken, 'test-jwt-secret') as JWTPayload;
      expect(decodedAccess.sub).toBe(userId);
      expect(decodedAccess.email).toBe(email);

      const decodedRefresh = verify(refreshToken, 'test-jwt-refresh-secret') as JWTPayload;
      expect(decodedRefresh.sub).toBe(userId);

      // Restore original values
      process.env.JWT_SECRET = originalSecret;
      process.env.JWT_REFRESH_SECRET = originalRefreshSecret;
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const { refreshToken } = generateTokens(userId, email, organizationId, role);
      const decoded = verifyRefreshToken(refreshToken);

      expect(decoded.sub).toBe(userId);
      expect(decoded.email).toBe(email);
      expect(decoded.organizationId).toBe(organizationId);
      expect(decoded.role).toBe(role);
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        verifyRefreshToken('invalid-token');
      }).toThrow();
    });

    it('should throw error when JWT_REFRESH_SECRET is not set in production environment', () => {
      // Save original values
      const originalRefreshSecret = process.env.JWT_REFRESH_SECRET;
      const originalNodeEnv = process.env.NODE_ENV;

      // Generate a token first with valid secret
      const { refreshToken } = generateTokens(userId, email, organizationId, role);

      // Set NODE_ENV to production and remove secret
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_REFRESH_SECRET;

      expect(() => {
        verifyRefreshToken(refreshToken);
      }).toThrow('JWT_REFRESH_SECRET environment variable is required');

      // Restore original values
      process.env.JWT_REFRESH_SECRET = originalRefreshSecret;
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should use fallback secret in test environment when JWT_REFRESH_SECRET is not set', () => {
      // Save original values
      const originalSecret = process.env.JWT_SECRET;
      const originalRefreshSecret = process.env.JWT_REFRESH_SECRET;
      const originalNodeEnv = process.env.NODE_ENV;

      // Set test environment and clear secrets
      process.env.NODE_ENV = 'test';
      delete process.env.JWT_SECRET;
      delete process.env.JWT_REFRESH_SECRET;

      // Generate token with fallback secrets
      const { refreshToken } = generateTokens(userId, email, organizationId, role);

      // Verify should work with fallback secret
      const decoded = verifyRefreshToken(refreshToken);
      expect(decoded.sub).toBe(userId);
      expect(decoded.email).toBe(email);

      // Restore original values
      process.env.JWT_SECRET = originalSecret;
      process.env.JWT_REFRESH_SECRET = originalRefreshSecret;
      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});
