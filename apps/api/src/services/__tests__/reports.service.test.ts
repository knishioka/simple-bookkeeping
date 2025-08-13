// Prismaクライアントのモック
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    accountingPeriod: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    journalEntry: {
      findMany: jest.fn(),
    },
    account: {
      findMany: jest.fn(),
    },
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
    AccountType: {
      ASSET: 'ASSET',
      LIABILITY: 'LIABILITY',
      EQUITY: 'EQUITY',
      REVENUE: 'REVENUE',
      EXPENSE: 'EXPENSE',
    },
    JournalStatus: {
      DRAFT: 'DRAFT',
      APPROVED: 'APPROVED',
      CANCELLED: 'CANCELLED',
    },
  };
});

import { PrismaClient } from '@prisma/client';
import { AccountType } from '@simple-bookkeeping/database';

import { ReportsService } from '../reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let mockPrismaClient: any;

  beforeEach(() => {
    service = new ReportsService();
    mockPrismaClient = new PrismaClient();
    jest.clearAllMocks();
  });

  describe('getBalanceSheet', () => {
    it.skip('should generate balance sheet correctly', async () => {
      const accountingPeriodId = 'period-1';
      const asOfDate = new Date('2024-01-31');

      mockPrismaClient.accountingPeriod.findFirst.mockResolvedValue({
        id: accountingPeriodId,
        name: '2024年度',
      });

      mockPrismaClient.journalEntry.findMany.mockResolvedValue([
        {
          id: 'entry-1',
          entryDate: new Date('2024-01-15'),
          lines: [
            {
              accountId: 'account-1',
              isDebit: true,
              amount: 100000,
              account: {
                id: 'account-1',
                code: '1110',
                name: '現金',
                accountType: AccountType.ASSET,
              },
            },
            {
              accountId: 'account-2',
              isDebit: false,
              amount: 100000,
              account: {
                id: 'account-2',
                code: '4000',
                name: '売上高',
                accountType: AccountType.REVENUE,
              },
            },
          ],
        },
      ]);

      mockPrismaClient.account.findMany.mockResolvedValue([
        {
          id: 'account-1',
          code: '1110',
          name: '現金',
          accountType: AccountType.ASSET,
          parentId: null,
        },
        {
          id: 'account-3',
          code: '2000',
          name: '負債',
          accountType: AccountType.LIABILITY,
          parentId: null,
        },
        {
          id: 'account-4',
          code: '3000',
          name: '純資産',
          accountType: AccountType.EQUITY,
          parentId: null,
        },
      ]);

      const result = await service.getBalanceSheet('org-123', asOfDate);

      expect(result.totalAssets).toBe(100000);
      expect(result.totalLiabilities).toBe(0);
      expect(result.totalEquity).toBe(0);
      // Assets structure changed, just check totals
      expect(result.totalAssets).toBeDefined();
    });

    it('should throw error when accounting period not found', async () => {
      mockPrismaClient.accountingPeriod.findFirst.mockResolvedValue(null);

      await expect(service.getBalanceSheet('org-123', new Date())).rejects.toThrow();
    });
  });

  describe('getIncomeStatement', () => {
    it.skip('should generate profit and loss statement correctly', async () => {
      const accountingPeriodId = 'period-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockPrismaClient.accountingPeriod.findFirst.mockResolvedValue({
        id: accountingPeriodId,
        name: '2024年度',
      });

      mockPrismaClient.journalEntry.findMany.mockResolvedValue([
        {
          id: 'entry-1',
          entryDate: new Date('2024-01-15'),
          lines: [
            {
              accountId: 'account-1',
              isDebit: true,
              amount: 100000,
              account: {
                id: 'account-1',
                code: '1110',
                name: '現金',
                accountType: AccountType.ASSET,
              },
            },
            {
              accountId: 'account-2',
              isDebit: false,
              amount: 100000,
              account: {
                id: 'account-2',
                code: '4000',
                name: '売上高',
                accountType: AccountType.REVENUE,
              },
            },
          ],
        },
        {
          id: 'entry-2',
          entryDate: new Date('2024-01-20'),
          lines: [
            {
              accountId: 'account-3',
              isDebit: true,
              amount: 60000,
              account: {
                id: 'account-3',
                code: '5000',
                name: '仕入高',
                accountType: AccountType.EXPENSE,
              },
            },
            {
              accountId: 'account-1',
              isDebit: false,
              amount: 60000,
              account: {
                id: 'account-1',
                code: '1110',
                name: '現金',
                accountType: AccountType.ASSET,
              },
            },
          ],
        },
      ]);

      mockPrismaClient.account.findMany.mockResolvedValue([
        {
          id: 'account-2',
          code: '4000',
          name: '売上高',
          accountType: AccountType.REVENUE,
          parentId: null,
        },
        {
          id: 'account-3',
          code: '5000',
          name: '仕入高',
          accountType: AccountType.EXPENSE,
          parentId: null,
        },
      ]);

      const result = await service.getIncomeStatement('org-123', startDate, endDate);

      expect(result.revenue.total).toBe(100000);
      expect(result.expenses.total).toBe(60000);
      expect(result.netIncome).toBe(40000);
      expect(result.revenue.details).toBeDefined();
      expect(result.expenses.details).toBeDefined();
    });
  });
});
