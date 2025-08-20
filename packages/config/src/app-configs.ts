/**
 * Application-specific configurations
 * Issue #203: E2Eテスト環境の環境変数管理を統一
 */

import { PORTS, API_URLS, TIMEOUTS, AUTH, DATABASE, RATE_LIMIT } from './constants';
import { getTestEnvironment } from './test-env';

// Web Application Configuration
export const WEB_CONFIG = {
  port: PORTS.WEB,
  apiUrl: API_URLS.BASE,
  apiTimeout: TIMEOUTS.API,
  publicUrl: process.env.NEXT_PUBLIC_URL || `http://localhost:${PORTS.WEB}`,
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
} as const;

// API Server Configuration
export const API_CONFIG = {
  port: PORTS.API,
  corsOrigin: API_URLS.CORS_ORIGIN,
  dbTimeout: TIMEOUTS.DATABASE,
  jwtSecret: process.env.JWT_SECRET || 'jwt-secret-key',
  jwtExpiresIn: AUTH.JWT_EXPIRES_IN,
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'refresh-secret-key',
  refreshTokenExpiresIn: AUTH.REFRESH_TOKEN_EXPIRES_IN,
  bcryptRounds: AUTH.BCRYPT_ROUNDS,
  rateLimitWindowMs: RATE_LIMIT.WINDOW_MS,
  rateLimitMaxRequests: RATE_LIMIT.MAX_REQUESTS,
  loginMaxAttempts: RATE_LIMIT.LOGIN_MAX_ATTEMPTS,
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
} as const;

// Database Configuration
export const DB_CONFIG = {
  url: process.env.DATABASE_URL || 'postgresql://localhost:5432/simple_bookkeeping',
  poolMin: DATABASE.POOL_MIN,
  poolMax: DATABASE.POOL_MAX,
  poolIdleTimeout: DATABASE.POOL_IDLE_TIMEOUT_MS,
  acquireTimeout: DATABASE.ACQUIRE_TIMEOUT_MS,
  connectionTimeout: TIMEOUTS.DATABASE,
  enableLogging: process.env.DATABASE_LOGGING === 'true',
} as const;

// Test Configuration (using unified test environment)
const testEnv = getTestEnvironment();
export const TEST_CONFIG = {
  apiUrl: testEnv.apiUrl,
  webUrl: testEnv.webUrl,
  databaseUrl:
    process.env.TEST_DATABASE_URL ||
    'postgresql://test:test@localhost:5432/simple_bookkeeping_test',
  timeout: TIMEOUTS.E2E_TEST,
  headless: process.env.TEST_HEADLESS !== 'false',
  slowMo: parseInt(process.env.TEST_SLOW_MO || '0', 10),
  video: process.env.TEST_VIDEO === 'true',
  screenshot: process.env.TEST_SCREENSHOT === 'true',
} as const;

// Environment Detection Helpers
export const isProduction = () => process.env.NODE_ENV === 'production';
export const isDevelopment = () => process.env.NODE_ENV === 'development';
export const isTest = () => process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'e2e';
export const isCI = () => process.env.CI === 'true';

// Configuration Validation
export function validateConfiguration(): void {
  // Validate required environment variables in production
  if (isProduction()) {
    const required = ['DATABASE_URL', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'CORS_ORIGIN'];

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables in production: ${missing.join(', ')}`
      );
    }
  }

  // Validate port numbers
  if (PORTS.WEB === PORTS.API) {
    throw new Error('Web and API ports cannot be the same');
  }

  // Validate timeout values
  if (TIMEOUTS.API > TIMEOUTS.DATABASE) {
    console.warn('API timeout is greater than database timeout, this may cause issues');
  }
}
