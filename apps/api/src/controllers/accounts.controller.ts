import { CreateAccountInput } from '@simple-bookkeeping/shared';
import { Response } from 'express';

import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middlewares/auth';

interface AccountQuery {
  type?: string;
  active?: string;
}

export const getAccounts = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
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
    console.error('Get accounts error:', error);
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
    console.error('Get account tree error:', error);
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
): Promise<Response<any, Record<string, any>> | undefined> => {
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

    res.json({
      data: account,
    });
  } catch (error) {
    console.error('Get account error:', error);
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
): Promise<Response<any, Record<string, any>> | undefined> => {
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
    console.error('Create account error:', error);
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
): Promise<Response<any, Record<string, any>> | undefined> => {
  try {
    const { id } = req.params as { id: string };
    const { name, parentId } = req.body as Partial<CreateAccountInput>;

    const organizationId = req.user?.organizationId;
    const account = await prisma.account.findFirst({
      where: { 
        id,
        organizationId,
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

    const updated = await prisma.account.update({
      where: { id },
      data: {
        name,
        parentId,
      },
      include: {
        parent: true,
      },
    });

    res.json({
      data: updated,
    });
  } catch (error) {
    console.error('Update account error:', error);
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
): Promise<Response<any, Record<string, any>> | undefined> => {
  try {
    const { id } = req.params as { id: string };

    const organizationId = req.user?.organizationId;
    const account = await prisma.account.findFirst({
      where: { 
        id,
        organizationId,
      },
      include: {
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
    console.error('Delete account error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '勘定科目の削除中にエラーが発生しました',
      },
    });
  }
};