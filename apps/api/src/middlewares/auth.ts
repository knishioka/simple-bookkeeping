/**
 * Stub auth middleware for backward compatibility
 * Authentication is now handled by Supabase in Next.js middleware
 * This file is kept to avoid breaking Express API build
 * The Express API will be completely removed in the next phase
 */

import { NextFunction, Request, Response } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId?: string;
    organizationRole?: string;
  };
}

// Stub authenticate middleware - always passes through
// Real authentication is handled by Supabase in Next.js
export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  // In test/development, extract user info from test token
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    const authHeader = req.headers.authorization;
    let userId = 'test-user-id';
    let organizationId = 'test-org-id';
    let role = 'admin';

    // Try to parse test token format: test-token-{userId}-{organizationId}-{role}
    if (authHeader && authHeader.startsWith('Bearer test-token-')) {
      const tokenStr = authHeader.replace('Bearer test-token-', '');
      // Split by last two dashes to handle UUIDs with dashes
      const lastDashIndex = tokenStr.lastIndexOf('-');
      const secondLastDashIndex = tokenStr.lastIndexOf('-', lastDashIndex - 1);

      if (secondLastDashIndex > 0 && lastDashIndex > 0) {
        userId = tokenStr.substring(0, secondLastDashIndex);
        organizationId = tokenStr.substring(secondLastDashIndex + 1, lastDashIndex);
        role = tokenStr.substring(lastDashIndex + 1).toUpperCase();
      }
    }

    (req as AuthenticatedRequest).user = {
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
      role,
      organizationId,
      organizationRole: role,
    };
  }
  next();
};

// Stub authorize middleware - accepts variable arguments
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const authorize = (...roles: any[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // In test/development, check if user has required role
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      const user = (req as AuthenticatedRequest).user;

      // If no user, return unauthorized
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      // If no roles specified, allow all authenticated users
      if (!roles || roles.length === 0) {
        return next();
      }

      // Check if user has one of the required roles
      // UserRole enum values are strings like 'ADMIN', 'ACCOUNTANT', 'VIEWER'
      const hasRole = roles.some((requiredRole) => {
        // Handle both string and enum values
        const roleStr = String(requiredRole);
        return user.role === roleStr || user.role === roleStr.toUpperCase();
      });

      if (hasRole) {
        return next();
      }

      // Unauthorized
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
        required: roles.map(String),
        actual: user.role,
      });
    }

    // In production, this API should not be used
    // Authentication is handled by Supabase
    next();
  };
};

// Stub setOrganizationContext middleware
export const setOrganizationContext = (req: Request, _res: Response, next: NextFunction) => {
  // Organization context is already set in authenticate middleware
  // This is just a pass-through for compatibility
  next();
};

// Stub requireOrganization middleware
export const requireOrganization = (req: Request, res: Response, next: NextFunction) => {
  // Check if user has organization context
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    const user = (req as AuthenticatedRequest).user;
    if (!user || !user.organizationId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Organization context required',
      });
    }
    return next();
  }

  // In production, this API should not be used
  next();
};
