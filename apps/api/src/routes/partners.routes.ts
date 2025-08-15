import { UserRole } from '@simple-bookkeeping/database';
import { Router } from 'express';

import * as partnersController from '../controllers/partners.controller';
import { auditLog } from '../middlewares/auditLog.middleware';
import {
  authenticate,
  authorize,
  setOrganizationContext,
  requireOrganization,
} from '../middlewares/auth';

import type { RouteHandler } from '../types/express';
import type { Router as RouterType } from 'express';

const router: RouterType = Router();

// All routes require authentication and organization context
router.use(authenticate);
router.use(setOrganizationContext);
router.use(requireOrganization);

// Get all partners
router.get('/', partnersController.getPartners as RouteHandler);

// Get single partner
router.get('/:id', partnersController.getPartnerById as RouteHandler);

// Create partner (Admin/Accountant only)
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  auditLog.createPartner,
  partnersController.createPartner as RouteHandler
);

// Update partner (Admin/Accountant only)
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTANT),
  auditLog.updatePartner,
  partnersController.updatePartner as RouteHandler
);

// Delete partner (Admin only)
router.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  auditLog.deletePartner,
  partnersController.deletePartner as RouteHandler
);

export default router;
