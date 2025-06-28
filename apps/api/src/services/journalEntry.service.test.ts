import { prisma } from '../lib/prisma';

import { createJournalEntriesFromCsv } from './journalEntry.service';

// Mock Prisma client
jest.mock('../lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    account: {
      findFirst: jest.fn(),
    },
    journalEntry: {
      create: jest.fn(),
    },
    accountingPeriod: {
      findFirst: jest.fn(),
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

      (prisma.account.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: 'acc1', name: '現金' })
        .mockResolvedValueOnce({ id: 'acc2', name: '売上' });
      (prisma.accountingPeriod.findFirst as jest.Mock).mockResolvedValue({ id: 'period1' });
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma));

      await createJournalEntriesFromCsv(records, organizationId, userId);

      expect(prisma.journalEntry.create).toHaveBeenCalledTimes(1);
      expect(prisma.journalEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: 'Test sale',
            lines: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({ accountId: 'acc1', debitAmount: 10000 }),
                expect.objectContaining({ accountId: 'acc2', creditAmount: 10000 }),
              ]),
            }),
          }),
        })
      );
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
      (prisma.account.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma));

      await expect(createJournalEntriesFromCsv(records, 'org1', 'user1')).rejects.toThrow(
        'Invalid account found'
      );
    });

    it('should throw an error for invalid amount', async () => {
      const records = [
        { 日付: '2025-01-01', 借方勘定: '現金', 貸方勘定: '売上', 金額: 'invalid', 摘要: 'Test' },
      ];
      (prisma.account.findFirst as jest.Mock).mockResolvedValue({ id: 'acc1' });
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma));

      await expect(createJournalEntriesFromCsv(records, 'org1', 'user1')).rejects.toThrow(
        'Invalid amount'
      );
    });
  });
});
