import { Response } from 'express';

import { AuthenticatedRequest } from '../middlewares/auth';
import { ReportsService } from '../services/reports.service';

const reportsService = new ReportsService();

export const getBalanceSheet = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accountingPeriodId } = req.params;
    const { asOfDate } = req.query;

    if (!asOfDate) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: '基準日を指定してください',
        },
      });
    }

    const date = new Date(asOfDate as string);
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE',
          message: '無効な日付形式です',
        },
      });
    }

    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        error: {
          code: 'ORGANIZATION_REQUIRED',
          message: '組織が選択されていません',
        },
      });
    }

    const balanceSheet = await reportsService.getBalanceSheet(accountingPeriodId, date, organizationId);

    res.json({
      data: balanceSheet,
    });
  } catch (error) {
    console.error('貸借対照表の取得エラー:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: '貸借対照表の取得に失敗しました',
      },
    });
  }
};

export const getProfitLoss = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accountingPeriodId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: '開始日と終了日を指定してください',
        },
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE',
          message: '無効な日付形式です',
        },
      });
    }

    if (start > end) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_RANGE',
          message: '開始日は終了日より前である必要があります',
        },
      });
    }

    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        error: {
          code: 'ORGANIZATION_REQUIRED',
          message: '組織が選択されていません',
        },
      });
    }

    const profitLoss = await reportsService.getProfitLoss(accountingPeriodId, start, end, organizationId);

    res.json({
      data: profitLoss,
    });
  } catch (error) {
    console.error('損益計算書の取得エラー:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: '損益計算書の取得に失敗しました',
      },
    });
  }
};
