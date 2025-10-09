/**
 * Playwright Configuration Constants
 * Centralized constants for all Playwright test configurations
 * Following Issue #416 Priority 2.1 requirements
 */

// ============================================
// Test Timeouts (in milliseconds)
// ============================================
export const TIMEOUTS = {
  // Fast mode timeouts (optimized for quick feedback)
  FAST: {
    TEST: 30000,
    EXPECT: 8000,
    ACTION: 8000,
    NAVIGATION: 15000,
    WEB_SERVER: 30000,
  },
  // CI mode timeouts (balanced for reliability)
  CI: {
    TEST: 75000,
    EXPECT: 20000,
    ACTION: 25000,
    NAVIGATION: 45000,
    WEB_SERVER: 45000,
  },
  // Comprehensive mode timeouts (thorough testing)
  COMPREHENSIVE: {
    TEST: 45000,
    EXPECT: 20000,
    ACTION: 20000,
    NAVIGATION: 45000,
    WEB_SERVER: 45000,
    GLOBAL: 30 * 60 * 1000, // 30 minutes
  },
  // Local development timeouts
  LOCAL: {
    TEST: 45000,
    EXPECT: 10000,
    ACTION: 15000,
    NAVIGATION: 30000,
    WEB_SERVER: 45000,
  },
  // Production testing timeouts
  PROD: {
    TEST: 60000,
    EXPECT: 15000,
    ACTION: 20000,
    NAVIGATION: 30000,
    WEB_SERVER: 0, // No web server for production testing
  },
  // CI-specific global timeout
  CI_GLOBAL: 45 * 60 * 1000, // 45 minutes
} as const;

// ============================================
// Test Retry Configuration
// ============================================
export const RETRIES = {
  FAST_CI: 1,
  FAST_LOCAL: 0,
  CI: 3,
  COMPREHENSIVE: 3,
  LOCAL: 1,
  PROD: 0,
} as const;

// ============================================
// Worker Configuration
// ============================================
export const WORKERS = {
  FAST_CI: 4,
  FAST_LOCAL: '50%',
  CI: 2,
  COMPREHENSIVE_CI: 3,
  COMPREHENSIVE_LOCAL: 2,
  LOCAL: 1,
  PROD: 1,
} as const;

// ============================================
// Slow Motion Delays (in milliseconds)
// ============================================
export const SLOW_MOTION = {
  NONE: 0,
  CI: 75,
  COMPREHENSIVE: 100,
} as const;

// ============================================
// URLs and Endpoints
// ============================================
export const URLS = {
  DEFAULT_PROD: 'https://simple-bookkeeping-mu.vercel.app',
  DUMMY_SUPABASE: 'https://dummy.supabase.co',
  LOGIN_PATH: '/login',
  DASHBOARD_PATH: '/dashboard/**',
} as const;

// ============================================
// Test Credentials (Dummy/Test Values)
// ============================================
export const TEST_CREDENTIALS = {
  // Default test admin user
  ADMIN: {
    EMAIL: 'admin@example.com',
    PASSWORD: 'admin123',
  },
  // Dummy Supabase credentials for E2E tests
  SUPABASE: {
    URL_KEY: 'NEXT_PUBLIC_SUPABASE_URL',
    ANON_KEY: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    DUMMY_URL: 'https://dummy.supabase.co',
    // This is a dummy JWT token used only for E2E testing
    // It has no real authentication value and is safe to commit
    DUMMY_ANON_KEY:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1bW15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDU1NzY4MDAsImV4cCI6MTk2MTE1MjgwMH0.dummy_key_for_testing',
  },
} as const;

// ============================================
// Chrome Browser Arguments
// ============================================
export const CHROME_ARGS = {
  // Base arguments for all modes
  BASE: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-web-security',
  ],
  // Additional arguments for fast mode
  FAST_MODE_EXTRA: [
    '--disable-extensions',
    '--disable-plugins',
    '--disable-images',
    '--disable-javascript-harmony-shipping',
    '--no-first-run',
    '--disable-default-apps',
    '--disable-popup-blocking',
    '--disable-translate',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ],
  // Additional arguments for CI/Comprehensive modes
  CI_MODE_EXTRA: ['--disable-extensions', '--no-first-run', '--disable-default-apps'],
  // Additional arguments for local mode
  LOCAL_MODE_EXTRA: ['--disable-features=VizDisplayCompositor', '--font-render-hinting=none'],
} as const;

// ============================================
// Viewport Dimensions
// ============================================
export const VIEWPORTS = {
  DEFAULT: { width: 1280, height: 720 },
  DESKTOP_WIDE: { width: 1920, height: 1080 },
  PROD: { width: 1280, height: 800 },
} as const;

// ============================================
// Locale and Timezone Settings
// ============================================
export const LOCALE_SETTINGS = {
  LOCAL_MODE: {
    LOCALE: 'ja-JP',
    TIMEZONE: 'Asia/Tokyo',
  },
} as const;

// ============================================
// Test File Patterns
// ============================================
export const TEST_PATTERNS = {
  // Files to ignore in fast mode
  FAST_MODE_IGNORE: [
    '**/*slow*',
    '**/*integration*',
    '**/accounting-periods.spec.ts',
    '**/extended-coverage.spec.ts',
    '**/audit-logs.spec.ts', // Temporarily excluded due to flaky auth issues
  ] as string[],
  // Files to ignore in local mode
  LOCAL_MODE_IGNORE: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'] as string[],
  // Test match patterns
  ALL_TESTS: '**/*.spec.ts',
  BASIC_TESTS: [
    '**/basic.spec.ts',
    '**/journal-entries.spec.ts',
    '**/simple-entry.spec.ts',
  ] as string[],
  RESPONSIVE_TESTS: ['**/responsive-navigation.spec.ts', '**/basic.spec.ts'] as string[],
  AUTH_TESTS: '**/auth/*.spec.ts',
  CROSS_BROWSER: /.*\.cross-browser\.spec\.ts$/,
  MOBILE: /.*\.mobile\.spec\.ts$/,
  TABLET: /.*\.tablet\.spec\.ts$/,
  AUTH_SPEC: /.*\.auth\.spec\.ts$/,
  DESKTOP_ONLY: /^((?!mobile|tablet).)*\.spec\.ts$/,
} as const;

// ============================================
// Reporter Output Paths
// ============================================
export const REPORTER_PATHS = {
  JSON_OUTPUT: 'test-results/results.json',
  JUNIT_OUTPUT: 'test-results/junit.xml',
  HTML_OUTPUT_DIR: 'test-results/html',
  LOCAL_HTML_OUTPUT_DIR: 'playwright-report',
  PERFORMANCE_REPORTER: './e2e/utils/performance-reporter.ts',
} as const;

// ============================================
// Output Directories
// ============================================
export const OUTPUT_DIRS = {
  TEST_RESULTS: 'test-results/output',
  AUTH_STATE: 'e2e/.auth/admin.json',
} as const;

// ============================================
// Screenshot Configuration
// ============================================
export const SCREENSHOT_CONFIG = {
  MAX_DIFF_PIXELS: 100,
  THRESHOLD: 0.2,
} as const;

// ============================================
// Trace and Video Modes
// ============================================
export const TRACE_MODES = {
  OFF: 'off' as const,
  ON_FIRST_RETRY: 'on-first-retry' as const,
  RETAIN_ON_FAILURE: 'retain-on-failure' as const,
};

export const VIDEO_MODES = {
  OFF: 'off' as const,
  RETAIN_ON_FAILURE: 'retain-on-failure' as const,
};

export const SCREENSHOT_MODES = {
  ONLY_ON_FAILURE: 'only-on-failure' as const,
};

// ============================================
// Environment Variable Keys
// ============================================
export const ENV_KEYS = {
  TEST_MODE: 'TEST_MODE',
  CI: 'CI',
  DEBUG: 'DEBUG',
  PWDEBUG: 'PWDEBUG',
  NODE_ENV: 'NODE_ENV',
  PORT: 'PORT',
  PROD_URL: 'PROD_URL',
  USE_GLOBAL_SETUP: 'USE_GLOBAL_SETUP',
  PREPARE_AUTH_STATE: 'PREPARE_AUTH_STATE',
} as const;

// ============================================
// Test Modes
// ============================================
export const TEST_MODES = {
  FAST: 'fast',
  CI: 'ci',
  COMPREHENSIVE: 'comprehensive',
  LOCAL: 'local',
  PROD: 'prod',
} as const;

export type TestMode = (typeof TEST_MODES)[keyof typeof TEST_MODES];

// ============================================
// Project Names
// ============================================
export const PROJECT_NAMES = {
  CHROMIUM: 'chromium',
  CHROMIUM_DESKTOP: 'chromium-desktop',
  CHROMIUM_PROD: 'chromium-prod',
  CHROMIUM_COMPREHENSIVE: 'chromium-comprehensive',
  CHROMIUM_DESKTOP_WIDE: 'chromium-desktop-wide',
  CHROMIUM_TABLET: 'chromium-tablet',
  FIREFOX: 'firefox',
  FIREFOX_COMPREHENSIVE: 'firefox-comprehensive',
  WEBKIT: 'webkit',
  MOBILE_CHROME: 'mobile-chrome',
  MOBILE_COMPREHENSIVE: 'mobile-comprehensive',
  API_AUTH: 'api-auth',
  API_AUTH_COMPREHENSIVE: 'api-auth-comprehensive',
} as const;

// ============================================
// Health Check Configuration
// ============================================
export const HEALTH_CHECK = {
  MAX_RETRIES_CI: 5,
  MAX_RETRIES_LOCAL: 1,
  RETRY_DELAY: 2000, // 2 seconds
} as const;

// ============================================
// Server Configuration
// ============================================
export const SERVER_CONFIG = {
  // Issue #520: Use dev server even in CI to ensure NODE_ENV='test' for mock auth
  // Production builds always set NODE_ENV='production' internally, breaking middleware test mode detection
  COMMAND: 'pnpm --filter @simple-bookkeeping/web dev',
  ENV: {
    NODE_ENV: 'test',
    // Enable mock authentication for E2E tests to prevent redirect loops
    E2E_USE_MOCK_AUTH: 'true',
  },
} as const;
