/**
 * Playwright Project Configuration
 * Defines test projects for different browsers and configurations
 */

import path from 'path';

import { devices, Project } from '@playwright/test';

import {
  PROJECT_NAMES,
  CHROME_ARGS,
  VIEWPORTS,
  LOCALE_SETTINGS,
  TEST_PATTERNS,
  TEST_MODES,
} from '../constants';

import { getTestMode, getCurrentModeConfig, isCI } from './modes';

/**
 * Issue #520: Shared storage state path for authenticated sessions
 * All projects use this storage state except for API auth tests
 */
const STORAGE_STATE_PATH = path.join(__dirname, '../../e2e/.auth/authenticated.json');

/**
 * Get Chrome browser arguments based on test mode
 */
export const getChromeArgs = (): string[] => {
  const mode = getTestMode();
  const baseArgs = [...CHROME_ARGS.BASE];

  switch (mode) {
    case TEST_MODES.FAST:
      return [...baseArgs, ...CHROME_ARGS.FAST_MODE_EXTRA];
    case TEST_MODES.CI:
    case TEST_MODES.COMPREHENSIVE:
      return [...baseArgs, ...CHROME_ARGS.CI_MODE_EXTRA];
    case TEST_MODES.LOCAL:
      return [...baseArgs, ...CHROME_ARGS.LOCAL_MODE_EXTRA];
    default:
      return baseArgs;
  }
};

/**
 * Create Chromium project configuration
 */
const createChromiumProject = (): Project => {
  const config = getCurrentModeConfig();
  return {
    name: PROJECT_NAMES.CHROMIUM,
    use: {
      ...devices['Desktop Chrome'],
      storageState: STORAGE_STATE_PATH,
      launchOptions: {
        args: getChromeArgs(),
        slowMo: config.slowMo,
      },
    },
    testIgnore: config.testIgnore,
  };
};

/**
 * Create Chromium Desktop project configuration
 */
const createChromiumDesktopProject = (): Project => {
  const mode = getTestMode();
  return {
    name: PROJECT_NAMES.CHROMIUM_DESKTOP,
    use: {
      ...devices['Desktop Chrome'],
      storageState: STORAGE_STATE_PATH,
      viewport: VIEWPORTS.DEFAULT,
      locale: mode === TEST_MODES.LOCAL ? LOCALE_SETTINGS.LOCAL_MODE.LOCALE : undefined,
      timezoneId: mode === TEST_MODES.LOCAL ? LOCALE_SETTINGS.LOCAL_MODE.TIMEZONE : undefined,
      launchOptions: {
        args: getChromeArgs(),
      },
    },
    testMatch: [TEST_PATTERNS.ALL_TESTS],
    testIgnore: TEST_PATTERNS.LOCAL_MODE_IGNORE,
  };
};

/**
 * Create Chromium Production project configuration
 */
const createChromiumProdProject = (): Project => ({
  name: PROJECT_NAMES.CHROMIUM_PROD,
  use: {
    ...devices['Desktop Chrome'],
    storageState: STORAGE_STATE_PATH,
    viewport: VIEWPORTS.PROD,
  },
});

/**
 * Create Chromium Comprehensive project configuration
 */
const createChromiumComprehensiveProject = (): Project => {
  const config = getCurrentModeConfig();
  return {
    name: PROJECT_NAMES.CHROMIUM_COMPREHENSIVE,
    use: {
      ...devices['Desktop Chrome'],
      storageState: STORAGE_STATE_PATH,
      launchOptions: {
        args: getChromeArgs(),
        slowMo: config.slowMo,
      },
    },
    testMatch: TEST_PATTERNS.ALL_TESTS,
  };
};

/**
 * Create Firefox Comprehensive project configuration
 */
const createFirefoxComprehensiveProject = (): Project => ({
  name: PROJECT_NAMES.FIREFOX_COMPREHENSIVE,
  use: {
    ...devices['Desktop Firefox'],
    storageState: STORAGE_STATE_PATH,
  },
  testMatch: TEST_PATTERNS.BASIC_TESTS,
});

/**
 * Create Mobile Comprehensive project configuration
 */
const createMobileComprehensiveProject = (): Project => ({
  name: PROJECT_NAMES.MOBILE_COMPREHENSIVE,
  use: {
    ...devices['Pixel 5'],
    storageState: STORAGE_STATE_PATH,
  },
  testMatch: TEST_PATTERNS.RESPONSIVE_TESTS,
});

/**
 * Create API Auth Comprehensive project configuration
 */
const createApiAuthComprehensiveProject = (): Project => ({
  name: PROJECT_NAMES.API_AUTH_COMPREHENSIVE,
  use: {
    ...devices['Desktop Chrome'],
    storageState: undefined,
  },
  testMatch: TEST_PATTERNS.AUTH_TESTS,
});

/**
 * Create additional non-CI projects
 */
const createAdditionalProjects = (): Project[] => {
  const projects: Project[] = [];

  // Cross-browser testing
  projects.push(
    {
      name: PROJECT_NAMES.FIREFOX,
      use: {
        ...devices['Desktop Firefox'],
        storageState: STORAGE_STATE_PATH,
      },
      testMatch: TEST_PATTERNS.CROSS_BROWSER,
    },
    {
      name: PROJECT_NAMES.WEBKIT,
      use: {
        ...devices['Desktop Safari'],
        storageState: STORAGE_STATE_PATH,
      },
      testMatch: TEST_PATTERNS.CROSS_BROWSER,
    }
  );

  // Mobile testing
  projects.push({
    name: PROJECT_NAMES.MOBILE_CHROME,
    use: {
      ...devices['Pixel 5'],
      storageState: STORAGE_STATE_PATH,
    },
    testMatch: TEST_PATTERNS.MOBILE,
  });

  // Desktop with different viewports
  projects.push(
    {
      name: PROJECT_NAMES.CHROMIUM_DESKTOP_WIDE,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE_PATH,
        viewport: VIEWPORTS.DESKTOP_WIDE,
      },
      testMatch: TEST_PATTERNS.DESKTOP_ONLY,
    },
    {
      name: PROJECT_NAMES.CHROMIUM_TABLET,
      use: {
        ...devices['iPad Pro'],
        storageState: STORAGE_STATE_PATH,
      },
      testMatch: TEST_PATTERNS.TABLET,
    }
  );

  // API authentication testing (no storage state - tests auth flow)
  projects.push({
    name: PROJECT_NAMES.API_AUTH,
    use: {
      ...devices['Desktop Chrome'],
      storageState: undefined,
    },
    testMatch: TEST_PATTERNS.AUTH_SPEC,
    dependencies: [],
  });

  return projects;
};

/**
 * Get project configurations based on current test mode
 */
export const getProjects = (): Project[] => {
  const config = getCurrentModeConfig();
  const mode = getTestMode();
  const projects: Project[] = [];

  // Add projects based on configuration
  for (const projectName of config.projects) {
    switch (projectName) {
      case PROJECT_NAMES.CHROMIUM:
        projects.push(createChromiumProject());
        break;
      case PROJECT_NAMES.CHROMIUM_DESKTOP:
        projects.push(createChromiumDesktopProject());
        break;
      case PROJECT_NAMES.CHROMIUM_PROD:
        projects.push(createChromiumProdProject());
        break;
      case PROJECT_NAMES.CHROMIUM_COMPREHENSIVE:
        projects.push(createChromiumComprehensiveProject());
        break;
      case PROJECT_NAMES.FIREFOX_COMPREHENSIVE:
        projects.push(createFirefoxComprehensiveProject());
        break;
      case PROJECT_NAMES.MOBILE_COMPREHENSIVE:
        projects.push(createMobileComprehensiveProject());
        break;
      case PROJECT_NAMES.API_AUTH_COMPREHENSIVE:
        projects.push(createApiAuthComprehensiveProject());
        break;
    }
  }

  // Add additional projects for non-CI environments
  if (!isCI() && mode !== TEST_MODES.FAST && mode !== TEST_MODES.PROD) {
    projects.push(...createAdditionalProjects());
  }

  return projects;
};
