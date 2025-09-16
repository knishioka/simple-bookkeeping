/**
 * Test Mode Configuration
 * Defines settings for different test execution modes
 */

import {
  TEST_MODES,
  TIMEOUTS,
  RETRIES,
  WORKERS,
  SLOW_MOTION,
  TRACE_MODES,
  VIDEO_MODES,
  SCREENSHOT_MODES,
  TEST_PATTERNS,
  ENV_KEYS,
  type TestMode,
} from '../constants';

/**
 * Mode configuration interface
 */
export interface ModeConfig {
  timeout: number;
  expectTimeout: number;
  actionTimeout: number;
  navigationTimeout: number;
  retries: number;
  workers: number | string;
  trace: (typeof TRACE_MODES)[keyof typeof TRACE_MODES];
  video: (typeof VIDEO_MODES)[keyof typeof VIDEO_MODES];
  screenshot: (typeof SCREENSHOT_MODES)[keyof typeof SCREENSHOT_MODES];
  slowMo: number;
  webServerTimeout: number;
  testIgnore: string[];
  projects: string[];
}

/**
 * Determine if running in CI environment
 */
export const isCI = (): boolean => process.env[ENV_KEYS.CI] === 'true';

/**
 * Determine if running in debug mode
 */
export const isDebug = (): boolean =>
  process.env[ENV_KEYS.DEBUG] === 'true' || process.env[ENV_KEYS.PWDEBUG] === '1';

/**
 * Get current test mode from environment
 */
export const getTestMode = (): TestMode => {
  const mode = process.env[ENV_KEYS.TEST_MODE] || (isCI() ? TEST_MODES.CI : TEST_MODES.LOCAL);
  const validModes = Object.values(TEST_MODES);

  if (!validModes.includes(mode as TestMode)) {
    throw new Error(`Invalid TEST_MODE: ${mode}. Must be one of: ${validModes.join(', ')}`);
  }

  return mode as TestMode;
};

/**
 * Mode-specific configurations
 */
export const modeConfigs: Record<TestMode, ModeConfig> = {
  [TEST_MODES.FAST]: {
    timeout: TIMEOUTS.FAST.TEST,
    expectTimeout: TIMEOUTS.FAST.EXPECT,
    actionTimeout: TIMEOUTS.FAST.ACTION,
    navigationTimeout: TIMEOUTS.FAST.NAVIGATION,
    retries: isCI() ? RETRIES.FAST_CI : RETRIES.FAST_LOCAL,
    workers: isCI() ? WORKERS.FAST_CI : WORKERS.FAST_LOCAL,
    trace: TRACE_MODES.OFF,
    video: VIDEO_MODES.OFF,
    screenshot: SCREENSHOT_MODES.ONLY_ON_FAILURE,
    slowMo: SLOW_MOTION.NONE,
    webServerTimeout: TIMEOUTS.FAST.WEB_SERVER,
    testIgnore: TEST_PATTERNS.FAST_MODE_IGNORE,
    projects: ['chromium'],
  },
  [TEST_MODES.CI]: {
    timeout: TIMEOUTS.CI.TEST,
    expectTimeout: TIMEOUTS.CI.EXPECT,
    actionTimeout: TIMEOUTS.CI.ACTION,
    navigationTimeout: TIMEOUTS.CI.NAVIGATION,
    retries: RETRIES.CI,
    workers: WORKERS.CI,
    trace: TRACE_MODES.RETAIN_ON_FAILURE,
    video: VIDEO_MODES.RETAIN_ON_FAILURE,
    screenshot: SCREENSHOT_MODES.ONLY_ON_FAILURE,
    slowMo: SLOW_MOTION.CI,
    webServerTimeout: TIMEOUTS.CI.WEB_SERVER,
    testIgnore: [],
    projects: ['chromium'],
  },
  [TEST_MODES.COMPREHENSIVE]: {
    timeout: TIMEOUTS.COMPREHENSIVE.TEST,
    expectTimeout: TIMEOUTS.COMPREHENSIVE.EXPECT,
    actionTimeout: TIMEOUTS.COMPREHENSIVE.ACTION,
    navigationTimeout: TIMEOUTS.COMPREHENSIVE.NAVIGATION,
    retries: RETRIES.COMPREHENSIVE,
    workers: isCI() ? WORKERS.COMPREHENSIVE_CI : WORKERS.COMPREHENSIVE_LOCAL,
    trace: TRACE_MODES.RETAIN_ON_FAILURE,
    video: VIDEO_MODES.RETAIN_ON_FAILURE,
    screenshot: SCREENSHOT_MODES.ONLY_ON_FAILURE,
    slowMo: SLOW_MOTION.COMPREHENSIVE,
    webServerTimeout: TIMEOUTS.COMPREHENSIVE.WEB_SERVER,
    testIgnore: [],
    projects: [
      'chromium-comprehensive',
      'firefox-comprehensive',
      'mobile-comprehensive',
      'api-auth-comprehensive',
    ],
  },
  [TEST_MODES.LOCAL]: {
    timeout: TIMEOUTS.LOCAL.TEST,
    expectTimeout: TIMEOUTS.LOCAL.EXPECT,
    actionTimeout: TIMEOUTS.LOCAL.ACTION,
    navigationTimeout: TIMEOUTS.LOCAL.NAVIGATION,
    retries: RETRIES.LOCAL,
    workers: WORKERS.LOCAL,
    trace: TRACE_MODES.RETAIN_ON_FAILURE,
    video: VIDEO_MODES.RETAIN_ON_FAILURE,
    screenshot: SCREENSHOT_MODES.ONLY_ON_FAILURE,
    slowMo: SLOW_MOTION.NONE,
    webServerTimeout: TIMEOUTS.LOCAL.WEB_SERVER,
    testIgnore: [],
    projects: ['chromium-desktop'],
  },
  [TEST_MODES.PROD]: {
    timeout: TIMEOUTS.PROD.TEST,
    expectTimeout: TIMEOUTS.PROD.EXPECT,
    actionTimeout: TIMEOUTS.PROD.ACTION,
    navigationTimeout: TIMEOUTS.PROD.NAVIGATION,
    retries: RETRIES.PROD,
    workers: WORKERS.PROD,
    trace: TRACE_MODES.ON_FIRST_RETRY,
    video: VIDEO_MODES.RETAIN_ON_FAILURE,
    screenshot: SCREENSHOT_MODES.ONLY_ON_FAILURE,
    slowMo: SLOW_MOTION.NONE,
    webServerTimeout: TIMEOUTS.PROD.WEB_SERVER,
    testIgnore: [],
    projects: ['chromium-prod'],
  },
};

/**
 * Get configuration for current test mode
 */
export const getCurrentModeConfig = (): ModeConfig => {
  const mode = getTestMode();
  return modeConfigs[mode];
};

/**
 * Get global timeout for current mode
 */
export const getGlobalTimeout = (): number | undefined => {
  const mode = getTestMode();
  if (mode === TEST_MODES.COMPREHENSIVE) {
    return TIMEOUTS.COMPREHENSIVE.GLOBAL;
  }
  if (mode === TEST_MODES.CI) {
    return TIMEOUTS.CI_GLOBAL;
  }
  return undefined;
};
