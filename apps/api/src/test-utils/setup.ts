/// <reference types="jest" />

// Import env setup first
import './env-setup';

// Now import prisma after environment variables are set
import { prisma } from '../lib/prisma';

// Increase timeout for database operations
jest.setTimeout(30000);

// Ensure clean database state before all tests
beforeAll(async () => {
  // Check database connection with retry logic
  let retries = 3;
  let lastError: Error | unknown;

  while (retries > 0) {
    try {
      await prisma.$connect();
      // Database connected successfully for tests
      break;
    } catch (error) {
      lastError = error;
      retries--;

      if (retries > 0) {
        console.warn(`⚠️ Database connection failed, retrying... (${3 - retries}/3)`);
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  if (retries === 0) {
    console.error('❌ Failed to connect to database after 3 attempts');
    console.error('Database URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
    console.error('Error:', lastError);

    // Provide helpful error message
    if (lastError instanceof Error && lastError.message.includes('User was denied access')) {
      console.error('\nPossible solutions:');
      console.error('1. Check if the database user exists and has proper permissions');
      console.error('2. Set TEST_DATABASE_URL environment variable with correct credentials');
      console.error('3. Use the default test user: bookkeeping/bookkeeping');
    }

    throw lastError;
  }
});

// Clean up after all tests
afterAll(async () => {
  await prisma.$disconnect();
});

// Suppress console logs during tests unless explicitly needed
if (process.env.NODE_ENV === 'test' && !process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // Keep error to see test failures
    error: console.error,
  };
}
