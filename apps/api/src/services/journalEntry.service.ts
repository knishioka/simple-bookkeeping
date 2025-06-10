import { prisma } from '@simple-bookkeeping/database/src/client';

export const generateEntryNumber = async (date: Date): Promise<string> => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  // Find the last entry number for the month
  const lastEntry = await prisma.journalEntry.findFirst({
    where: {
      entryNumber: {
        startsWith: `${year}${month}`,
      },
    },
    orderBy: {
      entryNumber: 'desc',
    },
  });

  let sequence = 1;
  if (lastEntry) {
    const lastSequence = parseInt(lastEntry.entryNumber.slice(-4));
    sequence = lastSequence + 1;
  }

  return `${year}${month}${String(sequence).padStart(4, '0')}`;
};

export const validateJournalEntryBalance = (
  lines: Array<{ debitAmount: number; creditAmount: number }>
): boolean => {
  const totalDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);

  // Allow for small floating point differences
  return Math.abs(totalDebit - totalCredit) < 0.01;
};

export const getAccountingPeriod = async (date: Date) => {
  return await prisma.accountingPeriod.findFirst({
    where: {
      startDate: { lte: date },
      endDate: { gte: date },
      isActive: true,
    },
  });
};
