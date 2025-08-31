/**
 * Centralized error handling utilities
 * Note: Express error handler has been removed. Use Next.js error handling instead.
 */

// import { ApiResponse } from '@simple-bookkeeping/types';
// import { ValidationApiError } from './api-errors';
import { BaseError } from './base-error';

// This function has been removed as it depends on Express.
// For Next.js, use error.tsx or API route error handling.
// Example implementation for Next.js API routes:
/*
export function formatErrorResponse(error: Error): { status: number; body: ApiResponse } {
  if (error instanceof ValidationApiError) {
    return {
      status: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
    };
  }

  if (error instanceof BaseError) {
    return {
      status: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
        },
      },
    };
  }

  // Handle unexpected errors
  console.error('Unexpected error:', error);
  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    },
  };
}
*/

export function isOperationalError(error: Error): boolean {
  if (error instanceof BaseError) {
    return error.isOperational;
  }
  return false;
}

export function logError(error: Error): void {
  console.error({
    message: error.message,
    stack: error.stack,
    ...(error instanceof BaseError && {
      code: error.code,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
    }),
  });
}
