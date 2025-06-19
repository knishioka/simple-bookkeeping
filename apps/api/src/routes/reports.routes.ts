import { Router } from 'express';

import { getBalanceSheet, getProfitLoss } from '../controllers/reports.controller';
import { authenticate, setOrganizationContext, requireOrganization } from '../middlewares/auth';

import type { Router as RouterType } from 'express';

const router: RouterType = Router();

// All routes require authentication and organization context
router.use(authenticate);
router.use(setOrganizationContext);
router.use(requireOrganization);

// 貸借対照表の取得
router.get('/accounting-periods/:accountingPeriodId/balance-sheet', getBalanceSheet as any);

// 損益計算書の取得
router.get('/accounting-periods/:accountingPeriodId/profit-loss', getProfitLoss as any);

export default router;
