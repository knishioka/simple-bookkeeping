// This test file specifically tests rate limiting
// It needs to be in a separate file to control the environment variable before the app loads

// Set test environment variables BEFORE importing anything else
process.env.NODE_ENV = 'test';
// Don't disable rate limiting for this test
delete process.env.DISABLE_RATE_LIMIT;

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

import { UserRole } from '@simple-bookkeeping/database';
import request from 'supertest';

import app from '../../index';
import { prisma } from '../../lib/prisma';
import {
  cleanupTestData,
  createTestOrganization,
  createTestUser,
} from '../../test-utils/test-helpers';

describe('Auth Rate Limiting', () => {
  beforeEach(async () => {
    await cleanupTestData();

    const testOrg = await createTestOrganization();
    // Create a test user for rate limiting tests
    await createTestUser(testOrg.id, UserRole.ACCOUNTANT, {
      email: 'rate-limit-test@example.com',
      password: 'TestPassword123!',
      name: 'Rate Limit Test User',
    });

    // Wait a bit to ensure rate limit window resets between tests
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    await cleanupTestData();
    // Wait to ensure rate limit windows don't overlap
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should rate limit login attempts after 5 failed attempts', async () => {
      // Make multiple failed login attempts sequentially
      const responses = [];
      for (let i = 0; i < 6; i++) {
        const response = await request(app).post('/api/v1/auth/login').send({
          email: 'rate-limit-test@example.com',
          password: 'WrongPassword123!',
        });
        responses.push(response);
      }

      // First 5 attempts should fail with invalid credentials
      for (let i = 0; i < 5; i++) {
        expect(responses[i].status).toBe(401);
        expect(responses[i].body.error.code).toBe('INVALID_CREDENTIALS');
      }

      // 6th attempt should be rate limited
      expect(responses[5].status).toBe(429);
      expect(responses[5].body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(responses[5].body.error.message).toContain('15分後に再試行');
    });
  });
});
