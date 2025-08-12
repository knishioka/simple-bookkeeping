// This file sets up environment variables for tests
// It MUST be imported before any other imports in test setup

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DISABLE_RATE_LIMIT = 'true';

// Set default test database URL if not provided
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@localhost:5432/simple_bookkeeping_test?schema=public';
}

// Set default JWT secrets for testing if not provided
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret';
}
if (!process.env.JWT_REFRESH_SECRET) {
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
}

export {};
