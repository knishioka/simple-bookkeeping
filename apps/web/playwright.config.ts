import { defineConfig, devices } from '@playwright/test';
import { PORTS, TIMEOUTS, getTestEnvironment } from '@simple-bookkeeping/config';

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

// Define valid test modes
type TestMode = 'fast' | 'ci' | 'comprehensive' | 'local' | 'prod';

// Get test mode from environment with type validation
const TEST_MODE = (process.env.TEST_MODE || (process.env.CI ? 'ci' : 'local')) as TestMode;

// Validate TEST_MODE
const validModes: TestMode[] = ['fast', 'ci', 'comprehensive', 'local', 'prod'];
if (!validModes.includes(TEST_MODE)) {
  throw new Error(`Invalid TEST_MODE: ${TEST_MODE}. Must be one of: ${validModes.join(', ')}`);
}
const isCI = process.env.CI === 'true';
const isDebug = process.env.DEBUG === 'true' || process.env.PWDEBUG === '1';

// Set Supabase env vars for E2E tests (required by middleware)
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1bW15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDU1NzY4MDAsImV4cCI6MTk2MTE1MjgwMH0.dummy_key_for_testing';

// Get unified test environment configuration
const testEnv = getTestEnvironment();

// Mode-specific configurations
const modeConfigs = {
  fast: {
    timeout: 30000,
    expectTimeout: 8000,
    actionTimeout: 8000,
    navigationTimeout: 15000,
    retries: isCI ? 1 : 0,
    workers: isCI ? 4 : '50%',
    trace: 'off' as const,
    video: 'off' as const,
    screenshot: 'only-on-failure' as const,
    slowMo: 0,
    webServerTimeout: 30000,
    testIgnore: [
      '**/*slow*',
      '**/*integration*',
      '**/accounting-periods.spec.ts',
      '**/extended-coverage.spec.ts',
    ],
    projects: ['chromium'],
  },
  ci: {
    timeout: 75000,
    expectTimeout: 20000,
    actionTimeout: 25000,
    navigationTimeout: 45000,
    retries: 3,
    workers: 2,
    trace: 'retain-on-failure' as const,
    video: 'retain-on-failure' as const,
    screenshot: 'only-on-failure' as const,
    slowMo: 75,
    webServerTimeout: 45000,
    testIgnore: [],
    projects: ['chromium'],
  },
  comprehensive: {
    timeout: 45000,
    expectTimeout: 20000,
    actionTimeout: 20000,
    navigationTimeout: 45000,
    retries: 3,
    workers: isCI ? 3 : 2,
    trace: 'retain-on-failure' as const,
    video: 'retain-on-failure' as const,
    screenshot: 'only-on-failure' as const,
    slowMo: 100,
    webServerTimeout: 45000,
    testIgnore: [],
    projects: [
      'chromium-comprehensive',
      'firefox-comprehensive',
      'mobile-comprehensive',
      'api-auth-comprehensive',
    ],
  },
  local: {
    timeout: 45000,
    expectTimeout: 10000,
    actionTimeout: 15000,
    navigationTimeout: 30000,
    retries: 1,
    workers: 1,
    trace: 'retain-on-failure' as const,
    video: 'retain-on-failure' as const,
    screenshot: 'only-on-failure' as const,
    slowMo: 0,
    webServerTimeout: 45000,
    testIgnore: [],
    projects: ['chromium-desktop'],
  },
  prod: {
    timeout: 60000,
    expectTimeout: 15000,
    actionTimeout: 20000,
    navigationTimeout: 30000,
    retries: 0,
    workers: 1,
    trace: 'on-first-retry' as const,
    video: 'retain-on-failure' as const,
    screenshot: 'only-on-failure' as const,
    slowMo: 0,
    webServerTimeout: 0, // No web server for production testing
    testIgnore: [],
    projects: ['chromium-prod'],
  },
};

// Get current mode config
const config = modeConfigs[TEST_MODE];

// Base URL configuration
const getBaseUrl = () => {
  if (TEST_MODE === 'prod') {
    return process.env.PROD_URL || 'https://simple-bookkeeping-mu.vercel.app';
  }
  return testEnv.webUrl;
};

// Browser launch options
const getChromeArgs = () => {
  const baseArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-web-security',
  ];

  if (TEST_MODE === 'fast') {
    return [
      ...baseArgs,
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
    ];
  }

  if (TEST_MODE === 'ci' || TEST_MODE === 'comprehensive') {
    return [...baseArgs, '--disable-extensions', '--no-first-run', '--disable-default-apps'];
  }

  if (TEST_MODE === 'local') {
    return [...baseArgs, '--disable-features=VizDisplayCompositor', '--font-render-hinting=none'];
  }

  return baseArgs;
};

// Reporter configuration
const getReporters = (): Array<[string, any] | string> => {
  const reporters: Array<[string, any] | string> = [
    ['list', { printSteps: isDebug || TEST_MODE === 'ci' }],
  ];

  if (TEST_MODE === 'fast') {
    reporters.push(
      ['json', { outputFile: 'test-results/results.json' }],
      ['junit', { outputFile: 'test-results/junit.xml' }]
    );
  } else if (TEST_MODE === 'ci' || TEST_MODE === 'comprehensive') {
    reporters.push(
      ['json', { outputFile: 'test-results/results.json' }],
      ['junit', { outputFile: 'test-results/junit.xml' }],
      ['html', { outputFolder: 'test-results/html', open: 'never' }]
    );
    if (TEST_MODE === 'comprehensive') {
      reporters.push(['./e2e/utils/performance-reporter.ts']);
    }
  } else if (TEST_MODE === 'local') {
    reporters.push(['html', { outputFolder: 'playwright-report', open: 'never' }]);
  } else if (TEST_MODE === 'prod') {
    // Simple reporter for production testing
  } else {
    // Default: HTML reporter for non-CI environments
    reporters.push([
      'html',
      { outputFolder: 'test-results/html', open: isCI ? 'never' : 'on-failure' },
    ]);
  }

  return reporters;
};

// Project definitions
const getProjects = () => {
  const projects = [];

  // Chromium projects - always use 'chromium' name for consistency with sharding
  if (config.projects.includes('chromium')) {
    projects.push({
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: getChromeArgs(),
          slowMo: config.slowMo,
        },
      },
      testIgnore: config.testIgnore,
    });
  }

  if (config.projects.includes('chromium-desktop')) {
    projects.push({
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        locale: TEST_MODE === 'local' ? 'ja-JP' : undefined,
        timezoneId: TEST_MODE === 'local' ? 'Asia/Tokyo' : undefined,
        launchOptions: {
          args: getChromeArgs(),
        },
      },
      testMatch: ['**/*.spec.ts'],
      testIgnore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
    });
  }

  if (config.projects.includes('chromium-prod')) {
    projects.push({
      name: 'chromium-prod',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    });
  }

  if (config.projects.includes('chromium-comprehensive')) {
    projects.push({
      name: 'chromium-comprehensive',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: getChromeArgs(),
          slowMo: config.slowMo,
        },
      },
      testMatch: '**/*.spec.ts',
    });
  }

  // Firefox project for comprehensive testing
  if (config.projects.includes('firefox-comprehensive')) {
    projects.push({
      name: 'firefox-comprehensive',
      use: {
        ...devices['Desktop Firefox'],
      },
      testMatch: ['**/basic.spec.ts', '**/journal-entries.spec.ts', '**/simple-entry.spec.ts'],
    });
  }

  // Mobile project for comprehensive testing
  if (config.projects.includes('mobile-comprehensive')) {
    projects.push({
      name: 'mobile-comprehensive',
      use: {
        ...devices['Pixel 5'],
      },
      testMatch: ['**/responsive-navigation.spec.ts', '**/basic.spec.ts'],
    });
  }

  // API auth project for comprehensive testing
  if (config.projects.includes('api-auth-comprehensive')) {
    projects.push({
      name: 'api-auth-comprehensive',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      testMatch: '**/auth/*.spec.ts',
    });
  }

  // Additional projects from base config (non-CI only)
  if (!isCI && TEST_MODE !== 'fast' && TEST_MODE !== 'prod') {
    // Cross-browser testing
    projects.push(
      {
        name: 'firefox',
        use: {
          ...devices['Desktop Firefox'],
        },
        testMatch: /.*\.cross-browser\.spec\.ts$/,
      },
      {
        name: 'webkit',
        use: {
          ...devices['Desktop Safari'],
        },
        testMatch: /.*\.cross-browser\.spec\.ts$/,
      }
    );

    // Mobile testing
    projects.push({
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
      testMatch: /.*\.mobile\.spec\.ts$/,
    });

    // Desktop with different viewports
    projects.push(
      {
        name: 'chromium-desktop-wide',
        use: {
          ...devices['Desktop Chrome'],
          viewport: { width: 1920, height: 1080 },
        },
        testMatch: /^((?!mobile|tablet).)*\.spec\.ts$/,
      },
      {
        name: 'chromium-tablet',
        use: {
          ...devices['iPad Pro'],
        },
        testMatch: /.*\.tablet\.spec\.ts$/,
      }
    );

    // API authentication testing
    projects.push({
      name: 'api-auth',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      testMatch: /.*\.auth\.spec\.ts$/,
      dependencies: [],
    });
  }

  return projects;
};

// Web server configuration
const getWebServerConfig = () => {
  // No web server for production testing
  if (TEST_MODE === 'prod') {
    return undefined;
  }

  // Skip if reusing existing server
  if (process.env.REUSE_SERVER === 'true') {
    return undefined;
  }

  return {
    command: 'pnpm --filter @simple-bookkeeping/web dev',
    port: PORTS.WEB,
    timeout: config.webServerTimeout,
    reuseExistingServer: !isCI,
    stdout: (isDebug ? 'pipe' : 'ignore') as 'pipe' | 'ignore',
    stderr: 'pipe' as const,
    env: {
      NODE_ENV: 'test',
      PORT: String(PORTS.WEB),
      // Supabase environment variables (test dummy values)
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1bW15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDU1NzY4MDAsImV4cCI6MTk2MTE1MjgwMH0.dummy_key_for_testing',
    },
  };
};

// Global timeout for comprehensive testing
const getGlobalTimeout = () => {
  if (TEST_MODE === 'comprehensive') {
    return 30 * 60 * 1000; // 30 minutes
  }
  if (TEST_MODE === 'ci') {
    return 45 * 60 * 1000; // 45 minutes
  }
  return undefined;
};

export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Parallel execution
  fullyParallel: TEST_MODE !== 'prod',
  forbidOnly: isCI || TEST_MODE === 'prod',

  // Timeout settings
  timeout: config.timeout,
  globalTimeout: getGlobalTimeout(),

  // Expect settings
  expect: {
    timeout: config.expectTimeout,
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
    },
  },

  // Retry settings
  retries: config.retries,

  // Worker settings
  workers: config.workers,

  // Reporter settings
  reporter: getReporters(),

  // Output directory
  outputDir: 'test-results/output',

  // Global setup/teardown
  globalSetup:
    process.env.USE_GLOBAL_SETUP === 'false' ? undefined : require.resolve('./e2e/global-setup'),
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
    actionTimeout: config.actionTimeout,
    navigationTimeout: config.navigationTimeout,

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
    locale: TEST_MODE === 'local' ? 'ja-JP' : undefined,
    timezoneId: TEST_MODE === 'local' ? 'Asia/Tokyo' : undefined,
    hasTouch: false,
  },

  // Projects
  projects: getProjects(),

  // Web server
  webServer: getWebServerConfig(),

  // Test matching (for local mode)
  testMatch: TEST_MODE === 'local' ? ['**/*.spec.ts'] : undefined,
  testIgnore:
    TEST_MODE === 'local'
      ? ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**']
      : undefined,
});
