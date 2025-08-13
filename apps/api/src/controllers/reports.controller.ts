import { Response } from 'express';

import { AuthenticatedRequest } from '../middlewares/auth';
import { ReportsService } from '../services/reports.service';

const reportsService = new ReportsService();

export const getBalanceSheet = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { asOf, compareTo } = req.query;
    const asOfDate = asOf || new Date().toISOString().split('T')[0];

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

    const balanceSheet = await reportsService.getBalanceSheet(
      organizationId,
      date,
      compareTo ? new Date(compareTo as string) : undefined
    );

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

export const getIncomeStatement = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { from, to, compareFrom, compareTo } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: '開始日と終了日を指定してください',
        },
      });
    }

    const start = new Date(from as string);
    const end = new Date(to as string);

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

    const incomeStatement = await reportsService.getIncomeStatement(
      organizationId,
      start,
      end,
      compareFrom && compareTo
        ? { from: new Date(compareFrom as string), to: new Date(compareTo as string) }
        : undefined
    );

    res.json({
      data: incomeStatement,
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

export const getCashFlow = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: '開始日と終了日を指定してください',
        },
      });
    }

    const start = new Date(from as string);
    const end = new Date(to as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
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

    const cashFlow = await reportsService.getCashFlow(organizationId, start, end);

    res.json({
      data: cashFlow,
    });
  } catch (error) {
    console.error('キャッシュフロー計算書の取得エラー:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'キャッシュフロー計算書の取得に失敗しました',
      },
    });
  }
};

export const getAgedReceivables = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { asOf } = req.query;
    const asOfDate = asOf ? new Date(asOf as string) : new Date();

    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        error: {
          code: 'ORGANIZATION_REQUIRED',
          message: '組織が選択されていません',
        },
      });
    }

    const agedReceivables = await reportsService.getAgedReceivables(organizationId, asOfDate);

    res.json({
      data: agedReceivables,
    });
  } catch (error) {
    console.error('売掛金年齢表の取得エラー:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: '売掛金年齢表の取得に失敗しました',
      },
    });
  }
};

export const getAgedPayables = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { asOf } = req.query;
    const asOfDate = asOf ? new Date(asOf as string) : new Date();

    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        error: {
          code: 'ORGANIZATION_REQUIRED',
          message: '組織が選択されていません',
        },
      });
    }

    const agedPayables = await reportsService.getAgedPayables(organizationId, asOfDate);

    res.json({
      data: agedPayables,
    });
  } catch (error) {
    console.error('買掛金年齢表の取得エラー:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: '買掛金年齢表の取得に失敗しました',
      },
    });
  }
};

export const getFinancialRatios = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { asOf } = req.query;
    const asOfDate = asOf ? new Date(asOf as string) : new Date();

    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({
        error: {
          code: 'ORGANIZATION_REQUIRED',
          message: '組織が選択されていません',
        },
      });
    }

    const financialRatios = await reportsService.getFinancialRatios(organizationId, asOfDate);

    res.json({
      data: financialRatios,
    });
  } catch (error) {
    console.error('財務比率の取得エラー:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: '財務比率の取得に失敗しました',
      },
    });
  }
};

interface ExportQueryParams {
  type?: string;
  format?: string;
  asOf?: string;
  from?: string;
  to?: string;
  compareFrom?: string;
  compareTo?: string;
}

export const exportReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, format, ...params } = req.query as ExportQueryParams;

    if (!type || !format) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'レポートタイプと形式を指定してください',
        },
      });
    }

    const validTypes = [
      'balance-sheet',
      'income-statement',
      'cash-flow',
      'financial-ratios',
      'aged-receivables',
      'aged-payables',
    ];
    if (!validTypes.includes(type as string)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REPORT_TYPE',
          message: '無効なレポートタイプです',
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

    const exportData = await reportsService.exportReport(
      organizationId,
      type as string,
      format as string,
      params
    );

    // Set appropriate headers based on format
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${type}-${new Date().toISOString().split('T')[0]}.pdf"`
      );
    } else if (format === 'xlsx') {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${type}-${new Date().toISOString().split('T')[0]}.xlsx"`
      );
    } else if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${type}-${new Date().toISOString().split('T')[0]}.csv"`
      );
    }

    res.send(exportData);
  } catch (error) {
    console.error('レポートエクスポートエラー:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'レポートのエクスポートに失敗しました',
      },
    });
  }
};

export const createCustomReport = async (req: AuthenticatedRequest, res: Response) => {
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

    const customReport = await reportsService.createCustomReport(organizationId, req.body);

    res.json({
      data: customReport,
    });
  } catch (error) {
    console.error('カスタムレポート作成エラー:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'カスタムレポートの作成に失敗しました',
      },
    });
  }
};
