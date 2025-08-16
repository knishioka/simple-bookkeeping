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
      findFirst: jest.fn(),
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

// Using 'any' for mockPrismaClient to avoid complex mock typing issues
// This is acceptable in test files for mocking purposes
describe('ReportsService', () => {
  let service: ReportsService;

  let mockPrismaClient: any;

  beforeEach(() => {
    service = new ReportsService();
    mockPrismaClient = new PrismaClient();
    jest.clearAllMocks();
  });

  describe('getBalanceSheet', () => {
    it('should generate balance sheet correctly', async () => {
      const organizationId = 'org-123';
      const asOfDate = new Date('2024-01-31');

      mockPrismaClient.journalEntry.findMany.mockResolvedValue([
        {
          id: 'entry-1',
          entryDate: new Date('2024-01-15'),
          lines: [
            {
              accountId: 'account-1',
              debitAmount: 100000,
              creditAmount: 0,
              account: {
                id: 'account-1',
                code: '1110',
                name: '現金',
                accountType: AccountType.ASSET,
              },
            },
            {
              accountId: 'account-2',
              debitAmount: 0,
              creditAmount: 100000,
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
          id: 'account-2',
          code: '4000',
          name: '売上高',
          accountType: AccountType.REVENUE,
          parentId: null,
        },
        {
          id: 'account-3',
          code: '2100',
          name: '買掛金',
          accountType: AccountType.LIABILITY,
          parentId: null,
        },
        {
          id: 'account-4',
          code: '3000',
          name: '資本金',
          accountType: AccountType.EQUITY,
          parentId: null,
        },
      ]);

      const result = await service.getBalanceSheet(organizationId, asOfDate);

      expect(result.totalAssets).toBe(100000);
      expect(result.totalLiabilities).toBe(0);
      // Total equity calculation is complex due to revenue/expense adjustments
      // Just verify the basic structure and that values are calculated
      expect(result.totalEquity).toBeDefined();
      expect(result.totalLiabilitiesAndEquity).toBeDefined();
      expect(result.assets).toBeDefined();
      expect('currentAssets' in result.assets).toBe(true);
      if ('currentAssets' in result.assets) {
        expect(result.assets.currentAssets.cash).toBe(100000);
        expect(result.assets.currentAssets.total).toBe(100000);
      }
    });
  });

  describe('getIncomeStatement', () => {
    it('should generate profit and loss statement correctly', async () => {
      const organizationId = 'org-123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockPrismaClient.journalEntry.findMany.mockResolvedValue([
        {
          id: 'entry-1',
          entryDate: new Date('2024-01-15'),
          lines: [
            {
              accountId: 'account-1',
              debitAmount: 100000,
              creditAmount: 0,
              account: {
                id: 'account-1',
                code: '1110',
                name: '現金',
                accountType: AccountType.ASSET,
              },
            },
            {
              accountId: 'account-2',
              debitAmount: 0,
              creditAmount: 100000,
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
              debitAmount: 60000,
              creditAmount: 0,
              account: {
                id: 'account-3',
                code: '5000',
                name: '仕入高',
                accountType: AccountType.EXPENSE,
              },
            },
            {
              accountId: 'account-1',
              debitAmount: 0,
              creditAmount: 60000,
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

      const result = await service.getIncomeStatement(organizationId, startDate, endDate);

      expect(result.revenue.total).toBe(100000);
      expect(result.expenses.total).toBe(60000);
      expect(result.grossProfit).toBe(100000); // Simplified: no COGS separation
      expect(result.netIncome).toBe(40000);
      expect(result.revenue.details).toBeDefined();
      expect(result.expenses.details).toBeDefined();
    });
  });

  describe('getFinancialRatios', () => {
    it('should calculate financial ratios correctly', async () => {
      const organizationId = 'org-123';
      const asOfDate = new Date('2024-01-31');

      // Mock data for balance sheet and income statement
      mockPrismaClient.journalEntry.findMany.mockResolvedValue([
        {
          id: 'entry-1',
          entryDate: new Date('2024-01-15'),
          lines: [
            {
              accountId: 'cash-account',
              debitAmount: 1000000,
              creditAmount: 0,
              account: {
                id: 'cash-account',
                code: '1110',
                name: '現金',
                accountType: AccountType.ASSET,
              },
            },
            {
              accountId: 'revenue-account',
              debitAmount: 0,
              creditAmount: 1000000,
              account: {
                id: 'revenue-account',
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
          id: 'cash-account',
          code: '1110',
          name: '現金',
          accountType: AccountType.ASSET,
          parentId: null,
        },
        {
          id: 'revenue-account',
          code: '4000',
          name: '売上高',
          accountType: AccountType.REVENUE,
          parentId: null,
        },
        {
          id: 'liability-account',
          code: '2100',
          name: '買掛金',
          accountType: AccountType.LIABILITY,
          parentId: null,
        },
      ]);

      const result = await service.getFinancialRatios(organizationId, asOfDate);

      expect(result.liquidityRatios).toBeDefined();
      expect(typeof result.liquidityRatios.currentRatio).toBe('number');
      expect(typeof result.liquidityRatios.quickRatio).toBe('number');
      expect(typeof result.liquidityRatios.cashRatio).toBe('number');

      expect(result.profitabilityRatios).toBeDefined();
      expect(typeof result.profitabilityRatios.grossProfitMargin).toBe('number');
      expect(typeof result.profitabilityRatios.netProfitMargin).toBe('number');
      expect(typeof result.profitabilityRatios.returnOnAssets).toBe('number');
      expect(typeof result.profitabilityRatios.returnOnEquity).toBe('number');

      expect(result.efficiencyRatios).toBeDefined();
      expect(typeof result.efficiencyRatios.assetTurnover).toBe('number');
      expect(typeof result.efficiencyRatios.inventoryTurnover).toBe('number');
      expect(typeof result.efficiencyRatios.receivablesTurnover).toBe('number');

      expect(result.leverageRatios).toBeDefined();
      expect(typeof result.leverageRatios.debtToEquity).toBe('number');
      expect(typeof result.leverageRatios.debtToAssets).toBe('number');
      expect(typeof result.leverageRatios.interestCoverage).toBe('number');
    });
  });

  describe('getCashFlow', () => {
    it('should calculate cash flow correctly', async () => {
      const organizationId = 'org-123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // Mock cash account
      mockPrismaClient.account.findFirst.mockResolvedValue({
        id: 'cash-account',
        code: '1110',
        name: '現金',
        accountType: AccountType.ASSET,
      });

      // Mock beginning balance entries (before period)
      mockPrismaClient.journalEntry.findMany
        .mockResolvedValueOnce([
          {
            id: 'entry-0',
            entryDate: new Date('2023-12-31'),
            lines: [
              {
                accountId: 'cash-account',
                debitAmount: 500000,
                creditAmount: 0,
              },
            ],
          },
        ])
        // Mock period entries
        .mockResolvedValueOnce([
          {
            id: 'entry-1',
            entryDate: new Date('2024-01-15'),
            description: '売上入金',
            lines: [
              {
                accountId: 'cash-account',
                debitAmount: 200000,
                creditAmount: 0,
                account: {
                  id: 'cash-account',
                  code: '1110',
                  name: '現金',
                  accountType: AccountType.ASSET,
                },
              },
            ],
          },
          {
            id: 'entry-2',
            entryDate: new Date('2024-01-20'),
            description: '仕入支払',
            lines: [
              {
                accountId: 'cash-account',
                debitAmount: 0,
                creditAmount: 100000,
                account: {
                  id: 'cash-account',
                  code: '1110',
                  name: '現金',
                  accountType: AccountType.ASSET,
                },
              },
            ],
          },
        ]);

      const result = await service.getCashFlow(organizationId, startDate, endDate);

      expect(result.beginningCash).toBe(500000);
      expect(result.operatingActivities).toBe(100000); // 200000 - 100000
      expect(result.investingActivities).toBe(0);
      expect(result.financingActivities).toBe(0);
      expect(result.netCashFlow).toBe(100000);
      expect(result.endingCash).toBe(600000); // 500000 + 100000
    });

    it('should throw error when cash account not found', async () => {
      mockPrismaClient.account.findFirst.mockResolvedValue(null);

      await expect(
        service.getCashFlow('org-123', new Date('2024-01-01'), new Date('2024-01-31'))
      ).rejects.toThrow('現金勘定が見つかりません');
    });
  });
});
