import { prisma } from '../lib/prisma';

import { createJournalEntriesFromCsv } from './journalEntry.service';

// Mock Prisma client
jest.mock('../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    account: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    journalEntry: {
      create: jest.fn(),
      findFirst: jest.fn(),
      groupBy: jest.fn(),
    },
    accountingPeriod: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('journalEntry.service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createJournalEntriesFromCsv', () => {
    it('should create journal entries from valid CSV records', async () => {
      const records = [
        {
          日付: '2025-01-01',
          借方勘定: '現金',
          貸方勘定: '売上',
          金額: '10000',
          摘要: 'Test sale',
        },
      ];
      const organizationId = 'org1';
      const userId = 'user1';

      // Mock transaction with proper structure
      const mockTx = {
        account: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'acc1', name: '現金', code: '1001' },
            { id: 'acc2', name: '売上', code: '4001' },
          ]),
        },
        accountingPeriod: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { id: 'period1', startDate: new Date('2025-01-01'), endDate: new Date('2025-12-31') },
            ]),
        },
        journalEntry: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'entry1' }),
          groupBy: jest.fn().mockResolvedValue([]),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(mockTx));

      await createJournalEntriesFromCsv(records, organizationId, userId);

      expect(mockTx.journalEntry.create).toHaveBeenCalledTimes(1);
    });

    it('should throw an error for invalid account', async () => {
      const records = [
        {
          日付: '2025-01-01',
          借方勘定: '存在しない勘定',
          貸方勘定: '売上',
          金額: '10000',
          摘要: 'Test',
        },
      ];

      // Mock transaction with empty accounts array
      const mockTx = {
        account: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        accountingPeriod: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { id: 'period1', startDate: new Date('2025-01-01'), endDate: new Date('2025-12-31') },
            ]),
        },
        journalEntry: {
          findFirst: jest.fn().mockResolvedValue(null),
          groupBy: jest.fn().mockResolvedValue([]),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(mockTx));

      await expect(createJournalEntriesFromCsv(records, 'org1', 'user1')).rejects.toThrow(
        'CSV import failed with 1 errors'
      );
    });

    it('should throw an error for invalid amount', async () => {
      const records = [
        { 日付: '2025-01-01', 借方勘定: '現金', 貸方勘定: '売上', 金額: 'invalid', 摘要: 'Test' },
      ];

      const mockTx = {
        account: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'acc1', name: '現金', code: '1001' },
            { id: 'acc2', name: '売上', code: '4001' },
          ]),
        },
        accountingPeriod: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { id: 'period1', startDate: new Date('2025-01-01'), endDate: new Date('2025-12-31') },
            ]),
        },
        journalEntry: {
          findFirst: jest.fn().mockResolvedValue(null),
          groupBy: jest.fn().mockResolvedValue([]),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(mockTx));

      await expect(createJournalEntriesFromCsv(records, 'org1', 'user1')).rejects.toThrow(
        'CSV import failed with 1 errors'
      );
    });
  });
});
