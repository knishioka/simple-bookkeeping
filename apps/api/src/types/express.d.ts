import { UserRole } from '@simple-bookkeeping/database';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: UserRole;
        organizationId?: string;
        organizationRole?: UserRole;
      };
    }
  }
}

export {};
