// Database connection pool constants
export const DATABASE_CONSTANTS = {
  // Connection pool settings
  DEFAULT_POOL_SIZE: process.env.NODE_ENV === 'production' ? 10 : 5,
  DEFAULT_POOL_TIMEOUT: 10, // seconds
  DEFAULT_CONNECT_TIMEOUT: 30, // seconds
  DEFAULT_IDLE_TIMEOUT: 300, // seconds (5 minutes)
  DEFAULT_STATEMENT_CACHE_SIZE: 0, // Disabled for better memory usage

  // Query settings
  DEFAULT_QUERY_TIMEOUT: 30000, // milliseconds
  SLOW_QUERY_THRESHOLD: 1000, // milliseconds

  // Retry settings
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // milliseconds

  // Health check settings
  HEALTH_CHECK_INTERVAL: 30000, // milliseconds
  HEALTH_CHECK_TIMEOUT: 5000, // milliseconds
} as const;

// Database error codes
export const DATABASE_ERROR_CODES = {
  CONNECTION_LIMIT_EXCEEDED: 'P2024',
  TIMEOUT: 'P2024',
  UNIQUE_CONSTRAINT: 'P2002',
  FOREIGN_KEY_CONSTRAINT: 'P2003',
  NOT_FOUND: 'P2025',
} as const;

// Environment-based pool size calculation
export function calculatePoolSize(): number {
  if (process.env.DB_POOL_SIZE) {
    return parseInt(process.env.DB_POOL_SIZE, 10);
  }

  // Serverless environments should use smaller pools
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return 1;
  }

  // Default formula: num_physical_cpus * 2 + 1
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cpuCount = require('os').cpus().length;
  return Math.min(cpuCount * 2 + 1, 20); // Cap at 20 connections
}

// Database URL builder with pool configuration
export function buildDatabaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  const params = new URLSearchParams(url.search);

  // Set connection pool parameters
  if (!params.has('connection_limit')) {
    params.set('connection_limit', calculatePoolSize().toString());
  }

  if (!params.has('pool_timeout')) {
    params.set(
      'pool_timeout',
      (process.env.DB_POOL_TIMEOUT || DATABASE_CONSTANTS.DEFAULT_POOL_TIMEOUT).toString()
    );
  }

  if (!params.has('connect_timeout')) {
    params.set(
      'connect_timeout',
      (process.env.DB_CONNECT_TIMEOUT || DATABASE_CONSTANTS.DEFAULT_CONNECT_TIMEOUT).toString()
    );
  }

  if (!params.has('statement_cache_size')) {
    params.set('statement_cache_size', DATABASE_CONSTANTS.DEFAULT_STATEMENT_CACHE_SIZE.toString());
  }

  // Security: Disable multiple statements
  params.set('multipleStatements', 'false');

  url.search = params.toString();
  return url.toString();
}
