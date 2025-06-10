import { UserRole, prisma } from '@simple-bookkeeping/database';
import { NextFunction, Request, Response } from 'express';
import passport from 'passport';

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
export const setOrganizationContext = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user;

  if (!user) {
    return next();
  }

  try {
    // Get organization ID from header or query parameter
    const organizationId = 
      req.headers['x-organization-id'] as string ||
      req.query.organizationId as string;

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
        authReq.user.organizationId = organizationId;
        authReq.user.organizationRole = userOrg.role;
      } else {
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
        authReq.user.organizationId = defaultOrg.organizationId;
        authReq.user.organizationRole = defaultOrg.role;
      }
    }

    next();
  } catch (error) {
    console.error('Error setting organization context:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: '組織情報の取得に失敗しました',
      },
    });
  }
};

// Middleware to require organization context
export const requireOrganization = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
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
