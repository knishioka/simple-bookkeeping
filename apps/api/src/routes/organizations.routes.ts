import { UserRole } from '@simple-bookkeeping/database';
import { Router } from 'express';
import { z } from 'zod';

import * as organizationsController from '../controllers/organizations.controller';
import { auditLog } from '../middlewares/auditLog.middleware';
import { authenticate, authorize, setOrganizationContext } from '../middlewares/auth';
import { validate } from '../middlewares/validation';

import type { RouteHandler } from '../types/express';
import type { Router as RouterType } from 'express';

const router: RouterType = Router();

// All routes require authentication
router.use(authenticate);
router.use(setOrganizationContext);

// Get user's organizations
router.get('/mine', organizationsController.getMyOrganizations as RouteHandler);

// Get organization details (requires organization context)
router.get('/current', organizationsController.getCurrentOrganization as RouteHandler);

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
  organizationsController.createOrganization as RouteHandler
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
  auditLog.updateOrganization,
  organizationsController.updateOrganization as RouteHandler
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
  organizationsController.inviteUser as RouteHandler
);

// Get organization members (All members can view)
router.get('/:id/members', organizationsController.getOrganizationMembers as RouteHandler);

// Update user role in organization (Admin only)
router.put(
  '/:id/members/:userId',
  authorize(UserRole.ADMIN),
  validate(
    z.object({
      body: z.object({
        role: z.enum([UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.VIEWER]),
      }),
    })
  ),
  organizationsController.updateUserRole as RouteHandler
);

// Remove user from organization (Admin only)
router.delete(
  '/:id/members/:userId',
  authorize(UserRole.ADMIN),
  organizationsController.removeUser as RouteHandler
);

// Add new member to organization (Admin only)
router.post(
  '/:id/members',
  authorize(UserRole.ADMIN),
  validate(
    z.object({
      body: z.object({
        email: z.string().email(),
        role: z.enum([UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.VIEWER]),
      }),
    })
  ),
  organizationsController.inviteUser as RouteHandler
);

// Get organization settings (All members can view)
router.get('/:id/settings', organizationsController.getOrganizationSettings as RouteHandler);

// Update organization settings (Admin only)
router.put(
  '/:id/settings',
  authorize(UserRole.ADMIN),
  validate(
    z.object({
      body: z.object({
        address: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
      }),
    })
  ),
  organizationsController.updateOrganizationSettings as RouteHandler
);

export default router;
