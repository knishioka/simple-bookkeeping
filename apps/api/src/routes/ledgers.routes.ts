import { Router } from 'express';

import {
  getCashBook,
  getBankBook,
  getAccountsReceivable,
  getAccountsPayable,
} from '../controllers/ledgers.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// すべてのルートに認証を要求
router.use(authenticate);

// 現金出納帳
router.get('/cash-book', getCashBook);

// 預金出納帳
router.get('/bank-book', getBankBook);

// 売掛金台帳
router.get('/accounts-receivable', getAccountsReceivable);

// 買掛金台帳
router.get('/accounts-payable', getAccountsPayable);

export default router;