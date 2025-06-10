import jwt from 'jsonwebtoken';

import { generateTokens, verifyRefreshToken } from '../jwt';

describe('JWT Utils', () => {
  const userId = 'test-user-id';
  const email = 'test@example.com';
  const role = 'ADMIN';

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', () => {
      const { accessToken, refreshToken } = generateTokens(userId, email, role);

      expect(accessToken).toBeTruthy();
      expect(refreshToken).toBeTruthy();

      // Verify access token
      const decodedAccess = jwt.verify(
        accessToken,
        process.env.JWT_SECRET || 'your-secret-key'
      ) as any;
      expect(decodedAccess.sub).toBe(userId);
      expect(decodedAccess.email).toBe(email);
      expect(decodedAccess.role).toBe(role);

      // Verify refresh token
      const decodedRefresh = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key'
      ) as any;
      expect(decodedRefresh.sub).toBe(userId);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const { refreshToken } = generateTokens(userId, email, role);
      const decoded = verifyRefreshToken(refreshToken);

      expect(decoded.sub).toBe(userId);
      expect(decoded.email).toBe(email);
      expect(decoded.role).toBe(role);
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        verifyRefreshToken('invalid-token');
      }).toThrow();
    });
  });
});
