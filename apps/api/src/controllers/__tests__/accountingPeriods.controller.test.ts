// Setup test environment variables first
import '../../test-utils/env-setup';

import { UserRole } from '@simple-bookkeeping/database';
import request from 'supertest';

import app from '../../index';
import { prisma } from '../../lib/prisma';
import {
  cleanupTestData,
  createFullTestSetup,
  createTestAccountingPeriod,
  createTestJournalEntry,
  generateTestToken,
  createTestUser,
} from '../../test-utils/test-helpers';

describe('AccountingPeriodsController', () => {
  let testSetup: Awaited<ReturnType<typeof createFullTestSetup>>;

  beforeEach(async () => {
    await cleanupTestData();
    testSetup = await createFullTestSetup();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('GET /api/v1/accounting-periods', () => {
    it('should return all accounting periods for organization', async () => {
      // Create additional period
      await createTestAccountingPeriod(testSetup.organization.id, {
        name: '2025年度',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      });

      const response = await request(app)
        .get('/api/v1/accounting-periods')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('name');
      expect(response.body.data[0]).toHaveProperty('startDate');
      expect(response.body.data[0]).toHaveProperty('endDate');
      expect(response.body.data[0]).toHaveProperty('isClosed');
    });

    it('should filter by active status', async () => {
      // Create closed period
      await createTestAccountingPeriod(testSetup.organization.id, {
        name: '2023年度',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        isClosed: true,
      });

      const response = await request(app)
        .get('/api/v1/accounting-periods')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({ isClosed: 'false' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].isClosed).toBe(false);
    });

    it('should return current period', async () => {
      const response = await request(app)
        .get('/api/v1/accounting-periods/current')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(testSetup.accountingPeriod.id);
      expect(response.body.data.isClosed).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/v1/accounting-periods');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/accounting-periods', () => {
    it('should create non-overlapping period', async () => {
      const periodData = {
        name: '2025年度',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      };

      const response = await request(app)
        .post('/api/v1/accounting-periods')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(periodData);

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('2025年度');
      expect(response.body.data.isClosed).toBe(false);
    });

    it('should prevent overlapping periods', async () => {
      const overlappingData = {
        name: 'Overlapping Period',
        startDate: '2024-06-01', // Overlaps with existing 2024 period
        endDate: '2024-12-31',
      };

      const response = await request(app)
        .post('/api/v1/accounting-periods')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(overlappingData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('PERIOD_OVERLAP');
    });

    it('should validate date range', async () => {
      const invalidData = {
        name: 'Invalid Period',
        startDate: '2025-12-31',
        endDate: '2025-01-01', // End before start
      };

      const response = await request(app)
        .post('/api/v1/accounting-periods')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_DATE_RANGE');
    });

    it('should require ACCOUNTANT or ADMIN role', async () => {
      const viewerUser = await createTestUser(testSetup.organization.id, UserRole.VIEWER);
      const viewerToken = generateTestToken(
        viewerUser.id,
        testSetup.organization.id,
        UserRole.VIEWER
      );

      const periodData = {
        name: '2025年度',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      };

      const response = await request(app)
        .post('/api/v1/accounting-periods')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(periodData);

      expect(response.status).toBe(403);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: 'Missing Dates',
        // Missing startDate and endDate
      };

      const response = await request(app)
        .post('/api/v1/accounting-periods')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/v1/accounting-periods/:id', () => {
    it('should update period properties', async () => {
      const period = await createTestAccountingPeriod(testSetup.organization.id, {
        name: '2025年度',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      });

      const updateData = {
        name: '2025年度（更新済み）',
      };

      const response = await request(app)
        .put(`/api/v1/accounting-periods/${period.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('2025年度（更新済み）');
    });

    it('should prevent updating closed period', async () => {
      const closedPeriod = await createTestAccountingPeriod(testSetup.organization.id, {
        name: '2023年度',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        isClosed: true,
      });

      const updateData = {
        name: 'Try to Update Closed',
      };

      const response = await request(app)
        .put(`/api/v1/accounting-periods/${closedPeriod.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('PERIOD_CLOSED');
    });

    it('should prevent date changes that create overlap', async () => {
      const period2025 = await createTestAccountingPeriod(testSetup.organization.id, {
        name: '2025年度',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      });

      const updateData = {
        startDate: '2024-06-01', // Would overlap with 2024 period
      };

      const response = await request(app)
        .put(`/api/v1/accounting-periods/${period2025.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('PERIOD_OVERLAP');
    });

    it('should return 404 for non-existent period', async () => {
      const response = await request(app)
        .put('/api/v1/accounting-periods/non-existent-id')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send({ name: 'Update' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/accounting-periods/:id/close', () => {
    it('should close period with validation', async () => {
      const response = await request(app)
        .post(`/api/v1/accounting-periods/${testSetup.accountingPeriod.id}/close`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isClosed).toBe(true);
      expect(response.body.data.closedAt).not.toBeNull();
    });

    it('should prevent closing period with unapproved entries', async () => {
      // Create draft entry
      await createTestJournalEntry(testSetup.organization.id, testSetup.accountingPeriod.id, true, {
        status: 'DRAFT' as any,
      });

      const response = await request(app)
        .post(`/api/v1/accounting-periods/${testSetup.accountingPeriod.id}/close`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('UNAPPROVED_ENTRIES_EXIST');
    });

    it('should prevent closing already closed period', async () => {
      const closedPeriod = await createTestAccountingPeriod(testSetup.organization.id, {
        name: '2023年度',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        isClosed: true,
      });

      const response = await request(app)
        .post(`/api/v1/accounting-periods/${closedPeriod.id}/close`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('PERIOD_ALREADY_CLOSED');
    });

    it('should require ADMIN role for closing', async () => {
      // ACCOUNTANT should not be able to close
      const response = await request(app)
        .post(`/api/v1/accounting-periods/${testSetup.accountingPeriod.id}/close`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(403);

      // ADMIN should be able to close
      const adminUser = await createTestUser(testSetup.organization.id, UserRole.ADMIN);
      const adminToken = generateTestToken(adminUser.id, testSetup.organization.id, UserRole.ADMIN);

      const adminResponse = await request(app)
        .post(`/api/v1/accounting-periods/${testSetup.accountingPeriod.id}/close`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminResponse.status).toBe(200);
    });
  });

  describe('POST /api/v1/accounting-periods/:id/reopen', () => {
    it('should reopen closed period', async () => {
      const closedPeriod = await createTestAccountingPeriod(testSetup.organization.id, {
        name: '2023年度',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        isClosed: true,
      });

      const adminUser = await createTestUser(testSetup.organization.id, UserRole.ADMIN);
      const adminToken = generateTestToken(adminUser.id, testSetup.organization.id, UserRole.ADMIN);

      const response = await request(app)
        .post(`/api/v1/accounting-periods/${closedPeriod.id}/reopen`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isClosed).toBe(false);
      expect(response.body.data.closedAt).toBeNull();
    });

    it('should prevent reopening open period', async () => {
      const adminUser = await createTestUser(testSetup.organization.id, UserRole.ADMIN);
      const adminToken = generateTestToken(adminUser.id, testSetup.organization.id, UserRole.ADMIN);

      const response = await request(app)
        .post(`/api/v1/accounting-periods/${testSetup.accountingPeriod.id}/reopen`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('PERIOD_NOT_CLOSED');
    });

    it('should require ADMIN role for reopening', async () => {
      const closedPeriod = await createTestAccountingPeriod(testSetup.organization.id, {
        name: '2023年度',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        isClosed: true,
      });

      const response = await request(app)
        .post(`/api/v1/accounting-periods/${closedPeriod.id}/reopen`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/accounting-periods/:id', () => {
    it('should delete period without entries', async () => {
      const emptyPeriod = await createTestAccountingPeriod(testSetup.organization.id, {
        name: '2025年度',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      });

      const adminUser = await createTestUser(testSetup.organization.id, UserRole.ADMIN);
      const adminToken = generateTestToken(adminUser.id, testSetup.organization.id, UserRole.ADMIN);

      const response = await request(app)
        .delete(`/api/v1/accounting-periods/${emptyPeriod.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('削除されました');
    });

    it('should prevent deletion of period with entries', async () => {
      // Create entry in period
      await createTestJournalEntry(testSetup.organization.id, testSetup.accountingPeriod.id);

      const adminUser = await createTestUser(testSetup.organization.id, UserRole.ADMIN);
      const adminToken = generateTestToken(adminUser.id, testSetup.organization.id, UserRole.ADMIN);

      const response = await request(app)
        .delete(`/api/v1/accounting-periods/${testSetup.accountingPeriod.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('PERIOD_HAS_ENTRIES');
    });

    it('should require ADMIN role for deletion', async () => {
      const period = await createTestAccountingPeriod(testSetup.organization.id, {
        name: '2025年度',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      });

      const response = await request(app)
        .delete(`/api/v1/accounting-periods/${period.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/accounting-periods/:id/summary', () => {
    it('should return period summary with statistics', async () => {
      // Create some entries
      await createTestJournalEntry(testSetup.organization.id, testSetup.accountingPeriod.id);
      await createTestJournalEntry(testSetup.organization.id, testSetup.accountingPeriod.id);

      const response = await request(app)
        .get(`/api/v1/accounting-periods/${testSetup.accountingPeriod.id}/summary`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('totalEntries');
      expect(response.body.data).toHaveProperty('totalDebits');
      expect(response.body.data).toHaveProperty('totalCredits');
      expect(response.body.data.totalEntries).toBe(2);
    });

    it('should return 404 for non-existent period', async () => {
      const response = await request(app)
        .get('/api/v1/accounting-periods/non-existent-id/summary')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(404);
    });
  });
});
