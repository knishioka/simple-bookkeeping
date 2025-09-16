/**
 * Timeout Configuration
 * Centralized timeout management for Playwright tests
 */

import { TIMEOUTS, TEST_MODES } from '../constants';

import { getTestMode } from './modes';

/**
 * Timeout configuration interface
 */
export interface TimeoutConfig {
  test: number;
  expect: number;
  action: number;
  navigation: number;
  webServer: number;
  global?: number;
}

/**
 * Get timeout configuration for current test mode
 */
export const getTimeoutConfig = (): TimeoutConfig => {
  const mode = getTestMode();

  switch (mode) {
    case TEST_MODES.FAST:
      return {
        test: TIMEOUTS.FAST.TEST,
        expect: TIMEOUTS.FAST.EXPECT,
        action: TIMEOUTS.FAST.ACTION,
        navigation: TIMEOUTS.FAST.NAVIGATION,
        webServer: TIMEOUTS.FAST.WEB_SERVER,
      };
    case TEST_MODES.CI:
      return {
        test: TIMEOUTS.CI.TEST,
        expect: TIMEOUTS.CI.EXPECT,
        action: TIMEOUTS.CI.ACTION,
        navigation: TIMEOUTS.CI.NAVIGATION,
        webServer: TIMEOUTS.CI.WEB_SERVER,
        global: TIMEOUTS.CI_GLOBAL,
      };
    case TEST_MODES.COMPREHENSIVE:
      return {
        test: TIMEOUTS.COMPREHENSIVE.TEST,
        expect: TIMEOUTS.COMPREHENSIVE.EXPECT,
        action: TIMEOUTS.COMPREHENSIVE.ACTION,
        navigation: TIMEOUTS.COMPREHENSIVE.NAVIGATION,
        webServer: TIMEOUTS.COMPREHENSIVE.WEB_SERVER,
        global: TIMEOUTS.COMPREHENSIVE.GLOBAL,
      };
    case TEST_MODES.LOCAL:
      return {
        test: TIMEOUTS.LOCAL.TEST,
        expect: TIMEOUTS.LOCAL.EXPECT,
        action: TIMEOUTS.LOCAL.ACTION,
        navigation: TIMEOUTS.LOCAL.NAVIGATION,
        webServer: TIMEOUTS.LOCAL.WEB_SERVER,
      };
    case TEST_MODES.PROD:
      return {
        test: TIMEOUTS.PROD.TEST,
        expect: TIMEOUTS.PROD.EXPECT,
        action: TIMEOUTS.PROD.ACTION,
        navigation: TIMEOUTS.PROD.NAVIGATION,
        webServer: TIMEOUTS.PROD.WEB_SERVER,
      };
    default:
      // Default to local timeouts
      return {
        test: TIMEOUTS.LOCAL.TEST,
        expect: TIMEOUTS.LOCAL.EXPECT,
        action: TIMEOUTS.LOCAL.ACTION,
        navigation: TIMEOUTS.LOCAL.NAVIGATION,
        webServer: TIMEOUTS.LOCAL.WEB_SERVER,
      };
  }
};

/**
 * Get test timeout for current mode
 */
export const getTestTimeout = (): number => {
  return getTimeoutConfig().test;
};

/**
 * Get expect timeout for current mode
 */
export const getExpectTimeout = (): number => {
  return getTimeoutConfig().expect;
};

/**
 * Get action timeout for current mode
 */
export const getActionTimeout = (): number => {
  return getTimeoutConfig().action;
};

/**
 * Get navigation timeout for current mode
 */
export const getNavigationTimeout = (): number => {
  return getTimeoutConfig().navigation;
};

/**
 * Get web server timeout for current mode
 */
export const getWebServerTimeout = (): number => {
  return getTimeoutConfig().webServer;
};

/**
 * Get global timeout for current mode (if applicable)
 */
export const getGlobalTimeout = (): number | undefined => {
  return getTimeoutConfig().global;
};

/**
 * Check if extended timeouts should be used
 * Useful for slow or resource-constrained environments
 */
export const shouldUseExtendedTimeouts = (): boolean => {
  return process.env.EXTENDED_TIMEOUTS === 'true';
};

/**
 * Apply timeout multiplier if extended timeouts are enabled
 */
export const applyTimeoutMultiplier = (timeout: number): number => {
  if (shouldUseExtendedTimeouts()) {
    const multiplier = parseFloat(process.env.TIMEOUT_MULTIPLIER || '1.5');
    return Math.floor(timeout * multiplier);
  }
  return timeout;
};

/**
 * Get adjusted timeout configuration with optional multiplier
 */
export const getAdjustedTimeoutConfig = (): TimeoutConfig => {
  const baseConfig = getTimeoutConfig();

  if (!shouldUseExtendedTimeouts()) {
    return baseConfig;
  }

  return {
    test: applyTimeoutMultiplier(baseConfig.test),
    expect: applyTimeoutMultiplier(baseConfig.expect),
    action: applyTimeoutMultiplier(baseConfig.action),
    navigation: applyTimeoutMultiplier(baseConfig.navigation),
    webServer: applyTimeoutMultiplier(baseConfig.webServer),
    global: baseConfig.global ? applyTimeoutMultiplier(baseConfig.global) : undefined,
  };
};
