import { Router } from 'express';

import {
  getBalanceSheet,
  getIncomeStatement,
  getCashFlow,
  getAgedReceivables,
  getAgedPayables,
  getFinancialRatios,
  exportReport,
  createCustomReport,
} from '../controllers/reports.controller';
import { authenticate, setOrganizationContext, requireOrganization } from '../middlewares/auth';

import type { RouteHandler } from '../types/express';
import type { Router as RouterType } from 'express';

const router: RouterType = Router();

// All routes require authentication and organization context
router.use(authenticate);
router.use(setOrganizationContext);
router.use(requireOrganization);

// Balance Sheet
router.get('/balance-sheet', getBalanceSheet as RouteHandler);

// Income Statement
router.get('/income-statement', getIncomeStatement as RouteHandler);

// Cash Flow Statement
router.get('/cash-flow', getCashFlow as RouteHandler);

// Aged Receivables
router.get('/aged-receivables', getAgedReceivables as RouteHandler);

// Aged Payables
router.get('/aged-payables', getAgedPayables as RouteHandler);

// Financial Ratios
router.get('/financial-ratios', getFinancialRatios as RouteHandler);

// Export Reports
router.get('/export', exportReport as RouteHandler);

// Export specific report types
router.get('/balance-sheet/export', exportReport as RouteHandler);
router.get('/profit-loss/export', exportReport as RouteHandler);
router.get('/income-statement/export', exportReport as RouteHandler);
router.get('/trial-balance/export', exportReport as RouteHandler);

// Custom Reports
router.post('/custom', createCustomReport as RouteHandler);

export default router;
