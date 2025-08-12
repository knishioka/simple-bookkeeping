import * as jwt from 'jsonwebtoken';

interface TokenPayload {
  sub: string;
  email: string;
  organizationId: string;
  role: string;
}

export const generateTokens = (
  userId: string,
  email: string,
  organizationId: string,
  role: string
): { accessToken: string; refreshToken: string } => {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

  // In test environment, allow default secrets for testing
  if (!jwtSecret && process.env.NODE_ENV !== 'test') {
    throw new Error('JWT_SECRET environment variable is required');
  }

  if (!jwtRefreshSecret && process.env.NODE_ENV !== 'test') {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }

  // Use default test secrets if not set in test environment
  const effectiveJwtSecret = jwtSecret || 'test-jwt-secret';
  const effectiveJwtRefreshSecret = jwtRefreshSecret || 'test-jwt-refresh-secret';

  const payload: TokenPayload = {
    sub: userId,
    email,
    organizationId,
    role,
  };

  const accessToken = jwt.sign(payload, effectiveJwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  } as jwt.SignOptions);

  const refreshToken = jwt.sign(payload, effectiveJwtRefreshSecret, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  } as jwt.SignOptions);

  return { accessToken, refreshToken };
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

  // In test environment, allow default secrets for testing
  if (!jwtRefreshSecret && process.env.NODE_ENV !== 'test') {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }

  // Use default test secret if not set in test environment
  const effectiveJwtRefreshSecret = jwtRefreshSecret || 'test-jwt-refresh-secret';

  return jwt.verify(token, effectiveJwtRefreshSecret) as TokenPayload;
};
