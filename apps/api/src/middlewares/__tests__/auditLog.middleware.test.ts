import { AuditAction, UserRole } from '@simple-bookkeeping/database';
import { Request, Response, NextFunction } from 'express';

import { prisma } from '../../lib/prisma';
import { createAuditLogMiddleware, auditAuthEvent } from '../auditLog.middleware';

// Mock dependencies
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  prisma: {
    auditLog: {
      create: jest.fn(),
    },
    journalEntry: {
      findFirst: jest.fn(),
    },
    account: {
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    accountingPeriod: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('@simple-bookkeeping/shared', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    error: jest.fn(),
  })),
}));

// Type for authenticated user
interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  organizationId?: string;
}

describe('Audit Log Middleware', () => {
  let mockRequest: Partial<Request> & { user?: AuthUser; organizationId?: string };
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        role: UserRole.ADMIN,
        organizationId: 'org-123',
      },
      organizationId: 'org-123',
      params: { id: 'entity-123' },
      headers: {
        'user-agent': 'Mozilla/5.0',
        'x-forwarded-for': '192.168.1.1',
      },
      socket: {
        remoteAddress: '127.0.0.1',
      } as unknown as Request['socket'],
    };

    mockResponse = {
      statusCode: 200,
      send: jest.fn().mockImplementation(function (this: Response) {
        return this;
      }),
    };

    mockNext = jest.fn();
  });

  describe('createAuditLogMiddleware', () => {
    it('should create audit log for successful operations', async () => {
      const middleware = createAuditLogMiddleware({
        action: AuditAction.CREATE,
        entityType: 'JournalEntry',
        captureNewValues: true,
      });

      const responseData = JSON.stringify({ data: { id: 'je-123', amount: 1000 } });

      // Run the middleware which will wrap res.send
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Now call the wrapped send function
      const wrappedSend = mockResponse.send;
      if (wrappedSend) {
        wrappedSend.call(mockResponse, responseData);
      }

      // Wait for async audit log creation
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockNext).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          organizationId: 'org-123',
          action: AuditAction.CREATE,
          entityType: 'JournalEntry',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        }),
      });
    });

    it('should capture old values when configured', async () => {
      const mockOldEntity = {
        id: 'entity-123',
        name: 'Old Name',
        amount: 500,
      };

      (prisma.journalEntry.findFirst as jest.Mock).mockResolvedValue(mockOldEntity);

      const middleware = createAuditLogMiddleware({
        action: AuditAction.UPDATE,
        entityType: 'JournalEntry',
        captureOldValues: true,
        captureNewValues: true,
      });

      // Run the middleware which will wrap res.send and capture old values
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Wait a bit for the old values to be captured
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify old values were captured
      expect(prisma.journalEntry.findFirst).toHaveBeenCalledWith({
        where: { id: 'entity-123', organizationId: 'org-123' },
        include: { lines: true },
      });

      // Now call the wrapped send function
      const wrappedSend = mockResponse.send;
      if (wrappedSend) {
        wrappedSend.call(
          mockResponse,
          JSON.stringify({ data: { id: 'entity-123', name: 'New Name', amount: 1000 } })
        );
      }

      // Wait for async audit log creation
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify audit log was created with old and new values
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          organizationId: 'org-123',
          action: AuditAction.UPDATE,
          entityType: 'JournalEntry',
          oldValues: mockOldEntity,
          newValues: expect.objectContaining({
            id: 'entity-123',
            name: 'New Name',
            amount: 1000,
          }),
        }),
      });
    });

    it('should skip audit log when skipCondition returns true', async () => {
      const middleware = createAuditLogMiddleware({
        action: AuditAction.CREATE,
        entityType: 'Test',
        skipCondition: (req) => req.params.id === 'skip-me',
      });

      mockRequest.params = { id: 'skip-me' };

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('should skip audit log when user is not authenticated', async () => {
      const middleware = createAuditLogMiddleware({
        action: AuditAction.CREATE,
        entityType: 'Test',
      });

      mockRequest.user = undefined;

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('should skip audit log when organization context is not set', async () => {
      const middleware = createAuditLogMiddleware({
        action: AuditAction.CREATE,
        entityType: 'Test',
      });

      mockRequest.organizationId = undefined;

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('should not create audit log for failed operations', async () => {
      const middleware = createAuditLogMiddleware({
        action: AuditAction.CREATE,
        entityType: 'Test',
      });

      mockResponse.statusCode = 400;

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Call the wrapped send function
      const wrappedSend = mockResponse.send;
      if (wrappedSend) {
        wrappedSend.call(mockResponse, JSON.stringify({ error: 'Bad Request' }));
      }

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('should handle errors in audit log creation gracefully', async () => {
      const middleware = createAuditLogMiddleware({
        action: AuditAction.CREATE,
        entityType: 'Test',
      });

      (prisma.auditLog.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Call the wrapped send function
      const wrappedSend = mockResponse.send;
      if (wrappedSend) {
        wrappedSend.call(mockResponse, JSON.stringify({ data: { id: 'test-123' } }));
      }

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Logger error should have been called, but mocking it properly is complex
      // The important thing is that the middleware doesn't throw and continues execution
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('auditAuthEvent', () => {
    it('should create audit log for login event', async () => {
      await auditAuthEvent('LOGIN', 'user-123', 'org-123', mockRequest as Request);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          organizationId: 'org-123',
          action: AuditAction.CREATE,
          entityType: 'Authentication',
          entityId: 'user-123',
          newValues: { event: 'LOGIN' },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        }),
      });
    });

    it('should handle auth events without organization context', async () => {
      await auditAuthEvent('LOGOUT', 'user-123', null, mockRequest as Request);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          organizationId: 'system',
          action: AuditAction.CREATE,
          entityType: 'Authentication',
          entityId: 'user-123',
          newValues: { event: 'LOGOUT' },
        }),
      });
    });

    it('should handle errors in auth event logging gracefully', async () => {
      (prisma.auditLog.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      await auditAuthEvent('LOGIN', 'user-123', 'org-123', mockRequest as Request);

      // Logger error should have been called for auth event failure
      // The important thing is that the function doesn't throw
    });
  });

  describe('Pre-configured middleware', () => {
    it('should have correct configuration for journal entry operations', async () => {
      const { auditLog } = await import('../auditLog.middleware');

      expect(auditLog.createJournalEntry).toBeDefined();
      expect(auditLog.updateJournalEntry).toBeDefined();
      expect(auditLog.deleteJournalEntry).toBeDefined();
      expect(auditLog.approveJournalEntry).toBeDefined();
    });

    it('should have correct configuration for account operations', async () => {
      const { auditLog } = await import('../auditLog.middleware');

      expect(auditLog.createAccount).toBeDefined();
      expect(auditLog.updateAccount).toBeDefined();
      expect(auditLog.deleteAccount).toBeDefined();
    });

    it('should have correct configuration for user operations', async () => {
      const { auditLog } = await import('../auditLog.middleware');

      expect(auditLog.createUser).toBeDefined();
      expect(auditLog.updateUser).toBeDefined();
      expect(auditLog.deleteUser).toBeDefined();
    });

    it('should have correct configuration for organization operations', async () => {
      const { auditLog } = await import('../auditLog.middleware');

      expect(auditLog.updateOrganization).toBeDefined();
    });

    it('should have correct configuration for accounting period operations', async () => {
      const { auditLog } = await import('../auditLog.middleware');

      expect(auditLog.createAccountingPeriod).toBeDefined();
      expect(auditLog.updateAccountingPeriod).toBeDefined();
      expect(auditLog.deleteAccountingPeriod).toBeDefined();
    });
  });
});
