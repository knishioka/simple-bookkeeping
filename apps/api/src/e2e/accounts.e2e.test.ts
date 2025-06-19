import { AccountType, UserRole } from '@prisma/client';
import request from 'supertest';

import app from '../index';
import { prisma } from '../lib/prisma';

import { createTestUser, cleanupTestData } from './test-helpers';

describe('Accounts E2E', () => {
  let adminToken: string;
  let organizationId: string;
  let parentAccountId: string;

  beforeAll(async () => {
    const testUser = await createTestUser(
      'accounts-admin@test.com',
      'Accounts Admin',
      UserRole.ADMIN,
      'TEST-ACCOUNTS'
    );

    adminToken = testUser.token;
    organizationId = testUser.organization.id;

    // Create parent account
    const parentAccount = await prisma.account.create({
      data: {
        code: '1000',
        name: '流動資産',
        accountType: AccountType.ASSET,
        isSystem: true,
        organizationId,
      },
    });
    parentAccountId = parentAccount.id;
  });

  describe('GET /api/v1/accounts', () => {
    it('should get all accounts', async () => {
      const response = await request(app)
        .get('/api/v1/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should fail without authentication', async () => {
      await request(app).get('/api/v1/accounts').expect(401);
    });
  });

  describe('POST /api/v1/accounts', () => {
    it('should create a new account', async () => {
      const newAccount = {
        code: '1111',
        name: '現金',
        accountType: 'ASSET',
        parentId: parentAccountId,
      };

      const response = await request(app)
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newAccount)
        .expect(201);

      expect(response.body.data).toMatchObject({
        code: '1111',
        name: '現金',
        accountType: 'ASSET',
      });
    });

    it('should fail with duplicate code', async () => {
      const duplicateAccount = {
        code: '1111',
        name: '小口現金',
        accountType: 'ASSET',
      };

      const response = await request(app)
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(duplicateAccount)
        .expect(400);

      expect(response.body.error.code).toBe('DUPLICATE_CODE');
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });
});
