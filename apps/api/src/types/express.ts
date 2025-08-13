import { UserRole } from '@simple-bookkeeping/database';
import { Request, RequestHandler } from 'express';

// Simple type for Express route handlers
// Using RequestHandler directly without additional constraints
export type RouteHandler = RequestHandler;

// Request with authenticated user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    organizationId?: string;
    organizationRole?: UserRole;
  };
}
