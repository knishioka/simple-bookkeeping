import { JournalStatus } from '@simple-bookkeeping/database';
import { CreateJournalEntryInput } from '@simple-bookkeeping/shared';
import { Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middlewares/auth';
import {
  generateEntryNumber,
  getAccountingPeriod,
  validateJournalEntryBalance,
} from '../services/journalEntry.service';

interface JournalEntryQuery {
  from?: string;
  to?: string;
  status?: string;
  page?: string;
  limit?: string;
}

export const getJournalEntries = async (
  req: AuthenticatedRequest &
    Request<Record<string, never>, Record<string, never>, Record<string, never>, JournalEntryQuery>,
  res: Response
) => {
  try {
    const { from, to, status, page = '1', limit = '50' } = req.query;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        error: {
          code: 'ORGANIZATION_REQUIRED',
          message: '組織の選択が必要です',
        },
      });
    }

    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      organizationId,
    };
    if (from || to) {
      where.entryDate = {};
      if (from) where.entryDate.gte = new Date(from);
      if (to) where.entryDate.lte = new Date(to);
    }
    if (status) {
      where.status = status as JournalStatus;
    }

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
            orderBy: {
              lineNumber: 'asc',
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          entryDate: 'desc',
        },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.journalEntry.count({ where }),
    ]);

    res.json({
      data: entries,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get journal entries error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '仕訳の取得中にエラーが発生しました',
      },
    });
  }
};

export const getJournalEntry = async (
  req: AuthenticatedRequest & Request<{ id: string }>,
  res: Response
) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        error: {
          code: 'ORGANIZATION_REQUIRED',
          message: '組織の選択が必要です',
        },
      });
    }

    const entry = await prisma.journalEntry.findFirst({
      where: { id, organizationId },
      include: {
        lines: {
          include: {
            account: true,
          },
          orderBy: {
            lineNumber: 'asc',
          },
        },
        accountingPeriod: true,
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!entry) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: '仕訳が見つかりません',
        },
      });
    }

    res.json({
      data: entry,
    });
  } catch (error) {
    console.error('Get journal entry error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '仕訳の取得中にエラーが発生しました',
      },
    });
  }
};

export const createJournalEntry = async (
  req: AuthenticatedRequest &
    Request<Record<string, never>, Record<string, never>, CreateJournalEntryInput>,
  res: Response
) => {
  try {
    const { entryDate, description, documentNumber, lines } = req.body;
    const userId = req.user?.id || '';
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        error: {
          code: 'ORGANIZATION_REQUIRED',
          message: '組織の選択が必要です',
        },
      });
    }

    // Validate balance
    if (!validateJournalEntryBalance(lines)) {
      return res.status(400).json({
        error: {
          code: 'UNBALANCED_ENTRY',
          message: '借方と貸方の合計が一致しません',
        },
      });
    }

    // Validate that all accounts belong to the organization
    const accountIds = lines.map((line: any) => line.accountId);
    const accountCount = await prisma.account.count({
      where: {
        id: { in: accountIds },
        organizationId,
      },
    });

    if (accountCount !== accountIds.length) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ACCOUNT',
          message: '無効な勘定科目が含まれています',
        },
      });
    }

    // Get accounting period
    const date = new Date(entryDate);
    const accountingPeriod = await getAccountingPeriod(date, organizationId);

    if (!accountingPeriod) {
      return res.status(400).json({
        error: {
          code: 'NO_ACCOUNTING_PERIOD',
          message: 'この日付に対応する会計期間が見つかりません',
        },
      });
    }

    // Generate entry number
    const entryNumber = await generateEntryNumber(date, organizationId);

    // Create journal entry with lines in a transaction
    const entry = await prisma.$transaction(async (tx) => {
      const journalEntry = await tx.journalEntry.create({
        data: {
          entryDate: date,
          entryNumber,
          description,
          documentNumber,
          accountingPeriodId: accountingPeriod.id,
          organizationId,
          createdById: userId,
          status: JournalStatus.DRAFT,
          lines: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            create: lines.map((line: any, index: number) => ({
              accountId: line.accountId,
              debitAmount: line.debitAmount,
              creditAmount: line.creditAmount,
              description: line.description,
              taxRate: line.taxRate,
              lineNumber: index + 1,
            })),
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

      return journalEntry;
    });

    res.status(201).json({
      data: entry,
    });
  } catch (error) {
    console.error('Create journal entry error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '仕訳の作成中にエラーが発生しました',
      },
    });
  }
};

export const updateJournalEntry = async (
  req: AuthenticatedRequest &
    Request<{ id: string }, Record<string, never>, Partial<CreateJournalEntryInput>>,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { description, documentNumber, lines } = req.body;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        error: {
          code: 'ORGANIZATION_REQUIRED',
          message: '組織の選択が必要です',
        },
      });
    }

    const existingEntry = await prisma.journalEntry.findFirst({
      where: { id, organizationId },
    });

    if (!existingEntry) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: '仕訳が見つかりません',
        },
      });
    }

    if (existingEntry.status !== JournalStatus.DRAFT) {
      return res.status(400).json({
        error: {
          code: 'ENTRY_NOT_EDITABLE',
          message: '下書き状態の仕訳のみ編集可能です',
        },
      });
    }

    // Validate that all accounts belong to the organization if lines are provided
    if (lines) {
      const accountIds = lines.map((line: any) => line.accountId);
      const accountCount = await prisma.account.count({
        where: {
          id: { in: accountIds },
          organizationId,
        },
      });

      if (accountCount !== accountIds.length) {
        return res.status(400).json({
          error: {
            code: 'INVALID_ACCOUNT',
            message: '無効な勘定科目が含まれています',
          },
        });
      }
    }

    // Validate balance if lines are provided
    if (lines && !validateJournalEntryBalance(lines)) {
      return res.status(400).json({
        error: {
          code: 'UNBALANCED_ENTRY',
          message: '借方と貸方の合計が一致しません',
        },
      });
    }

    // Update entry in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Update entry details
      await tx.journalEntry.update({
        where: { id },
        data: {
          description,
          documentNumber,
        },
      });

      // Update lines if provided
      if (lines) {
        // Delete existing lines
        await tx.journalEntryLine.deleteMany({
          where: { journalEntryId: id },
        });

        // Create new lines
        await tx.journalEntryLine.createMany({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: lines.map((line: any, index: number) => ({
            journalEntryId: id,
            accountId: line.accountId,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            description: line.description,
            taxRate: line.taxRate,
            lineNumber: index + 1,
          })),
        });
      }

      // Fetch updated entry with relations
      return await tx.journalEntry.findFirst({
        where: { id, organizationId },
        include: {
          lines: {
            include: {
              account: true,
            },
          },
        },
      });
    });

    res.json({
      data: updated,
    });
  } catch (error) {
    console.error('Update journal entry error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '仕訳の更新中にエラーが発生しました',
      },
    });
  }
};

export const deleteJournalEntry = async (
  req: AuthenticatedRequest & Request<{ id: string }>,
  res: Response
) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        error: {
          code: 'ORGANIZATION_REQUIRED',
          message: '組織の選択が必要です',
        },
      });
    }

    const entry = await prisma.journalEntry.findFirst({
      where: { id, organizationId },
    });

    if (!entry) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: '仕訳が見つかりません',
        },
      });
    }

    if (entry.status !== JournalStatus.DRAFT) {
      return res.status(400).json({
        error: {
          code: 'ENTRY_NOT_DELETABLE',
          message: '下書き状態の仕訳のみ削除可能です',
        },
      });
    }

    await prisma.$transaction(async (tx) => {
      // Verify entry belongs to organization before deletion
      const entryToDelete = await tx.journalEntry.findFirst({
        where: { id, organizationId },
      });

      if (!entryToDelete) {
        throw new Error('Entry not found');
      }

      await tx.journalEntry.delete({
        where: { id },
      });
    });

    res.json({
      data: {
        message: '仕訳を削除しました',
      },
    });
  } catch (error) {
    console.error('Delete journal entry error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '仕訳の削除中にエラーが発生しました',
      },
    });
  }
};

export const approveJournalEntry = async (
  req: AuthenticatedRequest & Request<{ id: string }>,
  res: Response
) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        error: {
          code: 'ORGANIZATION_REQUIRED',
          message: '組織の選択が必要です',
        },
      });
    }

    const entry = await prisma.journalEntry.findFirst({
      where: { id, organizationId },
    });

    if (!entry) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: '仕訳が見つかりません',
        },
      });
    }

    if (entry.status !== JournalStatus.DRAFT) {
      return res.status(400).json({
        error: {
          code: 'INVALID_STATUS',
          message: '下書き状態の仕訳のみ承認可能です',
        },
      });
    }

    const updated = await prisma.journalEntry.update({
      where: { id },
      data: {
        status: JournalStatus.APPROVED,
      },
    });

    res.json({
      data: updated,
    });
  } catch (error) {
    console.error('Approve journal entry error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '仕訳の承認中にエラーが発生しました',
      },
    });
  }
};
