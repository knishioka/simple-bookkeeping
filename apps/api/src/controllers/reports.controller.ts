import { Request, Response } from 'express';

import { ReportsService } from '../services/reports.service';

const reportsService = new ReportsService();

export const getBalanceSheet = async (req: Request, res: Response) => {
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

    const balanceSheet = await reportsService.getBalanceSheet(accountingPeriodId, date);

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

export const getProfitLoss = async (req: Request, res: Response) => {
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

    const profitLoss = await reportsService.getProfitLoss(accountingPeriodId, start, end);

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
