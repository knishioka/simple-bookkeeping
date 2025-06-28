import { PrismaClient } from '@prisma/client';
import { buildDatabaseUrl, DATABASE_CONSTANTS, Logger } from '@simple-bookkeeping/shared';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var prismaShutdownHandlers: (() => Promise<void>)[] | undefined;
}

const logger = new Logger({ component: 'PrismaClient' });

// Build optimized database URL with connection pool settings
const databaseUrl = process.env.DATABASE_URL
  ? buildDatabaseUrl(process.env.DATABASE_URL)
  : undefined;

// Create Prisma client with optimized configuration
function createPrismaClient() {
  const client = new PrismaClient({
    datasources: databaseUrl
      ? {
          db: { url: databaseUrl },
        }
      : undefined,
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
      { level: 'info', emit: 'event' },
    ],
  });

  // Log slow queries
  client.$on('query', (e) => {
    if (e.duration > DATABASE_CONSTANTS.SLOW_QUERY_THRESHOLD) {
      logger.warn('Slow query detected', {
        query: e.query,
        params: e.params,
        duration: e.duration,
        target: e.target,
      });
    }
  });

  // Log errors
  client.$on('error', (e) => {
    logger.error('Database error', new Error(e.message), {
      target: e.target,
      timestamp: e.timestamp,
    });
  });

  // Log warnings
  client.$on('warn', (e) => {
    logger.warn('Database warning', {
      message: e.message,
      target: e.target,
      timestamp: e.timestamp,
    });
  });

  // Log info (connection events)
  client.$on('info', (e) => {
    logger.info('Database info', {
      message: e.message,
      target: e.target,
      timestamp: e.timestamp,
    });
  });

  return client;
}

// Create singleton instance
export const prisma = global.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Graceful shutdown handling
async function handleShutdown() {
  logger.info('Gracefully shutting down Prisma client...');

  try {
    await prisma.$disconnect();
    logger.info('Prisma client disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting Prisma client', error as Error);
  }
}

// Register shutdown handlers only once
if (!global.prismaShutdownHandlers) {
  global.prismaShutdownHandlers = [];

  // Handle various shutdown signals
  ['SIGINT', 'SIGTERM', 'SIGUSR2'].forEach((signal) => {
    process.once(signal, async () => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      await handleShutdown();
      process.exit(0);
    });
  });

  // Handle uncaught errors
  process.once('uncaughtException', async (error) => {
    logger.error('Uncaught exception, shutting down gracefully', error);
    await handleShutdown();
    process.exit(1);
  });

  process.once('unhandledRejection', async (reason, promise) => {
    logger.error('Unhandled rejection, shutting down gracefully', new Error(String(reason)), {
      promise,
    });
    await handleShutdown();
    process.exit(1);
  });
}

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed', error as Error);
    return false;
  }
}

// Get connection pool metrics (requires raw SQL access to pg_stat_activity)
export async function getConnectionPoolMetrics() {
  try {
    const metrics = await prisma.$queryRaw<
      Array<{
        active: number;
        idle: number;
        total: number;
      }>
    >`
      SELECT 
        COUNT(*) FILTER (WHERE state = 'active') as active,
        COUNT(*) FILTER (WHERE state = 'idle') as idle,
        COUNT(*) as total
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid != pg_backend_pid()
    `;

    return metrics[0] || { active: 0, idle: 0, total: 0 };
  } catch (error) {
    logger.error('Failed to get connection pool metrics', error as Error);
    return { active: 0, idle: 0, total: 0 };
  }
}
