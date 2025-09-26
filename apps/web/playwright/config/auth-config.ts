/**
 * Test Credentials Configuration
 * Manages test credentials and authentication for E2E tests
 * Following Issue #416 Priority 2.3 - Enhanced security practices
 * Issue #466: Fix shard 1/3 failures with improved Storage State handling
 */

import * as fs from 'fs';
import * as path from 'path';

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
 * Get the base directory for auth state files
 * Issue #466: Use consistent base directory across all shards
 */
const getAuthBaseDir = (): string => {
  if (process.env.CI === 'true') {
    // In CI, use GitHub workspace root as the base
    // This ensures consistency across all shards
    const workspaceRoot = process.env.GITHUB_WORKSPACE;
    if (workspaceRoot && fs.existsSync(workspaceRoot)) {
      return path.join(workspaceRoot, 'apps/web/e2e/.auth');
    }

    // Fallback: Try to find the project root by looking for package.json
    let currentDir = process.cwd();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const packageJsonPath = path.join(currentDir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          if (packageJson.name === 'simple-bookkeeping-monorepo' || packageJson.workspaces) {
            // Found the monorepo root
            return path.join(currentDir, 'apps/web/e2e/.auth');
          }
        } catch {
          // Ignore parse errors
        }
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        // Reached filesystem root
        break;
      }
      currentDir = parentDir;
      attempts++;
    }

    // Final fallback for CI
    return '/home/runner/work/simple-bookkeeping/simple-bookkeeping/apps/web/e2e/.auth';
  }

  // For local development, use current working directory
  return path.resolve(process.cwd(), 'apps/web/e2e/.auth');
};

/**
 * Get authentication state storage path
 * Returns absolute path for CI compatibility with sharding support
 *
 * Issue #466: Fix shard 1/3 failures by using consistent path resolution
 * When running in sharded mode, we need to ensure all shards can find the auth state
 */
export const getAuthStatePath = (role: string = 'admin'): string => {
  const authDir = getAuthBaseDir();
  const authFile = `${role}.json`;

  // Create a shard-specific subdirectory to avoid conflicts
  const shardIndex = process.env.TEST_PARALLEL_INDEX || '0';
  const isSharded = process.env.CI === 'true' && shardIndex !== '0';

  if (isSharded) {
    // In sharded CI mode, use a shared auth directory
    // This prevents each shard from trying to create its own auth state
    const sharedAuthPath = path.join(authDir, 'shared', authFile);

    // Log the path for debugging
    if (process.env.DEBUG === 'true' || process.env.PWDEBUG === '1') {
      console.warn(`[Shard ${shardIndex}] Using shared auth path: ${sharedAuthPath}`);
    }

    return sharedAuthPath;
  }

  // Non-sharded mode: use the standard path
  return path.join(authDir, authFile);
};

/**
 * Check if authentication state file exists and is valid
 */
export const isAuthStateValid = (role: string = 'admin'): boolean => {
  const authPath = getAuthStatePath(role);

  if (!fs.existsSync(authPath)) {
    return false;
  }

  try {
    const stats = fs.statSync(authPath);
    // Check if file was created within the last hour (3600000 ms)
    const ageMs = Date.now() - stats.mtimeMs;
    return ageMs < 3600000;
  } catch {
    return false;
  }
};

/**
 * Check if authentication state should be prepared
 * Issue #466: Only prepare auth state once in sharded mode
 */
export const shouldPrepareAuthState = (): boolean => {
  // Always prepare if explicitly requested
  if (process.env[ENV_KEYS.PREPARE_AUTH_STATE] === 'true') {
    return true;
  }

  // In CI with sharding, only the first shard should prepare auth state
  if (process.env.CI === 'true') {
    const shardIndex = process.env.TEST_PARALLEL_INDEX || '0';

    // Check if we're the first shard (index 0) or running in non-sharded mode
    if (shardIndex === '0' || !process.env.TEST_PARALLEL_INDEX) {
      return true;
    }

    // For other shards, check if auth state already exists
    // If it doesn't exist after a reasonable wait, this shard should create it
    return !isAuthStateValid('admin');
  }

  // For local development, always prepare
  return true;
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
    shardIndex: process.env.TEST_PARALLEL_INDEX || '0',
    totalShards: process.env.TEST_PARALLEL_TOTAL || '1',
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
  console.warn(`  Shard: ${envConfig.shardIndex}/${envConfig.totalShards}`);
};
