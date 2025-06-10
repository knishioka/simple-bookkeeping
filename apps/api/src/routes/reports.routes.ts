import { Router } from 'express';

import { getBalanceSheet, getProfitLoss } from '../controllers/reports.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// 貸借対照表の取得
router.get('/accounting-periods/:accountingPeriodId/balance-sheet', authenticate, getBalanceSheet);

// 損益計算書の取得
router.get('/accounting-periods/:accountingPeriodId/profit-loss', authenticate, getProfitLoss);

export default router;
