// Mock prisma
jest.mock('../../lib/prisma', () => ({
  prisma: {
    journalEntry: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    journalEntryLine: {
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    accountingPeriod: {
      findFirst: jest.fn(),
    },
    account: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => {
      // Create a mock transaction object with all necessary methods
      const tx = {
        journalEntry: {
          create: jest.fn(),
          findMany: jest.fn(),
          groupBy: jest.fn(),
        },
        journalEntryLine: {
          createMany: jest.fn(),
          findMany: jest.fn(),
        },
        account: {
          findMany: jest.fn(),
        },
      };
      return callback(tx);
    }),
  },
}));

import { prisma } from '../../lib/prisma';
import { generateEntryNumber, validateJournalEntryBalance } from '../journalEntry.service';

describe('JournalEntry Service', () => {
  describe('generateEntryNumber', () => {
    it('should generate first entry number of the month', async () => {
      (prisma.journalEntry.findFirst as jest.Mock).mockResolvedValue(null);

      const date = new Date('2024-03-15');
      const organizationId = 'org-123';
      const entryNumber = await generateEntryNumber(date, organizationId);

      expect(entryNumber).toBe('2024030001');
      expect(prisma.journalEntry.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId,
          entryNumber: {
            startsWith: '202403',
          },
        },
        select: {
          entryNumber: true,
        },
        orderBy: {
          entryNumber: 'desc',
        },
      });
    });

    it('should increment existing entry number', async () => {
      (prisma.journalEntry.findFirst as jest.Mock).mockResolvedValue({
        entryNumber: '2024030005',
      });

      const date = new Date('2024-03-20');
      const organizationId = 'org-123';
      const entryNumber = await generateEntryNumber(date, organizationId);

      expect(entryNumber).toBe('2024030006');
    });
  });

  describe('validateJournalEntryBalance', () => {
    it('should return true for balanced entries', () => {
      const lines = [
        { debitAmount: 1000, creditAmount: 0 },
        { debitAmount: 0, creditAmount: 1000 },
      ];

      expect(validateJournalEntryBalance(lines)).toBe(true);
    });

    it('should return false for unbalanced entries', () => {
      const lines = [
        { debitAmount: 1000, creditAmount: 0 },
        { debitAmount: 0, creditAmount: 500 },
      ];

      expect(validateJournalEntryBalance(lines)).toBe(false);
    });

    it('should handle floating point precision', () => {
      const lines = [
        { debitAmount: 100.1, creditAmount: 0 },
        { debitAmount: 100.2, creditAmount: 0 },
        { debitAmount: 0, creditAmount: 200.3 },
      ];

      expect(validateJournalEntryBalance(lines)).toBe(true);
    });
  });
});
