import { Router } from 'express';

import { getBalanceSheet, getProfitLoss } from '../controllers/reports.controller';
import { authenticate, setOrganizationContext, requireOrganization } from '../middlewares/auth';

const router = Router();

// All routes require authentication and organization context
router.use(authenticate);
router.use(setOrganizationContext);
router.use(requireOrganization);

// 貸借対照表の取得
router.get('/accounting-periods/:accountingPeriodId/balance-sheet', getBalanceSheet);

// 損益計算書の取得
router.get('/accounting-periods/:accountingPeriodId/profit-loss', getProfitLoss);

export default router;
