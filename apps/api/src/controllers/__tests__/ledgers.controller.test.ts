// Setup test environment variables first
import '../../test-utils/env-setup';

import { JournalStatus } from '@simple-bookkeeping/database';
import request from 'supertest';

import app from '../../index';
import { prisma } from '../../lib/prisma';
import {
  cleanupTestData,
  createFullTestSetup,
  createTestJournalEntry,
} from '../../test-utils/test-helpers';

describe('LedgersController', () => {
  let testSetup: Awaited<ReturnType<typeof createFullTestSetup>>;

  beforeEach(async () => {
    await cleanupTestData();
    testSetup = await createFullTestSetup();

    // Create some journal entries for ledger
    await createTestJournalEntry(testSetup.organization.id, testSetup.accountingPeriod.id, true, {
      entryDate: new Date('2024-01-15'),
      description: 'Opening balance',
      status: JournalStatus.APPROVED,
      lines: [
        {
          accountId: testSetup.accounts.cash.id,
          debitAmount: 100000,
          creditAmount: 0,
        },
        {
          accountId: testSetup.accounts.sales.id,
          debitAmount: 0,
          creditAmount: 100000,
        },
      ],
    });

    await createTestJournalEntry(testSetup.organization.id, testSetup.accountingPeriod.id, true, {
      entryDate: new Date('2024-02-15'),
      description: 'Sales transaction',
      status: JournalStatus.APPROVED,
      lines: [
        {
          accountId: testSetup.accounts.cash.id,
          debitAmount: 50000,
          creditAmount: 0,
        },
        {
          accountId: testSetup.accounts.sales.id,
          debitAmount: 0,
          creditAmount: 50000,
        },
      ],
    });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('GET /api/v1/ledgers/general', () => {
    it('should return general ledger entries', async () => {
      const response = await request(app)
        .get('/api/v1/ledgers/general')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('account');
      expect(response.body.data[0]).toHaveProperty('entries');
    });

    it('should filter by date range', async () => {
      const response = await request(app)
        .get('/api/v1/ledgers/general')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          from: '2024-02-01',
          to: '2024-02-28',
        });

      expect(response.status).toBe(200);
      // Should only include February entries
      const cashLedger = response.body.data.find(
        (l: { account: { id: string } }) => l.account.id === testSetup.accounts.cash.id
      );
      expect(cashLedger.entries).toHaveLength(1);
      expect(cashLedger.entries[0].description).toContain('Sales transaction');
    });

    it('should filter by account', async () => {
      const response = await request(app)
        .get('/api/v1/ledgers/general')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          accountId: testSetup.accounts.cash.id,
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].account.id).toBe(testSetup.accounts.cash.id);
    });

    it('should include running balance', async () => {
      const response = await request(app)
        .get('/api/v1/ledgers/general')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          accountId: testSetup.accounts.cash.id,
        });

      expect(response.status).toBe(200);
      const entries = response.body.data[0].entries;
      expect(entries[0]).toHaveProperty('runningBalance');
      expect(entries[1].runningBalance).toBe(150000); // 100000 + 50000
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/v1/ledgers/general');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/ledgers/subsidiary/:accountId', () => {
    it('should return subsidiary ledger for specific account', async () => {
      const response = await request(app)
        .get(`/api/v1/ledgers/subsidiary/${testSetup.accounts.cash.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.account.id).toBe(testSetup.accounts.cash.id);
      expect(response.body.data.entries).toHaveLength(2);
      expect(response.body.data).toHaveProperty('openingBalance');
      expect(response.body.data).toHaveProperty('closingBalance');
      expect(response.body.data).toHaveProperty('totalDebits');
      expect(response.body.data).toHaveProperty('totalCredits');
    });

    it('should calculate correct balances', async () => {
      const response = await request(app)
        .get(`/api/v1/ledgers/subsidiary/${testSetup.accounts.cash.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.totalDebits).toBe(150000);
      expect(response.body.data.totalCredits).toBe(0);
      expect(response.body.data.closingBalance).toBe(150000);
    });

    it('should filter by date range', async () => {
      const response = await request(app)
        .get(`/api/v1/ledgers/subsidiary/${testSetup.accounts.cash.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          from: '2024-01-01',
          to: '2024-01-31',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.entries).toHaveLength(1);
      expect(response.body.data.totalDebits).toBe(100000);
    });

    it('should return 404 for non-existent account', async () => {
      const response = await request(app)
        .get('/api/v1/ledgers/subsidiary/non-existent-id')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/ledgers/trial-balance', () => {
    it('should return trial balance', async () => {
      const response = await request(app)
        .get('/api/v1/ledgers/trial-balance')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('accounts');
      expect(response.body.data).toHaveProperty('totalDebits');
      expect(response.body.data).toHaveProperty('totalCredits');
      expect(response.body.data.totalDebits).toBe(response.body.data.totalCredits);
    });

    it('should balance debits and credits', async () => {
      const response = await request(app)
        .get('/api/v1/ledgers/trial-balance')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.totalDebits).toBe(150000);
      expect(response.body.data.totalCredits).toBe(150000);
    });

    it('should filter by date', async () => {
      const response = await request(app)
        .get('/api/v1/ledgers/trial-balance')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          asOf: '2024-01-31',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.totalDebits).toBe(100000);
      expect(response.body.data.totalCredits).toBe(100000);
    });

    it('should group by account type', async () => {
      const response = await request(app)
        .get('/api/v1/ledgers/trial-balance')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          groupBy: 'accountType',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.groups).toHaveProperty('ASSET');
      expect(response.body.data.groups).toHaveProperty('REVENUE');
    });
  });

  describe('GET /api/v1/ledgers/account-balance/:accountId', () => {
    it('should return account balance', async () => {
      const response = await request(app)
        .get(`/api/v1/ledgers/account-balance/${testSetup.accounts.cash.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.accountId).toBe(testSetup.accounts.cash.id);
      expect(response.body.data.balance).toBe(150000);
      expect(response.body.data.debitTotal).toBe(150000);
      expect(response.body.data.creditTotal).toBe(0);
    });

    it('should calculate balance as of specific date', async () => {
      const response = await request(app)
        .get(`/api/v1/ledgers/account-balance/${testSetup.accounts.cash.id}`)
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          asOf: '2024-01-31',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.balance).toBe(100000);
    });

    it('should return 404 for non-existent account', async () => {
      const response = await request(app)
        .get('/api/v1/ledgers/account-balance/non-existent-id')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/ledgers/export', () => {
    it('should export ledger as CSV', async () => {
      const response = await request(app)
        .get('/api/v1/ledgers/export')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          format: 'csv',
          accountId: testSetup.accounts.cash.id,
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('ledger');
    });

    it('should export ledger as Excel', async () => {
      const response = await request(app)
        .get('/api/v1/ledgers/export')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          format: 'xlsx',
          accountId: testSetup.accounts.cash.id,
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('spreadsheet');
    });

    it('should export trial balance', async () => {
      const response = await request(app)
        .get('/api/v1/ledgers/export')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          format: 'csv',
          type: 'trial-balance',
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('trial-balance');
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/v1/ledgers/export').query({ format: 'csv' });

      expect(response.status).toBe(401);
    });
  });
});
