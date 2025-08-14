// This file sets up environment variables for tests
// It MUST be imported before any other imports in test setup

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DISABLE_RATE_LIMIT = 'true';

// Set default test database URL if not provided
// Use a more permissive configuration for local testing
if (!process.env.DATABASE_URL) {
  // Try different database configurations based on environment
  if (process.env.CI === 'true') {
    // CI environment - GitHub Actions PostgreSQL service
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/simple_bookkeeping_test?schema=public';
  } else {
    // Local development - try to detect the current user
    const currentUser = process.env.USER || process.env.USERNAME || 'postgres';
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ||
      `postgresql://${currentUser}@localhost:5432/simple_bookkeeping_test?schema=public`;
  }
}

// Set default JWT secrets for testing if not provided
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret';
}
if (!process.env.JWT_REFRESH_SECRET) {
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
}

export {};
