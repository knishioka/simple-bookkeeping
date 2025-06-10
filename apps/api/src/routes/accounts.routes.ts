import { UserRole } from '@simple-bookkeeping/database';
import { createAccountSchema } from '@simple-bookkeeping/shared';
import { Router } from 'express';
import { z } from 'zod';

import * as accountsController from '../controllers/accounts.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all accounts
router.get('/', accountsController.getAccounts);

// Get account tree
router.get('/tree', accountsController.getAccountTree);

// Get single account
router.get('/:id', accountsController.getAccount);

// Create account (Admin/Accountant only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  validate(z.object({ body: createAccountSchema })),
  accountsController.createAccount
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
  accountsController.updateAccount
);

// Delete account (Admin only)
router.delete('/:id', authorize(UserRole.ADMIN), accountsController.deleteAccount);

export default router;
