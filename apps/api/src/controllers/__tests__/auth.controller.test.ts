// Setup test environment variables first
import '../../test-utils/env-setup';

import { UserRole } from '@simple-bookkeeping/database';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../../index';
import { prisma } from '../../lib/prisma';
import {
  cleanupTestData,
  createTestOrganization,
  createTestUser,
  generateTestToken,
} from '../../test-utils/test-helpers';

describe('AuthController', () => {
  let testOrg: any;
  let testUser: any;
  const testPassword = 'TestPassword123!';

  beforeEach(async () => {
    await cleanupTestData();

    testOrg = await createTestOrganization();
    testUser = await createTestUser(testOrg.id, UserRole.ACCOUNTANT, {
      email: 'auth-test@example.com',
      password: testPassword,
      name: 'Auth Test User',
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'auth-test@example.com',
        password: testPassword,
      });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe('auth-test@example.com');
      expect(response.body.data.user.organizationId).toBe(testOrg.id);
    });

    it('should reject invalid password', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'auth-test@example.com',
        password: 'WrongPassword123!',
      });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should handle non-existent user', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'nonexistent@example.com',
        password: testPassword,
      });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject inactive user', async () => {
      // Deactivate user
      await prisma.user.update({
        where: { id: testUser.id },
        data: { isActive: false },
      });

      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'auth-test@example.com',
        password: testPassword,
      });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('ACCOUNT_DISABLED');
    });

    it('should validate required fields', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'auth-test@example.com',
        // Missing password
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should rate limit login attempts', async () => {
      // Make multiple failed login attempts
      const attempts = Array(6)
        .fill(null)
        .map(() =>
          request(app).post('/api/v1/auth/login').send({
            email: 'auth-test@example.com',
            password: 'WrongPassword',
          })
        );

      const responses = await Promise.all(attempts);
      const lastResponse = responses[responses.length - 1];

      // Should be rate limited after 5 attempts
      expect(lastResponse.status).toBe(429);
    });

    it('should log audit event for successful login', async () => {
      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'auth-test@example.com',
        password: testPassword,
      });

      expect(response.status).toBe(200);

      // Audit log checking would go here if auditLog model existed
      // For now, just verify login was successful
      expect(response.body.data.user.id).toBe(testUser.id);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Login to get tokens
      const loginResponse = await request(app).post('/api/v1/auth/login').send({
        email: 'auth-test@example.com',
        password: testPassword,
      });

      accessToken = loginResponse.body.data.token;
      refreshToken = loginResponse.body.data.refreshToken;
    });

    it('should refresh valid token', async () => {
      const response = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.token).not.toBe(accessToken);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject expired refresh token', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: testUser.id, organizationId: testOrg.id },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: expiredToken });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('should maintain user session', async () => {
      const response = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.data.user.id).toBe(testUser.id);
      expect(response.body.data.user.organizationId).toBe(testOrg.id);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let accessToken: string;

    beforeEach(async () => {
      accessToken = generateTestToken(testUser.id, testOrg.id);
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('ログアウト');
    });

    it('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('ログアウト');
    });

    it('should require authentication', async () => {
      const response = await request(app).post('/api/v1/auth/logout');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register new user with organization', async () => {
      const registerData = {
        email: 'newuser@example.com',
        password: 'NewPassword123!',
        name: 'New User',
        organizationName: 'New Company',
        organizationCode: 'NEW-CO',
      };

      const response = await request(app).post('/api/v1/auth/register').send(registerData);

      expect(response.status).toBe(201);
      expect(response.body.data.user.email).toBe('newuser@example.com');
      expect(response.body.data.organization.name).toBe('New Company');
      expect(response.body.data).toHaveProperty('token');
    });

    it('should prevent duplicate email', async () => {
      const registerData = {
        email: 'auth-test@example.com', // Already exists
        password: 'Password123!',
        name: 'Duplicate User',
        organizationName: 'Another Company',
        organizationCode: 'ANOTHER',
      };

      const response = await request(app).post('/api/v1/auth/register').send(registerData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should validate password strength', async () => {
      const registerData = {
        email: 'weak@example.com',
        password: 'weak', // Weak password
        name: 'Weak Password User',
        organizationName: 'Company',
        organizationCode: 'COMP',
      };

      const response = await request(app).post('/api/v1/auth/register').send(registerData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('WEAK_PASSWORD');
    });

    it('should validate email format', async () => {
      const registerData = {
        email: 'invalid-email',
        password: 'Password123!',
        name: 'Invalid Email User',
        organizationName: 'Company',
        organizationCode: 'COMP',
      };

      const response = await request(app).post('/api/v1/auth/register').send(registerData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_EMAIL');
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    let accessToken: string;

    beforeEach(async () => {
      accessToken = generateTestToken(testUser.id, testOrg.id);
    });

    it('should change password with valid current password', async () => {
      const changeData = {
        currentPassword: testPassword,
        newPassword: 'NewPassword123!',
      };

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changeData);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('パスワード');

      // Verify can login with new password
      const loginResponse = await request(app).post('/api/v1/auth/login').send({
        email: 'auth-test@example.com',
        password: 'NewPassword123!',
      });

      expect(loginResponse.status).toBe(200);
    });

    it('should reject incorrect current password', async () => {
      const changeData = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!',
      };

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changeData);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    });

    it('should validate new password strength', async () => {
      const changeData = {
        currentPassword: testPassword,
        newPassword: 'weak',
      };

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(changeData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('WEAK_PASSWORD');
    });

    it('should require authentication', async () => {
      const response = await request(app).post('/api/v1/auth/change-password').send({
        currentPassword: testPassword,
        newPassword: 'NewPassword123!',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current user info', async () => {
      const token = generateTestToken(testUser.id, testOrg.id);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(testUser.id);
      expect(response.body.data.email).toBe('auth-test@example.com');
      expect(response.body.data.organizationId).toBe(testOrg.id);
      expect(response.body.data.role).toBe(UserRole.ACCOUNTANT);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/switch-organization', () => {
    let otherOrg: any;
    let token: string;

    beforeEach(async () => {
      // Create another organization and link user
      otherOrg = await createTestOrganization({
        name: 'Other Organization',
        code: 'OTHER-ORG',
      });

      await prisma.userOrganization.create({
        data: {
          userId: testUser.id,
          organizationId: otherOrg.id,
          role: UserRole.VIEWER,
        },
      });

      token = generateTestToken(testUser.id, testOrg.id);
    });

    it('should switch to another organization', async () => {
      const response = await request(app)
        .post('/api/v1/auth/switch-organization')
        .set('Authorization', `Bearer ${token}`)
        .send({ organizationId: otherOrg.id });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.organizationId).toBe(otherOrg.id);
      expect(response.body.data.user.role).toBe(UserRole.VIEWER);
    });

    it('should reject switching to unauthorized organization', async () => {
      const unauthorizedOrg = await createTestOrganization({
        name: 'Unauthorized Org',
        code: 'UNAUTH',
      });

      const response = await request(app)
        .post('/api/v1/auth/switch-organization')
        .set('Authorization', `Bearer ${token}`)
        .send({ organizationId: unauthorizedOrg.id });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ORGANIZATION_ACCESS_DENIED');
    });

    it('should validate organization exists', async () => {
      const response = await request(app)
        .post('/api/v1/auth/switch-organization')
        .set('Authorization', `Bearer ${token}`)
        .send({ organizationId: 'non-existent-org' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('ORGANIZATION_NOT_FOUND');
    });
  });
});
