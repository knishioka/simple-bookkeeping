import { AccountType, JournalStatus, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import request from 'supertest';

import app from '../index';
import { prisma } from '../lib/prisma';
import { generateTokens } from '../utils/jwt';


describe('Reports E2E', () => {
  let adminToken: string;
  let accountingPeriodId: string;
  let assetAccountId: string;
  let revenueAccountId: string;
  let expenseAccountId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'reports-admin@test.com',
        passwordHash: await bcrypt.hash('password', 10),
        name: 'Reports Admin',
        role: UserRole.ADMIN,
      },
    });

    const tokens = generateTokens(user.id, user.email, user.role);
    adminToken = tokens.accessToken;

    // Create accounting period
    const accountingPeriod = await prisma.accountingPeriod.create({
      data: {
        name: '2024年度',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        isActive: true,
      },
    });
    accountingPeriodId = accountingPeriod.id;

    // Create accounts
    const assetAccount = await prisma.account.create({
      data: {
        code: '1110',
        name: '現金',
        accountType: AccountType.ASSET,
        isSystem: true,
      },
    });
    assetAccountId = assetAccount.id;

    const revenueAccount = await prisma.account.create({
      data: {
        code: '4000',
        name: '売上高',
        accountType: AccountType.REVENUE,
        isSystem: true,
      },
    });
    revenueAccountId = revenueAccount.id;

    const expenseAccount = await prisma.account.create({
      data: {
        code: '5000',
        name: '仕入高',
        accountType: AccountType.EXPENSE,
        isSystem: true,
      },
    });
    expenseAccountId = expenseAccount.id;

    // Create sample journal entries
    await prisma.journalEntry.create({
      data: {
        entryNumber: '202401001',
        entryDate: new Date('2024-01-15'),
        description: '売上計上',
        accountingPeriodId,
        createdById: user.id,
        status: JournalStatus.APPROVED,
        lines: {
          create: [
            {
              accountId: assetAccountId,
              debitAmount: 100000,
              creditAmount: 0,
              description: '売上代金',
              lineNumber: 1,
            },
            {
              accountId: revenueAccountId,
              debitAmount: 0,
              creditAmount: 100000,
              description: '売上高',
              lineNumber: 2,
            },
          ],
        },
      },
    });

    await prisma.journalEntry.create({
      data: {
        entryNumber: '202401002',
        entryDate: new Date('2024-01-20'),
        description: '仕入計上',
        accountingPeriodId,
        createdById: user.id,
        status: JournalStatus.APPROVED,
        lines: {
          create: [
            {
              accountId: expenseAccountId,
              debitAmount: 60000,
              creditAmount: 0,
              description: '仕入高',
              lineNumber: 1,
            },
            {
              accountId: assetAccountId,
              debitAmount: 0,
              creditAmount: 60000,
              description: '現金支払',
              lineNumber: 2,
            },
          ],
        },
      },
    });
  });

  describe('GET /api/v1/reports/accounting-periods/:id/balance-sheet', () => {
    it('should get balance sheet', async () => {
      const response = await request(app)
        .get(`/api/v1/reports/accounting-periods/${accountingPeriodId}/balance-sheet`)
        .query({ asOfDate: '2024-01-31' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('assets');
      expect(response.body.data).toHaveProperty('liabilities');
      expect(response.body.data).toHaveProperty('equity');
      expect(response.body.data.totalAssets).toBe(40000); // 100000 - 60000
      expect(response.body.data.assets[0]).toMatchObject({
        accountCode: '1110',
        accountName: '現金',
        balance: 40000,
      });
    });

    it('should fail without asOfDate', async () => {
      await request(app)
        .get(`/api/v1/reports/accounting-periods/${accountingPeriodId}/balance-sheet`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('GET /api/v1/reports/accounting-periods/:id/profit-loss', () => {
    it('should get profit and loss statement', async () => {
      const response = await request(app)
        .get(`/api/v1/reports/accounting-periods/${accountingPeriodId}/profit-loss`)
        .query({ startDate: '2024-01-01', endDate: '2024-01-31' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('revenues');
      expect(response.body.data).toHaveProperty('expenses');
      expect(response.body.data.totalRevenues).toBe(100000);
      expect(response.body.data.totalExpenses).toBe(60000);
      expect(response.body.data.netIncome).toBe(40000);
    });

    it('should fail with invalid date range', async () => {
      const response = await request(app)
        .get(`/api/v1/reports/accounting-periods/${accountingPeriodId}/profit-loss`)
        .query({ startDate: '2024-01-31', endDate: '2024-01-01' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_DATE_RANGE');
    });
  });
});
