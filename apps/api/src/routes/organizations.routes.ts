import { UserRole } from '@simple-bookkeeping/database';
import { Router } from 'express';
import { z } from 'zod';

import * as organizationsController from '../controllers/organizations.controller';
import { authenticate, authorize, setOrganizationContext } from '../middlewares/auth';
import { validate } from '../middlewares/validation';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(setOrganizationContext);

// Get user's organizations
router.get('/mine', organizationsController.getMyOrganizations);

// Get organization details (requires organization context)
router.get('/current', organizationsController.getCurrentOrganization);

// Create organization (any authenticated user can create)
router.post(
  '/',
  validate(
    z.object({
      body: z.object({
        name: z.string().min(1).max(255),
        code: z.string().min(1).max(50),
        taxId: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
      }),
    })
  ),
  organizationsController.createOrganization
);

// Update organization (Admin only within the organization)
router.put(
  '/:id',
  authorize(UserRole.ADMIN),
  validate(
    z.object({
      body: z.object({
        name: z.string().min(1).max(255).optional(),
        taxId: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
      }),
    })
  ),
  organizationsController.updateOrganization
);

// Invite user to organization (Admin only)
router.post(
  '/:id/invite',
  authorize(UserRole.ADMIN),
  validate(
    z.object({
      body: z.object({
        email: z.string().email(),
        role: z.enum([UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.VIEWER]),
      }),
    })
  ),
  organizationsController.inviteUser
);

// Remove user from organization (Admin only)
router.delete(
  '/:id/users/:userId',
  authorize(UserRole.ADMIN),
  organizationsController.removeUser
);

export default router;