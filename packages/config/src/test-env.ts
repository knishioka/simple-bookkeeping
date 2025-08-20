/**
 * Unified Test Environment Configuration
 * Issue #203: E2Eテスト環境の環境変数管理を統一する
 *
 * This module provides a centralized configuration for test environments,
 * reducing duplication and confusion around environment variables.
 */

import { PORTS } from './constants';

/**
 * Unified environment variable names
 * Priority: New unified vars > Legacy vars > Defaults
 */
export interface TestEnvironment {
  webUrl: string;
  apiUrl: string;
  isDocker: boolean;
  isCI: boolean;
  isE2E: boolean;
}

/**
 * Get test environment configuration with proper fallbacks
 * Priority order:
 * 1. TEST_WEB_URL / TEST_API_URL (new unified variables)
 * 2. BASE_URL / API_URL (legacy Docker variables)
 * 3. Default localhost URLs
 */
export function getTestEnvironment(): TestEnvironment {
  // Prioritize new unified variables over legacy ones
  const webUrl =
    process.env.TEST_WEB_URL || process.env.BASE_URL || `http://localhost:${PORTS.WEB}`;

  const apiUrl = process.env.TEST_API_URL || process.env.API_URL || `http://localhost:${PORTS.API}`;

  return {
    webUrl,
    apiUrl,
    isDocker: process.env.DOCKER_ENV === 'true' || !!process.env.DOCKER_CONTAINER,
    isCI: process.env.CI === 'true',
    isE2E: process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'e2e',
  };
}

/**
 * Test environment detection (backward compatibility)
 */
export const TEST_ENV = {
  // Environment detection
  isDocker: process.env.DOCKER_ENV === 'true' || !!process.env.DOCKER_CONTAINER,
  isCI: process.env.CI === 'true',
  isE2E: process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'e2e',

  // Unified URL configuration
  // Priority: New unified vars > Legacy vars > Defaults
  webUrl: process.env.TEST_WEB_URL || process.env.BASE_URL || `http://localhost:${PORTS.WEB}`,

  apiUrl: process.env.TEST_API_URL || process.env.API_URL || `http://localhost:${PORTS.API}`,

  // API endpoints
  apiBaseUrl: process.env.TEST_API_URL || process.env.API_URL || `http://localhost:${PORTS.API}`,

  apiV1Url: `${
    process.env.TEST_API_URL || process.env.API_URL || `http://localhost:${PORTS.API}`
  }/api/v1`,

  // Database configuration
  databaseUrl:
    process.env.DATABASE_URL ||
    process.env.TEST_DATABASE_URL ||
    'postgresql://test:test@localhost:5432/simple_bookkeeping_test',

  // Test execution settings
  timeout: parseInt(process.env.TEST_TIMEOUT || '60000', 10),
  retries: parseInt(process.env.TEST_RETRIES || (process.env.CI ? '2' : '0'), 10),
  workers: parseInt(process.env.TEST_WORKERS || (process.env.CI ? '4' : '2'), 10),

  // Debug settings
  debug: process.env.DEBUG === 'true' || process.env.PWDEBUG === '1',
  verbose: process.env.VERBOSE === 'true',
  headless: process.env.TEST_HEADLESS !== 'false',

  // Feature flags
  reuseServer: process.env.REUSE_SERVER === 'true',
  useGlobalSetup: process.env.USE_GLOBAL_SETUP !== 'false',
  disableRateLimit: process.env.DISABLE_RATE_LIMIT === 'true',
} as const;

/**
 * Get the appropriate health check URL for a service
 */
export function getHealthCheckUrl(service: 'web' | 'api'): string {
  if (service === 'api') {
    return `${TEST_ENV.apiBaseUrl}/api/v1/health`;
  }
  return TEST_ENV.webUrl;
}

/**
 * Get the appropriate WebSocket URL for real-time features
 */
export function getWebSocketUrl(): string {
  const apiUrl = TEST_ENV.apiUrl;
  return apiUrl.replace(/^http/, 'ws');
}

/**
 * Normalize URL to ensure consistency
 */
export function normalizeUrl(url: string): string {
  // Remove trailing slashes
  return url.replace(/\/+$/, '');
}

/**
 * Get environment-specific configuration
 */
export function getTestConfig() {
  return {
    urls: {
      web: normalizeUrl(TEST_ENV.webUrl),
      api: normalizeUrl(TEST_ENV.apiUrl),
      apiV1: normalizeUrl(TEST_ENV.apiV1Url),
      healthWeb: getHealthCheckUrl('web'),
      healthApi: getHealthCheckUrl('api'),
      ws: getWebSocketUrl(),
    },
    database: {
      url: TEST_ENV.databaseUrl,
    },
    execution: {
      timeout: TEST_ENV.timeout,
      retries: TEST_ENV.retries,
      workers: TEST_ENV.workers,
      headless: TEST_ENV.headless,
    },
    features: {
      reuseServer: TEST_ENV.reuseServer,
      useGlobalSetup: TEST_ENV.useGlobalSetup,
      disableRateLimit: TEST_ENV.disableRateLimit,
    },
    debug: {
      enabled: TEST_ENV.debug,
      verbose: TEST_ENV.verbose,
    },
    environment: {
      isDocker: TEST_ENV.isDocker,
      isCI: TEST_ENV.isCI,
      isE2E: TEST_ENV.isE2E,
    },
  };
}

/**
 * Validate test environment configuration
 */
export function validateTestEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check URL formats
  if (!TEST_ENV.webUrl.startsWith('http')) {
    errors.push('Web URL must start with http:// or https://');
  }

  if (!TEST_ENV.apiUrl.startsWith('http')) {
    errors.push('API URL must start with http:// or https://');
  }

  // Check timeout values
  if (TEST_ENV.timeout < 1000) {
    errors.push('Test timeout must be at least 1000ms');
  }

  // Check worker count
  if (TEST_ENV.workers < 1) {
    errors.push('Test workers must be at least 1');
  }

  // Docker-specific checks
  if (TEST_ENV.isDocker) {
    if (TEST_ENV.webUrl.includes('localhost')) {
      errors.push('Docker environment should not use localhost URLs');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Log test environment configuration (for debugging)
 */
/* eslint-disable no-console */
export function logTestEnvironment(): void {
  const config = getTestConfig();
  const validation = validateTestEnvironment();

  console.log('🔧 Test Environment Configuration:');
  console.log('═══════════════════════════════════════');

  console.log('📍 URLs:');
  console.log(`  - Web: ${config.urls.web}`);
  console.log(`  - API: ${config.urls.api}`);
  console.log(`  - API v1: ${config.urls.apiV1}`);

  console.log('🔬 Environment:');
  console.log(`  - Docker: ${config.environment.isDocker}`);
  console.log(`  - CI: ${config.environment.isCI}`);
  console.log(`  - E2E: ${config.environment.isE2E}`);

  console.log('⚙️ Execution:');
  console.log(`  - Timeout: ${config.execution.timeout}ms`);
  console.log(`  - Retries: ${config.execution.retries}`);
  console.log(`  - Workers: ${config.execution.workers}`);
  console.log(`  - Headless: ${config.execution.headless}`);

  console.log('🎛️ Features:');
  console.log(`  - Reuse Server: ${config.features.reuseServer}`);
  console.log(`  - Global Setup: ${config.features.useGlobalSetup}`);
  console.log(`  - Rate Limit Disabled: ${config.features.disableRateLimit}`);

  if (!validation.valid) {
    console.log('⚠️ Configuration Issues:');
    validation.errors.forEach((error) => {
      console.log(`  - ${error}`);
    });
  } else {
    console.log('✅ Configuration is valid');
  }

  console.log('═══════════════════════════════════════');
}
/* eslint-enable no-console */
