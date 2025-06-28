import { Logger, DATABASE_CONSTANTS, metrics } from '@simple-bookkeeping/shared';
import { Request, Response, NextFunction } from 'express';

import { getConnectionPoolMetrics } from '../lib/prisma';

const logger = new Logger({ component: 'DatabaseMiddleware' });

// Track database query performance
export const databaseMetricsMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Periodically update connection pool metrics
  if (Math.random() < 0.1) {
    // Sample 10% of requests
    try {
      const poolMetrics = await getConnectionPoolMetrics();
      metrics.setConnectionPoolMetrics(poolMetrics.active, poolMetrics.idle, poolMetrics.total);
    } catch (error) {
      logger.error('Failed to collect connection pool metrics', error as Error);
    }
  }

  next();
};

// Query performance tracking for Prisma
// This would be used in service methods that perform database operations
export function trackQueryPerformance(operation: string, model: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();

      try {
        const result = await originalMethod.apply(this, args);
        const duration = (Date.now() - startTime) / 1000; // Convert to seconds

        metrics.recordDatabaseQuery(operation, model, duration);

        if (duration > DATABASE_CONSTANTS.SLOW_QUERY_THRESHOLD / 1000) {
          logger.warn('Slow database operation detected', {
            operation,
            model,
            method: propertyKey,
            duration: duration * 1000, // Log in milliseconds
          });
        }

        return result;
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        metrics.recordDatabaseQuery(operation, model, duration);

        logger.error('Database operation failed', error as Error, {
          operation,
          model,
          method: propertyKey,
          duration: duration * 1000,
        });

        throw error;
      }
    };

    return descriptor;
  };
}

// Example usage in service:
// @trackQueryPerformance('findMany', 'Account')
// async getAccounts() { ... }
