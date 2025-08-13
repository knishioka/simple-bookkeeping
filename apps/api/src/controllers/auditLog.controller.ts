import { AuditAction } from '@simple-bookkeeping/database';
import { ApiError } from '@simple-bookkeeping/errors';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { auditLogService } from '../services/auditLog.service';

import type { AuthenticatedRequest } from '../types/express';

// Validation schemas
const auditLogFilterSchema = z.object({
  userId: z.string().uuid().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.enum(['createdAt', 'action', 'entityType']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export class AuditLogController {
  /**
   * Get paginated audit logs
   */
  async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const organizationId = authenticatedReq.user?.organizationId || '';

      // Parse and validate query parameters
      const validatedQuery = auditLogFilterSchema.parse(req.query);

      const filter = {
        organizationId,
        ...validatedQuery,
        startDate: validatedQuery.startDate ? new Date(validatedQuery.startDate) : undefined,
        endDate: validatedQuery.endDate ? new Date(validatedQuery.endDate) : undefined,
      };

      const result = await auditLogService.getAuditLogs(filter);

      res.json({
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single audit log by ID
   */
  async getAuditLogById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const organizationId = authenticatedReq.user?.organizationId || '';
      const { id } = req.params;

      if (!id) {
        throw new ApiError('Audit log ID is required', 400, 'VALIDATION_ERROR');
      }

      const auditLog = await auditLogService.getAuditLogById(id, organizationId);

      if (!auditLog) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Audit log not found',
          },
        });
        return;
      }

      res.json({
        data: auditLog,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export audit logs as CSV or JSON
   */
  async exportAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const organizationId = authenticatedReq.user?.organizationId || '';
      const format = req.query.format || 'csv';

      // Parse and validate query parameters
      const validatedQuery = auditLogFilterSchema.parse(req.query);

      const filter = {
        organizationId,
        ...validatedQuery,
        startDate: validatedQuery.startDate ? new Date(validatedQuery.startDate) : undefined,
        endDate: validatedQuery.endDate ? new Date(validatedQuery.endDate) : undefined,
      };

      if (format === 'json') {
        // Export as JSON
        const logs = await auditLogService.getAuditLogsForExport(filter);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.json(logs);
      } else {
        // Export as CSV
        const csv = await auditLogService.exportAuditLogs(filter);

        // Set headers for CSV download
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`
        );

        // Send CSV with BOM for proper Japanese character encoding
        res.send(`\uFEFF${csv}`);
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available entity types for filtering
   */
  async getEntityTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const organizationId = authenticatedReq.user?.organizationId || '';

      const entityTypes = await auditLogService.getEntityTypes(organizationId);

      res.json({
        data: entityTypes,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get audit log statistics
   */
  async getStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const organizationId = authenticatedReq.user?.organizationId || '';
      const days = req.query.days ? parseInt(req.query.days as string) : 30;

      if (isNaN(days) || days < 1 || days > 365) {
        throw new ApiError('Days must be between 1 and 365', 400, 'VALIDATION_ERROR');
      }

      const stats = await auditLogService.getStatistics(organizationId, days);

      res.json({
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const auditLogController = new AuditLogController();
