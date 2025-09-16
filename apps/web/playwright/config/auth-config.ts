/**
 * Test Credentials Configuration
 * Manages test credentials and authentication for E2E tests
 * Following Issue #416 Priority 2.3 - Enhanced security practices
 */

import { TEST_CREDENTIALS, ENV_KEYS } from '../constants';

/**
 * Test credential interface
 */
export interface TestCredential {
  email: string;
  password: string;
}

/**
 * Supabase test configuration interface
 */
export interface SupabaseTestConfig {
  url: string;
  anonKey: string;
}

/**
 * Get test admin credentials from environment or defaults
 * Prioritizes environment variables over hardcoded defaults
 */
export const getTestAdminCredentials = (): TestCredential => {
  return {
    email: process.env.TEST_ADMIN_EMAIL || TEST_CREDENTIALS.ADMIN.EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD || TEST_CREDENTIALS.ADMIN.PASSWORD,
  };
};

/**
 * Get Supabase test configuration from environment or defaults
 * Uses dummy values for E2E testing when not connected to real Supabase
 */
export const getSupabaseTestConfig = (): SupabaseTestConfig => {
  return {
    url: process.env[TEST_CREDENTIALS.SUPABASE.URL_KEY] || TEST_CREDENTIALS.SUPABASE.DUMMY_URL,
    anonKey:
      process.env[TEST_CREDENTIALS.SUPABASE.ANON_KEY] || TEST_CREDENTIALS.SUPABASE.DUMMY_ANON_KEY,
  };
};

/**
 * Set Supabase environment variables for E2E tests
 * Required by Next.js middleware even when not using real Supabase
 */
export const setSupabaseEnvVars = (): void => {
  const config = getSupabaseTestConfig();

  if (!process.env[TEST_CREDENTIALS.SUPABASE.URL_KEY]) {
    process.env[TEST_CREDENTIALS.SUPABASE.URL_KEY] = config.url;
  }

  if (!process.env[TEST_CREDENTIALS.SUPABASE.ANON_KEY]) {
    process.env[TEST_CREDENTIALS.SUPABASE.ANON_KEY] = config.anonKey;
  }
};

/**
 * Validate that required test environment variables are present
 * Returns array of missing variable names
 */
export const validateTestEnvironment = (): string[] => {
  const requiredVars = [ENV_KEYS.NODE_ENV];
  return requiredVars.filter((varName) => !process.env[varName]);
};

/**
 * Get authentication state storage path
 */
export const getAuthStatePath = (): string => {
  return process.env.AUTH_STATE_PATH || 'e2e/.auth/admin.json';
};

/**
 * Check if authentication state should be prepared
 */
export const shouldPrepareAuthState = (): boolean => {
  return process.env[ENV_KEYS.PREPARE_AUTH_STATE] === 'true';
};

/**
 * Get test environment configuration
 */
export const getTestEnvironmentConfig = () => {
  return {
    nodeEnv: process.env[ENV_KEYS.NODE_ENV] || 'test',
    isCI: process.env[ENV_KEYS.CI] === 'true',
    isDebug: process.env[ENV_KEYS.DEBUG] === 'true' || process.env[ENV_KEYS.PWDEBUG] === '1',
    testMode: process.env[ENV_KEYS.TEST_MODE],
  };
};

/**
 * Mask sensitive credentials for logging
 * Replaces middle portion of credentials with asterisks
 */
export const maskCredential = (credential: string): string => {
  if (credential.length <= 8) {
    return '*'.repeat(credential.length);
  }
  const visibleLength = 3;
  const start = credential.substring(0, visibleLength);
  const end = credential.substring(credential.length - visibleLength);
  const masked = '*'.repeat(credential.length - visibleLength * 2);
  return `${start}${masked}${end}`;
};

/**
 * Log credential configuration safely
 * Masks sensitive information when logging
 */
export const logCredentialConfig = (): void => {
  const adminCreds = getTestAdminCredentials();
  const supabaseConfig = getSupabaseTestConfig();
  const envConfig = getTestEnvironmentConfig();

  console.warn('🔐 Test Credential Configuration:');
  console.warn(`  Admin Email: ${maskCredential(adminCreds.email)}`);
  console.warn(`  Admin Password: ${maskCredential(adminCreds.password)}`);
  console.warn(`  Supabase URL: ${supabaseConfig.url}`);
  console.warn(`  Supabase Key: ${maskCredential(supabaseConfig.anonKey)}`);
  console.warn(`  Environment: ${envConfig.nodeEnv}`);
  console.warn(`  CI Mode: ${envConfig.isCI}`);
  console.warn(`  Debug Mode: ${envConfig.isDebug}`);
  console.warn(`  Test Mode: ${envConfig.testMode || 'default'}`);
};
