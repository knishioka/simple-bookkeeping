import { UserRole } from '@simple-bookkeeping/database';
import { Router } from 'express';

import { auditLogController } from '../controllers/auditLog.controller';
import {
  authenticate,
  authorize,
  setOrganizationContext,
  requireOrganization,
} from '../middlewares/auth';

import type { RouteHandler } from '../types/express';

const router = Router();

// Apply authentication and organization context to all routes
router.use(authenticate);
router.use(setOrganizationContext);
router.use(requireOrganization);

// Only ADMIN users can access audit logs
router.use(authorize(UserRole.ADMIN));

// Get audit logs with pagination and filters
router.get('/', auditLogController.getAuditLogs as RouteHandler);

// Get entity types for filtering
router.get('/entity-types', auditLogController.getEntityTypes as RouteHandler);

// Get audit log statistics
router.get('/statistics', auditLogController.getStatistics as RouteHandler);

// Export audit logs as CSV
router.get('/export', auditLogController.exportAuditLogs as RouteHandler);

// Get single audit log by ID
router.get('/:id', auditLogController.getAuditLogById as RouteHandler);

export default router;
