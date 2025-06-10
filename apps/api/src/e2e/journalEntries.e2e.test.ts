import { AccountType, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import request from 'supertest';

import app from '../index';
import { prisma } from '../lib/prisma';
import { generateTokens } from '../utils/jwt';


describe('Journal Entries E2E', () => {
  let accountantToken: string;
  let accountingPeriodId: string;
  let cashAccountId: string;
  let salesAccountId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'accountant@test.com',
        passwordHash: await bcrypt.hash('password', 10),
        name: 'Test Accountant',
        role: UserRole.ACCOUNTANT,
      },
    });

    const tokens = generateTokens(user.id, user.email, user.role);
    accountantToken = tokens.accessToken;

    // Create accounting period
    const period = await prisma.accountingPeriod.create({
      data: {
        name: '2024年度',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        isActive: true,
      },
    });
    accountingPeriodId = period.id;

    // Create accounts
    const cashAccount = await prisma.account.create({
      data: {
        code: '1110',
        name: '現金',
        accountType: AccountType.ASSET,
      },
    });
    cashAccountId = cashAccount.id;

    const salesAccount = await prisma.account.create({
      data: {
        code: '4110',
        name: '売上高',
        accountType: AccountType.REVENUE,
      },
    });
    salesAccountId = salesAccount.id;
  });

  describe('POST /api/v1/journal-entries', () => {
    it('should create a balanced journal entry', async () => {
      const entry = {
        entryDate: '2024-03-15',
        description: '現金売上',
        accountingPeriodId,
        lines: [
          {
            accountId: cashAccountId,
            debitAmount: 10000,
            creditAmount: 0,
          },
          {
            accountId: salesAccountId,
            debitAmount: 0,
            creditAmount: 10000,
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/journal-entries')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send(entry)
        .expect(201);

      expect(response.body.data).toMatchObject({
        description: '現金売上',
        status: 'DRAFT',
      });
      expect(response.body.data.lines).toHaveLength(2);
      expect(response.body.data.entryNumber).toMatch(/^\d{12}$/);
    });

    it('should reject unbalanced entry', async () => {
      const unbalancedEntry = {
        entryDate: '2024-03-15',
        description: '不正な仕訳',
        accountingPeriodId,
        lines: [
          {
            accountId: cashAccountId,
            debitAmount: 10000,
            creditAmount: 0,
          },
          {
            accountId: salesAccountId,
            debitAmount: 0,
            creditAmount: 5000, // Unbalanced
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/journal-entries')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send(unbalancedEntry)
        .expect(422);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/journal-entries', () => {
    it('should get journal entries with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/journal-entries')
        .set('Authorization', `Bearer ${accountantToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.meta).toMatchObject({
        page: 1,
        limit: 10,
      });
    });
  });
});
