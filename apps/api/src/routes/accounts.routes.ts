import { UserRole } from '@simple-bookkeeping/database';
import { createAccountSchema } from '@simple-bookkeeping/shared';
import { Router } from 'express';
import { z } from 'zod';

import * as accountsController from '../controllers/accounts.controller';
import {
  authenticate,
  authorize,
  setOrganizationContext,
  requireOrganization,
} from '../middlewares/auth';
import { validate } from '../middlewares/validation';

import type { Router as RouterType } from 'express';

const router: RouterType = Router();

// All routes require authentication and organization context
router.use(authenticate);
router.use(setOrganizationContext);
router.use(requireOrganization);

// Get all accounts
router.get('/', accountsController.getAccounts as any);

// Get account tree
router.get('/tree', accountsController.getAccountTree as any);

// Get single account
router.get('/:id', accountsController.getAccount as any);

// Create account (Admin/Accountant only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  validate(z.object({ body: createAccountSchema })),
  accountsController.createAccount as any
);

// Update account (Admin/Accountant only)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  validate(
    z.object({
      body: z.object({
        name: z.string().min(1).optional(),
        parentId: z.string().uuid().optional(),
      }),
    })
  ),
  accountsController.updateAccount as any
);

// Delete account (Admin only)
router.delete('/:id', authorize(UserRole.ADMIN), accountsController.deleteAccount as any);

export default router;
