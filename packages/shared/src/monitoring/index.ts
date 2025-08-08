import * as os from 'os';

import { Request, Response, NextFunction } from 'express';
import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

import { Logger } from '../logger';

export interface MetricsConfig {
  prefix?: string;
  defaultLabels?: Record<string, string>;
  collectDefaultMetrics?: boolean;
}

export class MetricsCollector {
  private registry: Registry;
  private logger: Logger;
  private prefix: string;

  // HTTP metrics
  private httpRequestDuration!: Histogram<string>;
  private httpRequestTotal!: Counter<string>;
  private httpRequestErrors!: Counter<string>;

  // Business metrics
  private journalEntriesCreated!: Counter<string>;
  private accountsCreated!: Counter<string>;
  private authenticationAttempts!: Counter<string>;
  private activeUsers!: Gauge<string>;

  // Database metrics
  private dbQueryDuration!: Histogram<string>;
  private dbConnectionPool!: Gauge<string>;

  // Cache metrics
  private cacheHits!: Counter<string>;
  private cacheMisses!: Counter<string>;
  private cacheLatency!: Histogram<string>;

  constructor(config: MetricsConfig = {}) {
    this.logger = new Logger({ component: 'MetricsCollector' });
    this.prefix = config.prefix || 'simple_bookkeeping_';
    this.registry = new Registry();

    if (config.defaultLabels) {
      this.registry.setDefaultLabels(config.defaultLabels);
    }

    if (config.collectDefaultMetrics !== false) {
      collectDefaultMetrics({ register: this.registry, prefix: this.prefix });
    }

    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // HTTP metrics
    this.httpRequestDuration = new Histogram({
      name: `${this.prefix}http_request_duration_seconds`,
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'organization_id'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.httpRequestTotal = new Counter({
      name: `${this.prefix}http_requests_total`,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'organization_id'],
      registers: [this.registry],
    });

    this.httpRequestErrors = new Counter({
      name: `${this.prefix}http_request_errors_total`,
      help: 'Total number of HTTP request errors',
      labelNames: ['method', 'route', 'error_code', 'organization_id'],
      registers: [this.registry],
    });

    // Business metrics
    this.journalEntriesCreated = new Counter({
      name: `${this.prefix}journal_entries_created_total`,
      help: 'Total number of journal entries created',
      labelNames: ['organization_id', 'status'],
      registers: [this.registry],
    });

    this.accountsCreated = new Counter({
      name: `${this.prefix}accounts_created_total`,
      help: 'Total number of accounts created',
      labelNames: ['organization_id', 'account_type'],
      registers: [this.registry],
    });

    this.authenticationAttempts = new Counter({
      name: `${this.prefix}authentication_attempts_total`,
      help: 'Total number of authentication attempts',
      labelNames: ['status', 'method'],
      registers: [this.registry],
    });

    this.activeUsers = new Gauge({
      name: `${this.prefix}active_users`,
      help: 'Number of active users',
      labelNames: ['organization_id'],
      registers: [this.registry],
    });

    // Database metrics
    this.dbQueryDuration = new Histogram({
      name: `${this.prefix}db_query_duration_seconds`,
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'model'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });

    this.dbConnectionPool = new Gauge({
      name: `${this.prefix}db_connection_pool`,
      help: 'Database connection pool metrics',
      labelNames: ['state'], // active, idle, total
      registers: [this.registry],
    });

    // Cache metrics
    this.cacheHits = new Counter({
      name: `${this.prefix}cache_hits_total`,
      help: 'Total number of cache hits',
      labelNames: ['cache_name', 'operation'],
      registers: [this.registry],
    });

    this.cacheMisses = new Counter({
      name: `${this.prefix}cache_misses_total`,
      help: 'Total number of cache misses',
      labelNames: ['cache_name', 'operation'],
      registers: [this.registry],
    });

    this.cacheLatency = new Histogram({
      name: `${this.prefix}cache_operation_duration_seconds`,
      help: 'Duration of cache operations in seconds',
      labelNames: ['operation', 'cache_name'],
      buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05],
      registers: [this.registry],
    });
  }

  // HTTP metrics recording
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    organizationId?: string
  ): void {
    const labels = {
      method,
      route,
      status_code: statusCode.toString(),
      organization_id: organizationId || 'unknown',
    };

    this.httpRequestDuration.observe(labels, duration);
    this.httpRequestTotal.inc(labels);

    if (statusCode >= 400) {
      this.httpRequestErrors.inc({
        method,
        route,
        error_code: this.getErrorCode(statusCode),
        organization_id: organizationId || 'unknown',
      });
    }
  }

  // Business metrics recording
  recordJournalEntryCreated(organizationId: string, status: string): void {
    this.journalEntriesCreated.inc({ organization_id: organizationId, status });
  }

  recordAccountCreated(organizationId: string, accountType: string): void {
    this.accountsCreated.inc({ organization_id: organizationId, account_type: accountType });
  }

  recordAuthenticationAttempt(status: 'success' | 'failure', method: string): void {
    this.authenticationAttempts.inc({ status, method });
  }

  setActiveUsers(organizationId: string, count: number): void {
    this.activeUsers.set({ organization_id: organizationId }, count);
  }

  // Database metrics recording
  recordDatabaseQuery(operation: string, model: string, duration: number): void {
    this.dbQueryDuration.observe({ operation, model }, duration);
  }

  setConnectionPoolMetrics(active: number, idle: number, total: number): void {
    this.dbConnectionPool.set({ state: 'active' }, active);
    this.dbConnectionPool.set({ state: 'idle' }, idle);
    this.dbConnectionPool.set({ state: 'total' }, total);
  }

  // Cache metrics recording
  recordCacheHit(cacheName: string, operation: string): void {
    this.cacheHits.inc({ cache_name: cacheName, operation });
  }

  recordCacheMiss(cacheName: string, operation: string): void {
    this.cacheMisses.inc({ cache_name: cacheName, operation });
  }

  recordCacheOperation(operation: string, cacheName: string, duration: number): void {
    this.cacheLatency.observe({ operation, cache_name: cacheName }, duration);
  }

  // Utility methods
  private getErrorCode(statusCode: number): string {
    if (statusCode >= 500) return '5xx';
    if (statusCode >= 400) return '4xx';
    return 'unknown';
  }

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  reset(): void {
    this.registry.clear();
    this.initializeMetrics();
  }
}

// Create singleton instance
export const metrics = new MetricsCollector({
  defaultLabels: {
    app: 'simple-bookkeeping',
    environment: process.env.NODE_ENV || 'development',
  },
});

// Express middleware for automatic HTTP metrics
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    const route = req.route?.path || req.path || 'unknown';
    const organizationId = (req as Request & { organizationId?: string }).organizationId;

    metrics.recordHttpRequest(req.method, route, res.statusCode, duration, organizationId);
  });

  next();
};

// Health check with detailed status
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: {
    database: {
      status: boolean;
      latency?: number;
      error?: string;
    };
    cache: {
      status: boolean;
      latency?: number;
      error?: string;
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    disk?: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

export class HealthChecker {
  private logger: Logger;
  private startTime: number;

  constructor() {
    this.logger = new Logger({ component: 'HealthChecker' });
    this.startTime = Date.now();
  }

  async checkHealth(
    dbCheck: () => Promise<boolean>,
    cacheCheck: () => Promise<boolean>
  ): Promise<HealthStatus> {
    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: (Date.now() - this.startTime) / 1000,
      checks: {
        database: { status: false },
        cache: { status: false },
        memory: this.getMemoryUsage(),
      },
    };

    // Check database
    try {
      const dbStart = Date.now();
      health.checks.database.status = await dbCheck();
      health.checks.database.latency = Date.now() - dbStart;
    } catch (error) {
      health.checks.database.status = false;
      health.checks.database.error = error instanceof Error ? error.message : 'Unknown error';
      health.status = 'unhealthy';
    }

    // Check cache
    try {
      const cacheStart = Date.now();
      health.checks.cache.status = await cacheCheck();
      health.checks.cache.latency = Date.now() - cacheStart;
    } catch (error) {
      health.checks.cache.status = false;
      health.checks.cache.error = error instanceof Error ? error.message : 'Unknown error';
      // Cache failure is degraded, not unhealthy
      if (health.status === 'healthy') {
        health.status = 'degraded';
      }
    }

    return health;
  }

  private getMemoryUsage() {
    const used = process.memoryUsage();
    const total = os.totalmem();
    const percentage = (used.heapUsed / total) * 100;

    return {
      used: used.heapUsed,
      total,
      percentage: Math.round(percentage * 100) / 100,
    };
  }
}

export const healthChecker = new HealthChecker();
