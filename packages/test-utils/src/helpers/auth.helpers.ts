import * as jwt from 'jsonwebtoken';

import { TEST_CREDENTIALS, TEST_JWT_CONFIG } from '../test-config';

/**
 * Generate a test JWT token
 * @param payload - Token payload
 * @param options - Optional JWT sign options
 * @returns JWT token string
 */
export function generateTestJWT(
  payload: {
    userId: string;
    email: string;
    role: 'admin' | 'accountant' | 'viewer';
    organizationId?: string;
  },
  options?: {
    secret?: string;
    expiresIn?: string | number;
  }
): string {
  const secret = options?.secret || TEST_JWT_CONFIG.secret;
  const expiresIn = options?.expiresIn || TEST_JWT_CONFIG.expiresIn;

  return jwt.sign(
    {
      ...payload,
      test: true, // Mark as test token
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    { expiresIn: expiresIn as any }
  );
}

/**
 * Generate a test refresh token
 * @param userId - User ID for the refresh token
 * @param options - Optional JWT sign options
 * @returns Refresh token string
 */
export function generateTestRefreshToken(
  userId: string,
  options?: {
    secret?: string;
    expiresIn?: string | number;
  }
): string {
  const secret = options?.secret || TEST_JWT_CONFIG.refreshSecret;
  const expiresIn = options?.expiresIn || TEST_JWT_CONFIG.refreshExpiresIn;

  return jwt.sign(
    {
      userId,
      type: 'refresh',
      test: true,
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    { expiresIn: expiresIn as any }
  );
}

/**
 * Generate an expired test JWT token
 * @param payload - Token payload
 * @returns Expired JWT token string
 */
export function generateExpiredTestJWT(payload: {
  userId: string;
  email: string;
  role: 'admin' | 'accountant' | 'viewer';
}): string {
  return jwt.sign(
    {
      ...payload,
      test: true,
      iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    },
    TEST_JWT_CONFIG.secret
  );
}

/**
 * Get test credentials by role
 * @param role - User role
 * @returns Test credentials for the specified role
 */
export function getTestCredentialsByRole(role: 'admin' | 'accountant' | 'viewer') {
  switch (role) {
    case 'admin':
      return TEST_CREDENTIALS.admin;
    case 'accountant':
      return TEST_CREDENTIALS.accountant;
    case 'viewer':
      return TEST_CREDENTIALS.viewer;
    default:
      return TEST_CREDENTIALS.testUser;
  }
}

/**
 * Create authorization header with test JWT
 * @param userId - User ID for the token
 * @param role - User role
 * @returns Authorization header object
 */
export function createTestAuthHeader(
  userId: string,
  role: 'admin' | 'accountant' | 'viewer' = 'viewer'
): { Authorization: string } {
  const credentials = getTestCredentialsByRole(role);
  const token = generateTestJWT({
    userId,
    email: credentials.email,
    role,
  });

  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Mock authentication middleware response
 * @param userId - User ID
 * @param role - User role
 * @returns Mock user object for req.user
 */
export function mockAuthUser(userId: string, role: 'admin' | 'accountant' | 'viewer' = 'viewer') {
  const credentials = getTestCredentialsByRole(role);

  return {
    id: userId,
    email: credentials.email,
    name: credentials.name,
    role,
    organizationId: 'test-org-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Generate test session data
 * @param userId - User ID
 * @param role - User role
 * @returns Session data object
 */
export function generateTestSession(
  userId: string,
  role: 'admin' | 'accountant' | 'viewer' = 'viewer'
) {
  const credentials = getTestCredentialsByRole(role);
  const accessToken = generateTestJWT({
    userId,
    email: credentials.email,
    role,
  });
  const refreshToken = generateTestRefreshToken(userId);

  return {
    user: {
      id: userId,
      email: credentials.email,
      name: credentials.name,
      role,
    },
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
  };
}
