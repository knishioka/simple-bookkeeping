// Setup test environment variables first
import '../../test-utils/env-setup';

import { JournalStatus, AccountType } from '@simple-bookkeeping/database';
import request from 'supertest';

import app from '../../index';
import { prisma } from '../../lib/prisma';
import {
  cleanupTestData,
  createFullTestSetup,
  createTestJournalEntry,
  createTestAccount,
} from '../../test-utils/test-helpers';

describe('ReportsController', () => {
  let testSetup: Awaited<ReturnType<typeof createFullTestSetup>>;

  beforeEach(async () => {
    await cleanupTestData();
    testSetup = await createFullTestSetup();

    // Create additional accounts for comprehensive reports
    await createTestAccount(testSetup.organization.id, {
      code: '4002',
      name: 'サービス収益',
      accountType: AccountType.REVENUE,
    });

    const liabilityAccount = await createTestAccount(testSetup.organization.id, {
      code: '2001',
      name: '買掛金',
      accountType: AccountType.LIABILITY,
    });

    // Create journal entries for reports
    await createTestJournalEntry(testSetup.organization.id, testSetup.accountingPeriod.id, true, {
      entryDate: new Date('2024-01-15'),
      description: '初期資本',
      status: JournalStatus.APPROVED,
      lines: [
        {
          accountId: testSetup.accounts.cash.id,
          debitAmount: 1000000,
          creditAmount: 0,
        },
        {
          accountId: liabilityAccount.id,
          debitAmount: 0,
          creditAmount: 1000000,
        },
      ],
    });

    await createTestJournalEntry(testSetup.organization.id, testSetup.accountingPeriod.id, true, {
      entryDate: new Date('2024-02-15'),
      description: '売上',
      status: JournalStatus.APPROVED,
      lines: [
        {
          accountId: testSetup.accounts.cash.id,
          debitAmount: 500000,
          creditAmount: 0,
        },
        {
          accountId: testSetup.accounts.sales.id,
          debitAmount: 0,
          creditAmount: 500000,
        },
      ],
    });

    await createTestJournalEntry(testSetup.organization.id, testSetup.accountingPeriod.id, true, {
      entryDate: new Date('2024-02-20'),
      description: '仕入',
      status: JournalStatus.APPROVED,
      lines: [
        {
          accountId: testSetup.accounts.expense.id,
          debitAmount: 200000,
          creditAmount: 0,
        },
        {
          accountId: testSetup.accounts.cash.id,
          debitAmount: 0,
          creditAmount: 200000,
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

  describe('GET /api/v1/reports/balance-sheet', () => {
    it('should return balance sheet', async () => {
      const response = await request(app)
        .get('/api/v1/reports/balance-sheet')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('assets');
      expect(response.body.data).toHaveProperty('liabilities');
      expect(response.body.data).toHaveProperty('equity');
      expect(response.body.data).toHaveProperty('totalAssets');
      expect(response.body.data).toHaveProperty('totalLiabilitiesAndEquity');
    });

    it('should balance assets with liabilities and equity', async () => {
      const response = await request(app)
        .get('/api/v1/reports/balance-sheet')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.totalAssets).toBe(response.body.data.totalLiabilitiesAndEquity);
    });

    it('should generate balance sheet as of specific date', async () => {
      const response = await request(app)
        .get('/api/v1/reports/balance-sheet')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({ asOf: '2024-01-31' });

      expect(response.status).toBe(200);
      // Should only include January transactions
      expect(response.body.data.assets.currentAssets.cash).toBe(1000000);
    });

    it('should support comparative balance sheet', async () => {
      const response = await request(app)
        .get('/api/v1/reports/balance-sheet')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          asOf: '2024-02-28',
          compareTo: '2024-01-31',
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('comparison');
      expect(response.body.data.comparison).toHaveProperty('assets');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/v1/reports/balance-sheet');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/reports/income-statement', () => {
    it('should return income statement', async () => {
      const response = await request(app)
        .get('/api/v1/reports/income-statement')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          from: '2024-01-01',
          to: '2024-12-31',
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('revenue');
      expect(response.body.data).toHaveProperty('expenses');
      expect(response.body.data).toHaveProperty('grossProfit');
      expect(response.body.data).toHaveProperty('netIncome');
    });

    it('should calculate correct net income', async () => {
      const response = await request(app)
        .get('/api/v1/reports/income-statement')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          from: '2024-01-01',
          to: '2024-12-31',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.revenue.total).toBe(500000);
      expect(response.body.data.expenses.total).toBe(200000);
      expect(response.body.data.netIncome).toBe(300000);
    });

    it('should filter by date range', async () => {
      const response = await request(app)
        .get('/api/v1/reports/income-statement')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          from: '2024-02-01',
          to: '2024-02-28',
        });

      expect(response.status).toBe(200);
      // Should only include February transactions
      expect(response.body.data.revenue.total).toBe(500000);
      expect(response.body.data.expenses.total).toBe(200000);
    });

    it('should support comparative income statement', async () => {
      const response = await request(app)
        .get('/api/v1/reports/income-statement')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          from: '2024-02-01',
          to: '2024-02-28',
          compareFrom: '2024-01-01',
          compareTo: '2024-01-31',
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('comparison');
      expect(response.body.data.comparison).toHaveProperty('revenue');
    });
  });

  describe('GET /api/v1/reports/cash-flow', () => {
    it('should return cash flow statement', async () => {
      const response = await request(app)
        .get('/api/v1/reports/cash-flow')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          from: '2024-01-01',
          to: '2024-12-31',
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('operatingActivities');
      expect(response.body.data).toHaveProperty('investingActivities');
      expect(response.body.data).toHaveProperty('financingActivities');
      expect(response.body.data).toHaveProperty('netCashFlow');
      expect(response.body.data).toHaveProperty('beginningCash');
      expect(response.body.data).toHaveProperty('endingCash');
    });

    it('should calculate correct cash flow', async () => {
      const response = await request(app)
        .get('/api/v1/reports/cash-flow')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          from: '2024-01-01',
          to: '2024-02-28',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.endingCash).toBe(1300000); // 1000000 + 500000 - 200000
    });
  });

  describe('GET /api/v1/reports/aged-receivables', () => {
    it('should return aged receivables report', async () => {
      const response = await request(app)
        .get('/api/v1/reports/aged-receivables')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('current');
      expect(response.body.data).toHaveProperty('days30');
      expect(response.body.data).toHaveProperty('days60');
      expect(response.body.data).toHaveProperty('days90');
      expect(response.body.data).toHaveProperty('over90');
      expect(response.body.data).toHaveProperty('total');
    });

    it('should categorize by age', async () => {
      const response = await request(app)
        .get('/api/v1/reports/aged-receivables')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({ asOf: '2024-02-28' });

      expect(response.status).toBe(200);
      // All receivables should be current (less than 30 days old)
      expect(response.body.data.current).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/v1/reports/aged-payables', () => {
    it('should return aged payables report', async () => {
      const response = await request(app)
        .get('/api/v1/reports/aged-payables')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('current');
      expect(response.body.data).toHaveProperty('days30');
      expect(response.body.data).toHaveProperty('days60');
      expect(response.body.data).toHaveProperty('days90');
      expect(response.body.data).toHaveProperty('over90');
      expect(response.body.data).toHaveProperty('total');
    });
  });

  describe('GET /api/v1/reports/financial-ratios', () => {
    it('should return financial ratios', async () => {
      const response = await request(app)
        .get('/api/v1/reports/financial-ratios')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('liquidityRatios');
      expect(response.body.data).toHaveProperty('profitabilityRatios');
      expect(response.body.data).toHaveProperty('efficiencyRatios');
      expect(response.body.data).toHaveProperty('leverageRatios');
    });

    it('should calculate current ratio', async () => {
      const response = await request(app)
        .get('/api/v1/reports/financial-ratios')
        .set('Authorization', `Bearer ${testSetup.token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.liquidityRatios).toHaveProperty('currentRatio');
      expect(response.body.data.liquidityRatios.currentRatio).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/reports/export', () => {
    it('should export balance sheet as PDF', async () => {
      const response = await request(app)
        .get('/api/v1/reports/export')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          type: 'balance-sheet',
          format: 'pdf',
          asOf: '2024-02-28',
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('balance-sheet');
    });

    it('should export income statement as Excel', async () => {
      const response = await request(app)
        .get('/api/v1/reports/export')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          type: 'income-statement',
          format: 'xlsx',
          from: '2024-01-01',
          to: '2024-12-31',
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('spreadsheet');
    });

    it('should export financial ratios as CSV', async () => {
      const response = await request(app)
        .get('/api/v1/reports/export')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          type: 'financial-ratios',
          format: 'csv',
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should validate report type', async () => {
      const response = await request(app)
        .get('/api/v1/reports/export')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .query({
          type: 'invalid-report',
          format: 'pdf',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_REPORT_TYPE');
    });
  });

  describe('POST /api/v1/reports/custom', () => {
    it('should generate custom report', async () => {
      const customReportConfig = {
        name: 'Custom Sales Report',
        dateRange: {
          from: '2024-01-01',
          to: '2024-12-31',
        },
        accounts: [testSetup.accounts.sales.id],
        groupBy: 'month',
        includeDetails: true,
      };

      const response = await request(app)
        .post('/api/v1/reports/custom')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(customReportConfig);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('name', 'Custom Sales Report');
      expect(response.body.data).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('summary');
    });

    it('should require at least VIEWER role', async () => {
      const customReportConfig = {
        name: 'Test Report',
        dateRange: {
          from: '2024-01-01',
          to: '2024-12-31',
        },
      };

      const response = await request(app)
        .post('/api/v1/reports/custom')
        .set('Authorization', `Bearer ${testSetup.token}`)
        .send(customReportConfig);

      expect(response.status).toBe(200);
    });
  });
});
