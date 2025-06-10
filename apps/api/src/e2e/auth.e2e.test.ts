import { UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import request from 'supertest';

import app from '../index';
import { prisma } from '../lib/prisma';

describe('Auth E2E', () => {
  let adminUser: { email: string; password: string };

  beforeAll(async () => {
    // Create test user
    adminUser = {
      email: 'admin@test.com',
      password: 'testpassword123',
    };

    await prisma.user.create({
      data: {
        email: adminUser.email,
        passwordHash: await bcrypt.hash(adminUser.password, 10),
        name: 'Test Admin',
        role: UserRole.ADMIN,
      },
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: adminUser.email,
          password: adminUser.password,
        })
        .expect(200);

      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user).toMatchObject({
        email: adminUser.email,
        name: 'Test Admin',
        role: 'ADMIN',
      });
    });

    it('should fail with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: adminUser.email,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh token', async () => {
      // First login
      const loginResponse = await request(app).post('/api/v1/auth/login').send({
        email: adminUser.email,
        password: adminUser.password,
      });

      const { refreshToken } = loginResponse.body.data;

      // Refresh token
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('refreshToken');
    });
  });
});
