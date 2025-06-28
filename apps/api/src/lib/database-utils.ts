import { Prisma } from '@prisma/client';
import { DATABASE_CONSTANTS, DATABASE_ERROR_CODES, Logger } from '@simple-bookkeeping/shared';

import { prisma } from './database-client';

const logger = new Logger({ component: 'DatabaseUtils' });

// Retry configuration
interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

// Check if error is retryable
function isRetryableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Connection pool timeout errors are retryable
    return (
      error.code === DATABASE_ERROR_CODES.CONNECTION_LIMIT_EXCEEDED ||
      error.code === DATABASE_ERROR_CODES.TIMEOUT
    );
  }

  if (error instanceof Error) {
    // Network errors are retryable
    return (
      error.message.includes('connect') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT')
    );
  }

  return false;
}

// Retry function for database operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = DATABASE_CONSTANTS.MAX_RETRY_ATTEMPTS,
    delay = DATABASE_CONSTANTS.RETRY_DELAY,
    onRetry,
  } = options;

  let lastError: Error = new Error('Operation failed');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (!isRetryableError(error) || attempt === maxAttempts) {
        throw error;
      }

      logger.warn(`Retrying database operation (attempt ${attempt}/${maxAttempts})`, {
        error: lastError.message,
        attempt,
      });

      if (onRetry) {
        onRetry(lastError, attempt);
      }

      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }

  throw lastError;
}

// Transaction with timeout
export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  }
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await prisma.$transaction(fn, {
      maxWait: options?.maxWait || 5000, // Max time to wait for transaction slot
      timeout: options?.timeout || DATABASE_CONSTANTS.DEFAULT_QUERY_TIMEOUT,
      isolationLevel: options?.isolationLevel,
    });

    const duration = Date.now() - startTime;
    if (duration > DATABASE_CONSTANTS.SLOW_QUERY_THRESHOLD) {
      logger.warn('Slow transaction detected', { duration });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Transaction failed', error as Error, { duration });
    throw error;
  }
}

// Batch operations with chunking
export async function batchOperation<T, R>(
  items: T[],
  operation: (batch: T[]) => Promise<R[]>,
  batchSize = 100
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await withRetry(() => operation(batch));
    results.push(...batchResults);

    // Add small delay between batches to avoid overwhelming the database
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

// Query with timeout wrapper
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = DATABASE_CONSTANTS.DEFAULT_QUERY_TIMEOUT
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([operation(), timeoutPromise]);
}

// Safe query execution with error handling
export async function safeQuery<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T | null> {
  try {
    return await withRetry(operation);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === DATABASE_ERROR_CODES.NOT_FOUND) {
        return null;
      }
    }

    logger.error(`Database query failed: ${context}`, error as Error);
    throw error;
  }
}

// Connection pool warmup
export async function warmupConnectionPool(connections = 5): Promise<void> {
  logger.info(`Warming up connection pool with ${connections} connections...`);

  const promises = Array.from({ length: connections }, async (_, i) => {
    try {
      await prisma.$queryRaw`SELECT ${i}::int`;
    } catch (error) {
      logger.warn(`Failed to warmup connection ${i}`, { error });
    }
  });

  await Promise.all(promises);
  logger.info('Connection pool warmup completed');
}

// Execute raw SQL with proper typing and error handling
export async function executeRawQuery<T = unknown>(
  query: TemplateStringsArray | Prisma.Sql,
  ...values: unknown[]
): Promise<T[]> {
  try {
    if ('strings' in query) {
      // Template literal call
      return await prisma.$queryRaw<T[]>(query, ...values);
    } else {
      // Prisma.sql call
      return await prisma.$queryRaw<T[]>(query);
    }
  } catch (error) {
    logger.error('Raw query execution failed', error as Error, {
      query: 'strings' in query ? query.strings.join('?') : (query as any).text || String(query),
    });
    throw error;
  }
}

// Database maintenance utilities
export const maintenance = {
  // Analyze tables for query optimization
  async analyzeTables(tables?: string[]): Promise<void> {
    const tableList = tables || [
      'organizations',
      'users',
      'accounts',
      'journal_entries',
      'journal_entry_lines',
      'accounting_periods',
    ];

    for (const table of tableList) {
      try {
        await prisma.$executeRaw`ANALYZE ${Prisma.raw(table)}`;
        logger.info(`Analyzed table: ${table}`);
      } catch (error) {
        logger.error(`Failed to analyze table: ${table}`, error as Error);
      }
    }
  },

  // Vacuum tables to reclaim space
  async vacuumTables(tables?: string[]): Promise<void> {
    const tableList = tables || ['journal_entries', 'journal_entry_lines'];

    for (const table of tableList) {
      try {
        // Note: VACUUM cannot be run inside a transaction block
        await prisma.$executeRaw`VACUUM (ANALYZE) ${Prisma.raw(table)}`;
        logger.info(`Vacuumed table: ${table}`);
      } catch (error) {
        logger.error(`Failed to vacuum table: ${table}`, error as Error);
      }
    }
  },

  // Get table sizes
  async getTableSizes(): Promise<Array<{ table: string; size: string; rows: number }>> {
    return await prisma.$queryRaw`
      SELECT 
        schemaname || '.' || tablename AS table,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        n_live_tup AS rows
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `;
  },
};

// Export all utilities
export default {
  withRetry,
  withTransaction,
  batchOperation,
  withTimeout,
  safeQuery,
  warmupConnectionPool,
  executeRawQuery,
  maintenance,
};
