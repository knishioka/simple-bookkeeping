import { Readable } from 'stream';

import { Logger, CreateAccountInput } from '@simple-bookkeeping/shared';
import { AccountType } from '@simple-bookkeeping/types';
import csvParser from 'csv-parser';
import { Response } from 'express';

import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middlewares/auth';

const logger = new Logger({ component: 'AccountsController' });

interface AccountQuery {
  type?: AccountType;
  active?: string;
}

/**
 * @swagger
 * /api/v1/accounts:
 *   get:
 *     summary: Get all accounts
 *     description: Retrieve all accounts for the current organization with optional filtering
 *     tags: [Accounts]
 *     parameters:
 *       - $ref: '#/components/parameters/organizationId'
 *       - name: type
 *         in: query
 *         description: Filter by account type
 *         schema:
 *           type: string
 *           enum: [ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE]
 *       - name: active
 *         in: query
 *         description: Filter by active status
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Account'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
export const getAccounts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { type, active } = req.query as AccountQuery;
    const organizationId = req.user?.organizationId;

    const where: Record<string, unknown> = {
      organizationId,
    };
    if (type) {
      where.accountType = type;
    }
    if (active !== undefined) {
      where.isActive = active === 'true';
    }

    const accounts = await prisma.account.findMany({
      where,
      include: {
        parent: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        _count: {
          select: {
            children: true,
          },
        },
      },
      orderBy: {
        code: 'asc',
      },
    });

    res.json({
      data: accounts,
    });
  } catch (error) {
    logger.error('Get accounts error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '勘定科目の取得中にエラーが発生しました',
      },
    });
  }
};

export const getAccountTree = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;

    const accounts = await prisma.account.findMany({
      where: {
        parentId: null,
        organizationId,
      },
      include: {
        children: {
          include: {
            children: true,
          },
        },
      },
      orderBy: {
        code: 'asc',
      },
    });

    res.json({
      data: accounts,
    });
  } catch (error) {
    logger.error('Get account tree error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '勘定科目階層の取得中にエラーが発生しました',
      },
    });
  }
};

export const getAccount = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { id } = req.params as { id: string };
    const organizationId = req.user?.organizationId;

    const account = await prisma.account.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        parent: true,
        children: true,
        lines: {
          select: {
            debitAmount: true,
            creditAmount: true,
          },
        },
      },
    });

    if (!account) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: '勘定科目が見つかりません',
        },
      });
    }

    // Calculate balance
    let balance = 0;
    if (account.lines) {
      const totalDebit = account.lines.reduce((sum, line) => sum + Number(line.debitAmount), 0);
      const totalCredit = account.lines.reduce((sum, line) => sum + Number(line.creditAmount), 0);

      // Balance calculation depends on account type
      // Asset and Expense accounts: debit increases balance, credit decreases
      // Liability, Equity, and Revenue accounts: credit increases balance, debit decreases
      if (account.accountType === 'ASSET' || account.accountType === 'EXPENSE') {
        balance = totalDebit - totalCredit;
      } else {
        balance = totalCredit - totalDebit;
      }
    }

    // Remove lines from response and add balance
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { lines, ...accountData } = account;
    const responseData = {
      ...accountData,
      balance,
    };

    res.json({
      data: responseData,
    });
  } catch (error) {
    logger.error('Get account error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '勘定科目の取得中にエラーが発生しました',
      },
    });
  }
};

export const createAccount = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { code, name, accountType, parentId } = req.body as CreateAccountInput;

    // Check if account code already exists in this organization
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        error: {
          code: 'ORGANIZATION_REQUIRED',
          message: '組織が選択されていません',
        },
      });
    }

    const existingAccount = await prisma.account.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code,
        },
      },
    });

    if (existingAccount) {
      return res.status(400).json({
        error: {
          code: 'DUPLICATE_CODE',
          message: 'この勘定科目コードは既に使用されています',
        },
      });
    }

    // Validate parent account if provided
    if (parentId) {
      const parentAccount = await prisma.account.findFirst({
        where: {
          id: parentId,
          organizationId,
        },
      });

      if (!parentAccount) {
        return res.status(400).json({
          error: {
            code: 'INVALID_PARENT',
            message: '親勘定科目が見つかりません',
          },
        });
      }

      if (parentAccount.accountType !== accountType) {
        return res.status(400).json({
          error: {
            code: 'TYPE_MISMATCH',
            message: '親勘定科目と同じタイプである必要があります',
          },
        });
      }
    }

    const account = await prisma.account.create({
      data: {
        code,
        name,
        accountType,
        parentId,
        organizationId,
      },
      include: {
        parent: true,
      },
    });

    res.status(201).json({
      data: account,
    });
  } catch (error) {
    logger.error('Create account error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '勘定科目の作成中にエラーが発生しました',
      },
    });
  }
};

export const updateAccount = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { id } = req.params as { id: string };
    const { code, name, accountType, parentId } = req.body as Partial<CreateAccountInput>;

    const organizationId = req.user?.organizationId;
    const account = await prisma.account.findFirst({
      where: {
        id,
        organizationId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        accountType: true,
        parentId: true,
        isSystem: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        organizationId: true,
        _count: {
          select: {
            lines: true,
          },
        },
      },
    });

    if (!account) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: '勘定科目が見つかりません',
        },
      });
    }

    if (account.isSystem) {
      return res.status(400).json({
        error: {
          code: 'SYSTEM_ACCOUNT',
          message: 'システム標準科目は編集できません',
        },
      });
    }

    // Prevent account code changes
    if (code && code !== account.code) {
      return res.status(400).json({
        error: {
          code: 'CODE_CHANGE_NOT_ALLOWED',
          message: '勘定科目コードは変更できません',
        },
      });
    }

    // Prevent account type changes for accounts with transactions
    if (accountType && accountType !== account.accountType && account._count.lines > 0) {
      return res.status(400).json({
        error: {
          code: 'TYPE_CHANGE_NOT_ALLOWED',
          message: '仕訳で使用されている勘定科目の種別は変更できません',
        },
      });
    }

    const updateData: Partial<{ name: string; parentId: string | null; accountType: AccountType }> =
      {};
    if (name !== undefined) updateData.name = name;
    if (parentId !== undefined) updateData.parentId = parentId;
    if (accountType !== undefined && account._count.lines === 0)
      updateData.accountType = accountType;

    const updated = await prisma.account.update({
      where: { id },
      data: updateData,
      include: {
        parent: true,
      },
    });

    res.json({
      data: updated,
    });
  } catch (error) {
    logger.error('Update account error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '勘定科目の更新中にエラーが発生しました',
      },
    });
  }
};

export const deleteAccount = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const { id } = req.params as { id: string };

    const organizationId = req.user?.organizationId;
    const account = await prisma.account.findFirst({
      where: {
        id,
        organizationId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        accountType: true,
        parentId: true,
        isSystem: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        organizationId: true,
        _count: {
          select: {
            lines: true,
            children: true,
          },
        },
      },
    });

    if (!account) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: '勘定科目が見つかりません',
        },
      });
    }

    if (account.isSystem) {
      return res.status(400).json({
        error: {
          code: 'SYSTEM_ACCOUNT',
          message: 'システム標準科目は削除できません',
        },
      });
    }

    if (account._count.lines > 0) {
      return res.status(400).json({
        error: {
          code: 'ACCOUNT_IN_USE',
          message: 'この勘定科目は仕訳で使用されているため削除できません',
        },
      });
    }

    if (account._count.children > 0) {
      return res.status(400).json({
        error: {
          code: 'HAS_CHILDREN',
          message: 'この勘定科目は子科目があるため削除できません',
        },
      });
    }

    await prisma.account.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    res.json({
      data: {
        message: '勘定科目を無効化しました',
      },
    });
  } catch (error) {
    logger.error('Delete account error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '勘定科目の削除中にエラーが発生しました',
      },
    });
  }
};

interface CSVRow {
  code: string;
  name: string;
  accountType: string;
}

export const importAccounts = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response | undefined> => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        error: {
          code: 'ORGANIZATION_REQUIRED',
          message: '組織が選択されていません',
        },
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: {
          code: 'FILE_REQUIRED',
          message: 'CSVファイルをアップロードしてください',
        },
      });
    }

    const results: CSVRow[] = [];
    const errors: string[] = [];
    const imported: string[] = [];

    // Parse CSV from buffer
    const stream = Readable.from(req.file.buffer.toString());

    await new Promise<void>((resolve, reject) => {
      stream
        .pipe(csvParser())
        .on('data', (data: CSVRow) => {
          results.push(data);
        })
        .on('error', reject)
        .on('end', resolve);
    });

    // Validate CSV format
    if (results.length === 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_CSV_FORMAT',
          message: 'CSVファイルが空か、形式が正しくありません',
        },
      });
    }

    // Check required columns
    const firstRow = results[0];
    if (!('code' in firstRow) || !('name' in firstRow) || !('accountType' in firstRow)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_CSV_FORMAT',
          message: 'CSVファイルには code, name, accountType の列が必要です',
        },
      });
    }

    // Process each row
    for (const row of results) {
      try {
        // Validate account type
        if (!['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].includes(row.accountType)) {
          errors.push(`${row.code}: 無効な勘定科目タイプ: ${row.accountType}`);
          continue;
        }

        // Check if account code already exists
        const existingAccount = await prisma.account.findUnique({
          where: {
            organizationId_code: {
              organizationId,
              code: row.code,
            },
          },
        });

        if (existingAccount) {
          errors.push(`${row.code}: 既に存在する勘定科目コードです`);
          continue;
        }

        // Create account
        await prisma.account.create({
          data: {
            code: row.code,
            name: row.name,
            accountType: row.accountType as AccountType,
            organizationId,
          },
        });

        imported.push(row.code);
      } catch (error) {
        errors.push(`${row.code}: インポート中にエラーが発生しました`);
        logger.error('Import account error:', error);
      }
    }

    res.status(201).json({
      data: {
        imported: imported.length,
        errors,
      },
    });
  } catch (error) {
    logger.error('Import accounts error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '勘定科目のインポート中にエラーが発生しました',
      },
    });
  }
};
