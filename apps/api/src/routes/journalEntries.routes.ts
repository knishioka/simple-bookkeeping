import { UserRole } from '@simple-bookkeeping/database';
import { createJournalEntrySchema } from '@simple-bookkeeping/shared';
import { Router } from 'express';
import { z } from 'zod';

import * as journalEntriesController from '../controllers/journalEntries.controller';
import {
  authenticate,
  authorize,
  setOrganizationContext,
  requireOrganization,
} from '../middlewares/auth';
import { validate } from '../middlewares/validation';

import type { RouteHandler } from '../types/express';
import type { Router as RouterType } from 'express';

const router: RouterType = Router();

// All routes require authentication and organization context
router.use(authenticate);
router.use(setOrganizationContext);
router.use(requireOrganization);

// Get all journal entries
router.get('/', journalEntriesController.getJournalEntries as RouteHandler);

// Get single journal entry
router.get('/:id', journalEntriesController.getJournalEntry as RouteHandler);

// Create journal entry (Admin/Accountant only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  validate(z.object({ body: createJournalEntrySchema })),
  journalEntriesController.createJournalEntry as RouteHandler
);

// Update journal entry (Admin/Accountant only)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  validate(
    z.object({
      body: z.object({
        description: z.string().min(1).optional(),
        documentNumber: z.string().optional(),
        lines: createJournalEntrySchema.shape.lines.optional(),
      }),
    })
  ),
  journalEntriesController.updateJournalEntry as RouteHandler
);

// Delete journal entry (Admin only)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  journalEntriesController.deleteJournalEntry as RouteHandler
);

// Approve journal entry (Admin/Accountant only)
router.post(
  '/:id/approve',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  journalEntriesController.approveJournalEntry as RouteHandler
);

export default router;
