// Setup test environment variables first
import '../../test-utils/env-setup';

import { PartnerType, UserRole, User, Partner } from '@simple-bookkeeping/database';
import request from 'supertest';

import app from '../../index';
import { prisma } from '../../lib/prisma';
import {
  cleanupTestData,
  createFullTestSetup,
  createTestUser,
  generateTestToken,
} from '../../test-utils/test-helpers';

describe('PartnersController', () => {
  let testSetup: Awaited<ReturnType<typeof createFullTestSetup>>;
  let adminUser: User;
  let adminToken: string;
  let testPartner: Partner;

  beforeEach(async () => {
    await cleanupTestData();
    testSetup = await createFullTestSetup();
    // Create separate admin user for admin-only operations
    adminUser = await createTestUser(testSetup.organization.id, UserRole.ADMIN, {
      email: 'admin-partners@test.com',
    });
    adminToken = generateTestToken(adminUser.id, testSetup.organization.id, UserRole.ADMIN);

    // Create test partner
    testPartner = await prisma.partner.create({
      data: {
        code: 'C001',
        name: 'テスト顧客',
        nameKana: 'テストコキャク',
        partnerType: PartnerType.CUSTOMER,
        address: '東京都千代田区',
        phone: '03-1234-5678',
        email: 'test@customer.com',
        organizationId: testSetup.organization.id,
      },
    });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('GET /api/v1/partners', () => {
    it('should return all partners for organization', async () => {
      // Create additional test partner
      await prisma.partner.create({
        data: {
          code: 'V001',
          name: 'テスト仕入先',
          partnerType: PartnerType.VENDOR,
          organizationId: testSetup.organization.id,
        },
      });

      const response = await request(app)
        .get('/api/v1/partners')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('code');
      expect(response.body.data[0]).toHaveProperty('name');
      expect(response.body.data[0]).toHaveProperty('partnerType');
    });

    it('should filter by partner type', async () => {
      // Create vendor partner
      await prisma.partner.create({
        data: {
          code: 'V001',
          name: 'テスト仕入先',
          partnerType: PartnerType.VENDOR,
          organizationId: testSetup.organization.id,
        },
      });

      const response = await request(app)
        .get('/api/v1/partners')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({ type: PartnerType.CUSTOMER });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].partnerType).toBe(PartnerType.CUSTOMER);
    });

    it('should filter by active status', async () => {
      // Create inactive partner
      await prisma.partner.create({
        data: {
          code: 'V002',
          name: '廃止取引先',
          partnerType: PartnerType.VENDOR,
          isActive: false,
          organizationId: testSetup.organization.id,
        },
      });

      const response = await request(app)
        .get('/api/v1/partners')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({ active: 'false' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].isActive).toBe(false);
    });

    it('should search by name or code', async () => {
      await prisma.partner.create({
        data: {
          code: 'V001',
          name: '特殊商事',
          nameKana: 'トクシュショウジ',
          partnerType: PartnerType.VENDOR,
          organizationId: testSetup.organization.id,
        },
      });

      const response = await request(app)
        .get('/api/v1/partners')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({ search: '特殊' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('特殊商事');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/v1/partners');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/partners/:id', () => {
    it('should return partner by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/partners/${testPartner.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(testPartner.id);
      expect(response.body.data.code).toBe('C001');
      expect(response.body.data.name).toBe('テスト顧客');
    });

    it('should return 404 for non-existent partner', async () => {
      const response = await request(app)
        .get('/api/v1/partners/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should not return partner from different organization', async () => {
      // Create another organization and partner
      const otherOrg = await prisma.organization.create({
        data: {
          name: 'Other Org',
          code: 'OTHER',
        },
      });

      const otherPartner = await prisma.partner.create({
        data: {
          code: 'O001',
          name: 'Other Partner',
          partnerType: PartnerType.CUSTOMER,
          organizationId: otherOrg.id,
        },
      });

      const response = await request(app)
        .get(`/api/v1/partners/${otherPartner.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/partners', () => {
    it('should create partner with valid data', async () => {
      const partnerData = {
        code: 'C002',
        name: '新規顧客',
        nameKana: 'シンキコキャク',
        partnerType: 'CUSTOMER',
        address: '東京都渋谷区',
        phone: '03-9876-5432',
        email: 'new@customer.com',
        taxId: '1234567890123',
      };

      const response = await request(app)
        .post('/api/v1/partners')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(partnerData);

      expect(response.status).toBe(201);
      expect(response.body.data.code).toBe('C002');
      expect(response.body.data.name).toBe('新規顧客');
      expect(response.body.data.partnerType).toBe('CUSTOMER');
    });

    it('should prevent duplicate partner codes', async () => {
      const partnerData = {
        code: 'C001', // Duplicate code
        name: 'Duplicate Partner',
        partnerType: 'CUSTOMER',
      };

      const response = await request(app)
        .post('/api/v1/partners')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(partnerData);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('DUPLICATE_CODE');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: 'Missing Code',
        // Missing code and partnerType
      };

      const response = await request(app)
        .post('/api/v1/partners')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate email format', async () => {
      const partnerData = {
        code: 'C003',
        name: 'Invalid Email Partner',
        partnerType: 'CUSTOMER',
        email: 'invalid-email',
      };

      const response = await request(app)
        .post('/api/v1/partners')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(partnerData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should allow empty email', async () => {
      const partnerData = {
        code: 'C004',
        name: 'No Email Partner',
        partnerType: 'CUSTOMER',
        email: '',
      };

      const response = await request(app)
        .post('/api/v1/partners')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(partnerData);

      expect(response.status).toBe(201);
      expect(response.body.data.email).toBeNull();
    });

    it('should require ADMIN or ACCOUNTANT role', async () => {
      const viewerUser = await createTestUser(testSetup.organization.id, UserRole.VIEWER, {
        email: 'viewer-partners@test.com',
      });
      const viewerToken = generateTestToken(
        viewerUser.id,
        testSetup.organization.id,
        UserRole.VIEWER
      );

      const partnerData = {
        code: 'C005',
        name: 'Viewer Partner',
        partnerType: 'CUSTOMER',
      };

      const response = await request(app)
        .post('/api/v1/partners')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(partnerData);

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/v1/partners/:id', () => {
    it('should update partner properties', async () => {
      const updateData = {
        name: '更新済み顧客',
        address: '新しい住所',
        phone: '03-0000-0000',
      };

      const response = await request(app)
        .put(`/api/v1/partners/${testPartner.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('更新済み顧客');
      expect(response.body.data.address).toBe('新しい住所');
      expect(response.body.data.phone).toBe('03-0000-0000');
    });

    it('should prevent changing code to duplicate', async () => {
      // Create another partner
      await prisma.partner.create({
        data: {
          code: 'C099',
          name: 'Another Partner',
          partnerType: PartnerType.CUSTOMER,
          organizationId: testSetup.organization.id,
        },
      });

      const updateData = {
        code: 'C099', // Try to change to existing code
      };

      const response = await request(app)
        .put(`/api/v1/partners/${testPartner.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(updateData);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('DUPLICATE_CODE');
    });

    it('should update isActive status', async () => {
      const updateData = {
        isActive: false,
      };

      const response = await request(app)
        .put(`/api/v1/partners/${testPartner.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.data.isActive).toBe(false);
    });

    it('should return 404 for non-existent partner', async () => {
      const response = await request(app)
        .put('/api/v1/partners/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });

    it('should require ADMIN or ACCOUNTANT role', async () => {
      const viewerUser = await createTestUser(testSetup.organization.id, UserRole.VIEWER, {
        email: 'viewer-partners@test.com',
      });
      const viewerToken = generateTestToken(
        viewerUser.id,
        testSetup.organization.id,
        UserRole.VIEWER
      );

      const response = await request(app)
        .put(`/api/v1/partners/${testPartner.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'Updated' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/partners/:id', () => {
    it('should soft delete partner without transactions', async () => {
      const response = await request(app)
        .delete(`/api/v1/partners/${testPartner.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);

      // Verify soft delete
      const partner = await prisma.partner.findUnique({
        where: { id: testPartner.id },
      });
      expect(partner?.isActive).toBe(false);
    });

    it('should prevent deletion of partner with journal entries', async () => {
      // Create journal entry with partner
      await prisma.journalEntry.create({
        data: {
          entryNumber: 'JE001',
          entryDate: new Date(),
          description: 'Test Entry',
          accountingPeriodId: testSetup.accountingPeriod.id,
          partnerId: testPartner.id,
          createdById: testSetup.user.id,
          organizationId: testSetup.organization.id,
          lines: {
            create: [
              {
                accountId: testSetup.accounts.cash.id,
                debitAmount: 1000,
                creditAmount: 0,
                lineNumber: 1,
              },
              {
                accountId: testSetup.accounts.sales.id,
                debitAmount: 0,
                creditAmount: 1000,
                lineNumber: 2,
              },
            ],
          },
        },
      });

      const response = await request(app)
        .delete(`/api/v1/partners/${testPartner.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('HAS_JOURNAL_ENTRIES');
    });

    it('should return 404 for non-existent partner', async () => {
      const response = await request(app)
        .delete('/api/v1/partners/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    it('should require ADMIN role', async () => {
      const accountantUser = await createTestUser(testSetup.organization.id, UserRole.ACCOUNTANT, {
        email: 'accountant-partners@test.com',
      });
      const accountantToken = generateTestToken(
        accountantUser.id,
        testSetup.organization.id,
        UserRole.ACCOUNTANT
      );

      const response = await request(app)
        .delete(`/api/v1/partners/${testPartner.id}`)
        .set('Authorization', `Bearer ${accountantToken}`);

      expect(response.status).toBe(403);
    });
  });
});
