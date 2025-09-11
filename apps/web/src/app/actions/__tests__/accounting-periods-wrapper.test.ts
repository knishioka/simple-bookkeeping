import { getCurrentOrganizationId } from '@/lib/organization';

import * as accountingPeriodsActions from '../accounting-periods';
import {
  getAccountingPeriodsWithAuth,
  getActiveAccountingPeriodWithAuth,
  createAccountingPeriodWithAuth,
  updateAccountingPeriodWithAuth,
  closeAccountingPeriodWithAuth,
  reopenAccountingPeriodWithAuth,
  deleteAccountingPeriodWithAuth,
  activateAccountingPeriodWithAuth,
} from '../accounting-periods-wrapper';
import { ERROR_CODES } from '../types';

// Mock dependencies
jest.mock('@/lib/organization', () => ({
  getCurrentOrganizationId: jest.fn(),
}));

jest.mock('../accounting-periods', () => ({
  getAccountingPeriods: jest.fn(),
  getActiveAccountingPeriod: jest.fn(),
  createAccountingPeriod: jest.fn(),
  updateAccountingPeriod: jest.fn(),
  closeAccountingPeriod: jest.fn(),
  reopenAccountingPeriod: jest.fn(),
  deleteAccountingPeriod: jest.fn(),
  activateAccountingPeriod: jest.fn(),
}));

const mockGetCurrentOrganizationId = getCurrentOrganizationId as jest.MockedFunction<
  typeof getCurrentOrganizationId
>;

describe('Accounting Periods Wrapper Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAccountingPeriodsWithAuth', () => {
    it('should call getAccountingPeriods with organization ID', async () => {
      const mockOrganizationId = 'org-123';
      const mockParams = { page: 1, pageSize: 20 };
      const mockResult = {
        success: true,
        data: {
          items: [],
          pagination: {
            page: 1,
            pageSize: 20,
            totalCount: 0,
            totalPages: 0,
          },
        },
      };

      mockGetCurrentOrganizationId.mockResolvedValue(mockOrganizationId);
      (accountingPeriodsActions.getAccountingPeriods as jest.Mock).mockResolvedValue(mockResult);

      const result = await getAccountingPeriodsWithAuth(mockParams);

      expect(mockGetCurrentOrganizationId).toHaveBeenCalled();
      expect(accountingPeriodsActions.getAccountingPeriods).toHaveBeenCalledWith(
        mockOrganizationId,
        mockParams
      );
      expect(result).toEqual(mockResult);
    });

    it('should return error when no organization is selected', async () => {
      mockGetCurrentOrganizationId.mockResolvedValue(null);

      const result = await getAccountingPeriodsWithAuth();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(result.error?.message).toContain('組織が選択されていません');
      expect(accountingPeriodsActions.getAccountingPeriods).not.toHaveBeenCalled();
    });

    it('should handle errors from underlying action', async () => {
      const mockOrganizationId = 'org-123';
      const mockError = {
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Database error',
        },
      };

      mockGetCurrentOrganizationId.mockResolvedValue(mockOrganizationId);
      (accountingPeriodsActions.getAccountingPeriods as jest.Mock).mockResolvedValue(mockError);

      const result = await getAccountingPeriodsWithAuth();

      expect(result).toEqual(mockError);
    });
  });

  describe('getActiveAccountingPeriodWithAuth', () => {
    it('should call getActiveAccountingPeriod with organization ID', async () => {
      const mockOrganizationId = 'org-123';
      const mockPeriod = {
        id: 'period-123',
        organization_id: mockOrganizationId,
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        is_closed: false,
      };
      const mockResult = {
        success: true,
        data: mockPeriod,
      };

      mockGetCurrentOrganizationId.mockResolvedValue(mockOrganizationId);
      (accountingPeriodsActions.getActiveAccountingPeriod as jest.Mock).mockResolvedValue(
        mockResult
      );

      const result = await getActiveAccountingPeriodWithAuth();

      expect(mockGetCurrentOrganizationId).toHaveBeenCalled();
      expect(accountingPeriodsActions.getActiveAccountingPeriod).toHaveBeenCalledWith(
        mockOrganizationId
      );
      expect(result).toEqual(mockResult);
    });

    it('should return null when no active period exists', async () => {
      const mockOrganizationId = 'org-123';
      const mockResult = {
        success: true,
        data: null,
      };

      mockGetCurrentOrganizationId.mockResolvedValue(mockOrganizationId);
      (accountingPeriodsActions.getActiveAccountingPeriod as jest.Mock).mockResolvedValue(
        mockResult
      );

      const result = await getActiveAccountingPeriodWithAuth();

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should return error when no organization is selected', async () => {
      mockGetCurrentOrganizationId.mockResolvedValue(null);

      const result = await getActiveAccountingPeriodWithAuth();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(result.error?.message).toContain('組織が選択されていません');
    });
  });

  describe('createAccountingPeriodWithAuth', () => {
    it('should create accounting period with organization ID', async () => {
      const mockOrganizationId = 'org-123';
      const mockData = {
        name: '2025年度',
        start_date: '2025-01-01',
        end_date: '2025-12-31',
      };
      const mockResult = {
        success: true,
        data: {
          id: 'new-period',
          organization_id: mockOrganizationId,
          ...mockData,
          is_closed: false,
        },
      };

      mockGetCurrentOrganizationId.mockResolvedValue(mockOrganizationId);
      (accountingPeriodsActions.createAccountingPeriod as jest.Mock).mockResolvedValue(mockResult);

      const result = await createAccountingPeriodWithAuth(mockData);

      expect(mockGetCurrentOrganizationId).toHaveBeenCalled();
      expect(accountingPeriodsActions.createAccountingPeriod).toHaveBeenCalledWith(
        mockOrganizationId,
        mockData
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle validation errors', async () => {
      const mockOrganizationId = 'org-123';
      const mockData = {
        name: '',
        start_date: '2025-12-31',
        end_date: '2025-01-01', // Invalid: end before start
      };
      const mockError = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: '開始日は終了日より前である必要があります',
        },
      };

      mockGetCurrentOrganizationId.mockResolvedValue(mockOrganizationId);
      (accountingPeriodsActions.createAccountingPeriod as jest.Mock).mockResolvedValue(mockError);

      const result = await createAccountingPeriodWithAuth(mockData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('should return error when no organization is selected', async () => {
      mockGetCurrentOrganizationId.mockResolvedValue(null);

      const result = await createAccountingPeriodWithAuth({
        name: '2025年度',
        start_date: '2025-01-01',
        end_date: '2025-12-31',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(accountingPeriodsActions.createAccountingPeriod).not.toHaveBeenCalled();
    });
  });

  describe('updateAccountingPeriodWithAuth', () => {
    it('should update accounting period', async () => {
      const periodId = 'period-123';
      const mockData = {
        name: '2024年度（修正）',
      };
      const mockResult = {
        success: true,
        data: {
          id: periodId,
          organization_id: 'org-123',
          name: '2024年度（修正）',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          is_closed: false,
        },
      };

      (accountingPeriodsActions.updateAccountingPeriod as jest.Mock).mockResolvedValue(mockResult);

      const result = await updateAccountingPeriodWithAuth(periodId, mockData);

      expect(accountingPeriodsActions.updateAccountingPeriod).toHaveBeenCalledWith(
        periodId,
        mockData
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle closed period update attempts', async () => {
      const periodId = 'period-123';
      const mockData = {
        start_date: '2024-02-01',
      };
      const mockError = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: '閉じられた会計期間は更新できません',
        },
      };

      (accountingPeriodsActions.updateAccountingPeriod as jest.Mock).mockResolvedValue(mockError);

      const result = await updateAccountingPeriodWithAuth(periodId, mockData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('閉じられた会計期間');
    });
  });

  describe('closeAccountingPeriodWithAuth', () => {
    it('should close accounting period', async () => {
      const periodId = 'period-123';
      const mockResult = {
        success: true,
        data: {
          id: periodId,
          organization_id: 'org-123',
          name: '2024年度',
          is_closed: true,
          closed_at: new Date().toISOString(),
          closed_by: 'user-123',
        },
      };

      (accountingPeriodsActions.closeAccountingPeriod as jest.Mock).mockResolvedValue(mockResult);

      const result = await closeAccountingPeriodWithAuth(periodId);

      expect(accountingPeriodsActions.closeAccountingPeriod).toHaveBeenCalledWith(periodId);
      expect(result).toEqual(mockResult);
      expect(result.data?.is_closed).toBe(true);
    });

    it('should handle pending entries error', async () => {
      const periodId = 'period-123';
      const mockError = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: '未承認の仕訳が存在するため、会計期間を閉じることができません',
        },
      };

      (accountingPeriodsActions.closeAccountingPeriod as jest.Mock).mockResolvedValue(mockError);

      const result = await closeAccountingPeriodWithAuth(periodId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('未承認の仕訳');
    });
  });

  describe('reopenAccountingPeriodWithAuth', () => {
    it('should reopen closed accounting period', async () => {
      const periodId = 'period-123';
      const mockResult = {
        success: true,
        data: {
          id: periodId,
          organization_id: 'org-123',
          name: '2024年度',
          is_closed: false,
          closed_at: null,
          closed_by: null,
        },
      };

      (accountingPeriodsActions.reopenAccountingPeriod as jest.Mock).mockResolvedValue(mockResult);

      const result = await reopenAccountingPeriodWithAuth(periodId);

      expect(accountingPeriodsActions.reopenAccountingPeriod).toHaveBeenCalledWith(periodId);
      expect(result).toEqual(mockResult);
      expect(result.data?.is_closed).toBe(false);
    });

    it('should handle insufficient permissions', async () => {
      const periodId = 'period-123';
      const mockError = {
        success: false,
        error: {
          code: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
          message: '会計期間を再度開くには管理者権限が必要です',
        },
      };

      (accountingPeriodsActions.reopenAccountingPeriod as jest.Mock).mockResolvedValue(mockError);

      const result = await reopenAccountingPeriodWithAuth(periodId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    });
  });

  describe('deleteAccountingPeriodWithAuth', () => {
    it('should delete accounting period', async () => {
      const periodId = 'period-123';
      const mockResult = {
        success: true,
        data: { id: periodId },
      };

      (accountingPeriodsActions.deleteAccountingPeriod as jest.Mock).mockResolvedValue(mockResult);

      const result = await deleteAccountingPeriodWithAuth(periodId);

      expect(accountingPeriodsActions.deleteAccountingPeriod).toHaveBeenCalledWith(periodId);
      expect(result).toEqual(mockResult);
    });

    it('should handle deletion with existing journal entries', async () => {
      const periodId = 'period-123';
      const mockError = {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'この会計期間には仕訳が存在するため削除できません',
        },
      };

      (accountingPeriodsActions.deleteAccountingPeriod as jest.Mock).mockResolvedValue(mockError);

      const result = await deleteAccountingPeriodWithAuth(periodId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('仕訳が存在');
    });

    it('should handle rate limiting', async () => {
      const periodId = 'period-123';
      const mockError = {
        success: false,
        error: {
          code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
          message: 'Too many requests',
        },
      };

      (accountingPeriodsActions.deleteAccountingPeriod as jest.Mock).mockResolvedValue(mockError);

      const result = await deleteAccountingPeriodWithAuth(periodId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED);
    });
  });

  describe('activateAccountingPeriodWithAuth', () => {
    it('should activate accounting period', async () => {
      const periodId = 'period-123';
      const mockResult = {
        success: true,
        data: {
          id: periodId,
          organization_id: 'org-123',
          name: '2024年度',
          is_closed: false,
          closed_at: null,
          closed_by: null,
        },
      };

      (accountingPeriodsActions.activateAccountingPeriod as jest.Mock).mockResolvedValue(
        mockResult
      );

      const result = await activateAccountingPeriodWithAuth(periodId);

      expect(accountingPeriodsActions.activateAccountingPeriod).toHaveBeenCalledWith(periodId);
      expect(result).toEqual(mockResult);
    });

    it('should handle already active period', async () => {
      const periodId = 'period-123';
      const mockResult = {
        success: true,
        data: {
          id: periodId,
          organization_id: 'org-123',
          name: '2024年度',
          is_closed: false,
        },
      };

      (accountingPeriodsActions.activateAccountingPeriod as jest.Mock).mockResolvedValue(
        mockResult
      );

      const result = await activateAccountingPeriodWithAuth(periodId);

      expect(result.success).toBe(true);
      expect(result.data?.is_closed).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined organization ID gracefully', async () => {
      mockGetCurrentOrganizationId.mockResolvedValue(undefined as any);

      const result = await getAccountingPeriodsWithAuth();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('should handle network errors', async () => {
      const mockOrganizationId = 'org-123';
      mockGetCurrentOrganizationId.mockResolvedValue(mockOrganizationId);
      (accountingPeriodsActions.getAccountingPeriods as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      await expect(getAccountingPeriodsWithAuth()).rejects.toThrow('Network error');
    });

    it('should pass through complex query parameters', async () => {
      const mockOrganizationId = 'org-123';
      const complexParams = {
        page: 5,
        pageSize: 50,
        search: '2024',
        orderBy: 'start_date',
        orderDirection: 'desc' as const,
      };

      mockGetCurrentOrganizationId.mockResolvedValue(mockOrganizationId);
      (accountingPeriodsActions.getAccountingPeriods as jest.Mock).mockResolvedValue({
        success: true,
        data: { items: [], pagination: {} },
      });

      await getAccountingPeriodsWithAuth(complexParams);

      expect(accountingPeriodsActions.getAccountingPeriods).toHaveBeenCalledWith(
        mockOrganizationId,
        complexParams
      );
    });

    it('should handle empty data updates', async () => {
      const periodId = 'period-123';
      const emptyData = {};

      (accountingPeriodsActions.updateAccountingPeriod as jest.Mock).mockResolvedValue({
        success: true,
        data: { id: periodId },
      });

      const result = await updateAccountingPeriodWithAuth(periodId, emptyData);

      expect(accountingPeriodsActions.updateAccountingPeriod).toHaveBeenCalledWith(
        periodId,
        emptyData
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should complete all wrapper operations within reasonable time', async () => {
      const mockOrganizationId = 'org-123';
      mockGetCurrentOrganizationId.mockResolvedValue(mockOrganizationId);

      // Mock all actions to return quickly
      const mockResult = { success: true, data: {} };
      Object.values(accountingPeriodsActions).forEach((action) => {
        if (typeof action === 'function') {
          (action as jest.Mock).mockResolvedValue(mockResult);
        }
      });

      const startTime = Date.now();

      await Promise.all([
        getAccountingPeriodsWithAuth(),
        getActiveAccountingPeriodWithAuth(),
        createAccountingPeriodWithAuth({
          name: 'Test',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
        }),
        updateAccountingPeriodWithAuth('period-123', { name: 'Updated' }),
        closeAccountingPeriodWithAuth('period-123'),
        reopenAccountingPeriodWithAuth('period-123'),
        activateAccountingPeriodWithAuth('period-123'),
        deleteAccountingPeriodWithAuth('period-123'),
      ]);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle rapid successive calls', async () => {
      const mockOrganizationId = 'org-123';
      mockGetCurrentOrganizationId.mockResolvedValue(mockOrganizationId);
      (accountingPeriodsActions.getAccountingPeriods as jest.Mock).mockResolvedValue({
        success: true,
        data: { items: [], pagination: {} },
      });

      const promises = Array.from({ length: 100 }, () => getAccountingPeriodsWithAuth());

      const results = await Promise.all(promises);

      expect(results.every((r) => r.success)).toBe(true);
      expect(mockGetCurrentOrganizationId).toHaveBeenCalledTimes(100);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete period lifecycle', async () => {
      const mockOrganizationId = 'org-123';
      const periodId = 'period-123';

      mockGetCurrentOrganizationId.mockResolvedValue(mockOrganizationId);

      // Create
      (accountingPeriodsActions.createAccountingPeriod as jest.Mock).mockResolvedValue({
        success: true,
        data: { id: periodId, is_closed: false },
      });

      const createResult = await createAccountingPeriodWithAuth({
        name: '2024年度',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      });
      expect(createResult.success).toBe(true);

      // Update
      (accountingPeriodsActions.updateAccountingPeriod as jest.Mock).mockResolvedValue({
        success: true,
        data: { id: periodId, name: '2024年度（更新）' },
      });

      const updateResult = await updateAccountingPeriodWithAuth(periodId, {
        name: '2024年度（更新）',
      });
      expect(updateResult.success).toBe(true);

      // Close
      (accountingPeriodsActions.closeAccountingPeriod as jest.Mock).mockResolvedValue({
        success: true,
        data: { id: periodId, is_closed: true },
      });

      const closeResult = await closeAccountingPeriodWithAuth(periodId);
      expect(closeResult.success).toBe(true);

      // Reopen
      (accountingPeriodsActions.reopenAccountingPeriod as jest.Mock).mockResolvedValue({
        success: true,
        data: { id: periodId, is_closed: false },
      });

      const reopenResult = await reopenAccountingPeriodWithAuth(periodId);
      expect(reopenResult.success).toBe(true);

      // Delete
      (accountingPeriodsActions.deleteAccountingPeriod as jest.Mock).mockResolvedValue({
        success: true,
        data: { id: periodId },
      });

      const deleteResult = await deleteAccountingPeriodWithAuth(periodId);
      expect(deleteResult.success).toBe(true);
    });
  });
});
