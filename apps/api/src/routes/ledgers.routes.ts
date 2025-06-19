import { Router } from 'express';

import {
  getCashBook,
  getBankBook,
  getAccountsReceivable,
  getAccountsPayable,
} from '../controllers/ledgers.controller';
import { authenticate, setOrganizationContext, requireOrganization } from '../middlewares/auth';

import type { Router as RouterType } from 'express';

const router: RouterType = Router();

// すべてのルートに認証を要求
router.use(authenticate);
router.use(setOrganizationContext);
router.use(requireOrganization);

// 現金出納帳
router.get('/cash-book', getCashBook);

// 預金出納帳
router.get('/bank-book', getBankBook);

// 売掛金台帳
router.get('/accounts-receivable', getAccountsReceivable);

// 買掛金台帳
router.get('/accounts-payable', getAccountsPayable);

export default router;
