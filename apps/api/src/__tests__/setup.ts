import { prisma } from '../lib/prisma';

// Increase timeout for database operations
jest.setTimeout(30000);

// Set NODE_ENV to test to ensure proper test configuration
process.env.NODE_ENV = 'test';

// Disable rate limiting in tests
process.env.DISABLE_RATE_LIMIT = 'true';

// Ensure clean database state before all tests
beforeAll(async () => {
  // Check database connection
  try {
    await prisma.$connect();
    // Database connected successfully for tests
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    throw error;
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
