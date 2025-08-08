import { HTTP_STATUS, ERROR_CODES, Logger } from '@simple-bookkeeping/shared';
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

const logger = new Logger({ component: 'ValidationMiddleware' });

/**
 * Generic validation middleware factory
 * @param schema - Zod schema to validate against
 * @param source - Where to find the data to validate ('body', 'query', 'params')
 * @returns Express middleware function
 */
export const validate = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get data from the specified source
      const data = req[source];

      // Validate the data
      const validatedData = await schema.parseAsync(data);

      // Replace the original data with validated/transformed data
      req[source] = validatedData;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Validation failed', {
          path: req.path,
          method: req.method,
          source,
          errors: error.issues,
        });

        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Validation failed',
            details: error.issues.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })),
          },
        });
      }

      // Unexpected error
      logger.error('Unexpected validation error', error);

      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: 'An unexpected error occurred during validation',
        },
      });
    }
  };
};

/**
 * Combine multiple validation middlewares
 * Useful when you need to validate multiple sources
 */
export const validateMultiple = (
  validations: Array<{
    schema: ZodSchema;
    source: 'body' | 'query' | 'params';
  }>
) => {
  const middlewares = validations.map(({ schema, source }) => validate(schema, source));

  return (req: Request, res: Response, next: NextFunction) => {
    // Execute all validation middlewares in sequence
    const runMiddleware = (index: number): void => {
      if (index >= middlewares.length) {
        return next();
      }

      middlewares[index](req, res, (err?: unknown) => {
        if (err) {
          return next(err);
        }
        runMiddleware(index + 1);
      });
    };

    runMiddleware(0);
  };
};

/**
 * Optional validation middleware
 * Validates if data is present, but doesn't fail if data is missing
 */
export const validateOptional = (
  schema: ZodSchema,
  source: 'body' | 'query' | 'params' = 'body'
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const data = req[source];

    // If no data is present, skip validation
    if (!data || Object.keys(data).length === 0) {
      return next();
    }

    // Otherwise, perform normal validation
    return validate(schema, source)(req, res, next);
  };
};

/**
 * Custom validation middleware for file uploads
 */
export const validateFile = (options: {
  maxSize?: number;
  allowedTypes?: string[];
  required?: boolean;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;

    if (!file && options.required) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'File is required',
        },
      });
    }

    if (!file) {
      return next();
    }

    // Validate file size
    if (options.maxSize && file.size > options.maxSize) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: {
          code: ERROR_CODES.FILE_TOO_LARGE,
          message: `File size exceeds maximum allowed size of ${options.maxSize} bytes`,
        },
      });
    }

    // Validate file type
    if (options.allowedTypes && !options.allowedTypes.includes(file.mimetype)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: {
          code: ERROR_CODES.INVALID_FILE_TYPE,
          message: `File type ${file.mimetype} is not allowed. Allowed types: ${options.allowedTypes.join(', ')}`,
        },
      });
    }

    next();
  };
};

/**
 * Sanitize and validate pagination parameters
 */
export const validatePagination = (req: Request, res: Response, next: NextFunction) => {
  const { page = '1', limit = '50' } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid page number',
      },
    });
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid limit. Must be between 1 and 100',
      },
    });
  }

  // Add parsed values to request
  (req as Request & { pagination?: { page: number; limit: number; skip: number } }).pagination = {
    page: pageNum,
    limit: limitNum,
    skip: (pageNum - 1) * limitNum,
  };

  next();
};
