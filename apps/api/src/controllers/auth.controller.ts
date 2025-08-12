import {
  ChangePasswordInput,
  LoginInput,
  UpdateUserProfileInput,
  UserRole,
} from '@simple-bookkeeping/core';
import { hash, compare } from 'bcryptjs';
import { Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middlewares/auth';
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

    const isPasswordValid = await compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'メールアドレスまたはパスワードが正しくありません',
        },
      });
    }

    // Get user's default organization
    const defaultOrg = await prisma.userOrganization.findFirst({
      where: {
        userId: user.id,
        isDefault: true,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    const organizationId = defaultOrg?.organizationId;
    const organizationRole = defaultOrg?.role || UserRole.VIEWER;

    if (!organizationId) {
      return res.status(400).json({
        error: {
          code: 'NO_ORGANIZATION',
          message: 'ユーザーが組織に所属していません',
        },
      });
    }

    const { accessToken, refreshToken } = generateTokens(
      user.id,
      user.email,
      organizationId,
      organizationRole
    );

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
          role: organizationRole,
          organizationId,
          organization: defaultOrg?.organization,
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

    // Get user's organization info from the refresh token payload
    // If organizationId is in the token, use it; otherwise get default
    let organizationId = payload.organizationId;
    let organizationRole = payload.role;

    // If no organization info in token (legacy token), get default organization
    if (!organizationId) {
      const defaultOrg = await prisma.userOrganization.findFirst({
        where: {
          userId: user.id,
          isDefault: true,
        },
      });

      if (!defaultOrg) {
        return res.status(400).json({
          error: {
            code: 'NO_ORGANIZATION',
            message: 'ユーザーが組織に所属していません',
          },
        });
      }

      organizationId = defaultOrg.organizationId;
      organizationRole = defaultOrg.role;
    } else {
      // Verify the user still has access to the organization
      const userOrg = await prisma.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId,
          },
        },
      });

      if (!userOrg) {
        // User no longer has access to this organization, get default
        const defaultOrg = await prisma.userOrganization.findFirst({
          where: {
            userId: user.id,
            isDefault: true,
          },
        });

        if (!defaultOrg) {
          return res.status(400).json({
            error: {
              code: 'NO_ORGANIZATION',
              message: 'ユーザーが組織に所属していません',
            },
          });
        }

        organizationId = defaultOrg.organizationId;
        organizationRole = defaultOrg.role;
      } else {
        // Update role in case it changed
        organizationRole = userOrg.role;
      }
    }

    const tokens = generateTokens(user.id, user.email, organizationId, organizationRole);

    res.json({
      data: {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch {
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
    const passwordHash = await hash(password, 10);

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

    const tokens = generateTokens(
      result.user.id,
      result.user.email,
      result.organization.id,
      UserRole.ADMIN
    );

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

export const getMe = async (req: Request, res: Response) => {
  try {
    // Get user from request (set by authenticate middleware)
    const authUser = (req as AuthenticatedRequest).user;

    if (!authUser) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
        },
      });
    }

    // Get full user data with organization info
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        userOrganizations: {
          select: {
            organizationId: true,
            role: true,
            isDefault: true,
            organization: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'ユーザーが見つかりません',
        },
      });
    }

    // Get default/current organization
    const defaultOrg = user.userOrganizations.find((org) => org.isDefault);
    const currentOrganization = defaultOrg
      ? {
          id: defaultOrg.organization.id,
          name: defaultOrg.organization.name,
          code: defaultOrg.organization.code,
          role: defaultOrg.role,
          isDefault: true,
        }
      : undefined;

    // Format organizations list
    const organizations = user.userOrganizations.map((userOrg) => ({
      id: userOrg.organization.id,
      name: userOrg.organization.name,
      code: userOrg.organization.code,
      role: userOrg.role,
      isDefault: userOrg.isDefault,
    }));

    res.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          organizations,
          currentOrganization,
        },
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'ユーザー情報の取得中にエラーが発生しました',
      },
    });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;
    const { name } = req.body as UpdateUserProfileInput;

    if (!authUser) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
        },
      });
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: authUser.id },
      data: {
        name,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    res.json({
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'プロフィール更新中にエラーが発生しました',
      },
    });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;
    const { currentPassword, newPassword } = req.body as ChangePasswordInput;

    if (!authUser) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
        },
      });
    }

    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'ユーザーが見つかりません',
        },
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PASSWORD',
          message: '現在のパスワードが正しくありません',
        },
      });
    }

    // Hash new password
    const newPasswordHash = await hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: authUser.id },
      data: {
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      },
    });

    res.json({
      data: {
        message: 'パスワードを変更しました',
      },
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'パスワード変更中にエラーが発生しました',
      },
    });
  }
};

export const switchOrganization = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;
    const { organizationId } = req.body;

    if (!authUser) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
        },
      });
    }

    if (!organizationId) {
      return res.status(400).json({
        error: {
          code: 'MISSING_ORGANIZATION_ID',
          message: '組織IDが必要です',
        },
      });
    }

    // Check if user has access to the organization
    const userOrg = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: authUser.id,
          organizationId,
        },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
          },
        },
      },
    });

    if (!userOrg) {
      return res.status(403).json({
        error: {
          code: 'NO_ACCESS_TO_ORGANIZATION',
          message: 'この組織へのアクセス権限がありません',
        },
      });
    }

    if (!userOrg.organization.isActive) {
      return res.status(403).json({
        error: {
          code: 'ORGANIZATION_INACTIVE',
          message: 'この組織は無効化されています',
        },
      });
    }

    // Get user details for token generation
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'ユーザーが見つかりません',
        },
      });
    }

    // Generate new tokens with the selected organization
    const { accessToken, refreshToken } = generateTokens(
      user.id,
      user.email,
      organizationId,
      userOrg.role
    );

    res.json({
      data: {
        token: accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: userOrg.role,
          organizationId,
          organization: userOrg.organization,
        },
      },
    });
  } catch (error) {
    console.error('Switch organization error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '組織切り替え中にエラーが発生しました',
      },
    });
  }
};
