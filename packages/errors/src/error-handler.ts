/**
 * Centralized error handling utilities
 */

import { ApiResponse } from '@simple-bookkeeping/types';
import { Response } from 'express';

import { ValidationApiError } from './api-errors';
import { BaseError } from './base-error';

export function handleError(error: Error, res: Response): void {
  if (error instanceof ValidationApiError) {
    const response: ApiResponse = {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
    res.status(error.statusCode).json(response);
    return;
  }

  if (error instanceof BaseError) {
    const response: ApiResponse = {
      error: {
        code: error.code,
        message: error.message,
      },
    };
    res.status(error.statusCode).json(response);
    return;
  }

  // Handle unexpected errors
  console.error('Unexpected error:', error);
  const response: ApiResponse = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  };
  res.status(500).json(response);
}

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
