import { Request, Response } from 'express';

import { AuthenticatedRequest } from '../middlewares/auth';
import { ledgerService } from '../services/ledger.service';

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
    console.error('Failed to get cash book:', error);
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

    const entries = await ledgerService.getBankBook({
      accountCode: '', // 複数の預金科目を扱うため空文字
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
      organizationId,
    });

    // 預金科目の合計開始残高を取得
    const bankCodes = ['1120', '1130'];
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
    console.error('Failed to get bank book:', error);
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
    console.error('Failed to get accounts receivable:', error);
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
    console.error('Failed to get accounts payable:', error);
    res.status(500).json({ error: 'Failed to get accounts payable' });
  }
};
