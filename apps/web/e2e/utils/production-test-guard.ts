import { test } from '@playwright/test';

const ENABLE_FLAGS = [
  'E2E_RUN_PRODUCTION_TESTS',
  'PLAYWRIGHT_RUN_PRODUCTION_TESTS',
  'ALLOW_PRODUCTION_E2E',
  'ALLOW_PRODUCTION_AUTH_E2E',
  'RUN_PRODUCTION_E2E_TESTS',
];

function isEnabledFlag(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return value.trim().toLowerCase() === 'true';
}

const shouldRunProductionAuthTests = ENABLE_FLAGS.some((key) => isEnabledFlag(process.env[key]));

if (!shouldRunProductionAuthTests) {
  const message =
    '[Production Test Guard] Skipping production authentication E2E specs. ' +
    'Set E2E_RUN_PRODUCTION_TESTS=true (or another allow flag) to enable them.';

  if (process.env.CI === 'true') {
    console.warn(`${message} CI runs require an explicit opt-in.`);
  } else {
    console.warn(message);
  }
}

export const describeProductionAuth: typeof test.describe = shouldRunProductionAuthTests
  ? test.describe
  : test.describe.skip;

export const isProductionAuthEnabled = shouldRunProductionAuthTests;
