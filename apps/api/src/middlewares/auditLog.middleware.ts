import { AuditAction, Prisma } from '@simple-bookkeeping/database';
import { Logger } from '@simple-bookkeeping/shared';
import { Request, Response, NextFunction } from 'express';

import { prisma } from '../lib/prisma';

import type { AuthenticatedRequest } from '../types/express';

const logger = new Logger({ component: 'AuditLogMiddleware' });

interface AuditLogOptions {
  action: AuditAction;
  entityType: string;
  getEntityId?: (req: Request) => string | undefined;
  captureOldValues?: boolean;
  captureNewValues?: boolean;
  skipCondition?: (req: Request) => boolean;
}

/**
 * Create audit log middleware for automatic logging of operations
 */
export function createAuditLogMiddleware(options: AuditLogOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authenticatedReq = req as AuthenticatedRequest;

    // Skip if condition is met
    if (options.skipCondition?.(req)) {
      return next();
    }

    // Skip if user is not authenticated
    if (!authenticatedReq.user) {
      return next();
    }

    // Skip if organization context is not set
    if (!authenticatedReq.user?.organizationId) {
      return next();
    }

    const entityId = options.getEntityId?.(req) || req.params.id;

    // Capture old values if needed
    let oldValues: unknown = null;
    if (options.captureOldValues && entityId) {
      try {
        oldValues = await captureEntityValues(
          options.entityType,
          entityId,
          authenticatedReq.user?.organizationId || ''
        );
      } catch (error) {
        logger.error('Failed to capture old values for audit log', {
          error,
          entityType: options.entityType,
          entityId,
        });
      }
    }

    // Store original send function
    const originalSend = res.send;

    // Override send to capture response and create audit log
    res.send = function (data: unknown) {
      // Call original send
      originalSend.call(this, data);

      // Create audit log asynchronously if response was successful
      if (res.statusCode >= 200 && res.statusCode < 300) {
        createAuditLog({
          userId: authenticatedReq.user?.id || '',
          organizationId: authenticatedReq.user?.organizationId || '',
          action: options.action,
          entityType: options.entityType,
          entityId: entityId || extractEntityIdFromResponse(data),
          oldValues: options.captureOldValues ? oldValues : null,
          newValues: options.captureNewValues ? extractNewValuesFromResponse(data) : null,
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent'] || null,
        }).catch((error) => {
          logger.error('Failed to create audit log', { error, options });
        });
      }

      return this;
    };

    next();
  };
}

/**
 * Capture current entity values before modification
 */
async function captureEntityValues(
  entityType: string,
  entityId: string,
  organizationId: string
): Promise<unknown> {
  switch (entityType.toLowerCase()) {
    case 'journalentry':
      return await prisma.journalEntry.findFirst({
        where: { id: entityId, organizationId },
        include: { lines: true },
      });

    case 'account':
      return await prisma.account.findFirst({
        where: { id: entityId, organizationId },
      });

    case 'user':
      return await prisma.user.findUnique({
        where: { id: entityId },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
        },
      });

    case 'organization':
      return await prisma.organization.findUnique({
        where: { id: entityId },
        select: {
          id: true,
          name: true,
          taxId: true,
          address: true,
          phone: true,
          email: true,
        },
      });

    case 'accountingperiod':
      return await prisma.accountingPeriod.findFirst({
        where: { id: entityId, organizationId },
      });

    default:
      return null;
  }
}

/**
 * Extract entity ID from response data
 */
function extractEntityIdFromResponse(data: unknown): string | undefined {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    const dataObj = parsed as Record<string, unknown>;
    const id = dataObj?.data ? (dataObj.data as Record<string, unknown>)?.id : dataObj?.id;
    return typeof id === 'string' ? id : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract new values from response data
 */
function extractNewValuesFromResponse(data: unknown): unknown {
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    const dataObj = parsed as Record<string, unknown>;
    const result = dataObj?.data || dataObj;

    // Remove sensitive fields
    if (result && typeof result === 'object' && result !== null) {
      const sanitized = { ...result } as Record<string, unknown>;
      delete sanitized.password;
      delete sanitized.hashedPassword;
      delete sanitized.refreshToken;
      delete sanitized.resetToken;
      return sanitized;
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || null;
}

/**
 * Create audit log entry in database
 */
async function createAuditLog(data: {
  userId: string;
  organizationId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  oldValues: unknown;
  newValues: unknown;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId || '',
        oldValues: data.oldValues as Prisma.InputJsonValue,
        newValues: data.newValues as Prisma.InputJsonValue,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    logger.error('Failed to save audit log to database', { error, data });
    // Don't throw - audit logging should not break the main operation
  }
}

/**
 * Middleware for logging authentication events
 */
export async function auditAuthEvent(
  action: 'LOGIN' | 'LOGOUT' | 'PASSWORD_RESET',
  userId: string,
  organizationId: string | null,
  req: Request
): Promise<void> {
  try {
    // Map auth events to AuditAction
    const auditAction =
      action === 'LOGIN' || action === 'LOGOUT'
        ? AuditAction.CREATE // Using CREATE for auth events as there's no specific AUTH action
        : AuditAction.UPDATE; // Password reset is an update

    await prisma.auditLog.create({
      data: {
        userId,
        organizationId: organizationId || 'system', // Use 'system' for auth events without org context
        action: auditAction,
        entityType: 'Authentication',
        entityId: userId,
        oldValues: null as unknown as Prisma.InputJsonValue,
        newValues: { event: action } as Prisma.InputJsonValue,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] || null,
      },
    });
  } catch (error) {
    logger.error('Failed to create auth audit log', { error, action, userId });
  }
}

// Pre-configured middleware for common operations
export const auditLog = {
  // Journal Entry operations
  createJournalEntry: createAuditLogMiddleware({
    action: AuditAction.CREATE,
    entityType: 'JournalEntry',
    captureNewValues: true,
  }),

  updateJournalEntry: createAuditLogMiddleware({
    action: AuditAction.UPDATE,
    entityType: 'JournalEntry',
    captureOldValues: true,
    captureNewValues: true,
  }),

  deleteJournalEntry: createAuditLogMiddleware({
    action: AuditAction.DELETE,
    entityType: 'JournalEntry',
    captureOldValues: true,
  }),

  approveJournalEntry: createAuditLogMiddleware({
    action: AuditAction.APPROVE,
    entityType: 'JournalEntry',
  }),

  // Account operations
  createAccount: createAuditLogMiddleware({
    action: AuditAction.CREATE,
    entityType: 'Account',
    captureNewValues: true,
  }),

  updateAccount: createAuditLogMiddleware({
    action: AuditAction.UPDATE,
    entityType: 'Account',
    captureOldValues: true,
    captureNewValues: true,
  }),

  deleteAccount: createAuditLogMiddleware({
    action: AuditAction.DELETE,
    entityType: 'Account',
    captureOldValues: true,
  }),

  // User operations
  createUser: createAuditLogMiddleware({
    action: AuditAction.CREATE,
    entityType: 'User',
    captureNewValues: true,
  }),

  updateUser: createAuditLogMiddleware({
    action: AuditAction.UPDATE,
    entityType: 'User',
    captureOldValues: true,
    captureNewValues: true,
  }),

  deleteUser: createAuditLogMiddleware({
    action: AuditAction.DELETE,
    entityType: 'User',
    captureOldValues: true,
  }),

  // Organization operations
  updateOrganization: createAuditLogMiddleware({
    action: AuditAction.UPDATE,
    entityType: 'Organization',
    captureOldValues: true,
    captureNewValues: true,
  }),

  // Partner operations
  createPartner: createAuditLogMiddleware({
    action: AuditAction.CREATE,
    entityType: 'Partner',
    captureNewValues: true,
  }),

  updatePartner: createAuditLogMiddleware({
    action: AuditAction.UPDATE,
    entityType: 'Partner',
    captureOldValues: true,
    captureNewValues: true,
  }),

  deletePartner: createAuditLogMiddleware({
    action: AuditAction.DELETE,
    entityType: 'Partner',
    captureOldValues: true,
  }),

  // Accounting Period operations
  createAccountingPeriod: createAuditLogMiddleware({
    action: AuditAction.CREATE,
    entityType: 'AccountingPeriod',
    captureNewValues: true,
  }),

  updateAccountingPeriod: createAuditLogMiddleware({
    action: AuditAction.UPDATE,
    entityType: 'AccountingPeriod',
    captureOldValues: true,
    captureNewValues: true,
  }),

  deleteAccountingPeriod: createAuditLogMiddleware({
    action: AuditAction.DELETE,
    entityType: 'AccountingPeriod',
    captureOldValues: true,
  }),
};
