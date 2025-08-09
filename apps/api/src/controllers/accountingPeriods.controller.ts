import { PrismaClient } from '@prisma/client';
import { UserRole } from '@simple-bookkeeping/database';
import {
  createAccountingPeriodSchema,
  updateAccountingPeriodSchema,
  AccountingPeriodFilter,
} from '@simple-bookkeeping/types';
import { Request, Response } from 'express';
import { z } from 'zod';

import { BadRequestError, NotFoundError, ConflictError } from '../errors';
import { AuthenticatedRequest } from '../middlewares/auth';
import { AccountingPeriodService } from '../services/accountingPeriod.service';

const prisma = new PrismaClient();
const accountingPeriodService = new AccountingPeriodService(prisma);

export const getAccountingPeriods = async (req: Request, res: Response) => {
  try {
    const organizationId = (req as AuthenticatedRequest).user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: '組織IDが設定されていません' });
    }

    const filter: AccountingPeriodFilter = {};

    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }
    if (req.query.name) {
      filter.name = req.query.name as string;
    }
    if (req.query.startDate) {
      filter.startDate = req.query.startDate as string;
    }
    if (req.query.endDate) {
      filter.endDate = req.query.endDate as string;
    }

    const includeSummary = req.query.includeSummary === 'true';

    if (includeSummary) {
      const periods = await accountingPeriodService.findWithSummary(organizationId);
      return res.json({ data: periods });
    } else {
      const periods = await accountingPeriodService.findAll(organizationId, filter);
      return res.json({ data: periods });
    }
  } catch (error) {
    console.error('Failed to get accounting periods:', error);
    return res.status(500).json({ error: '会計期間の取得に失敗しました' });
  }
};

export const getAccountingPeriod = async (req: Request, res: Response) => {
  try {
    const organizationId = (req as AuthenticatedRequest).user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: '組織IDが設定されていません' });
    }

    const { id } = req.params;
    const period = await accountingPeriodService.findById(id, organizationId);

    return res.json({ data: period });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Failed to get accounting period:', error);
    return res.status(500).json({ error: '会計期間の取得に失敗しました' });
  }
};

export const createAccountingPeriod = async (req: Request, res: Response) => {
  try {
    const organizationId = (req as AuthenticatedRequest).user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: '組織IDが設定されていません' });
    }

    const validatedData = createAccountingPeriodSchema.parse(req.body);
    const period = await accountingPeriodService.create(organizationId, validatedData);

    return res.status(201).json({ data: period });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'バリデーションエラー',
        details: error.issues,
      });
    }
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof ConflictError) {
      return res.status(409).json({ error: error.message });
    }
    console.error(
      'Failed to create accounting period:',
      error instanceof Error ? error.message : error
    );
    return res.status(500).json({ error: '会計期間の作成に失敗しました' });
  }
};

export const updateAccountingPeriod = async (req: Request, res: Response) => {
  try {
    const organizationId = (req as AuthenticatedRequest).user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: '組織IDが設定されていません' });
    }

    const { id } = req.params;
    const validatedData = updateAccountingPeriodSchema.parse(req.body);
    const period = await accountingPeriodService.update(id, organizationId, validatedData);

    return res.json({ data: period });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'バリデーションエラー',
        details: error.issues,
      });
    }
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    if (error instanceof ConflictError) {
      return res.status(409).json({ error: error.message });
    }
    console.error(
      'Failed to update accounting period:',
      error instanceof Error ? error.message : error
    );
    return res.status(500).json({ error: '会計期間の更新に失敗しました' });
  }
};

export const deleteAccountingPeriod = async (req: Request, res: Response) => {
  try {
    const organizationId = (req as AuthenticatedRequest).user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: '組織IDが設定されていません' });
    }

    const { id } = req.params;
    await accountingPeriodService.delete(id, organizationId);

    return res.status(204).send();
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    console.error(
      'Failed to delete accounting period:',
      error instanceof Error ? error.message : error
    );
    return res.status(500).json({ error: '会計期間の削除に失敗しました' });
  }
};

export const activateAccountingPeriod = async (req: Request, res: Response) => {
  try {
    const organizationId = (req as AuthenticatedRequest).user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: '組織IDが設定されていません' });
    }

    const userRole = (req as AuthenticatedRequest).user?.role;
    if (userRole !== UserRole.ADMIN) {
      return res.status(403).json({ error: 'この操作を実行する権限がありません' });
    }

    const { id } = req.params;
    const period = await accountingPeriodService.activate(id, organizationId);

    return res.json({ data: period });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Failed to activate accounting period:', error);
    return res.status(500).json({ error: '会計期間の有効化に失敗しました' });
  }
};

export const getActiveAccountingPeriod = async (req: Request, res: Response) => {
  try {
    const organizationId = (req as AuthenticatedRequest).user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: '組織IDが設定されていません' });
    }

    const period = await accountingPeriodService.getActivePeriod(organizationId);

    if (!period) {
      return res.status(404).json({ error: 'アクティブな会計期間が見つかりません' });
    }

    return res.json({ data: period });
  } catch (error) {
    console.error('Failed to get active accounting period:', error);
    return res.status(500).json({ error: 'アクティブな会計期間の取得に失敗しました' });
  }
};
