import { Logger } from '@simple-bookkeeping/shared';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request type
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
      logger: Logger;
    }
  }
}

// Request logging middleware
export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Generate request ID
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.startTime = Date.now();

  // Set request ID header
  res.setHeader('X-Request-ID', req.requestId);

  // Create request-specific logger
  req.logger = Logger.fromRequest(req);

  // Log incoming request
  req.logger.http(`Incoming ${req.method} request`, {
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    params: req.params,
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data: unknown): Response {
    res.send = originalSend;

    const duration = Date.now() - req.startTime;
    const logData = {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length'),
    };

    // Log based on status code
    if (res.statusCode >= 500) {
      req.logger.error(`Request failed with ${res.statusCode}`, undefined, logData);
    } else if (res.statusCode >= 400) {
      req.logger.warn(`Request completed with ${res.statusCode}`, logData);
    } else {
      req.logger.http(`Request completed successfully`, logData);
    }

    return res.send(data);
  };

  next();
};

// Error logging middleware
export const errorLoggingMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const logger = req.logger || new Logger();

  logger.error('Unhandled error in request', err, {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    stack: err.stack,
  });

  next(err);
};

// Performance monitoring middleware
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const route = req.route?.path || req.path;

  // Skip static assets
  if (route.includes('.') || route.startsWith('/_next')) {
    return next();
  }

  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1e6; // Convert to milliseconds

    if (duration > 1000) {
      req.logger.warn(`Slow request detected`, {
        route,
        duration: `${duration.toFixed(2)}ms`,
        threshold: '1000ms',
      });
    }
  });

  next();
};
