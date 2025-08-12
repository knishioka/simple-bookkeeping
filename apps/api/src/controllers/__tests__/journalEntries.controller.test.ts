// Setup test environment variables first
import '../../test-utils/env-setup';

import { JournalStatus, UserRole } from '@simple-bookkeeping/database';
import request from 'supertest';

import app from '../../index';
import { prisma } from '../../lib/prisma';
import {
  cleanupTestData,
  createFullTestSetup,
  createTestJournalEntry,
  generateTestToken,
  createTestUser,
  createTestAccountingPeriod,
} from '../../test-utils/test-helpers';

describe('JournalEntriesController', () => {
  let testSetup: Awaited<ReturnType<typeof createFullTestSetup>>;

  beforeEach(async () => {
    await cleanupTestData();
    testSetup = await createFullTestSetup();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('GET /api/v1/journal-entries', () => {
    it('should return paginated journal entries', async () => {
      // Create test entries
      await createTestJournalEntry(testSetup.organization.id, testSetup.accountingPeriod.id, true, {
        description: 'Entry 1',
      });
      await createTestJournalEntry(testSetup.organization.id, testSetup.accountingPeriod.id, true, {
        description: 'Entry 2',
      });

      const response = await request(app)
        .get('/api/v1/journal-entries')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({ page: '1', limit: '10' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta.total).toBe(2);
      expect(response.body.meta.page).toBe(1);
    });

    it('should filter by date range', async () => {
      await createTestJournalEntry(testSetup.organization.id, testSetup.accountingPeriod.id, true, {
        description: 'January Entry',
        entryDate: new Date('2024-01-15'),
      });
      await createTestJournalEntry(testSetup.organization.id, testSetup.accountingPeriod.id, true, {
        description: 'February Entry',
        entryDate: new Date('2024-02-15'),
      });

      const response = await request(app)
        .get('/api/v1/journal-entries')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          from: '2024-02-01',
          to: '2024-02-28',
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].description).toBe('February Entry');
    });

    it('should filter by status', async () => {
      await createTestJournalEntry(testSetup.organization.id, testSetup.accountingPeriod.id, true, {
        description: 'Draft Entry',
        status: JournalStatus.DRAFT,
      });
      await createTestJournalEntry(testSetup.organization.id, testSetup.accountingPeriod.id, true, {
        description: 'Approved Entry',
        status: JournalStatus.APPROVED,
      });

      const response = await request(app)
        .get('/api/v1/journal-entries')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({ status: JournalStatus.APPROVED });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe(JournalStatus.APPROVED);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/v1/journal-entries');

      expect(response.status).toBe(401);
    });

    it('should handle invalid query parameters', async () => {
      const response = await request(app)
        .get('/api/v1/journal-entries')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          page: 'invalid',
          limit: '999999',
        });

      expect(response.status).toBe(200);
      // Should use default values
      expect(response.body.meta.page).toBe(1);
    });
  });

  describe('POST /api/v1/journal-entries', () => {
    it('should create a balanced journal entry', async () => {
      const entryData = {
        entryDate: '2024-03-15',
        description: '売上計上',
        accountingPeriodId: testSetup.accountingPeriod.id,
        lines: [
          {
            accountId: testSetup.accounts.cash.id,
            debitAmount: 10000,
            creditAmount: 0,
            description: '現金受取',
          },
          {
            accountId: testSetup.accounts.sales.id,
            debitAmount: 0,
            creditAmount: 10000,
            description: '売上高',
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/journal-entries')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(entryData);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.description).toBe('売上計上');
      expect(response.body.data.lines).toHaveLength(2);
      expect(response.body.data.status).toBe(JournalStatus.DRAFT);
    });

    it('should reject unbalanced entries', async () => {
      const entryData = {
        entryDate: '2024-03-15',
        description: 'Unbalanced Entry',
        accountingPeriodId: testSetup.accountingPeriod.id,
        lines: [
          {
            accountId: testSetup.accounts.cash.id,
            debitAmount: 10000,
            creditAmount: 0,
            description: 'Debit',
          },
          {
            accountId: testSetup.accounts.sales.id,
            debitAmount: 0,
            creditAmount: 5000, // Unbalanced
            description: 'Credit',
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/journal-entries')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(entryData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate required fields', async () => {
      const entryData = {
        // Missing required fields
        lines: [],
      };

      const response = await request(app)
        .post('/api/v1/journal-entries')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(entryData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require at least 2 lines', async () => {
      const entryData = {
        entryDate: '2024-03-15',
        description: 'Invalid Entry',
        accountingPeriodId: testSetup.accountingPeriod.id,
        lines: [
          {
            accountId: testSetup.accounts.cash.id,
            debitAmount: 10000,
            creditAmount: 0,
            description: 'Single Line',
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/journal-entries')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(entryData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require ACCOUNTANT or ADMIN role', async () => {
      const viewerUser = await createTestUser(testSetup.organization.id, UserRole.VIEWER);
      const viewerToken = generateTestToken(
        viewerUser.id,
        testSetup.organization.id,
        UserRole.VIEWER
      );

      const entryData = {
        entryDate: '2024-03-15',
        description: 'Test Entry',
        accountingPeriodId: testSetup.accountingPeriod.id,
        lines: [
          {
            accountId: testSetup.accounts.cash.id,
            debitAmount: 1000,
            creditAmount: 0,
          },
          {
            accountId: testSetup.accounts.sales.id,
            debitAmount: 0,
            creditAmount: 1000,
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/journal-entries')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(entryData);

      expect(response.status).toBe(403);
    });

    it('should prevent entry for closed accounting period', async () => {
      // Create a closed period
      const closedPeriod = await createTestAccountingPeriod(testSetup.organization.id, {
        name: '2023年度',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        isClosed: true,
      });

      const entryData = {
        entryDate: '2023-06-15',
        description: 'Entry for Closed Period',
        accountingPeriodId: closedPeriod.id,
        lines: [
          {
            accountId: testSetup.accounts.cash.id,
            debitAmount: 1000,
            creditAmount: 0,
          },
          {
            accountId: testSetup.accounts.sales.id,
            debitAmount: 0,
            creditAmount: 1000,
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/journal-entries')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(entryData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('PERIOD_CLOSED');
    });
  });

  describe('PUT /api/v1/journal-entries/:id', () => {
    it('should update entry with valid data', async () => {
      const entry = await createTestJournalEntry(
        testSetup.organization.id,
        testSetup.accountingPeriod.id,
        true,
        { description: 'Original Entry' }
      );

      const updateData = {
        description: 'Updated Entry',
        lines: [
          {
            accountId: testSetup.accounts.cash.id,
            debitAmount: 2000,
            creditAmount: 0,
            description: 'Updated Cash',
          },
          {
            accountId: testSetup.accounts.sales.id,
            debitAmount: 0,
            creditAmount: 2000,
            description: 'Updated Sales',
          },
        ],
      };

      const response = await request(app)
        .put(`/api/v1/journal-entries/${entry.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.data.description).toBe('Updated Entry');
      expect(parseFloat(response.body.data.lines[0].debitAmount)).toBe(2000);
    });

    it('should prevent updating approved entries', async () => {
      const entry = await createTestJournalEntry(
        testSetup.organization.id,
        testSetup.accountingPeriod.id,
        true,
        {
          description: 'Approved Entry',
          status: JournalStatus.APPROVED,
        }
      );

      const updateData = {
        description: 'Try to Update Approved',
      };

      const response = await request(app)
        .put(`/api/v1/journal-entries/${entry.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('ENTRY_APPROVED');
    });

    it('should validate balance after update', async () => {
      const entry = await createTestJournalEntry(
        testSetup.organization.id,
        testSetup.accountingPeriod.id
      );

      const updateData = {
        lines: [
          {
            accountId: testSetup.accounts.cash.id,
            debitAmount: 1000,
            creditAmount: 0,
          },
          {
            accountId: testSetup.accounts.sales.id,
            debitAmount: 0,
            creditAmount: 500, // Unbalanced
          },
        ],
      };

      const response = await request(app)
        .put(`/api/v1/journal-entries/${entry.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent entry', async () => {
      const response = await request(app)
        .put('/api/v1/journal-entries/non-existent-id')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send({ description: 'Update' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/journal-entries/:id', () => {
    it('should soft delete entry', async () => {
      const entry = await createTestJournalEntry(
        testSetup.organization.id,
        testSetup.accountingPeriod.id
      );

      // Create ADMIN user for deletion
      const adminUser = await createTestUser(testSetup.organization.id, UserRole.ADMIN);
      const adminToken = generateTestToken(adminUser.id, testSetup.organization.id, UserRole.ADMIN);

      const response = await request(app)
        .delete(`/api/v1/journal-entries/${entry.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.message).toContain('削除');

      // Verify deletion
      const deletedEntry = await prisma.journalEntry.findUnique({
        where: { id: entry.id },
      });
      expect(deletedEntry).toBeNull();
    });

    it('should prevent deletion of approved entries', async () => {
      const entry = await createTestJournalEntry(
        testSetup.organization.id,
        testSetup.accountingPeriod.id,
        true,
        { status: JournalStatus.APPROVED }
      );

      // Create ADMIN user for deletion attempt
      const adminUser = await createTestUser(testSetup.organization.id, UserRole.ADMIN);
      const adminToken = generateTestToken(adminUser.id, testSetup.organization.id, UserRole.ADMIN);

      const response = await request(app)
        .delete(`/api/v1/journal-entries/${entry.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('ENTRY_APPROVED');
    });

    it('should require ADMIN role for deletion', async () => {
      const entry = await createTestJournalEntry(
        testSetup.organization.id,
        testSetup.accountingPeriod.id
      );

      // Try with ACCOUNTANT role (testSetup user is ACCOUNTANT)
      const response = await request(app)
        .delete(`/api/v1/journal-entries/${entry.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      // ACCOUNTANT should not be able to delete
      expect(response.status).toBe(403);

      // Create ADMIN user and try again
      const adminUser = await createTestUser(testSetup.organization.id, UserRole.ADMIN);
      const adminToken = generateTestToken(adminUser.id, testSetup.organization.id, UserRole.ADMIN);

      const adminResponse = await request(app)
        .delete(`/api/v1/journal-entries/${entry.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminResponse.status).toBe(200);
    });
  });

  describe('POST /api/v1/journal-entries/:id/approve', () => {
    it('should approve a draft entry', async () => {
      const entry = await createTestJournalEntry(
        testSetup.organization.id,
        testSetup.accountingPeriod.id,
        true,
        { status: JournalStatus.DRAFT }
      );

      const response = await request(app)
        .post(`/api/v1/journal-entries/${entry.id}/approve`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(JournalStatus.APPROVED);
    });

    it('should require ACCOUNTANT or ADMIN role', async () => {
      const entry = await createTestJournalEntry(
        testSetup.organization.id,
        testSetup.accountingPeriod.id
      );

      const viewerUser = await createTestUser(testSetup.organization.id, UserRole.VIEWER);
      const viewerToken = generateTestToken(
        viewerUser.id,
        testSetup.organization.id,
        UserRole.VIEWER
      );

      const response = await request(app)
        .post(`/api/v1/journal-entries/${entry.id}/approve`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(403);
    });

    it('should prevent approving unbalanced entry', async () => {
      const entry = await createTestJournalEntry(
        testSetup.organization.id,
        testSetup.accountingPeriod.id,
        false // Unbalanced
      );

      const response = await request(app)
        .post(`/api/v1/journal-entries/${entry.id}/approve`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('UNBALANCED_ENTRY');
    });
  });

  describe('POST /api/v1/journal-entries/upload-csv', () => {
    it('should create entries from valid CSV', async () => {
      const csvContent = `entryDate,description,accountCode,debitAmount,creditAmount
2024-03-15,売上計上,${testSetup.accounts.cash.code},10000,0
2024-03-15,売上計上,${testSetup.accounts.sales.code},0,10000
2024-03-16,仕入計上,${testSetup.accounts.expense.code},5000,0
2024-03-16,仕入計上,${testSetup.accounts.cash.code},0,5000`;

      const response = await request(app)
        .post('/api/v1/journal-entries/upload-csv')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .attach('file', Buffer.from(csvContent), 'entries.csv')
        .field('accountingPeriodId', testSetup.accountingPeriod.id);

      expect(response.status).toBe(201);
      expect(response.body.data.created).toBe(2);
      expect(response.body.data.errors).toHaveLength(0);
    });

    it('should handle invalid CSV format', async () => {
      const invalidCsv = `invalid,format
missing,required,columns`;

      const response = await request(app)
        .post('/api/v1/journal-entries/upload-csv')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .attach('file', Buffer.from(invalidCsv), 'invalid.csv')
        .field('accountingPeriodId', testSetup.accountingPeriod.id);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_CSV_FORMAT');
    });

    it('should require file upload', async () => {
      const response = await request(app)
        .post('/api/v1/journal-entries/upload-csv')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .field('accountingPeriodId', testSetup.accountingPeriod.id);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('ファイル');
    });
  });
});
