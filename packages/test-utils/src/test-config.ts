import { randomBytes } from 'crypto';

/**
 * Generate a secure test password
 * @param prefix - Optional prefix for the password
 * @returns A secure test password
 */
function generateSecurePassword(prefix = 'Test'): string {
  const randomPart = randomBytes(8).toString('hex');
  const timestamp = Date.now();
  return `${prefix}_${randomPart}_${timestamp}`;
}

/**
 * Test credentials configuration
 * Uses environment variables when available, falls back to secure defaults
 */
export const TEST_CREDENTIALS = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin.test@example.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'AdminTest123!',
    name: process.env.TEST_ADMIN_NAME || 'Test Admin',
    role: 'admin' as const,
  },
  accountant: {
    email: process.env.TEST_ACCOUNTANT_EMAIL || 'accountant.test@example.com',
    password: process.env.TEST_ACCOUNTANT_PASSWORD || 'AccountantTest123!',
    name: process.env.TEST_ACCOUNTANT_NAME || 'Test Accountant',
    role: 'accountant' as const,
  },
  viewer: {
    email: process.env.TEST_VIEWER_EMAIL || 'viewer.test@example.com',
    password: process.env.TEST_VIEWER_PASSWORD || 'ViewerTest123!',
    name: process.env.TEST_VIEWER_NAME || 'Test Viewer',
    role: 'viewer' as const,
  },
  // Generic test user for various test scenarios
  testUser: {
    email: process.env.TEST_USER_EMAIL || 'user.test@example.com',
    password: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
    name: process.env.TEST_USER_NAME || 'Test User',
    role: 'viewer' as const,
  },
} as const;

/**
 * JWT configuration for tests
 */
export const TEST_JWT_CONFIG = {
  secret: process.env.TEST_JWT_SECRET || 'test-jwt-secret-do-not-use-in-production',
  expiresIn: process.env.TEST_JWT_EXPIRES_IN || '1h',
  refreshSecret: process.env.TEST_REFRESH_SECRET || 'test-refresh-secret-do-not-use-in-production',
  refreshExpiresIn: process.env.TEST_REFRESH_EXPIRES_IN || '7d',
} as const;

/**
 * Database configuration for tests
 */
export const TEST_DATABASE_CONFIG = {
  url:
    process.env.TEST_DATABASE_URL ||
    'postgresql://test:test@localhost:5432/simple_bookkeeping_test',
} as const;

/**
 * API configuration for tests
 */
export const TEST_API_CONFIG = {
  baseUrl: process.env.TEST_API_URL || 'http://localhost:3001',
  timeout: parseInt(process.env.TEST_API_TIMEOUT || '30000', 10),
} as const;

/**
 * Generate a unique test email
 * @param prefix - Optional prefix for the email
 * @returns A unique test email address
 */
export function generateTestEmail(prefix = 'test'): string {
  const timestamp = Date.now();
  const random = randomBytes(4).toString('hex');
  return `${prefix}.${timestamp}.${random}@example.com`;
}

/**
 * Generate test credentials for a new user
 * @param overrides - Optional overrides for the generated credentials
 * @returns Test user credentials
 */
export function generateTestCredentials(
  overrides?: Partial<{
    email: string;
    password: string;
    name: string;
    role: 'admin' | 'accountant' | 'viewer';
  }>
) {
  return {
    email: overrides?.email || generateTestEmail(),
    password: overrides?.password || generateSecurePassword(),
    name: overrides?.name || `Test User ${Date.now()}`,
    role: overrides?.role || ('viewer' as const),
  };
}

/**
 * Check if we're in a test environment
 * @returns true if in test environment
 */
export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'e2e';
}

/**
 * Validate that test credentials are not used in production
 * @throws Error if test credentials are detected in production
 */
export function validateTestCredentials(): void {
  if (process.env.NODE_ENV === 'production') {
    const testPatterns = [
      'test',
      'localhost',
      'example.com',
      'test-jwt-secret',
      'admin123',
      'password123',
    ];

    const envVars = [
      process.env.DATABASE_URL,
      process.env.JWT_SECRET,
      process.env.ADMIN_EMAIL,
      process.env.ADMIN_PASSWORD,
    ];

    for (const envVar of envVars) {
      if (envVar) {
        for (const pattern of testPatterns) {
          if (envVar.toLowerCase().includes(pattern)) {
            throw new Error(`Test credentials detected in production environment: ${pattern}`);
          }
        }
      }
    }
  }
}

export { generateSecurePassword };
