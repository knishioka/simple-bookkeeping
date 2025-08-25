import { AccountType, JournalStatus } from '@simple-bookkeeping/database';
import * as csv from 'csv-stringify';
import * as ExcelJS from 'exceljs';
import { Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middlewares/auth';
import { ledgerService } from '../services/ledger.service';

interface AccountWhereInput {
  organizationId: string;
  id?: string;
}

interface JournalEntryWhereInput {
  organizationId: string;
  status: { in: JournalStatus[] };
  entryDate?: {
    gte?: Date;
    lte?: Date;
    lt?: Date;
  };
}

interface JournalLineWhereInput {
  accountId: string;
  journalEntry: JournalEntryWhereInput;
}

/**
 * 現金出納帳を取得
 */
export const getCashBook = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const organizationId = (req as AuthenticatedRequest).user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Organization not found' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    // 勘定科目の存在確認
    const account = await prisma.account.findFirst({
      where: { code: '1110', organizationId },
    });

    if (!account) {
      console.warn('Cash account not found for organization:', {
        organizationId,
        accountCode: '1110',
      });
      // 勘定科目が存在しない場合は空のデータを返す
      return res.json({
        data: {
          openingBalance: 0,
          entries: [],
          closingBalance: 0,
        },
      });
    }

    const entries = await ledgerService.getCashBook({
      accountCode: '1110',
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
      organizationId,
    });

    // 開始残高を取得
    const openingBalance = await ledgerService.getOpeningBalance(
      '1110',
      new Date(startDate as string),
      organizationId
    );

    res.json({
      data: {
        openingBalance,
        entries,
        closingBalance: entries.length > 0 ? entries[entries.length - 1].balance : openingBalance,
      },
    });
  } catch (error) {
    console.error('Failed to get cash book:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      organizationId: (req as AuthenticatedRequest).user?.organizationId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      prismaError: error instanceof Error && 'code' in error ? error.code : undefined,
      fullError: error,
    });

    // Check for specific Prisma errors
    if (error instanceof Error) {
      if ('code' in error && (error.code === 'P2021' || error.code === 'P2022')) {
        console.error('Database schema issue detected. Migration may be required.', error);
        return res.status(500).json({
          error: 'Database schema is out of sync. Please contact support.',
          code: 'DB_SCHEMA_ERROR',
        });
      }
    }

    res.status(500).json({ error: 'Failed to get cash book' });
  }
};

/**
 * 預金出納帳を取得
 */
export const getBankBook = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const organizationId = (req as AuthenticatedRequest).user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Organization not found' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    // 預金科目の存在確認
    const bankCodes = ['1120', '1130'];
    const bankAccounts = await prisma.account.findMany({
      where: {
        code: { in: bankCodes },
        organizationId,
      },
    });

    if (bankAccounts.length === 0) {
      console.warn('No bank accounts found for organization:', {
        organizationId,
        accountCodes: bankCodes,
      });
      // 預金科目が存在しない場合は空のデータを返す
      return res.json({
        data: {
          openingBalance: 0,
          entries: [],
          closingBalance: 0,
        },
      });
    }

    const entries = await ledgerService.getBankBook({
      accountCode: '', // 複数の預金科目を扱うため空文字
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
      organizationId,
    });

    // 預金科目の合計開始残高を取得
    let totalOpeningBalance = 0;
    for (const code of bankCodes) {
      const balance = await ledgerService.getOpeningBalance(
        code,
        new Date(startDate as string),
        organizationId
      );
      totalOpeningBalance += balance;
    }

    res.json({
      data: {
        openingBalance: totalOpeningBalance,
        entries,
        closingBalance:
          entries.length > 0
            ? totalOpeningBalance +
              entries.reduce((sum, e) => sum + (e.debitAmount - e.creditAmount), 0)
            : totalOpeningBalance,
      },
    });
  } catch (error) {
    console.error('Failed to get bank book:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      organizationId: (req as AuthenticatedRequest).user?.organizationId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      prismaError: error instanceof Error && 'code' in error ? error.code : undefined,
      fullError: error,
    });

    // Check for specific Prisma errors
    if (error instanceof Error) {
      // P2002: Unique constraint violation
      // P2021: Table does not exist
      // P2022: Column does not exist
      if ('code' in error && (error.code === 'P2021' || error.code === 'P2022')) {
        console.error('Database schema issue detected. Migration may be required.', error);
        return res.status(500).json({
          error: 'Database schema is out of sync. Please contact support.',
          code: 'DB_SCHEMA_ERROR',
        });
      }
    }

    res.status(500).json({ error: 'Failed to get bank book' });
  }
};

/**
 * 売掛金台帳を取得
 */
export const getAccountsReceivable = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const organizationId = (req as AuthenticatedRequest).user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Organization not found' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    // 勘定科目の存在確認
    const account = await prisma.account.findFirst({
      where: { code: '1140', organizationId },
    });

    if (!account) {
      console.warn('Accounts receivable account not found for organization:', {
        organizationId,
        accountCode: '1140',
      });
      // 勘定科目が存在しない場合は空のデータを返す
      return res.json({
        data: {
          openingBalance: 0,
          entries: [],
          closingBalance: 0,
        },
      });
    }

    const entries = await ledgerService.getAccountsReceivable({
      accountCode: '1140',
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
      organizationId,
    });

    const openingBalance = await ledgerService.getOpeningBalance(
      '1140',
      new Date(startDate as string),
      organizationId
    );

    res.json({
      data: {
        openingBalance,
        entries,
        closingBalance: entries.length > 0 ? entries[entries.length - 1].balance : openingBalance,
      },
    });
  } catch (error) {
    console.error('Failed to get accounts receivable:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      organizationId: (req as AuthenticatedRequest).user?.organizationId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      prismaError: error instanceof Error && 'code' in error ? error.code : undefined,
      fullError: error,
    });

    // Check for specific Prisma errors
    if (error instanceof Error) {
      if ('code' in error && (error.code === 'P2021' || error.code === 'P2022')) {
        console.error('Database schema issue detected. Migration may be required.', error);
        return res.status(500).json({
          error: 'Database schema is out of sync. Please contact support.',
          code: 'DB_SCHEMA_ERROR',
        });
      }
    }

    res.status(500).json({ error: 'Failed to get accounts receivable' });
  }
};

/**
 * 買掛金台帳を取得
 */
export const getAccountsPayable = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const organizationId = (req as AuthenticatedRequest).user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Organization not found' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    // 勘定科目の存在確認
    const account = await prisma.account.findFirst({
      where: { code: '2110', organizationId },
    });

    if (!account) {
      console.warn('Accounts payable account not found for organization:', {
        organizationId,
        accountCode: '2110',
      });
      // 勘定科目が存在しない場合は空のデータを返す
      return res.json({
        data: {
          openingBalance: 0,
          entries: [],
          closingBalance: 0,
        },
      });
    }

    const entries = await ledgerService.getAccountsPayable({
      accountCode: '2110',
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
      organizationId,
    });

    const openingBalance = await ledgerService.getOpeningBalance(
      '2110',
      new Date(startDate as string),
      organizationId
    );

    res.json({
      data: {
        openingBalance,
        entries,
        closingBalance: entries.length > 0 ? entries[entries.length - 1].balance : openingBalance,
      },
    });
  } catch (error) {
    console.error('Failed to get accounts payable:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      organizationId: (req as AuthenticatedRequest).user?.organizationId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      prismaError: error instanceof Error && 'code' in error ? error.code : undefined,
      fullError: error,
    });

    // Check for specific Prisma errors
    if (error instanceof Error) {
      if ('code' in error && (error.code === 'P2021' || error.code === 'P2022')) {
        console.error('Database schema issue detected. Migration may be required.', error);
        return res.status(500).json({
          error: 'Database schema is out of sync. Please contact support.',
          code: 'DB_SCHEMA_ERROR',
        });
      }
    }

    res.status(500).json({ error: 'Failed to get accounts payable' });
  }
};

/**
 * 総勘定元帳を取得
 */
export const getGeneralLedger = async (req: Request, res: Response) => {
  try {
    const { from, to, accountId } = req.query;
    const organizationId = (req as AuthenticatedRequest).user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Organization not found' });
    }

    const whereClause: AccountWhereInput = {
      organizationId,
    };

    // Filter by specific account if provided
    if (accountId) {
      whereClause.id = accountId as string;
    }

    // Get accounts
    const accounts = await prisma.account.findMany({
      where: whereClause,
      orderBy: { code: 'asc' },
    });

    // Build ledger data for each account
    const ledgerData = await Promise.all(
      accounts.map(async (account) => {
        const entryWhereClause: JournalLineWhereInput = {
          accountId: account.id,
          journalEntry: {
            organizationId,
            status: { in: [JournalStatus.APPROVED, JournalStatus.LOCKED] },
          },
        };

        if (from || to) {
          entryWhereClause.journalEntry.entryDate = {};
          if (from) {
            entryWhereClause.journalEntry.entryDate.gte = new Date(from as string);
          }
          if (to) {
            entryWhereClause.journalEntry.entryDate.lte = new Date(to as string);
          }
        }

        const journalLines = await prisma.journalEntryLine.findMany({
          where: entryWhereClause,
          include: {
            journalEntry: true,
          },
          orderBy: {
            journalEntry: {
              entryDate: 'asc',
            },
          },
        });

        // Calculate running balance
        let runningBalance = 0;
        const entries = journalLines.map((line) => {
          const debitAmount = Number(line.debitAmount);
          const creditAmount = Number(line.creditAmount);

          // Update running balance based on account type
          if (
            account.accountType === AccountType.ASSET ||
            account.accountType === AccountType.EXPENSE
          ) {
            runningBalance += debitAmount - creditAmount;
          } else {
            runningBalance += creditAmount - debitAmount;
          }

          return {
            id: line.id,
            date: line.journalEntry.entryDate,
            entryNumber: line.journalEntry.entryNumber,
            description: line.description || line.journalEntry.description,
            debitAmount,
            creditAmount,
            runningBalance,
          };
        });

        return {
          account: {
            id: account.id,
            code: account.code,
            name: account.name,
            accountType: account.accountType,
          },
          entries,
        };
      })
    );

    res.json({ data: ledgerData });
  } catch (error) {
    console.error('Failed to get general ledger:', error);
    res.status(500).json({ error: 'Failed to get general ledger' });
  }
};

/**
 * 補助元帳を取得
 */
export const getSubsidiaryLedger = async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    const { from, to } = req.query;
    const organizationId = (req as AuthenticatedRequest).user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Organization not found' });
    }

    // Check if account exists
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        organizationId,
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Build query for journal entries
    const entryWhereClause: JournalLineWhereInput = {
      accountId,
      journalEntry: {
        organizationId,
        status: { in: [JournalStatus.APPROVED, JournalStatus.LOCKED] },
      },
    };

    if (from || to) {
      entryWhereClause.journalEntry.entryDate = {};
      if (from) {
        entryWhereClause.journalEntry.entryDate.gte = new Date(from as string);
      }
      if (to) {
        entryWhereClause.journalEntry.entryDate.lte = new Date(to as string);
      }
    }

    const journalLines = await prisma.journalEntryLine.findMany({
      where: entryWhereClause,
      include: {
        journalEntry: true,
      },
      orderBy: {
        journalEntry: {
          entryDate: 'asc',
        },
      },
    });

    // Calculate totals and balance
    let totalDebits = 0;
    let totalCredits = 0;
    let runningBalance = 0;

    const entries = journalLines.map((line) => {
      const debitAmount = Number(line.debitAmount);
      const creditAmount = Number(line.creditAmount);

      totalDebits += debitAmount;
      totalCredits += creditAmount;

      // Update running balance based on account type
      if (
        account.accountType === AccountType.ASSET ||
        account.accountType === AccountType.EXPENSE
      ) {
        runningBalance += debitAmount - creditAmount;
      } else {
        runningBalance += creditAmount - debitAmount;
      }

      return {
        id: line.id,
        date: line.journalEntry.entryDate,
        entryNumber: line.journalEntry.entryNumber,
        description: line.description || line.journalEntry.description,
        debitAmount,
        creditAmount,
        runningBalance,
      };
    });

    res.json({
      data: {
        account: {
          id: account.id,
          code: account.code,
          name: account.name,
          accountType: account.accountType,
        },
        entries,
        openingBalance: 0, // Simplified for now
        closingBalance: runningBalance,
        totalDebits,
        totalCredits,
      },
    });
  } catch (error) {
    console.error('Failed to get subsidiary ledger:', error);
    res.status(500).json({ error: 'Failed to get subsidiary ledger' });
  }
};

/**
 * 試算表を取得
 */
export const getTrialBalance = async (req: Request, res: Response) => {
  try {
    const { asOf, groupBy } = req.query;
    const organizationId = (req as AuthenticatedRequest).user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Organization not found' });
    }

    // Get all accounts
    const accounts = await prisma.account.findMany({
      where: {
        organizationId,
      },
      orderBy: { code: 'asc' },
    });

    // Build date filter
    const dateFilter: JournalEntryWhereInput = {
      organizationId,
      status: { in: [JournalStatus.APPROVED, JournalStatus.LOCKED] },
    };

    if (asOf) {
      dateFilter.entryDate = { lte: new Date(asOf as string) };
    }

    // Calculate balance for each account
    const accountBalances = await Promise.all(
      accounts.map(async (account) => {
        const result = await prisma.journalEntryLine.aggregate({
          where: {
            accountId: account.id,
            journalEntry: dateFilter,
          },
          _sum: {
            debitAmount: true,
            creditAmount: true,
          },
        });

        const debitTotal = Number(result._sum.debitAmount || 0);
        const creditTotal = Number(result._sum.creditAmount || 0);

        return {
          id: account.id,
          code: account.code,
          name: account.name,
          accountType: account.accountType,
          debitBalance: debitTotal,
          creditBalance: creditTotal,
        };
      })
    );

    // Calculate totals
    let totalDebits = 0;
    let totalCredits = 0;

    accountBalances.forEach((account) => {
      totalDebits += account.debitBalance;
      totalCredits += account.creditBalance;
    });

    // Group by account type if requested
    if (groupBy === 'accountType') {
      const groups: Record<
        string,
        {
          accounts: typeof accountBalances;
          totalDebits: number;
          totalCredits: number;
        }
      > = {};

      accountBalances.forEach((account) => {
        if (!groups[account.accountType]) {
          groups[account.accountType] = {
            accounts: [],
            totalDebits: 0,
            totalCredits: 0,
          };
        }
        groups[account.accountType].accounts.push(account);
        groups[account.accountType].totalDebits += account.debitBalance;
        groups[account.accountType].totalCredits += account.creditBalance;
      });

      res.json({
        data: {
          groups,
          totalDebits,
          totalCredits,
        },
      });
    } else {
      res.json({
        data: {
          accounts: accountBalances,
          totalDebits,
          totalCredits,
        },
      });
    }
  } catch (error) {
    console.error('Failed to get trial balance:', error);
    res.status(500).json({ error: 'Failed to get trial balance' });
  }
};

/**
 * 勘定残高を取得
 */
export const getAccountBalance = async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    const { asOf } = req.query;
    const organizationId = (req as AuthenticatedRequest).user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Organization not found' });
    }

    // Check if account exists
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        organizationId,
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Build date filter
    const dateFilter: JournalEntryWhereInput = {
      organizationId,
      status: { in: [JournalStatus.APPROVED, JournalStatus.LOCKED] },
    };

    if (asOf) {
      dateFilter.entryDate = { lte: new Date(asOf as string) };
    }

    // Calculate balance
    const result = await prisma.journalEntryLine.aggregate({
      where: {
        accountId,
        journalEntry: dateFilter,
      },
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
    });

    const debitTotal = Number(result._sum.debitAmount || 0);
    const creditTotal = Number(result._sum.creditAmount || 0);

    // Calculate balance based on account type
    let balance = 0;
    if (account.accountType === AccountType.ASSET || account.accountType === AccountType.EXPENSE) {
      balance = debitTotal - creditTotal;
    } else {
      balance = creditTotal - debitTotal;
    }

    res.json({
      data: {
        accountId,
        accountCode: account.code,
        accountName: account.name,
        balance,
        debitTotal,
        creditTotal,
      },
    });
  } catch (error) {
    console.error('Failed to get account balance:', error);
    res.status(500).json({ error: 'Failed to get account balance' });
  }
};

/**
 * 元帳データをエクスポート
 */
export const exportLedger = async (req: Request, res: Response) => {
  try {
    const { format, type, accountId, from, to } = req.query;
    const organizationId = (req as AuthenticatedRequest).user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({ error: 'Organization not found' });
    }

    if (!format) {
      return res.status(400).json({ error: 'Format is required' });
    }

    // Get ledger data based on type
    let data: Array<{ [key: string]: string | number }>;
    let filename: string;

    if (type === 'trial-balance') {
      // Get trial balance data
      const accounts = await prisma.account.findMany({
        where: {
          organizationId,
        },
        orderBy: { code: 'asc' },
      });

      const balances = await Promise.all(
        accounts.map(async (account) => {
          const result = await prisma.journalEntryLine.aggregate({
            where: {
              accountId: account.id,
              journalEntry: {
                organizationId,
                status: { in: [JournalStatus.APPROVED, JournalStatus.LOCKED] },
              },
            },
            _sum: {
              debitAmount: true,
              creditAmount: true,
            },
          });

          return {
            code: account.code,
            name: account.name,
            debit: Number(result._sum.debitAmount || 0),
            credit: Number(result._sum.creditAmount || 0),
          };
        })
      );

      data = balances;
      filename = 'trial-balance';
    } else {
      // Get general ledger data
      if (!accountId) {
        return res.status(400).json({ error: 'Account ID is required for ledger export' });
      }

      const account = await prisma.account.findFirst({
        where: {
          id: accountId as string,
          organizationId,
        },
      });

      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const entryWhereClause: JournalLineWhereInput = {
        accountId: accountId as string,
        journalEntry: {
          organizationId,
          status: { in: [JournalStatus.APPROVED, JournalStatus.LOCKED] },
        },
      };

      if (from || to) {
        entryWhereClause.journalEntry.entryDate = {};
        if (from) {
          entryWhereClause.journalEntry.entryDate.gte = new Date(from as string);
        }
        if (to) {
          entryWhereClause.journalEntry.entryDate.lte = new Date(to as string);
        }
      }

      const journalLines = await prisma.journalEntryLine.findMany({
        where: entryWhereClause,
        include: {
          journalEntry: true,
        },
        orderBy: {
          journalEntry: {
            entryDate: 'asc',
          },
        },
      });

      data = journalLines.map((line) => ({
        date: line.journalEntry.entryDate.toISOString().split('T')[0],
        entryNumber: line.journalEntry.entryNumber,
        description: line.description || line.journalEntry.description,
        debit: Number(line.debitAmount),
        credit: Number(line.creditAmount),
      }));

      filename = `ledger-${account.code}`;
    }

    // Export based on format
    if (format === 'csv') {
      csv.stringify(data, { header: true }, (err: Error | undefined, output: string) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to generate CSV' });
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        res.send(output);
      });
    } else if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Ledger');

      // Add headers
      if (data.length > 0) {
        sheet.columns = Object.keys(data[0]).map((key) => ({
          header: key.charAt(0).toUpperCase() + key.slice(1),
          key,
          width: 15,
        }));
        sheet.addRows(data);
      }

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);

      await workbook.xlsx.write(res);
      res.end();
    } else {
      res.status(400).json({ error: 'Invalid format. Use csv or xlsx' });
    }
  } catch (error) {
    console.error('Failed to export ledger:', error);
    res.status(500).json({ error: 'Failed to export ledger' });
  }
};
