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
      expect(response.body.data[0]).toHaveProperty('isActive');
    });

    it('should filter by active status', async () => {
      // Create inactive period
      await createTestAccountingPeriod(testSetup.organization.id, {
        name: '2023年度',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        isClosed: true,
      });

      const response = await request(app)
        .get('/api/v1/accounting-periods')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({ isActive: 'true' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].isActive).toBe(true);
    });

    it('should return active period', async () => {
      const response = await request(app)
        .get('/api/v1/accounting-periods/active')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(testSetup.accountingPeriod.id);
      expect(response.body.data.isActive).toBe(true);
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
      expect(response.body.data.isActive).toBeDefined();
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

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('期間が重複');
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
      expect(response.body.error).toBeDefined();
      expect(response.body.details).toBeDefined();
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
      expect(response.body.error).toContain('バリデーションエラー');
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

    it('should allow updating inactive period', async () => {
      const inactivePeriod = await createTestAccountingPeriod(testSetup.organization.id, {
        name: '2023年度',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31'),
        isClosed: true,
      });

      const updateData = {
        name: 'Updated 2023年度',
      };

      const response = await request(app)
        .put(`/api/v1/accounting-periods/${inactivePeriod.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated 2023年度');
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

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('期間が重複');
    });

    it('should return 404 for non-existent period', async () => {
      const response = await request(app)
        .put('/api/v1/accounting-periods/non-existent-id')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send({ name: 'Update' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/accounting-periods/:id/activate', () => {
    it('should activate period', async () => {
      const inactivePeriod = await createTestAccountingPeriod(testSetup.organization.id, {
        name: '2025年度',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        isClosed: true,
      });

      const adminUser = await createTestUser(testSetup.organization.id, UserRole.ADMIN);
      const adminToken = generateTestToken(adminUser.id, testSetup.organization.id, UserRole.ADMIN);

      const response = await request(app)
        .post(`/api/v1/accounting-periods/${inactivePeriod.id}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isActive).toBe(true);
    });

    it('should require ADMIN role for activation', async () => {
      const inactivePeriod = await createTestAccountingPeriod(testSetup.organization.id, {
        name: '2025年度',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        isClosed: true,
      });

      // ACCOUNTANT should not be able to activate
      const response = await request(app)
        .post(`/api/v1/accounting-periods/${inactivePeriod.id}/activate`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent period', async () => {
      const adminUser = await createTestUser(testSetup.organization.id, UserRole.ADMIN);
      const adminToken = generateTestToken(adminUser.id, testSetup.organization.id, UserRole.ADMIN);

      const response = await request(app)
        .post('/api/v1/accounting-periods/non-existent-id/activate')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/accounting-periods/:id', () => {
    it('should delete period without entries', async () => {
      const emptyPeriod = await createTestAccountingPeriod(testSetup.organization.id, {
        name: '2025年度',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        isClosed: true, // Make it inactive so it can be deleted
      });

      // Using ACCOUNTANT role (testSetup.token)
      const response = await request(app)
        .delete(`/api/v1/accounting-periods/${emptyPeriod.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(204);
    });

    it('should prevent deletion of period with entries', async () => {
      // Create entry in period
      await createTestJournalEntry(testSetup.organization.id, testSetup.accountingPeriod.id);

      const response = await request(app)
        .delete(`/api/v1/accounting-periods/${testSetup.accountingPeriod.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should require ACCOUNTANT or ADMIN role for deletion', async () => {
      const period = await createTestAccountingPeriod(testSetup.organization.id, {
        name: '2025年度',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      });

      // VIEWER should not be able to delete
      const viewerUser = await createTestUser(testSetup.organization.id, UserRole.VIEWER);
      const viewerToken = generateTestToken(
        viewerUser.id,
        testSetup.organization.id,
        UserRole.VIEWER
      );

      const response = await request(app)
        .delete(`/api/v1/accounting-periods/${period.id}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/accounting-periods with summary', () => {
    it('should return periods with summary when includeSummary is true', async () => {
      // Create some entries
      await createTestJournalEntry(testSetup.organization.id, testSetup.accountingPeriod.id);
      await createTestJournalEntry(testSetup.organization.id, testSetup.accountingPeriod.id);

      const response = await request(app)
        .get('/api/v1/accounting-periods')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({ includeSummary: 'true' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toHaveProperty('journalEntryCount');
      expect(response.body.data[0]).toHaveProperty('totalDebit');
      expect(response.body.data[0]).toHaveProperty('totalCredit');
      expect(response.body.data[0].journalEntryCount).toBe(2);
    });
  });
});
