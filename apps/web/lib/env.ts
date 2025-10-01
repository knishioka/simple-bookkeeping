/**
 * Environment variable validation and type-safe access
 * Validates all environment variables at startup using Zod schemas
 */

import { z } from 'zod';

/**
 * Server-side environment variables schema
 * These variables are only available on the server
 */
const serverEnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),

  // Supabase (Server-side)
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // Authentication
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Vercel environment
  VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
  VERCEL_URL: z.string().optional(),

  // Port configuration
  PORT: z.string().regex(/^\d+$/).default('3000'),
});

/**
 * Custom URL validator that only allows HTTP(S) protocols
 * and rejects XSS/SSRF attempts
 */
const httpUrlValidator = z
  .string()
  .trim()
  .min(1, { message: 'URL cannot be empty' })
  .refine(
    (val) => {
      // Treat whitespace-only strings as invalid
      if (!val || val.trim().length === 0) {
        return false;
      }

      try {
        const url = new URL(val.trim());
        // Only allow http: and https: protocols
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Invalid Supabase URL format' }
  );

/**
 * Custom string validator that treats empty/whitespace as invalid
 */
const nonEmptyString = z
  .string()
  .trim()
  .min(1, { message: 'Value cannot be empty' })
  .refine((val) => val && val.trim().length > 0, { message: 'Value cannot be whitespace only' });

/**
 * Client-side environment variables schema
 * These variables are exposed to the browser (prefixed with NEXT_PUBLIC_)
 */
const clientEnvSchema = z.object({
  // Supabase (Client-side)
  NEXT_PUBLIC_SUPABASE_URL: httpUrlValidator,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmptyString,

  // Site configuration
  NEXT_PUBLIC_SITE_URL: z.string().url().optional().or(z.literal('')),
  NEXT_PUBLIC_APP_NAME: z.string().default('Simple Bookkeeping'),
  NEXT_PUBLIC_APP_VERSION: z.string().optional(),

  // Feature flags
  NEXT_PUBLIC_ENABLE_ANALYTICS: z.enum(['true', 'false']).default('false'),
  NEXT_PUBLIC_ENABLE_PWA: z.enum(['true', 'false']).default('false'),
});

/**
 * Combined environment schema
 */
const envSchema = z.object({
  ...serverEnvSchema.shape,
  ...clientEnvSchema.shape,
});

/**
 * Parse and validate environment variables
 * @param env - Environment variables object (usually process.env)
 * @returns Validated and typed environment variables
 * @throws {ZodError} If validation fails
 */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): Env {
  try {
    // Separate client and server validation for better error messages
    const isServer = typeof window === 'undefined';

    if (isServer) {
      // Server-side: validate all variables
      return envSchema.parse(env) as Env;
    } else {
      // Client-side: only validate public variables
      return clientEnvSchema.parse(env) as Env;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Get the first error for simpler error messages
      const firstError = error.errors[0];
      if (firstError) {
        const fieldName = firstError.path.join('.');

        // Check for specific error types
        if (firstError.code === 'invalid_type' && firstError.received === 'undefined') {
          throw new Error(`Missing required environment variable: ${fieldName}`);
        }

        // Check for empty/whitespace strings (treated as missing)
        if (
          firstError.code === 'too_small' ||
          firstError.message.includes('empty') ||
          firstError.message.includes('whitespace')
        ) {
          throw new Error(`Missing required environment variable: ${fieldName}`);
        }

        // Check for custom validation failures (URL format, etc.)
        if (firstError.code === 'custom' || firstError.message.includes('Invalid Supabase URL')) {
          throw new Error(`Invalid Supabase URL format`);
        }

        if (firstError.code === 'invalid_string' && firstError.validation === 'url') {
          throw new Error(`Invalid Supabase URL format`);
        }

        // Generic error message
        throw new Error(`Invalid environment variable ${fieldName}: ${firstError.message}`);
      }

      // Fallback error message
      const errorMessage = `❌ Environment variable validation failed:\n${error.errors
        .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
        .join('\n')}`;

      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    throw error;
  }
}

/**
 * Type-safe environment variables
 * Validated at module load time
 */
export const env = validateEnv(process.env);

/**
 * Helper to get Supabase URL with fallback
 * Handles local development and production environments
 * Reads from process.env for test compatibility
 */
export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!url || url.length === 0) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }

  // Validate URL format
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Invalid Supabase URL format');
    }
  } catch {
    throw new Error('Invalid Supabase URL format');
  }

  return url;
}

/**
 * Helper to get Supabase Anon Key
 * Reads from process.env for test compatibility
 */
export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!key || key.length === 0) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return key;
}

/**
 * Helper to get site URL with fallback
 * Handles Vercel preview deployments and local development
 */
export function getSiteUrl(): string {
  // Priority order: NEXT_PUBLIC_SITE_URL > Vercel URL > localhost
  if (env.NEXT_PUBLIC_SITE_URL) {
    return env.NEXT_PUBLIC_SITE_URL;
  }

  if (env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}`;
  }

  // Fallback for local development
  if (env.NODE_ENV === 'development') {
    return `http://localhost:${env.PORT || '3000'}`;
  }

  // In production without a URL, throw error
  throw new Error('Site URL is not configured');
}

/**
 * Helper to check if we're in production
 */
export function isProduction(): boolean {
  return env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production';
}

/**
 * Helper to check if we're in development
 */
export function isDevelopment(): boolean {
  return env.NODE_ENV === 'development';
}

/**
 * Helper to check if we're in a test environment
 */
export function isTest(): boolean {
  return env.NODE_ENV === 'test';
}

/**
 * Helper to check if analytics is enabled
 */
export function isAnalyticsEnabled(): boolean {
  return env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true' && isProduction();
}

/**
 * Helper to check if PWA is enabled
 */
export function isPWAEnabled(): boolean {
  return env.NEXT_PUBLIC_ENABLE_PWA === 'true';
}

/**
 * Validate required environment variables for specific features
 * Use this at the start of functions that require specific env vars
 */
export function requireEnvVars(vars: Array<keyof typeof env>): void {
  const missing = vars.filter((v) => !env[v]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please check your .env.local file'
    );
  }
}

/**
 * Get environment variable with fallback
 * Useful for optional variables with defaults
 */
export function getEnvVar<T extends keyof typeof env>(key: T, fallback?: string): string {
  const value = env[key];

  if (value === undefined || value === '') {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Environment variable ${key} is not set and no fallback provided`);
  }

  return String(value);
}

/**
 * Type for validated environment variables
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Type for client-only environment variables
 */
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Type for server-only environment variables
 */
export type ServerEnv = z.infer<typeof serverEnvSchema>;

// Export for testing and validation
export { envSchema, clientEnvSchema, serverEnvSchema };

/**
 * Initialize environment validation
 * Call this at app startup to fail fast on missing/invalid env vars
 */
export function initializeEnv(): void {
  try {
    validateEnv(process.env);
    // eslint-disable-next-line no-console
    console.log('✅ Environment variables validated successfully');
  } catch (error) {
    console.error('❌ Environment validation failed:', error);
    if (isDevelopment()) {
      process.exit(1);
    }
  }
}

export default env;
