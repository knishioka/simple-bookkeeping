import { UserRole } from '@simple-bookkeeping/database';
import { createJournalEntrySchema } from '@simple-bookkeeping/shared';
import { Router } from 'express';
import { z } from 'zod';

import * as journalEntriesController from '../controllers/journalEntries.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all journal entries
router.get('/', journalEntriesController.getJournalEntries);

// Get single journal entry
router.get('/:id', journalEntriesController.getJournalEntry);

// Create journal entry (Admin/Accountant only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  validate(z.object({ body: createJournalEntrySchema })),
  journalEntriesController.createJournalEntry
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
  journalEntriesController.updateJournalEntry
);

// Delete journal entry (Admin only)
router.delete('/:id', authorize(UserRole.ADMIN), journalEntriesController.deleteJournalEntry);

// Approve journal entry (Admin/Accountant only)
router.post(
  '/:id/approve',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  journalEntriesController.approveJournalEntry
);

export default router;
