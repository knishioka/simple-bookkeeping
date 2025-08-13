// Setup test environment variables first
import '../../test-utils/env-setup';

import { UserRole } from '@simple-bookkeeping/database';
import request from 'supertest';

import app from '../../index';
import { prisma } from '../../lib/prisma';
import {
  cleanupTestData,
  createFullTestSetup,
  createTestUser,
  generateTestToken,
} from '../../test-utils/test-helpers';

describe('AuditLogController', () => {
  let testSetup: Awaited<ReturnType<typeof createFullTestSetup>>;
  let adminToken: string;

  beforeEach(async () => {
    await cleanupTestData();
    testSetup = await createFullTestSetup();

    // Create admin user for audit log access
    const adminUser = await createTestUser(testSetup.organization.id, UserRole.ADMIN);
    adminToken = generateTestToken(adminUser.id, testSetup.organization.id, UserRole.ADMIN);

    // Create some audit logs
    await prisma.auditLog.create({
      data: {
        organizationId: testSetup.organization.id,
        userId: testSetup.user.id,
        action: 'CREATE',
        entityType: 'JournalEntry',
        entityId: 'test-entity-1',
        newValues: { description: 'Created journal entry' },
        ipAddress: '127.0.0.1',
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: testSetup.organization.id,
        userId: testSetup.user.id,
        action: 'UPDATE',
        entityType: 'Account',
        entityId: 'test-entity-2',
        oldValues: { name: 'Original name' },
        newValues: { name: 'Updated name' },
        ipAddress: '127.0.0.1',
      },
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('GET /api/v1/audit-logs', () => {
    it('should return audit logs for admin users', async () => {
      // Verify audit logs were created
      const auditLogs = await prisma.auditLog.findMany({
        where: { organizationId: testSetup.organization.id },
      });
      expect(auditLogs).toHaveLength(2);

      const response = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('action');
      expect(response.body.data[0]).toHaveProperty('entityType');
      expect(response.body.data[0]).toHaveProperty('userId');
    });

    it('should filter by action type', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ action: 'CREATE' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].action).toBe('CREATE');
    });

    it('should filter by entity type', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ entityType: 'Account' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].entityType).toBe('Account');
    });

    it('should filter by date range', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: yesterday.toISOString(),
          endDate: tomorrow.toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 1 });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(1);
      expect(response.body.meta.total).toBe(2);
    });

    it('should require ADMIN role', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${testSetup.token}`); // ACCOUNTANT token

      expect(response.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/v1/audit-logs');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/audit-logs/:id', () => {
    it('should return specific audit log details', async () => {
      const log = await prisma.auditLog.findFirst({
        where: { organizationId: testSetup.organization.id },
      });

      const response = await request(app)
        .get(`/api/v1/audit-logs/${log?.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(log?.id);
      expect(response.body.data).toHaveProperty('newValues');
    });

    it('should return 404 for non-existent log', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    it('should require ADMIN role', async () => {
      const log = await prisma.auditLog.findFirst();

      const response = await request(app)
        .get(`/api/v1/audit-logs/${log?.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/audit-logs/export', () => {
    it('should export audit logs as CSV', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ format: 'csv' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('audit-logs');
    });

    it('should export audit logs as JSON', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ format: 'json' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should apply filters to export', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          format: 'json',
          action: 'CREATE',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].action).toBe('CREATE');
    });

    it('should require ADMIN role', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs/export')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({ format: 'csv' });

      expect(response.status).toBe(403);
    });
  });

  describe('Audit log creation on actions', () => {
    it.skip('should create audit log on journal entry creation', async () => {
      const entryData = {
        entryDate: '2024-03-15',
        description: 'Test Entry for Audit',
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

      await request(app)
        .post('/api/v1/journal-entries')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(entryData);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityType: 'JournalEntry',
          action: 'CREATE',
          userId: testSetup.user.id,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.newValues).toEqual(
        expect.objectContaining({
          description: 'Test Entry for Audit',
        })
      );
    });

    it.skip('should create audit log on account update', async () => {
      const updateData = {
        name: 'Updated Account Name',
      };

      await request(app)
        .put(`/api/v1/accounts/${testSetup.accounts.cash.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(updateData);

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          entityType: 'Account',
          entityId: testSetup.accounts.cash.id,
          action: 'UPDATE',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditLog).not.toBeNull();
    });
  });
});
