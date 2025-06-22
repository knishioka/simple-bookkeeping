import * as jwt from 'jsonwebtoken';

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

export const generateTokens = (
  userId: string,
  email: string,
  role: string
): { accessToken: string; refreshToken: string } => {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  if (!jwtRefreshSecret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }

  const payload: TokenPayload = {
    sub: userId,
    email,
    role,
  };

  const accessToken = jwt.sign(payload, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  } as jwt.SignOptions);

  const refreshToken = jwt.sign(payload, jwtRefreshSecret, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  } as jwt.SignOptions);

  return { accessToken, refreshToken };
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!jwtRefreshSecret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }

  return jwt.verify(token, jwtRefreshSecret) as TokenPayload;
};
