import { UserRole } from '@simple-bookkeeping/database';
import { Logger } from '@simple-bookkeeping/shared';
import { NextFunction, Request, Response } from 'express';
import passport from 'passport';

import { prisma } from '../lib/prisma';

const logger = new Logger({ component: 'AuthMiddleware' });

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    organizationId?: string;
    organizationRole?: UserRole;
  };
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  passport.authenticate('jwt', { session: false }, (err: Error, user: any) => {
    if (err || !user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
        },
      });
    }

    (req as AuthenticatedRequest).user = user as {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      organizationId?: string;
      organizationRole?: UserRole;
    };
    next();
  })(req, res, next);
};

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です',
        },
      });
    }

    // Check organization role if organizationRole is set
    const effectiveRole = user.organizationRole || user.role;
    if (!roles.includes(effectiveRole)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: '権限がありません',
        },
      });
    }

    next();
  };
};

// Middleware to set organization context from header or query parameter
export const setOrganizationContext = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;

  if (!user) {
    return next();
  }

  try {
    // Get organization ID from header or query parameter
    const organizationId =
      (req.headers['x-organization-id'] as string) || (req.query.organizationId as string);

    logger.debug('Setting organization context', {
      userId: user.id,
      headerOrgId: req.headers['x-organization-id'],
      queryOrgId: req.query.organizationId,
      organizationId,
    });

    if (organizationId) {
      // Verify user has access to this organization
      const userOrg = await prisma.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId,
          },
        },
        include: {
          organization: {
            select: {
              id: true,
              isActive: true,
            },
          },
        },
      });

      if (userOrg && userOrg.organization.isActive) {
        if (authReq.user) {
          authReq.user.organizationId = organizationId;
          authReq.user.organizationRole = userOrg.role;
          logger.debug('Organization context set from header/query', {
            userId: user.id,
            organizationId,
            role: userOrg.role,
          });
        }
      } else {
        logger.warn('User does not have access to organization', {
          userId: user.id,
          organizationId,
        });
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'この組織へのアクセス権限がありません',
          },
        });
      }
    } else {
      // Get default organization if no organization specified
      const defaultOrg = await prisma.userOrganization.findFirst({
        where: {
          userId: user.id,
          isDefault: true,
        },
        include: {
          organization: {
            select: {
              id: true,
              isActive: true,
            },
          },
        },
      });

      if (defaultOrg && defaultOrg.organization.isActive) {
        if (authReq.user) {
          authReq.user.organizationId = defaultOrg.organizationId;
          authReq.user.organizationRole = defaultOrg.role;
          logger.debug('Organization context set from default', {
            userId: user.id,
            organizationId: defaultOrg.organizationId,
            role: defaultOrg.role,
          });
        }
      } else {
        logger.warn('No default organization found for user', {
          userId: user.id,
        });
      }
    }

    next();
  } catch (error) {
    const requestedOrgId =
      (req.headers['x-organization-id'] as string) || (req.query.organizationId as string);

    logger.error('Error setting organization context', error as Error, {
      userId: user.id,
      organizationId: requestedOrgId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
    });

    // Check if it's a database connection error
    if (error instanceof Error) {
      if (error.message.includes('P2002') || error.message.includes('P2003')) {
        return res.status(400).json({
          error: {
            code: 'INVALID_ORGANIZATION',
            message: '指定された組織が見つかりません',
          },
        });
      }

      if (error.message.includes('P2021') || error.message.includes('P2022')) {
        return res.status(503).json({
          error: {
            code: 'DATABASE_ERROR',
            message: 'データベース接続エラーが発生しました。しばらくしてから再度お試しください。',
          },
        });
      }

      // Log the actual error in development mode
      if (process.env.NODE_ENV === 'development') {
        return res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: '組織情報の取得に失敗しました',
            details: error.message,
          },
        });
      }
    }

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: '組織情報の取得に失敗しました',
      },
    });
  }
};

// Middleware to require organization context
export const requireOrganization = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;

  if (!user || !user.organizationId) {
    return res.status(400).json({
      error: {
        code: 'ORGANIZATION_REQUIRED',
        message: '組織の選択が必要です',
      },
    });
  }

  next();
};
