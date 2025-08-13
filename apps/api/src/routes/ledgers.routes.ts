import { Router } from 'express';

import {
  getCashBook,
  getBankBook,
  getAccountsReceivable,
  getAccountsPayable,
  getGeneralLedger,
  getSubsidiaryLedger,
  getTrialBalance,
  getAccountBalance,
  exportLedger,
} from '../controllers/ledgers.controller';
import { authenticate, setOrganizationContext, requireOrganization } from '../middlewares/auth';

import type { Router as RouterType } from 'express';

const router: RouterType = Router();

// すべてのルートに認証を要求
router.use(authenticate);
router.use(setOrganizationContext);
router.use(requireOrganization);

// 総勘定元帳
router.get('/general', getGeneralLedger);

// 補助元帳
router.get('/subsidiary/:accountId', getSubsidiaryLedger);

// 試算表
router.get('/trial-balance', getTrialBalance);

// 勘定残高
router.get('/account-balance/:accountId', getAccountBalance);

// エクスポート
router.get('/export', exportLedger);

// 現金出納帳
router.get('/cash-book', getCashBook);

// 預金出納帳
router.get('/bank-book', getBankBook);

// 売掛金台帳
router.get('/accounts-receivable', getAccountsReceivable);

// 買掛金台帳
router.get('/accounts-payable', getAccountsPayable);

export default router;
