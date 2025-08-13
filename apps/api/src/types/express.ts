import { UserRole } from '@simple-bookkeeping/database';
import { Request, RequestHandler } from 'express';

// Simple type for Express route handlers to avoid any warnings
// Using a more permissive type to handle various request parameter combinations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RouteHandler = RequestHandler<any, any, any, any>;

// Request with authenticated user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    organizationId?: string;
    organizationRole?: UserRole;
  };
  organizationId?: string; // Deprecated, use user.organizationId instead
}
