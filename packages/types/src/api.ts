/**
 * API-specific type definitions
 */

import { Request } from 'express';

import { User } from './auth';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
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
