import { DATABASE_CONSTANTS } from '../constants';
import { Logger } from '../logger';

import { metrics } from './index';

const logger = new Logger({ component: 'DatabaseMonitor' });

export interface DatabaseHealthStatus {
  connected: boolean;
  poolMetrics?: {
    active: number;
    idle: number;
    total: number;
    utilizationPercent: number;
  };
  latency?: number;
  error?: string;
}

export interface PoolMetrics {
  active: number;
  idle: number;
  total: number;
}

// Type for health check function
export type DatabaseHealthCheckFn = () => Promise<boolean>;
export type GetPoolMetricsFn = () => Promise<PoolMetrics>;

// Enhanced database health check using dependency injection
export async function performDatabaseHealthCheck(
  checkDatabaseHealth?: DatabaseHealthCheckFn,
  getConnectionPoolMetrics?: GetPoolMetricsFn
): Promise<DatabaseHealthStatus> {
  const startTime = Date.now();

  try {
    // If no health check function provided, return unknown status
    if (!checkDatabaseHealth) {
      return {
        connected: false,
        latency: Date.now() - startTime,
        error: 'Health check function not provided',
      };
    }

    const isHealthy = await checkDatabaseHealth();
    const latency = Date.now() - startTime;

    if (!isHealthy) {
      return {
        connected: false,
        latency,
        error: 'Database health check failed',
      };
    }

    // Get pool metrics if function is provided
    if (getConnectionPoolMetrics) {
      try {
        const poolMetrics = await getConnectionPoolMetrics();
        const utilizationPercent =
          poolMetrics.total > 0 ? Math.round((poolMetrics.active / poolMetrics.total) * 100) : 0;

        return {
          connected: true,
          latency,
          poolMetrics: {
            ...poolMetrics,
            utilizationPercent,
          },
        };
      } catch (error) {
        // Pool metrics might not be available in all environments
        logger.debug('Failed to get pool metrics', { error });
      }
    }

    return {
      connected: true,
      latency,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    logger.error('Database health check failed', error as Error);

    return {
      connected: false,
      latency,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Database monitoring service
export class DatabaseMonitor {
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;
  private checkDatabaseHealth?: DatabaseHealthCheckFn;
  private getConnectionPoolMetrics?: GetPoolMetricsFn;

  configure(
    checkDatabaseHealth: DatabaseHealthCheckFn,
    getConnectionPoolMetrics?: GetPoolMetricsFn
  ): void {
    this.checkDatabaseHealth = checkDatabaseHealth;
    this.getConnectionPoolMetrics = getConnectionPoolMetrics;
  }

  start(intervalMs: number = DATABASE_CONSTANTS.HEALTH_CHECK_INTERVAL): void {
    if (this.isRunning) {
      logger.warn('Database monitor is already running');
      return;
    }

    if (!this.checkDatabaseHealth) {
      logger.error('Database monitor not configured. Call configure() first.');
      return;
    }

    this.isRunning = true;
    logger.info('Starting database monitor', { intervalMs });

    // Initial check
    this.performCheck();

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.performCheck();
    }, intervalMs);
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    this.isRunning = false;
    logger.info('Stopped database monitor');
  }

  private async performCheck(): Promise<void> {
    try {
      const health = await performDatabaseHealthCheck(
        this.checkDatabaseHealth,
        this.getConnectionPoolMetrics
      );

      // Update metrics
      if (health.poolMetrics) {
        metrics.setConnectionPoolMetrics(
          health.poolMetrics.active,
          health.poolMetrics.idle,
          health.poolMetrics.total
        );
      }

      // Log warnings for high utilization
      if (health.poolMetrics && health.poolMetrics.utilizationPercent > 80) {
        logger.warn('High database connection pool utilization', {
          utilization: health.poolMetrics.utilizationPercent,
          active: health.poolMetrics.active,
          total: health.poolMetrics.total,
        });
      }

      // Log errors
      if (!health.connected) {
        logger.error(
          'Database connectivity issue detected',
          new Error(health.error || 'Unknown error')
        );
      }
    } catch (error) {
      logger.error('Database monitor check failed', error as Error);
    }
  }
}

// Singleton instance
export const databaseMonitor = new DatabaseMonitor();
