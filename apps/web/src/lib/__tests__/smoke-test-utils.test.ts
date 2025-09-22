/**
 * Tests for Smoke Test Utilities
 *
 * This test suite covers all functions in smoke-test-utils.ts including:
 * - checkExecutionLimit
 * - getExecutionLimitStatus
 * - formatExecutionLimitStatus
 * - Helper functions (getCurrentDate, getWorkflowExecutionCount)
 */

import { execSync } from 'child_process';

import {
  checkExecutionLimit,
  getExecutionLimitStatus,
  formatExecutionLimitStatus,
  defaultConfig,
} from '../../../e2e/smoke-test-utils';

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('Smoke Test Utilities', () => {
  const originalEnv = process.env;
  const mockDate = new Date('2024-12-20T12:00:00Z'); // UTC noon

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };

    // Mock Date
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);

    // Mock console methods to reduce noise in test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('checkExecutionLimit', () => {
    describe('successful execution checks', () => {
      it('should return true when under the limit', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockExecSync.mockReturnValueOnce('3' as any);

        const result = await checkExecutionLimit();

        expect(result).toBe(true);
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining(
            'gh api repos/owner/repo/actions/workflows/production-e2e-smoke-test.yml/runs'
          ),
          expect.objectContaining({
            encoding: 'utf8',
          })
        );
      });

      it('should return true when exactly at limit minus one', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockExecSync.mockReturnValueOnce('4' as any);

        const result = await checkExecutionLimit({ maxExecutions: 5 });

        expect(result).toBe(true);
      });

      it('should return false when at the limit', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockExecSync.mockReturnValueOnce('5' as any);

        const result = await checkExecutionLimit({ maxExecutions: 5 });

        expect(result).toBe(false);
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Daily execution limit exceeded: 5/5')
        );
      });

      it('should return false when over the limit', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockExecSync.mockReturnValueOnce('10' as any);

        const result = await checkExecutionLimit({ maxExecutions: 5 });

        expect(result).toBe(false);
      });
    });

    describe('configuration handling', () => {
      it('should use custom configuration when provided', async () => {
        mockExecSync.mockReturnValueOnce('2' as any);

        const result = await checkExecutionLimit({
          maxExecutions: 10,
          repository: 'custom/repo',
          workflowName: 'custom-workflow.yml',
          useJST: false,
        });

        expect(result).toBe(true);
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining('repos/custom/repo/actions/workflows/custom-workflow.yml'),
          expect.anything()
        );
      });

      it('should use GITHUB_REPOSITORY environment variable when repository not specified', async () => {
        process.env.GITHUB_REPOSITORY = 'env/repo';
        mockExecSync.mockReturnValueOnce('1' as any);

        const result = await checkExecutionLimit();

        expect(result).toBe(true);
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining('repos/env/repo'),
          expect.anything()
        );
      });

      it('should pass GITHUB_TOKEN to gh CLI', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        process.env.GITHUB_TOKEN = 'test-github-token';
        mockExecSync.mockReturnValueOnce('1' as any);

        await checkExecutionLimit();

        expect(mockExecSync).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            env: expect.objectContaining({
              GH_TOKEN: 'test-github-token',
            }),
          })
        );
      });

      it('should use GH_TOKEN when GITHUB_TOKEN is not available', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        process.env.GH_TOKEN = 'test-gh-token';
        delete process.env.GITHUB_TOKEN;
        mockExecSync.mockReturnValueOnce('1' as any);

        await checkExecutionLimit();

        expect(mockExecSync).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            env: expect.objectContaining({
              GH_TOKEN: 'test-gh-token',
            }),
          })
        );
      });
    });

    describe('timezone handling', () => {
      it('should use JST timezone by default', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockExecSync.mockReturnValueOnce('1' as any);

        await checkExecutionLimit();

        // For 2024-12-20T12:00:00Z, JST (UTC+9) would be 2024-12-20T21:00:00
        // So the JST date is still 2024-12-20
        const expectedDate = '2024-12-20';
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining(`"${expectedDate}T00:00:00+09:00"`),
          expect.anything()
        );
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining(`"${expectedDate}T23:59:59+09:00"`),
          expect.anything()
        );
      });

      it('should use UTC timezone when useJST is false', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockExecSync.mockReturnValueOnce('1' as any);

        await checkExecutionLimit({ useJST: false });

        const expectedDate = '2024-12-20';
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining(`"${expectedDate}T00:00:00Z"`),
          expect.anything()
        );
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining(`"${expectedDate}T23:59:59Z"`),
          expect.anything()
        );
      });

      it('should handle date rollover correctly in JST', async () => {
        // Set time to 11 PM UTC (8 AM next day in JST)
        const lateUTCTime = new Date('2024-12-20T23:00:00Z');
        jest.setSystemTime(lateUTCTime);

        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockExecSync.mockReturnValueOnce('1' as any);

        await checkExecutionLimit({ useJST: true });

        // In JST, this would be 2024-12-21
        const expectedDate = '2024-12-21';
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining(`"${expectedDate}T00:00:00+09:00"`),
          expect.anything()
        );
      });
    });

    describe('error handling', () => {
      it('should return false when repository is not specified', async () => {
        delete process.env.GITHUB_REPOSITORY;

        const result = await checkExecutionLimit();

        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('Error checking execution limit:'),
          expect.any(Error)
        );
      });

      it('should return false when GitHub API call fails', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockExecSync.mockImplementation(() => {
          throw new Error('Command failed: gh api ...');
        });

        const result = await checkExecutionLimit();

        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('Failing safe - blocking execution due to error')
        );
      });

      it('should handle workflow not found (HTTP 404) gracefully', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockExecSync.mockImplementation(() => {
          const error = new Error('HTTP 404: Not Found');
          throw error;
        });

        const result = await checkExecutionLimit();

        expect(result).toBe(true); // Should return true as count is 0
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining("Workflow 'production-e2e-smoke-test.yml' not found")
        );
      });

      it('should throw authentication error for HTTP 401', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockExecSync.mockImplementation(() => {
          throw new Error('HTTP 401: Unauthorized');
        });

        const result = await checkExecutionLimit();

        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('Error checking execution limit:'),
          expect.objectContaining({
            message: expect.stringContaining('GitHub API authentication failed'),
          })
        );
      });

      it('should throw authentication error for HTTP 403', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockExecSync.mockImplementation(() => {
          throw new Error('HTTP 403: Forbidden');
        });

        const result = await checkExecutionLimit();

        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('Error checking execution limit:'),
          expect.objectContaining({
            message: expect.stringContaining('GitHub API authentication failed'),
          })
        );
      });

      it('should handle invalid API response gracefully', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockExecSync.mockReturnValueOnce('invalid-number' as any);

        const result = await checkExecutionLimit();

        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('Error checking execution limit:'),
          expect.objectContaining({
            message: expect.stringContaining('Invalid execution count returned from API'),
          })
        );
      });

      it('should handle empty API response', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockExecSync.mockReturnValueOnce('' as any);

        const result = await checkExecutionLimit();

        expect(result).toBe(false);
      });

      it('should trim whitespace from API response', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockExecSync.mockReturnValueOnce('  3  \n' as any);

        const result = await checkExecutionLimit();

        expect(result).toBe(true);
      });
    });

    describe('logging', () => {
      it('should log check details', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockExecSync.mockReturnValueOnce('2' as any);

        await checkExecutionLimit();

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('[Execution Limit Check] Checking workflow runs for')
        );
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Repository: owner/repo, Workflow: production-e2e-smoke-test.yml')
        );
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Current executions today: 2/5')
        );
      });

      it('should log warning when limit exceeded', async () => {
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockExecSync.mockReturnValueOnce('5' as any);

        await checkExecutionLimit({ maxExecutions: 5 });

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Daily execution limit exceeded: 5/5')
        );
        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Further executions will be blocked until tomorrow')
        );
      });
    });
  });

  describe('getExecutionLimitStatus', () => {
    it('should return detailed status when under limit', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      mockExecSync.mockReturnValueOnce('2' as any);

      const status = await getExecutionLimitStatus();

      expect(status).toEqual({
        isLimitExceeded: false,
        currentCount: 2,
        maxCount: 5,
        currentDate: '2024-12-20',
      });
    });

    it('should return exceeded status when at limit', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      mockExecSync.mockReturnValueOnce('5' as any);

      const status = await getExecutionLimitStatus({ maxExecutions: 5 });

      expect(status).toEqual({
        isLimitExceeded: true,
        currentCount: 5,
        maxCount: 5,
        currentDate: '2024-12-20',
      });
    });

    it('should return error status when repository not specified', async () => {
      delete process.env.GITHUB_REPOSITORY;

      const status = await getExecutionLimitStatus();

      expect(status).toEqual({
        isLimitExceeded: true,
        currentCount: 0,
        maxCount: 5,
        currentDate: '2024-12-20',
        error: 'GitHub repository not specified',
      });
    });

    it('should return error status when API call fails', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      mockExecSync.mockImplementation(() => {
        throw new Error('API Error');
      });

      const status = await getExecutionLimitStatus();

      expect(status).toEqual({
        isLimitExceeded: true,
        currentCount: 0,
        maxCount: 5,
        currentDate: '2024-12-20',
        error: expect.stringContaining('Failed to query GitHub API'),
      });
    });

    it('should use custom configuration', async () => {
      mockExecSync.mockReturnValueOnce('7' as any);

      const status = await getExecutionLimitStatus({
        maxExecutions: 10,
        repository: 'custom/repo',
        workflowName: 'custom.yml',
        useJST: false,
      });

      expect(status).toEqual({
        isLimitExceeded: false,
        currentCount: 7,
        maxCount: 10,
        currentDate: '2024-12-20',
      });
    });

    it('should handle JST timezone correctly', async () => {
      // Set time to 11 PM UTC (8 AM next day in JST)
      const lateUTCTime = new Date('2024-12-20T23:00:00Z');
      jest.setSystemTime(lateUTCTime);

      process.env.GITHUB_REPOSITORY = 'owner/repo';
      mockExecSync.mockReturnValueOnce('1' as any);

      const status = await getExecutionLimitStatus({ useJST: true });

      expect(status.currentDate).toBe('2024-12-21'); // Next day in JST
    });
  });

  describe('formatExecutionLimitStatus', () => {
    it('should format success status correctly', () => {
      const status = {
        isLimitExceeded: false,
        currentCount: 2,
        maxCount: 5,
        currentDate: '2024-12-20',
      };

      const message = formatExecutionLimitStatus(status);

      expect(message).toBe('✅ Execution allowed (2/5 used today, 3 remaining) for 2024-12-20');
    });

    it('should format exceeded status correctly', () => {
      const status = {
        isLimitExceeded: true,
        currentCount: 5,
        maxCount: 5,
        currentDate: '2024-12-20',
      };

      const message = formatExecutionLimitStatus(status);

      expect(message).toBe(
        '⚠️ Daily execution limit exceeded (5/5) for 2024-12-20. Please wait until tomorrow to run more tests.'
      );
    });

    it('should format error status correctly', () => {
      const status = {
        isLimitExceeded: true,
        currentCount: 0,
        maxCount: 5,
        currentDate: '2024-12-20',
        error: 'API authentication failed',
      };

      const message = formatExecutionLimitStatus(status);

      expect(message).toBe('❌ Execution limit check failed: API authentication failed');
    });

    it('should handle zero executions correctly', () => {
      const status = {
        isLimitExceeded: false,
        currentCount: 0,
        maxCount: 5,
        currentDate: '2024-12-20',
      };

      const message = formatExecutionLimitStatus(status);

      expect(message).toBe('✅ Execution allowed (0/5 used today, 5 remaining) for 2024-12-20');
    });

    it('should handle over-limit correctly', () => {
      const status = {
        isLimitExceeded: true,
        currentCount: 10,
        maxCount: 5,
        currentDate: '2024-12-20',
      };

      const message = formatExecutionLimitStatus(status);

      expect(message).toBe(
        '⚠️ Daily execution limit exceeded (10/5) for 2024-12-20. Please wait until tomorrow to run more tests.'
      );
    });
  });

  describe('defaultConfig', () => {
    it('should have correct default values', () => {
      expect(defaultConfig).toEqual({
        maxExecutions: 5,
        workflowName: 'production-e2e-smoke-test.yml',
        useJST: true,
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete success flow', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      process.env.GITHUB_TOKEN = 'test-token';
      mockExecSync.mockReturnValueOnce('3' as any);

      // Check limit
      const canExecute = await checkExecutionLimit();
      expect(canExecute).toBe(true);

      // Get status
      mockExecSync.mockReturnValueOnce('3' as any);
      const status = await getExecutionLimitStatus();
      expect(status.isLimitExceeded).toBe(false);

      // Format message
      const message = formatExecutionLimitStatus(status);
      expect(message).toContain('Execution allowed');
    });

    it('should handle complete failure flow', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      mockExecSync.mockReturnValueOnce('5' as any);

      // Check limit
      const canExecute = await checkExecutionLimit({ maxExecutions: 5 });
      expect(canExecute).toBe(false);

      // Get status
      mockExecSync.mockReturnValueOnce('5' as any);
      const status = await getExecutionLimitStatus({ maxExecutions: 5 });
      expect(status.isLimitExceeded).toBe(true);

      // Format message
      const message = formatExecutionLimitStatus(status);
      expect(message).toContain('limit exceeded');
    });

    it('should handle workflow creation scenario', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';

      // First call - workflow doesn't exist
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('HTTP 404: Not Found - Workflow not found');
      });

      const firstCheck = await checkExecutionLimit();
      expect(firstCheck).toBe(true); // Should allow execution for non-existent workflow

      // Second call - workflow exists with 1 execution
      mockExecSync.mockReturnValueOnce('1' as any);
      const secondCheck = await checkExecutionLimit();
      expect(secondCheck).toBe(true);
    });

    it('should handle multiple consecutive checks', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';

      // Simulate increasing execution count
      for (let i = 0; i < 6; i++) {
        mockExecSync.mockReturnValueOnce(String(i) as any);
        const result = await checkExecutionLimit({ maxExecutions: 5 });

        if (i < 5) {
          expect(result).toBe(true);
        } else {
          expect(result).toBe(false);
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle very large execution counts', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      mockExecSync.mockReturnValueOnce('999999' as any);

      const result = await checkExecutionLimit({ maxExecutions: 5 });

      expect(result).toBe(false);
    });

    it('should handle negative numbers from API (invalid but should be handled)', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      mockExecSync.mockReturnValueOnce('-1' as any);

      const result = await checkExecutionLimit({ maxExecutions: 5 });

      expect(result).toBe(true); // -1 < 5, so technically under limit
    });

    it('should handle special characters in repository name', async () => {
      mockExecSync.mockReturnValueOnce('1' as any);

      const result = await checkExecutionLimit({
        repository: 'owner-123/repo.name-test',
      });

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('repos/owner-123/repo.name-test'),
        expect.anything()
      );
    });

    it('should handle special characters in workflow name', async () => {
      mockExecSync.mockReturnValueOnce('1' as any);

      const result = await checkExecutionLimit({
        repository: 'owner/repo',
        workflowName: 'test-workflow_v2.1.yml',
      });

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('workflows/test-workflow_v2.1.yml'),
        expect.anything()
      );
    });

    it('should handle execSync returning Buffer', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      // execSync with encoding: 'utf8' always returns string, not Buffer
      // But if it did return a Buffer, toString() would be called on it
      mockExecSync.mockReturnValueOnce('2' as any);

      const result = await checkExecutionLimit();

      expect(result).toBe(true);
    });

    it('should handle concurrent calls', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      mockExecSync.mockReturnValue('2' as any);

      const results = await Promise.all([
        checkExecutionLimit(),
        checkExecutionLimit(),
        checkExecutionLimit(),
      ]);

      expect(results).toEqual([true, true, true]);
      expect(mockExecSync).toHaveBeenCalledTimes(3);
    });
  });

  describe('getCurrentDate helper (indirect testing)', () => {
    it('should use correct date for various timezones', async () => {
      const testCases = [
        {
          time: new Date('2024-12-20T00:00:00Z'),
          useJST: true,
          expectedDate: '2024-12-20', // 9 AM JST
        },
        {
          time: new Date('2024-12-20T14:59:59Z'),
          useJST: true,
          expectedDate: '2024-12-20', // 11:59 PM JST
        },
        {
          time: new Date('2024-12-20T15:00:00Z'),
          useJST: true,
          expectedDate: '2024-12-21', // 12:00 AM JST next day
        },
        {
          time: new Date('2024-12-20T23:59:59Z'),
          useJST: true,
          expectedDate: '2024-12-21', // 8:59 AM JST next day
        },
        {
          time: new Date('2024-12-20T12:00:00Z'),
          useJST: false,
          expectedDate: '2024-12-20', // UTC
        },
      ];

      for (const testCase of testCases) {
        jest.setSystemTime(testCase.time);
        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockExecSync.mockReturnValueOnce('1' as any);

        await checkExecutionLimit({ useJST: testCase.useJST });

        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining(`"${testCase.expectedDate}T`),
          expect.anything()
        );
      }
    });
  });

  describe('getWorkflowExecutionCount helper (indirect testing)', () => {
    it('should construct correct gh CLI command', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      mockExecSync.mockReturnValueOnce('1' as any);

      await checkExecutionLimit();

      const call = mockExecSync.mock.calls[0];
      const command = call[0] as string;

      // Check command structure
      expect(command).toContain('gh api');
      expect(command).toContain(
        'repos/owner/repo/actions/workflows/production-e2e-smoke-test.yml/runs'
      );
      expect(command).toContain('--jq');
      expect(command).toContain('status == "completed"');
      expect(command).toContain('conclusion == "success"');
      expect(command).toContain('created_at >=');
      expect(command).toContain('created_at <=');
      expect(command).toContain('| length');
    });

    it('should pass correct execution options', async () => {
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      process.env.GITHUB_TOKEN = 'test-token';
      mockExecSync.mockReturnValueOnce('1' as any);

      await checkExecutionLimit();

      const call = mockExecSync.mock.calls[0];
      const options = call[1] as any;

      expect(options).toEqual({
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: expect.objectContaining({
          GH_TOKEN: 'test-token',
        }),
      });
    });
  });
});
