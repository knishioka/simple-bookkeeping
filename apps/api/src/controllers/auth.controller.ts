import { UserRole } from '@simple-bookkeeping/database';
import { LoginInput } from '@simple-bookkeeping/shared';
import bcrypt from 'bcrypt';
import { Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';

export const login = async (
  req: Request<Record<string, never>, Record<string, never>, LoginInput>,
  res: Response
) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'メールアドレスまたはパスワードが正しくありません',
        },
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'メールアドレスまたはパスワードが正しくありません',
        },
      });
    }

    // TODO: Remove hardcoded role when fully migrated to organization-based roles
    const { accessToken, refreshToken } = generateTokens(user.id, user.email, UserRole.ADMIN);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    res.json({
      data: {
        token: accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          // TODO: Get role from user's default organization
          role: UserRole.ADMIN,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ログイン処理中にエラーが発生しました',
      },
    });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'リフレッシュトークンが必要です',
        },
      });
    }

    const payload = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'トークンが無効です',
        },
      });
    }

    // TODO: Remove hardcoded role when fully migrated to organization-based roles
    const tokens = generateTokens(user.id, user.email, UserRole.ADMIN);

    res.json({
      data: {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'トークンが無効です',
      },
    });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, organizationName } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        error: {
          code: 'USER_EXISTS',
          message: 'このメールアドレスは既に使用されています',
        },
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create organization and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          code: `ORG-${Date.now()}`,
          isActive: true,
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          isActive: true,
        },
      });

      // Link user to organization
      await tx.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: UserRole.ADMIN,
          isDefault: true,
        },
      });

      return { user, organization };
    });

    const tokens = generateTokens(result.user.id, result.user.email, UserRole.ADMIN);

    res.status(201).json({
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
        organization: {
          id: result.organization.id,
          name: result.organization.name,
        },
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ユーザー登録中にエラーが発生しました',
      },
    });
  }
};

export const logout = async (_req: Request, res: Response) => {
  // In a stateless JWT setup, logout is handled client-side
  // Here we just return a success response
  res.json({
    data: {
      message: 'ログアウトしました',
    },
  });
};
