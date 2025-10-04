import { defineConfig } from '@playwright/test';
import { PORTS, getTestEnvironment } from '@simple-bookkeeping/config';

// Import modular configuration
import {
  getTestMode,
  getCurrentModeConfig,
  getGlobalTimeout,
  isCI,
  getProjects,
  getReporters,
  setSupabaseEnvVars,
  getTimeoutConfig,
  TEST_MODES,
  ENV_KEYS,
  OUTPUT_DIRS,
  SERVER_CONFIG,
  URLS,
  SCREENSHOT_CONFIG,
  LOCALE_SETTINGS,
  TEST_PATTERNS,
} from './playwright/config';

/**
 * Unified Playwright configuration for E2E tests
 *
 * Uses TEST_MODE environment variable to switch between different test modes:
 * - fast: Quick feedback for CI (3-5 minutes)
 * - ci: Comprehensive CI testing (default for CI)
 * - comprehensive: Full test suite with all browsers
 * - local: Local development testing
 * - prod: Production testing against deployed app
 */

// Set up Supabase environment variables for E2E tests
setSupabaseEnvVars();

// Get current test mode
const testMode = getTestMode();

// Get unified test environment configuration
const testEnv = getTestEnvironment();

// Get mode-specific configuration
const config = getCurrentModeConfig();

// Get timeout configuration
const timeouts = getTimeoutConfig();

/**
 * Get base URL configuration
 */
const getBaseUrl = (): string => {
  if (testMode === TEST_MODES.PROD) {
    return process.env[ENV_KEYS.PROD_URL] || URLS.DEFAULT_PROD;
  }
  return testEnv.webUrl;
};

/**
 * Get web server configuration
 */
const getWebServerConfig = () => {
  // No web server for production testing
  if (testMode === TEST_MODES.PROD) {
    return undefined;
  }

  // Always restart server for E2E tests to ensure environment variables are loaded
  // This fixes Issue #514 where E2E_USE_MOCK_AUTH wasn't recognized by middleware
  // when added to .env.local after server startup
  return {
    command: SERVER_CONFIG.COMMAND,
    port: PORTS.WEB,
    timeout: timeouts.webServer,
    reuseExistingServer: false,
    stdout: (process.env[ENV_KEYS.DEBUG] === 'true' ? 'pipe' : 'ignore') as 'pipe' | 'ignore',
    stderr: 'pipe' as const,
    env: {
      ...SERVER_CONFIG.ENV,
      NODE_ENV: 'test',
      [ENV_KEYS.PORT]: String(PORTS.WEB),
      DATABASE_URL:
        process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/bookkeeping_test',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'test-nextauth-secret',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      // Supabase environment variables are already set by setSupabaseEnvVars()
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key',
      // Enable mock authentication for E2E tests to prevent redirect loops
      E2E_USE_MOCK_AUTH: 'true',
    },
  };
};

export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Parallel execution
  fullyParallel: testMode !== TEST_MODES.PROD,
  forbidOnly: isCI() || testMode === TEST_MODES.PROD,

  // Timeout settings
  timeout: timeouts.test,
  globalTimeout: getGlobalTimeout(),

  // Expect settings
  expect: {
    timeout: timeouts.expect,
    toHaveScreenshot: {
      maxDiffPixels: SCREENSHOT_CONFIG.MAX_DIFF_PIXELS,
      threshold: SCREENSHOT_CONFIG.THRESHOLD,
    },
  },

  // Retry settings
  retries: config.retries,

  // Worker settings
  workers: config.workers,

  // Reporter settings
  reporter: getReporters(),

  // Output directory
  outputDir: OUTPUT_DIRS.TEST_RESULTS,

  // Global setup/teardown
  globalSetup:
    process.env[ENV_KEYS.USE_GLOBAL_SETUP] === 'false'
      ? undefined
      : require.resolve('./e2e/global-setup'),
  globalTeardown: undefined,

  // Shared settings
  use: {
    // Base URL
    baseURL: getBaseUrl(),

    // Trace settings
    trace: config.trace,

    // Screenshot settings
    screenshot: {
      mode: config.screenshot,
      fullPage: false,
    },

    // Video settings
    video: config.video,

    // Timeout settings
    actionTimeout: timeouts.action,
    navigationTimeout: timeouts.navigation,

    // Viewport settings
    viewport: { width: 1280, height: 720 },

    // Network settings
    offline: false,

    // JavaScript enabled
    javaScriptEnabled: true,

    // Storage state
    storageState: undefined,

    // HTTP credentials
    httpCredentials: undefined,

    // User-Agent
    userAgent: undefined,

    // Color scheme
    colorScheme: 'light',

    // Locale settings (for local mode)
    locale: testMode === TEST_MODES.LOCAL ? LOCALE_SETTINGS.LOCAL_MODE.LOCALE : undefined,
    timezoneId: testMode === TEST_MODES.LOCAL ? LOCALE_SETTINGS.LOCAL_MODE.TIMEZONE : undefined,
    hasTouch: false,
  },

  // Projects
  projects: getProjects(),

  // Web server
  webServer: getWebServerConfig(),

  // Test matching (for local mode)
  testMatch: testMode === TEST_MODES.LOCAL ? [TEST_PATTERNS.ALL_TESTS] : undefined,
  testIgnore: testMode === TEST_MODES.LOCAL ? TEST_PATTERNS.LOCAL_MODE_IGNORE : undefined,
});
