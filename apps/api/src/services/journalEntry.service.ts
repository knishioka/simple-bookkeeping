import { JournalStatus } from '@simple-bookkeeping/database';
import { Logger } from '@simple-bookkeeping/shared';

import { prisma } from '../lib/prisma';

const logger = new Logger({ component: 'JournalEntryService' });

// Constants
const FLOATING_POINT_TOLERANCE = 0.01;
const ENTRY_NUMBER_SEQUENCE_LENGTH = 4;

// ... (existing functions)

interface CsvRecord {
  日付: string;
  借方勘定: string;
  貸方勘定: string;
  金額: string;
  摘要: string;
}

interface AccountMap {
  id: string;
  name: string;
  code: string;
}

interface AccountingPeriodMap {
  id: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Optimized CSV import function that avoids N+1 queries
 * Pre-fetches all required data and uses Maps for O(1) lookups
 */
export const createJournalEntriesFromCsv = async (
  records: CsvRecord[],
  organizationId: string,
  userId: string
) => {
  logger.info('Starting CSV import', {
    recordCount: records.length,
    organizationId,
  });

  const results = await prisma.$transaction(async (tx) => {
    // Pre-fetch all required data to avoid N+1 queries
    const [accounts, accountingPeriods, lastEntryNumbers] = await Promise.all([
      // Fetch all active accounts
      tx.account.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true, code: true },
      }),

      // Fetch all active accounting periods
      tx.accountingPeriod.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, startDate: true, endDate: true },
      }),

      // Fetch last entry numbers for each month
      tx.journalEntry.groupBy({
        by: ['entryNumber'],
        where: { organizationId },
        _max: { entryNumber: true },
      }),
    ]);

    // Create Maps for O(1) lookup performance
    const accountMap = new Map<string, AccountMap>(accounts.map((acc) => [acc.name, acc]));

    // Helper function to find accounting period
    const findAccountingPeriod = (date: Date): AccountingPeriodMap | undefined => {
      return accountingPeriods.find((period) => date >= period.startDate && date <= period.endDate);
    };

    // Initialize entry number counters
    const entryNumberCounters = new Map<string, number>();
    lastEntryNumbers.forEach((entry) => {
      if (entry._max.entryNumber) {
        const yearMonth = entry._max.entryNumber.substring(0, 6);
        const sequence = parseInt(entry._max.entryNumber.slice(-ENTRY_NUMBER_SEQUENCE_LENGTH));
        entryNumberCounters.set(yearMonth, sequence);
      }
    });

    // Process records with validation
    const createdEntries = [];
    const errors: string[] = [];

    for (let index = 0; index < records.length; index++) {
      const record = records[index];

      try {
        // Validate accounts
        const debitAccount = accountMap.get(record.借方勘定);
        const creditAccount = accountMap.get(record.貸方勘定);

        if (!debitAccount) {
          errors.push(`Row ${index + 1}: 借方勘定 "${record.借方勘定}" が見つかりません`);
          continue;
        }

        if (!creditAccount) {
          errors.push(`Row ${index + 1}: 貸方勘定 "${record.貸方勘定}" が見つかりません`);
          continue;
        }

        // Validate amount
        const amount = parseFloat(record.金額);
        if (isNaN(amount) || amount <= 0) {
          errors.push(`Row ${index + 1}: 無効な金額 "${record.金額}"`);
          continue;
        }

        // Validate date
        const entryDate = new Date(record.日付);
        if (isNaN(entryDate.getTime())) {
          errors.push(`Row ${index + 1}: 無効な日付 "${record.日付}"`);
          continue;
        }

        // Find accounting period
        const accountingPeriod = findAccountingPeriod(entryDate);
        if (!accountingPeriod) {
          errors.push(`Row ${index + 1}: 日付 "${record.日付}" に対応する会計期間が見つかりません`);
          continue;
        }

        // Generate entry number
        const year = entryDate.getFullYear();
        const month = String(entryDate.getMonth() + 1).padStart(2, '0');
        const yearMonth = `${year}${month}`;

        const currentSequence = (entryNumberCounters.get(yearMonth) || 0) + 1;
        entryNumberCounters.set(yearMonth, currentSequence);

        const entryNumber = `${yearMonth}${String(currentSequence).padStart(ENTRY_NUMBER_SEQUENCE_LENGTH, '0')}`;

        // Create journal entry
        const newEntry = await tx.journalEntry.create({
          data: {
            entryDate,
            entryNumber,
            description: record.摘要 || '',
            accountingPeriodId: accountingPeriod.id,
            organizationId,
            createdById: userId,
            status: JournalStatus.DRAFT,
            lines: {
              create: [
                {
                  accountId: debitAccount.id,
                  debitAmount: amount,
                  creditAmount: 0,
                  description: record.摘要 || '',
                  lineNumber: 1,
                },
                {
                  accountId: creditAccount.id,
                  debitAmount: 0,
                  creditAmount: amount,
                  description: record.摘要 || '',
                  lineNumber: 2,
                },
              ],
            },
          },
          include: {
            lines: {
              include: {
                account: true,
              },
            },
          },
        });

        createdEntries.push(newEntry);
      } catch (error) {
        logger.error('Error processing CSV record', error, {
          index,
          record,
        });
        errors.push(
          `Row ${index + 1}: 予期しないエラー - ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // If there are errors, throw them
    if (errors.length > 0) {
      throw new Error(`CSV import failed with ${errors.length} errors:\n${errors.join('\n')}`);
    }

    logger.info('CSV import completed', {
      createdCount: createdEntries.length,
      organizationId,
    });

    return createdEntries;
  });

  return results;
};

/**
 * Generate entry number for a journal entry
 * Format: YYYYMMXXXX (e.g., 2024010001)
 */
export const generateEntryNumber = async (date: Date, organizationId: string): Promise<string> => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const yearMonth = `${year}${month}`;

  // Find the last entry number for the month
  const lastEntry = await prisma.journalEntry.findFirst({
    where: {
      organizationId,
      entryNumber: {
        startsWith: yearMonth,
      },
    },
    orderBy: {
      entryNumber: 'desc',
    },
    select: {
      entryNumber: true,
    },
  });

  let sequence = 1;
  if (lastEntry) {
    const lastSequence = parseInt(lastEntry.entryNumber.slice(-ENTRY_NUMBER_SEQUENCE_LENGTH));
    sequence = lastSequence + 1;
  }

  return `${yearMonth}${String(sequence).padStart(ENTRY_NUMBER_SEQUENCE_LENGTH, '0')}`;
};

/**
 * Validate that journal entry lines are balanced
 * @param lines Array of journal entry lines
 * @returns true if balanced, false otherwise
 */
export const validateJournalEntryBalance = (
  lines: Array<{ debitAmount: number; creditAmount: number }>
): boolean => {
  const totalDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);

  // Allow for small floating point differences
  return Math.abs(totalDebit - totalCredit) < FLOATING_POINT_TOLERANCE;
};

/**
 * Get accounting period for a given date
 */
export const getAccountingPeriod = async (date: Date, organizationId: string) => {
  // First try to find an active period for the date
  const activePeriod = await prisma.accountingPeriod.findFirst({
    where: {
      organizationId,
      startDate: { lte: date },
      endDate: { gte: date },
      isActive: true,
    },
  });

  if (activePeriod) {
    return activePeriod;
  }

  // If no active period found, try to find any period for the date
  return await prisma.accountingPeriod.findFirst({
    where: {
      organizationId,
      startDate: { lte: date },
      endDate: { gte: date },
    },
    orderBy: {
      isActive: 'desc', // Prefer active periods if multiple periods exist for the date
    },
  });
};
