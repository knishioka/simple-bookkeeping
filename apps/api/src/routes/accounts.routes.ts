import { UserRole } from '@simple-bookkeeping/database';
import { createAccountSchema } from '@simple-bookkeeping/shared';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import * as accountsController from '../controllers/accounts.controller';
import { auditLog } from '../middlewares/auditLog.middleware';
import {
  authenticate,
  authorize,
  setOrganizationContext,
  requireOrganization,
} from '../middlewares/auth';
import { validate } from '../middlewares/validation';

import type { RouteHandler } from '../types/express';
import type { Router as RouterType } from 'express';

// Setup multer for file upload
const upload = multer({ storage: multer.memoryStorage() });

const router: RouterType = Router();

// All routes require authentication and organization context
router.use(authenticate);
router.use(setOrganizationContext);
router.use(requireOrganization);

// Get all accounts
router.get('/', accountsController.getAccounts as RouteHandler);

// Get account tree
router.get('/tree', accountsController.getAccountTree as RouteHandler);

// Get single account
router.get('/:id', accountsController.getAccount as RouteHandler);

// Create account (Admin/Accountant only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  validate(z.object({ body: createAccountSchema })),
  auditLog.createAccount,
  accountsController.createAccount as RouteHandler
);

// Update account (Admin/Accountant only)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  validate(
    z.object({
      body: z.object({
        code: z.string().optional(),
        name: z.string().min(1).optional(),
        accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']).optional(),
        parentId: z.string().uuid().optional(),
      }),
    })
  ),
  auditLog.updateAccount,
  accountsController.updateAccount as RouteHandler
);

// Delete account (Admin only)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  auditLog.deleteAccount,
  accountsController.deleteAccount as RouteHandler
);

// Import accounts from CSV (Admin/Accountant only)
router.post(
  '/import',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  upload.single('file'),
  accountsController.importAccounts as RouteHandler
);

export default router;
