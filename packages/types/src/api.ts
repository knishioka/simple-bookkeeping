/**
 * API-specific type definitions
 * Note: Express types have been removed. Use Next.js request types instead.
 */

// import { User } from './auth';

// This interface has been removed as it depends on Express.
// For Next.js, use NextRequest or the request object from API routes.
// export interface AuthenticatedRequest extends Request {
//   user?: User;
// }

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ApiValidationError {
  code: 'VALIDATION_ERROR';
  message: string;
  details: ValidationError[];
}

export interface ApiAuthError {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'TOKEN_EXPIRED';
  message: string;
}

export interface ApiNotFoundError {
  code: 'NOT_FOUND';
  message: string;
  resource?: string;
}

export interface ApiServerError {
  code: 'INTERNAL_SERVER_ERROR';
  message: string;
}

// Export API subdirectory types
export * from './api/journal-entries';
