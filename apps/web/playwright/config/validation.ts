/**
 * Environment Variable Validation
 * Validates and ensures required environment variables are set
 */

import { ENV_KEYS } from '../constants';

/**
 * Environment variable validation result
 */
export interface ValidationResult {
  isValid: boolean;
  missingVars: string[];
  warnings: string[];
}

/**
 * Required environment variables for different modes
 */
const REQUIRED_VARS: Record<string, string[]> = {
  base: [ENV_KEYS.NODE_ENV],
  ci: [ENV_KEYS.CI],
  prod: [ENV_KEYS.PROD_URL],
  auth: [ENV_KEYS.PREPARE_AUTH_STATE],
};

/**
 * Validate base environment variables
 */
const validateBaseVars = (): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    missingVars: [],
    warnings: [],
  };

  // Check required base variables
  for (const varName of REQUIRED_VARS.base) {
    if (!process.env[varName]) {
      result.missingVars.push(varName);
      result.isValid = false;
    }
  }

  // Check NODE_ENV value
  if (process.env[ENV_KEYS.NODE_ENV] && process.env[ENV_KEYS.NODE_ENV] !== 'test') {
    result.warnings.push(
      `${ENV_KEYS.NODE_ENV} is set to "${process.env[ENV_KEYS.NODE_ENV]}" instead of "test"`
    );
  }

  return result;
};

/**
 * Validate CI-specific environment variables
 */
const validateCIVars = (): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    missingVars: [],
    warnings: [],
  };

  if (process.env[ENV_KEYS.CI] === 'true') {
    // CI-specific validations
    if (!process.env[ENV_KEYS.TEST_MODE]) {
      result.warnings.push('TEST_MODE not set in CI environment, defaulting to "ci"');
    }
  }

  return result;
};

/**
 * Validate production mode environment variables
 */
const validateProdVars = (): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    missingVars: [],
    warnings: [],
  };

  if (process.env[ENV_KEYS.TEST_MODE] === 'prod') {
    if (!process.env[ENV_KEYS.PROD_URL]) {
      result.warnings.push('PROD_URL not set for production testing, using default URL');
    }
  }

  return result;
};

/**
 * Validate authentication-related environment variables
 */
const validateAuthVars = (): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    missingVars: [],
    warnings: [],
  };

  if (process.env[ENV_KEYS.PREPARE_AUTH_STATE] === 'true') {
    if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) {
      result.warnings.push(
        'Auth state preparation enabled but test credentials not set, using defaults'
      );
    }
  }

  return result;
};

/**
 * Validate Supabase environment variables
 */
const validateSupabaseVars = (): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    missingVars: [],
    warnings: [],
  };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    result.warnings.push('NEXT_PUBLIC_SUPABASE_URL not set, using dummy value for E2E tests');
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    result.warnings.push('NEXT_PUBLIC_SUPABASE_ANON_KEY not set, using dummy value for E2E tests');
  }

  return result;
};

/**
 * Merge multiple validation results
 */
const mergeResults = (...results: ValidationResult[]): ValidationResult => {
  const merged: ValidationResult = {
    isValid: true,
    missingVars: [],
    warnings: [],
  };

  for (const result of results) {
    merged.isValid = merged.isValid && result.isValid;
    merged.missingVars.push(...result.missingVars);
    merged.warnings.push(...result.warnings);
  }

  // Remove duplicates
  merged.missingVars = Array.from(new Set(merged.missingVars));
  merged.warnings = Array.from(new Set(merged.warnings));

  return merged;
};

/**
 * Validate all environment variables
 */
export const validateEnvironment = (): ValidationResult => {
  const results = [
    validateBaseVars(),
    validateCIVars(),
    validateProdVars(),
    validateAuthVars(),
    validateSupabaseVars(),
  ];

  return mergeResults(...results);
};

/**
 * Log validation results
 */
export const logValidationResults = (result: ValidationResult): void => {
  if (result.missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    result.missingVars.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️  Environment variable warnings:');
    result.warnings.forEach((warning) => {
      console.warn(`   - ${warning}`);
    });
  }

  if (result.isValid && result.warnings.length === 0) {
    console.warn('✅ All environment variables validated successfully');
  }
};

/**
 * Ensure environment is valid or throw error
 */
export const ensureValidEnvironment = (): void => {
  const result = validateEnvironment();

  if (!result.isValid) {
    logValidationResults(result);
    throw new Error(
      `Environment validation failed: Missing required variables: ${result.missingVars.join(', ')}`
    );
  }

  if (result.warnings.length > 0) {
    logValidationResults(result);
  }
};
