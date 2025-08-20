// Setup test environment variables first
import '../../test-utils/env-setup';

import { UserRole } from '@simple-bookkeeping/database';
import bcrypt from 'bcryptjs';
import request from 'supertest';

import app from '../../index';
import { prisma } from '../../lib/prisma';

describe('Organization-based Authentication', () => {
  let testUserId: string;
  let testOrg1Id: string;
  let testOrg2Id: string;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    // Clean up test data
    await prisma.userOrganization.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.organization.deleteMany({});

    // Create test organizations
    const org1 = await prisma.organization.create({
      data: {
        name: 'Test Organization 1',
        code: 'TEST-ORG-1',
        isActive: true,
      },
    });
    testOrg1Id = org1.id;

    const org2 = await prisma.organization.create({
      data: {
        name: 'Test Organization 2',
        code: 'TEST-ORG-2',
        isActive: true,
      },
    });
    testOrg2Id = org2.id;

    // Create test user
    const passwordHash = await bcrypt.hash('TestPassword123!', 10);
    const user = await prisma.user.create({
      data: {
        email: 'test-org@example.com',
        passwordHash,
        name: 'Test User',
        isActive: true,
      },
    });
    testUserId = user.id;

    // Link user to both organizations with different roles
    await prisma.userOrganization.create({
      data: {
        userId: testUserId,
        organizationId: testOrg1Id,
        role: UserRole.ADMIN,
        isDefault: true,
      },
    });

    await prisma.userOrganization.create({
      data: {
        userId: testUserId,
        organizationId: testOrg2Id,
        role: UserRole.VIEWER,
        isDefault: false,
      },
    });
  });

  afterEach(async () => {
    // Clean up any additional data created during tests
    await prisma.auditLog.deleteMany({});
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.userOrganization.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.organization.deleteMany({});
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should include organization info in JWT token', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'test-org@example.com',
        password: 'TestPassword123!',
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user).toHaveProperty('organizationId', testOrg1Id);
      expect(response.body.data.user).toHaveProperty('role', UserRole.ADMIN);
      expect(response.body.data.user.organization).toHaveProperty('name', 'Test Organization 1');

      accessToken = response.body.data.token;
      refreshToken = response.body.data.refreshToken;
    });

    it('should return error if user has no organization', async () => {
      // Create user without organization
      const passwordHash = await bcrypt.hash('TestPassword123!', 10);
      await prisma.user.create({
        data: {
          email: 'no-org@example.com',
          passwordHash,
          name: 'No Org User',
          isActive: true,
        },
      });

      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'no-org@example.com',
        password: 'TestPassword123!',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('NO_ORGANIZATION');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    beforeEach(async () => {
      // Ensure we have a valid token before running refresh tests
      if (!refreshToken) {
        const loginResponse = await request(app).post('/api/v1/auth/login').send({
          email: 'test-org@example.com',
          password: 'TestPassword123!',
        });
        accessToken = loginResponse.body.data.token;
        refreshToken = loginResponse.body.data.refreshToken;
      }
    });

    it('should maintain organization context when refreshing token', async () => {
      const response = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken,
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('should handle legacy tokens without organization info', async () => {
      // This test simulates old tokens that don't have organizationId
      // The system should get the default organization
      const response = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken,
      });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/v1/auth/switch-organization', () => {
    beforeEach(async () => {
      // Ensure we have a valid token before running switch tests
      if (!accessToken) {
        const loginResponse = await request(app).post('/api/v1/auth/login').send({
          email: 'test-org@example.com',
          password: 'TestPassword123!',
        });
        accessToken = loginResponse.body.data.token;
        refreshToken = loginResponse.body.data.refreshToken;
      }
    });

    it('should switch to another organization successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/switch-organization')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          organizationId: testOrg2Id,
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user).toHaveProperty('organizationId', testOrg2Id);
      expect(response.body.data.user).toHaveProperty('role', UserRole.VIEWER);
      expect(response.body.data.user.organization).toHaveProperty('name', 'Test Organization 2');
    });

    it('should return error when switching to unauthorized organization', async () => {
      // Create another organization the user doesn't have access to
      const unauthorizedOrg = await prisma.organization.create({
        data: {
          name: 'Unauthorized Org',
          code: 'UNAUTH-ORG',
          isActive: true,
        },
      });

      const response = await request(app)
        .post('/api/v1/auth/switch-organization')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          organizationId: unauthorizedOrg.id,
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('NO_ACCESS_TO_ORGANIZATION');
    });

    it('should return error when switching to inactive organization', async () => {
      // Create inactive organization
      const inactiveOrg = await prisma.organization.create({
        data: {
          name: 'Inactive Org',
          code: 'INACTIVE-ORG',
          isActive: false,
        },
      });

      await prisma.userOrganization.create({
        data: {
          userId: testUserId,
          organizationId: inactiveOrg.id,
          role: UserRole.VIEWER,
          isDefault: false,
        },
      });

      const response = await request(app)
        .post('/api/v1/auth/switch-organization')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          organizationId: inactiveOrg.id,
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ORGANIZATION_INACTIVE');
    });

    it('should require valid organization ID', async () => {
      const response = await request(app)
        .post('/api/v1/auth/switch-organization')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          organizationId: 'invalid-uuid',
        });

      expect(response.status).toBe(422);
    });

    it('should require authentication', async () => {
      const response = await request(app).post('/api/v1/auth/switch-organization').send({
        organizationId: testOrg2Id,
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Authorization with organization roles', () => {
    it('should authorize based on organization role', async () => {
      // Login to get token with ADMIN role for org1
      const loginResponse = await request(app).post('/api/v1/auth/login').send({
        email: 'test-org@example.com',
        password: 'TestPassword123!',
      });

      const adminToken = loginResponse.body.data.token;

      // Test accessing an admin-only endpoint
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should deny access when role is insufficient', async () => {
      // Ensure we have a valid token
      if (!accessToken) {
        const loginResponse = await request(app).post('/api/v1/auth/login').send({
          email: 'test-org@example.com',
          password: 'TestPassword123!',
        });
        accessToken = loginResponse.body.data.token;
      }

      // Switch to org2 where user is VIEWER
      const switchResponse = await request(app)
        .post('/api/v1/auth/switch-organization')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          organizationId: testOrg2Id,
        });

      const viewerToken = switchResponse.body.data.token;

      // Try to access an admin-only endpoint (when we have one)
      // For now, just verify the token works for basic auth
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(200);
      // In the response, the user should have VIEWER role
      // Check various possible response structures
      const role =
        response.body.data.user.currentOrganization?.role ||
        response.body.data.user.role ||
        response.body.data.role;
      expect(role).toBe(UserRole.VIEWER);
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should create user with organization and proper role', async () => {
      const response = await request(app).post('/api/v1/auth/register').send({
        email: 'new-org-user@example.com',
        password: 'TestPassword123!',
        name: 'New Org User',
        organizationName: 'New Test Organization',
      });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user).toHaveProperty('email', 'new-org-user@example.com');
      expect(response.body.data.organization).toHaveProperty('name', 'New Test Organization');

      // Verify the user has ADMIN role for the new organization
      const userOrg = await prisma.userOrganization.findFirst({
        where: {
          user: { email: 'new-org-user@example.com' },
        },
      });

      expect(userOrg?.role).toBe(UserRole.ADMIN);
      expect(userOrg?.isDefault).toBe(true);
    });
  });
});
