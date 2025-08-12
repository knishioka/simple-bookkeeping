// Setup test environment variables first
import '../../test-utils/env-setup';

import { AccountType, UserRole } from '@simple-bookkeeping/database';
import request from 'supertest';

import app from '../../index';
import { prisma } from '../../lib/prisma';
import {
  cleanupTestData,
  createFullTestSetup,
  createTestAccount,
  generateTestToken,
  createTestUser,
} from '../../test-utils/test-helpers';

describe('AccountsController', () => {
  let testSetup: Awaited<ReturnType<typeof createFullTestSetup>>;

  beforeEach(async () => {
    await cleanupTestData();
    testSetup = await createFullTestSetup();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('GET /api/v1/accounts', () => {
    it('should return all accounts for organization', async () => {
      // Additional test accounts
      await createTestAccount(testSetup.organization.id, {
        code: '2001',
        name: '売掛金',
        accountType: AccountType.ASSET,
      });

      const response = await request(app)
        .get('/api/v1/accounts')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(4); // 3 from setup + 1 additional
      expect(response.body.data[0]).toHaveProperty('code');
      expect(response.body.data[0]).toHaveProperty('name');
      expect(response.body.data[0]).toHaveProperty('accountType');
    });

    it('should filter by account type', async () => {
      const response = await request(app)
        .get('/api/v1/accounts')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({ accountType: AccountType.ASSET });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1); // Only cash account
      expect(response.body.data[0].accountType).toBe(AccountType.ASSET);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/v1/accounts')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({ accountType: AccountType.REVENUE });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2); // sales and services accounts
      expect(response.body.data[0].accountType).toBe(AccountType.REVENUE);
    });

    it('should filter by active status', async () => {
      // Create inactive account
      await createTestAccount(testSetup.organization.id, {
        code: '9999',
        name: '廃止勘定',
        accountType: AccountType.ASSET,
        isActive: false,
      });

      const response = await request(app)
        .get('/api/v1/accounts')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({ isActive: 'false' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].isActive).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/v1/accounts');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/accounts', () => {
    it('should create account with valid data', async () => {
      const accountData = {
        code: '3001',
        name: '買掛金',
        accountType: AccountType.LIABILITY,
        description: 'Trade payables',
      };

      const response = await request(app)
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(accountData);

      expect(response.status).toBe(201);
      expect(response.body.data.code).toBe('3001');
      expect(response.body.data.name).toBe('買掛金');
    });

    it('should prevent duplicate account codes', async () => {
      const accountData = {
        code: testSetup.accounts.cash.code, // Duplicate code
        name: 'Duplicate Account',
        accountType: AccountType.ASSET,
      };

      const response = await request(app)
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(accountData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('DUPLICATE_ACCOUNT_CODE');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: 'Missing Code Account',
        // Missing code and accountType
      };

      const response = await request(app)
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate account type', async () => {
      const invalidData = {
        code: '4001',
        name: 'Invalid Type',
        accountType: 'INVALID_TYPE', // Invalid account type
      };

      const response = await request(app)
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require ACCOUNTANT or ADMIN role', async () => {
      const viewerUser = await createTestUser(testSetup.organization.id, UserRole.VIEWER);
      const viewerToken = generateTestToken(viewerUser.id, testSetup.organization.id);

      const accountData = {
        code: '3001',
        name: 'Test Account',
        accountType: AccountType.ASSET,
      };

      const response = await request(app)
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(accountData);

      expect(response.status).toBe(403);
    });

    it('should handle parent account hierarchy', async () => {
      const parentAccount = await createTestAccount(testSetup.organization.id, {
        code: '1000',
        name: '流動資産',
        accountType: AccountType.ASSET,
      });

      const childAccountData = {
        code: '1100',
        name: '現金預金',
        accountType: AccountType.ASSET,
        parentId: parentAccount.id,
      };

      const response = await request(app)
        .post('/api/v1/accounts')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(childAccountData);

      expect(response.status).toBe(201);
      expect(response.body.data.parentId).toBe(parentAccount.id);
    });
  });

  describe('PUT /api/v1/accounts/:id', () => {
    it('should update account properties', async () => {
      const account = await createTestAccount(testSetup.organization.id, {
        code: '4001',
        name: 'Original Name',
        accountType: AccountType.REVENUE,
      });

      const updateData = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const response = await request(app)
        .put(`/api/v1/accounts/${account.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.description).toBe('Updated description');
      expect(response.body.data.code).toBe('4001'); // Code unchanged
    });

    it('should prevent changing account code', async () => {
      const account = await createTestAccount(testSetup.organization.id);

      const updateData = {
        code: 'NEW-CODE', // Trying to change code
      };

      const response = await request(app)
        .put(`/api/v1/accounts/${account.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('CODE_CHANGE_NOT_ALLOWED');
    });

    it('should prevent updating account with existing journal entries', async () => {
      // Create account with journal entries
      const account = testSetup.accounts.cash;

      const updateData = {
        accountType: AccountType.LIABILITY, // Try to change type
      };

      const response = await request(app)
        .put(`/api/v1/accounts/${account.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('ACCOUNT_HAS_TRANSACTIONS');
    });

    it('should return 404 for non-existent account', async () => {
      const response = await request(app)
        .put('/api/v1/accounts/non-existent-id')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send({ name: 'Update' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/accounts/:id', () => {
    it('should soft delete account without transactions', async () => {
      const account = await createTestAccount(testSetup.organization.id, {
        code: '9001',
        name: 'Deletable Account',
        accountType: AccountType.ASSET,
      });

      const response = await request(app)
        .delete(`/api/v1/accounts/${account.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('削除されました');

      // Verify deletion
      const deletedAccount = await prisma.account.findUnique({
        where: { id: account.id },
      });
      expect(deletedAccount).toBeNull();
    });

    it('should prevent deletion of account with transactions', async () => {
      // testSetup.accounts.cash has transactions from setup
      const response = await request(app)
        .delete(`/api/v1/accounts/${testSetup.accounts.cash.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('ACCOUNT_HAS_TRANSACTIONS');
    });

    it('should require ADMIN role for deletion', async () => {
      const account = await createTestAccount(testSetup.organization.id);

      // Try with ACCOUNTANT role
      const response = await request(app)
        .delete(`/api/v1/accounts/${account.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(403);

      // Try with ADMIN role
      const adminUser = await createTestUser(testSetup.organization.id, UserRole.ADMIN);
      const adminToken = generateTestToken(adminUser.id, testSetup.organization.id);

      const adminResponse = await request(app)
        .delete(`/api/v1/accounts/${account.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminResponse.status).toBe(200);
    });
  });

  describe('GET /api/v1/accounts/:id', () => {
    it('should return account details with balance', async () => {
      const response = await request(app)
        .get(`/api/v1/accounts/${testSetup.accounts.cash.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(testSetup.accounts.cash.id);
      expect(response.body.data.code).toBe(testSetup.accounts.cash.code);
      expect(response.body.data).toHaveProperty('balance');
    });

    it('should return 404 for non-existent account', async () => {
      const response = await request(app)
        .get('/api/v1/accounts/non-existent-id')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(404);
    });

    it('should not return accounts from other organizations', async () => {
      // Create another organization with account
      const otherOrg = await testSetup.organization;
      const otherAccount = await createTestAccount(otherOrg.id);

      // Create a different organization user
      const differentOrg = await prisma.organization.create({
        data: { name: 'Different Org', code: 'DIFF' },
      });
      const differentUser = await createTestUser(differentOrg.id);
      const differentToken = generateTestToken(differentUser.id, differentOrg.id);

      const response = await request(app)
        .get(`/api/v1/accounts/${otherAccount.id}`)
        .set('Authorization', `Bearer ${differentToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/accounts/import', () => {
    it('should import accounts from CSV', async () => {
      const csvContent = `code,name,accountType
6001,給与手当,EXPENSE
6002,地代家賃,EXPENSE
6003,通信費,EXPENSE`;

      const response = await request(app)
        .post('/api/v1/accounts/import')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .attach('file', Buffer.from(csvContent), 'accounts.csv');

      expect(response.status).toBe(201);
      expect(response.body.data.imported).toBe(3);
      expect(response.body.data.errors).toHaveLength(0);
    });

    it('should handle duplicate codes in CSV', async () => {
      const csvContent = `code,name,accountType
${testSetup.accounts.cash.code},Duplicate,ASSET
7001,Valid Account,EXPENSE`;

      const response = await request(app)
        .post('/api/v1/accounts/import')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .attach('file', Buffer.from(csvContent), 'accounts.csv');

      expect(response.status).toBe(201);
      expect(response.body.data.imported).toBe(1);
      expect(response.body.data.errors).toHaveLength(1);
      expect(response.body.data.errors[0]).toContain(testSetup.accounts.cash.code);
    });

    it('should validate CSV format', async () => {
      const invalidCsv = `invalid,format
missing,required,columns`;

      const response = await request(app)
        .post('/api/v1/accounts/import')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .attach('file', Buffer.from(invalidCsv), 'invalid.csv');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_CSV_FORMAT');
    });
  });
});
