/**
 * API-specific error classes
 */

import { ValidationError } from '@simple-bookkeeping/types';

import { BaseError } from './base-error';
import { getErrorMessage, Language } from './messages';

export class ApiError extends BaseError {
  constructor(message: string, statusCode = 500, code = 'API_ERROR') {
    super(message, statusCode, code);
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string) {
    super(message, 400, 'BAD_REQUEST');
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id?: string, language?: Language) {
    const resourceWithId = id ? `${resource} (ID: ${id})` : resource;
    const message = getErrorMessage('RESOURCE_NOT_FOUND', { resource: resourceWithId }, language);
    super(message, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message?: string, language?: Language) {
    const errorMessage = message || getErrorMessage('UNAUTHORIZED', undefined, language);
    super(errorMessage, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends ApiError {
  constructor(message?: string, language?: Language) {
    const errorMessage = message || getErrorMessage('FORBIDDEN', undefined, language);
    super(errorMessage, 403, 'FORBIDDEN');
  }
}

export class ValidationApiError extends ApiError {
  public readonly details: ValidationError[];

  constructor(details: ValidationError[]) {
    const message = details.map((d) => d.message).join(', ');
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message?: string, language?: Language) {
    const errorMessage = message || getErrorMessage('TOO_MANY_REQUESTS', undefined, language);
    super(errorMessage, 429, 'TOO_MANY_REQUESTS');
  }
}
