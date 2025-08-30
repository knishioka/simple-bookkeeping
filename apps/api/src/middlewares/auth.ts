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
export const authenticate = (_req: Request, _res: Response, next: NextFunction) => {
  // In test/development, set a dummy user
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    (_req as AuthenticatedRequest).user = {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
      organizationId: 'test-org-id',
      organizationRole: 'admin',
    };
  }
  next();
};

// Stub authorize middleware - accepts variable arguments
export const authorize = (..._roles: string[]) => {
  return (_req: Request, _res: Response, next: NextFunction) => {
    // Always allow in development/test
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      return next();
    }

    // In production, this API should not be used
    // Authentication is handled by Supabase
    next();
  };
};

// Stub setOrganizationContext middleware
export const setOrganizationContext = (_req: Request, _res: Response, next: NextFunction) => {
  // Set dummy organization context in development/test
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    (_req as AuthenticatedRequest).user = {
      ...(_req as AuthenticatedRequest).user,
      organizationId: 'test-org-id',
    } as AuthenticatedRequest['user'];
  }
  next();
};

// Stub requireOrganization middleware
export const requireOrganization = (_req: Request, _res: Response, next: NextFunction) => {
  // Always pass in development/test
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    return next();
  }

  // In production, this API should not be used
  next();
};
