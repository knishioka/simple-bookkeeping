/**
 * Playwright Reporter Configuration
 * Configures test result reporting for different environments
 */

import { ReporterDescription } from '@playwright/test';

import { TEST_MODES, REPORTER_PATHS } from '../constants';

import { getTestMode, isCI, isDebug } from './modes';

/**
 * Reporter type alias for clarity
 */
type Reporter = ReporterDescription;

/**
 * Create list reporter configuration
 */
const createListReporter = (): Reporter => {
  const mode = getTestMode();
  const shouldPrintSteps = isDebug() || mode === TEST_MODES.CI;
  return ['list', { printSteps: shouldPrintSteps }];
};

/**
 * Create JSON reporter configuration
 */
const createJsonReporter = (): Reporter => {
  return ['json', { outputFile: REPORTER_PATHS.JSON_OUTPUT }];
};

/**
 * Create JUnit reporter configuration
 */
const createJunitReporter = (): Reporter => {
  return ['junit', { outputFile: REPORTER_PATHS.JUNIT_OUTPUT }];
};

/**
 * Create HTML reporter configuration
 */
const createHtmlReporter = (
  outputFolder: string,
  open: 'always' | 'never' | 'on-failure'
): Reporter => {
  return ['html', { outputFolder, open }];
};

/**
 * Create performance reporter configuration
 */
const createPerformanceReporter = (): Reporter => {
  return [REPORTER_PATHS.PERFORMANCE_REPORTER];
};

/**
 * Get reporter configuration for fast mode
 */
const getFastModeReporters = (): Reporter[] => {
  return [createListReporter(), createJsonReporter(), createJunitReporter()];
};

/**
 * Get reporter configuration for CI mode
 */
const getCIModeReporters = (): Reporter[] => {
  return [
    createListReporter(),
    createJsonReporter(),
    createJunitReporter(),
    createHtmlReporter(REPORTER_PATHS.HTML_OUTPUT_DIR, 'never'),
  ];
};

/**
 * Get reporter configuration for comprehensive mode
 */
const getComprehensiveModeReporters = (): Reporter[] => {
  const reporters = getCIModeReporters();
  reporters.push(createPerformanceReporter());
  return reporters;
};

/**
 * Get reporter configuration for local mode
 */
const getLocalModeReporters = (): Reporter[] => {
  return [createListReporter(), createHtmlReporter(REPORTER_PATHS.LOCAL_HTML_OUTPUT_DIR, 'never')];
};

/**
 * Get reporter configuration for production mode
 */
const getProdModeReporters = (): Reporter[] => {
  // Simple reporter for production testing
  return [createListReporter()];
};

/**
 * Get default reporter configuration
 */
const getDefaultReporters = (): Reporter[] => {
  const open = isCI() ? 'never' : 'on-failure';
  return [createListReporter(), createHtmlReporter(REPORTER_PATHS.HTML_OUTPUT_DIR, open)];
};

/**
 * Get reporter configuration based on current test mode
 */
export const getReporters = (): Reporter[] => {
  const mode = getTestMode();

  switch (mode) {
    case TEST_MODES.FAST:
      return getFastModeReporters();
    case TEST_MODES.CI:
      return getCIModeReporters();
    case TEST_MODES.COMPREHENSIVE:
      return getComprehensiveModeReporters();
    case TEST_MODES.LOCAL:
      return getLocalModeReporters();
    case TEST_MODES.PROD:
      return getProdModeReporters();
    default:
      return getDefaultReporters();
  }
};
