import { UserRole } from '@simple-bookkeeping/database';
import { Router } from 'express';

import {
  getAccountingPeriods,
  getAccountingPeriod,
  createAccountingPeriod,
  updateAccountingPeriod,
  deleteAccountingPeriod,
  activateAccountingPeriod,
  getActiveAccountingPeriod,
} from '../controllers/accountingPeriods.controller';
import { auditLog } from '../middlewares/auditLog.middleware';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

router.get('/', authenticate, getAccountingPeriods);

router.get('/active', authenticate, getActiveAccountingPeriod);

router.get('/:id', authenticate, getAccountingPeriod);

router.post(
  '/',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  auditLog.createAccountingPeriod,
  createAccountingPeriod
);

router.put(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  auditLog.updateAccountingPeriod,
  updateAccountingPeriod
);

router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  auditLog.deleteAccountingPeriod,
  deleteAccountingPeriod
);

router.post('/:id/activate', authenticate, authorize(UserRole.ADMIN), activateAccountingPeriod);

export default router;
