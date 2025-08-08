import { UserRole } from '@simple-bookkeeping/database';
import {
  FILE_UPLOAD_SIZE_LIMIT,
  createJournalEntrySchema,
  updateJournalEntrySchema,
  journalEntryQuerySchema,
} from '@simple-bookkeeping/shared';
import { Router } from 'express';
import multer, { memoryStorage } from 'multer';

import * as journalEntriesController from '../controllers/journalEntries.controller';
import {
  authenticate,
  authorize,
  setOrganizationContext,
  requireOrganization,
} from '../middlewares/auth';
import { validate, validateFile } from '../middlewares/validation.middleware';

import type { RouteHandler } from '../types/express';
import type { Router as RouterType } from 'express';

const router: RouterType = Router();
const upload = multer({
  storage: memoryStorage(),
  limits: { fileSize: FILE_UPLOAD_SIZE_LIMIT },
});

// All routes require authentication and organization context
router.use(authenticate);
router.use(setOrganizationContext);
router.use(requireOrganization);

// Get all journal entries
router.get(
  '/',
  validate(journalEntryQuerySchema, 'query'),
  journalEntriesController.getJournalEntries as RouteHandler
);

// Get single journal entry
router.get('/:id', journalEntriesController.getJournalEntry as RouteHandler);

// Create journal entry (Admin/Accountant only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  validate(createJournalEntrySchema, 'body'),
  journalEntriesController.createJournalEntry as RouteHandler
);

// Update journal entry (Admin/Accountant only)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  validate(updateJournalEntrySchema, 'body'),
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

// Import journal entries from CSV
router.post(
  '/import',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  upload.single('file'),
  validateFile({
    required: true,
    maxSize: FILE_UPLOAD_SIZE_LIMIT,
    allowedTypes: ['text/csv', 'application/csv'],
  }),
  journalEntriesController.importJournalEntries as RouteHandler
);

export default router;
