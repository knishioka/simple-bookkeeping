/**
 * Enhanced Tests for Smoke Test Utilities - Trend Analysis & Advanced Features
 *
 * This test suite covers the new trend analysis and notification features:
 * - Workflow history retrieval (getWorkflowHistory)
 * - Trend analysis (analyzeTrends, getWorkflowTrends)
 * - Trend formatting (formatTrendAnalysis)
 * - Priority determination (determineNotificationPriority)
 */

import { spawnSync } from 'child_process';

import {
  getWorkflowHistory,
  analyzeTrends,
  getWorkflowTrends,
  formatTrendAnalysis,
  determineNotificationPriority,
} from '../../../e2e/smoke-test-utils';

// Mock child_process
jest.mock('child_process', () => ({
  spawnSync: jest.fn(),
}));

const mockSpawnSync = spawnSync as jest.MockedFunction<typeof spawnSync>;

// Helper to create mock workflow run data
const createMockWorkflowRun = (overrides?: Partial<any>) => ({
  id: 123456789,
  conclusion: 'success',
  status: 'completed',
  created_at: '2024-12-20T10:00:00Z',
  updated_at: '2024-12-20T10:05:00Z',
  run_started_at: '2024-12-20T10:00:30Z',
  run_duration_ms: 300000, // 5 minutes
  html_url: 'https://github.com/owner/repo/actions/runs/123456789',
  ...overrides,
});

// Helper to create mock spawnSync result
const createMockSpawnResult = (stdout: string, status = 0, stderr = '') =>
  ({
    stdout,
    stderr,
    status,
    signal: null,
    output: [stdout],
    pid: 123,
  }) as any;

describe('Smoke Test Utils - Enhanced Features', () => {
  const originalEnv = process.env;
  const mockDate = new Date('2024-12-20T12:00:00Z');

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('getWorkflowHistory', () => {
    it('should retrieve workflow history for the specified period', async () => {
      const mockRuns = [
        createMockWorkflowRun({ id: 1, created_at: '2024-12-19T10:00:00Z' }),
        createMockWorkflowRun({ id: 2, created_at: '2024-12-18T10:00:00Z' }),
        createMockWorkflowRun({ id: 3, created_at: '2024-12-17T10:00:00Z' }),
      ];

      mockSpawnSync.mockReturnValueOnce(createMockSpawnResult(JSON.stringify(mockRuns)));

      const runs = await getWorkflowHistory('owner/repo', 'test.yml', 7);

      expect(runs).toHaveLength(3);
      expect(runs[0].id).toBe(1);
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining([
          'api',
          'repos/owner/repo/actions/workflows/test.yml/runs',
          '--paginate',
          '--jq',
          expect.stringContaining('created_at >='),
        ]),
        expect.objectContaining({
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        })
      );
    });

    it('should handle empty workflow history', async () => {
      mockSpawnSync.mockReturnValueOnce(createMockSpawnResult('[]'));

      const runs = await getWorkflowHistory('owner/repo', 'test.yml');

      expect(runs).toEqual([]);
    });

    it('should return empty array on API error', async () => {
      mockSpawnSync.mockReturnValueOnce({
        stdout: '',
        stderr: 'HTTP 404: Not Found',
        status: 1,
        signal: null,
        output: [''],
        pid: 123,
      } as any);

      const runs = await getWorkflowHistory('owner/repo', 'test.yml');

      expect(runs).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to get workflow history:',
        expect.any(Error)
      );
    });

    it('should validate repository format', async () => {
      const runs = await getWorkflowHistory('invalid&&repo', 'test.yml');

      expect(runs).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to get workflow history:',
        expect.objectContaining({
          message: expect.stringContaining('Invalid repository format'),
        })
      );
    });

    it('should validate workflow name format', async () => {
      const runs = await getWorkflowHistory('owner/repo', 'invalid.txt');

      expect(runs).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to get workflow history:',
        expect.objectContaining({
          message: expect.stringContaining('Invalid workflow name'),
        })
      );
    });

    it('should use specified number of days for lookback', async () => {
      mockSpawnSync.mockReturnValueOnce(createMockSpawnResult('[]'));

      const now = new Date('2024-12-20T12:00:00Z');
      jest.setSystemTime(now);

      await getWorkflowHistory('owner/repo', 'test.yml', 14);

      const call = mockSpawnSync.mock.calls[0];
      const jqQuery = call[1][4] as string; // --jq is at index 3, query is at index 4
      // Should look back 14 days from 2024-12-20
      expect(jqQuery).toContain('2024-12-06'); // 14 days before 2024-12-20
    });

    it('should handle malformed JSON response', async () => {
      mockSpawnSync.mockReturnValueOnce(createMockSpawnResult('not valid json'));

      const runs = await getWorkflowHistory('owner/repo', 'test.yml');

      expect(runs).toEqual([]);
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle non-array JSON response', async () => {
      mockSpawnSync.mockReturnValueOnce(createMockSpawnResult('{"not": "array"}'));

      const runs = await getWorkflowHistory('owner/repo', 'test.yml');

      expect(runs).toEqual([]);
    });

    it('should pass authentication tokens correctly', async () => {
      process.env.GITHUB_TOKEN = 'test-token';
      mockSpawnSync.mockReturnValueOnce(createMockSpawnResult('[]'));

      await getWorkflowHistory('owner/repo', 'test.yml');

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'gh',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            GITHUB_TOKEN: 'test-token',
            GH_TOKEN: 'test-token',
          }),
        })
      );
    });
  });

  describe('analyzeTrends', () => {
    it('should analyze empty run history', () => {
      const analysis = analyzeTrends([]);

      expect(analysis.totalRuns).toBe(0);
      expect(analysis.successfulRuns).toBe(0);
      expect(analysis.failedRuns).toBe(0);
      expect(analysis.skippedRuns).toBe(0);
      expect(analysis.successRate).toBe(0);
      expect(analysis.failureRate).toBe(0);
      expect(analysis.averageDuration).toBe(0);
      expect(analysis.minDuration).toBe(0); // Should be 0 after fix
      expect(analysis.maxDuration).toBe(0);
      expect(analysis.runsByDate).toEqual({});
      expect(analysis.failuresByDate).toEqual({});
      expect(analysis.lastFailureDate).toBeUndefined();
      expect(analysis.consecutiveFailures).toBe(0);
      expect(analysis.periodDays).toBe(7);
    });

    it('should calculate success and failure rates correctly', () => {
      const runs = [
        createMockWorkflowRun({ conclusion: 'success' }),
        createMockWorkflowRun({ conclusion: 'success' }),
        createMockWorkflowRun({ conclusion: 'failure' }),
        createMockWorkflowRun({ conclusion: 'success' }),
        createMockWorkflowRun({ conclusion: 'failure' }),
      ];

      const analysis = analyzeTrends(runs);

      expect(analysis.totalRuns).toBe(5);
      expect(analysis.successfulRuns).toBe(3);
      expect(analysis.failedRuns).toBe(2);
      expect(analysis.successRate).toBe(60); // 3/5 = 60%
      expect(analysis.failureRate).toBe(40); // 2/5 = 40%
    });

    it('should track consecutive failures correctly', () => {
      const runs = [
        createMockWorkflowRun({ conclusion: 'failure', created_at: '2024-12-20T10:00:00Z' }),
        createMockWorkflowRun({ conclusion: 'failure', created_at: '2024-12-19T10:00:00Z' }),
        createMockWorkflowRun({ conclusion: 'failure', created_at: '2024-12-18T10:00:00Z' }),
        createMockWorkflowRun({ conclusion: 'success', created_at: '2024-12-17T10:00:00Z' }),
        createMockWorkflowRun({ conclusion: 'failure', created_at: '2024-12-16T10:00:00Z' }),
      ];

      const analysis = analyzeTrends(runs);

      expect(analysis.consecutiveFailures).toBe(3); // Most recent 3 runs are failures
      expect(analysis.lastFailureDate).toBe('2024-12-20');
    });

    it('should calculate duration statistics', () => {
      const runs = [
        createMockWorkflowRun({ run_duration_ms: 60000 }), // 1 minute
        createMockWorkflowRun({ run_duration_ms: 120000 }), // 2 minutes
        createMockWorkflowRun({ run_duration_ms: 180000 }), // 3 minutes
        createMockWorkflowRun({ run_duration_ms: 240000 }), // 4 minutes
      ];

      const analysis = analyzeTrends(runs);

      expect(analysis.averageDuration).toBe(150); // Average: 2.5 minutes = 150 seconds
      expect(analysis.minDuration).toBe(60); // 1 minute = 60 seconds
      expect(analysis.maxDuration).toBe(240); // 4 minutes = 240 seconds
    });

    it('should group runs by date', () => {
      const runs = [
        createMockWorkflowRun({ created_at: '2024-12-20T10:00:00Z' }),
        createMockWorkflowRun({ created_at: '2024-12-20T14:00:00Z' }),
        createMockWorkflowRun({ created_at: '2024-12-19T10:00:00Z' }),
        createMockWorkflowRun({ created_at: '2024-12-18T10:00:00Z' }),
        createMockWorkflowRun({ created_at: '2024-12-18T12:00:00Z' }),
        createMockWorkflowRun({ created_at: '2024-12-18T16:00:00Z' }),
      ];

      const analysis = analyzeTrends(runs);

      expect(analysis.runsByDate).toEqual({
        '2024-12-20': 2,
        '2024-12-19': 1,
        '2024-12-18': 3,
      });
    });

    it('should group failures by date', () => {
      const runs = [
        createMockWorkflowRun({ conclusion: 'failure', created_at: '2024-12-20T10:00:00Z' }),
        createMockWorkflowRun({ conclusion: 'success', created_at: '2024-12-20T14:00:00Z' }),
        createMockWorkflowRun({ conclusion: 'failure', created_at: '2024-12-19T10:00:00Z' }),
        createMockWorkflowRun({ conclusion: 'failure', created_at: '2024-12-19T14:00:00Z' }),
        createMockWorkflowRun({ conclusion: 'success', created_at: '2024-12-18T10:00:00Z' }),
      ];

      const analysis = analyzeTrends(runs);

      expect(analysis.failuresByDate).toEqual({
        '2024-12-20': 1,
        '2024-12-19': 2,
      });
    });

    it('should handle skipped and cancelled runs', () => {
      const runs = [
        createMockWorkflowRun({ conclusion: 'success' }),
        createMockWorkflowRun({ conclusion: 'skipped' }),
        createMockWorkflowRun({ conclusion: 'cancelled' }),
        createMockWorkflowRun({ conclusion: 'failure' }),
      ];

      const analysis = analyzeTrends(runs);

      expect(analysis.skippedRuns).toBe(2); // skipped + cancelled
    });

    it('should handle runs without duration data', () => {
      const runs = [
        createMockWorkflowRun({ run_duration_ms: undefined }),
        createMockWorkflowRun({ run_duration_ms: 120000 }),
        createMockWorkflowRun({ run_duration_ms: null }),
      ];

      const analysis = analyzeTrends(runs);

      expect(analysis.averageDuration).toBe(120); // Only one valid duration
      expect(analysis.minDuration).toBe(120);
      expect(analysis.maxDuration).toBe(120);
    });

    it('should handle custom period days', () => {
      const runs = [createMockWorkflowRun()];

      const analysis = analyzeTrends(runs, 30);

      expect(analysis.periodDays).toBe(30);
    });

    it('should reset consecutive failures when success is found', () => {
      const runs = [
        createMockWorkflowRun({ conclusion: 'failure', created_at: '2024-12-20T10:00:00Z' }),
        createMockWorkflowRun({ conclusion: 'failure', created_at: '2024-12-19T10:00:00Z' }),
        createMockWorkflowRun({ conclusion: 'success', created_at: '2024-12-18T10:00:00Z' }),
        createMockWorkflowRun({ conclusion: 'failure', created_at: '2024-12-17T10:00:00Z' }),
        createMockWorkflowRun({ conclusion: 'failure', created_at: '2024-12-16T10:00:00Z' }),
      ];

      const analysis = analyzeTrends(runs);

      expect(analysis.consecutiveFailures).toBe(2); // Only the 2 most recent failures
    });
  });

  describe('getWorkflowTrends', () => {
    it('should combine history retrieval and analysis', async () => {
      const mockRuns = [
        createMockWorkflowRun({ conclusion: 'success' }),
        createMockWorkflowRun({ conclusion: 'failure' }),
        createMockWorkflowRun({ conclusion: 'success' }),
      ];

      mockSpawnSync.mockReturnValueOnce(createMockSpawnResult(JSON.stringify(mockRuns)));

      const trends = await getWorkflowTrends('owner/repo', 'test.yml', 7);

      expect(trends.totalRuns).toBe(3);
      expect(trends.successfulRuns).toBe(2);
      expect(trends.failedRuns).toBe(1);
      expect(trends.periodDays).toBe(7);
    });

    it('should use default workflow name', async () => {
      mockSpawnSync.mockReturnValueOnce(createMockSpawnResult('[]'));

      await getWorkflowTrends('owner/repo');

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining([
          'api',
          'repos/owner/repo/actions/workflows/production-e2e-smoke-test.yml/runs',
        ]),
        expect.anything()
      );
    });

    it('should handle API errors gracefully', async () => {
      mockSpawnSync.mockImplementation(() => {
        throw new Error('API Error');
      });

      const trends = await getWorkflowTrends('owner/repo');

      expect(trends.totalRuns).toBe(0);
      expect(trends.successfulRuns).toBe(0);
      expect(trends.failedRuns).toBe(0);
    });
  });

  describe('formatTrendAnalysis', () => {
    it('should format basic trend analysis', () => {
      const trends = {
        totalRuns: 10,
        successfulRuns: 8,
        failedRuns: 2,
        skippedRuns: 0,
        successRate: 80,
        failureRate: 20,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        runsByDate: {},
        failuresByDate: {},
        lastFailureDate: undefined,
        consecutiveFailures: 0,
        periodDays: 7,
      };

      const formatted = formatTrendAnalysis(trends);

      expect(formatted).toContain('📊 7-Day Trend Analysis');
      expect(formatted).toContain('Total Runs: 10');
      expect(formatted).toContain('✅ Successful: 8 (80%)');
      expect(formatted).toContain('❌ Failed: 2 (20%)');
      expect(formatted).toContain('⚠️ Warning - Moderate failure rate'); // 20% is moderate, not low
    });

    it('should include duration statistics when available', () => {
      const trends = {
        totalRuns: 5,
        successfulRuns: 5,
        failedRuns: 0,
        skippedRuns: 0,
        successRate: 100,
        failureRate: 0,
        averageDuration: 150,
        minDuration: 60,
        maxDuration: 300,
        runsByDate: {},
        failuresByDate: {},
        lastFailureDate: undefined,
        consecutiveFailures: 0,
        periodDays: 7,
      };

      const formatted = formatTrendAnalysis(trends);

      expect(formatted).toContain('⏱️ Duration Statistics:');
      expect(formatted).toContain('Average: 150s');
      expect(formatted).toContain('Min: 60s');
      expect(formatted).toContain('Max: 300s');
    });

    it('should include failure analysis when failures exist', () => {
      const trends = {
        totalRuns: 10,
        successfulRuns: 6,
        failedRuns: 4,
        skippedRuns: 0,
        successRate: 60,
        failureRate: 40,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        runsByDate: {},
        failuresByDate: {
          '2024-12-20': 2,
          '2024-12-19': 1,
          '2024-12-18': 1,
        },
        lastFailureDate: '2024-12-20',
        consecutiveFailures: 2,
        periodDays: 7,
      };

      const formatted = formatTrendAnalysis(trends);

      expect(formatted).toContain('🔍 Failure Analysis:');
      expect(formatted).toContain('Last Failure: 2024-12-20');
      expect(formatted).toContain('⚠️ Consecutive Failures: 2');
      expect(formatted).toContain('Failures by Date:');
      expect(formatted).toContain('2024-12-20: 2 failure(s)');
    });

    it('should show critical alert for multiple consecutive failures', () => {
      const trends = {
        totalRuns: 10,
        successfulRuns: 5,
        failedRuns: 5,
        skippedRuns: 0,
        successRate: 50,
        failureRate: 50,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        runsByDate: {},
        failuresByDate: {},
        lastFailureDate: '2024-12-20',
        consecutiveFailures: 4,
        periodDays: 7,
      };

      const formatted = formatTrendAnalysis(trends);

      expect(formatted).toContain('🚨 Critical - Very high failure rate');
      expect(formatted).toContain('🚨 ALERT: Multiple consecutive failures detected!');
    });

    it('should show excellent health for zero failures', () => {
      const trends = {
        totalRuns: 10,
        successfulRuns: 10,
        failedRuns: 0,
        skippedRuns: 0,
        successRate: 100,
        failureRate: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        runsByDate: {},
        failuresByDate: {},
        lastFailureDate: undefined,
        consecutiveFailures: 0,
        periodDays: 7,
      };

      const formatted = formatTrendAnalysis(trends);

      expect(formatted).toContain('✅ Excellent - No failures');
    });

    it('should show warning health for moderate failure rate', () => {
      const trends = {
        totalRuns: 10,
        successfulRuns: 8,
        failedRuns: 2,
        skippedRuns: 0,
        successRate: 80,
        failureRate: 20,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        runsByDate: {},
        failuresByDate: {},
        lastFailureDate: undefined,
        consecutiveFailures: 0,
        periodDays: 7,
      };

      const formatted = formatTrendAnalysis(trends);

      expect(formatted).toContain('⚠️ Warning - Moderate failure rate');
    });

    it('should show poor health for high failure rate', () => {
      const trends = {
        totalRuns: 10,
        successfulRuns: 6,
        failedRuns: 4,
        skippedRuns: 0,
        successRate: 60,
        failureRate: 40,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        runsByDate: {},
        failuresByDate: {},
        lastFailureDate: undefined,
        consecutiveFailures: 0,
        periodDays: 7,
      };

      const formatted = formatTrendAnalysis(trends);

      expect(formatted).toContain('🔥 Poor - High failure rate');
    });

    it('should include skipped runs when present', () => {
      const trends = {
        totalRuns: 10,
        successfulRuns: 6,
        failedRuns: 2,
        skippedRuns: 2,
        successRate: 60,
        failureRate: 20,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        runsByDate: {},
        failuresByDate: {},
        lastFailureDate: undefined,
        consecutiveFailures: 0,
        periodDays: 7,
      };

      const formatted = formatTrendAnalysis(trends);

      expect(formatted).toContain('⏸️ Skipped: 2');
    });

    it('should limit failure dates shown to most recent 5', () => {
      const trends = {
        totalRuns: 20,
        successfulRuns: 10,
        failedRuns: 10,
        skippedRuns: 0,
        successRate: 50,
        failureRate: 50,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        runsByDate: {},
        failuresByDate: {
          '2024-12-20': 2,
          '2024-12-19': 1,
          '2024-12-18': 1,
          '2024-12-17': 1,
          '2024-12-16': 1,
          '2024-12-15': 1,
          '2024-12-14': 1,
          '2024-12-13': 1,
          '2024-12-12': 1,
        },
        lastFailureDate: '2024-12-20',
        consecutiveFailures: 0,
        periodDays: 10,
      };

      const formatted = formatTrendAnalysis(trends);
      const lines = formatted.split('\n');
      const failureLines = lines.filter((line) => line.includes('failure(s)'));

      // Should only show 5 most recent dates
      expect(failureLines.length).toBe(5);
      expect(formatted).toContain('2024-12-20');
      expect(formatted).not.toContain('2024-12-12'); // Oldest, should be excluded
    });
  });

  describe('determineNotificationPriority', () => {
    it('should return critical for 3+ consecutive failures', () => {
      const trends = {
        totalRuns: 10,
        successfulRuns: 7,
        failedRuns: 3,
        skippedRuns: 0,
        successRate: 70,
        failureRate: 30,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        runsByDate: {},
        failuresByDate: {},
        lastFailureDate: '2024-12-20',
        consecutiveFailures: 3,
        periodDays: 7,
      };

      const priority = determineNotificationPriority(trends);

      expect(priority).toBe('critical');
    });

    it('should return critical for 50%+ failure rate', () => {
      const trends = {
        totalRuns: 10,
        successfulRuns: 5,
        failedRuns: 5,
        skippedRuns: 0,
        successRate: 50,
        failureRate: 50,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        runsByDate: {},
        failuresByDate: {},
        lastFailureDate: '2024-12-20',
        consecutiveFailures: 1,
        periodDays: 7,
      };

      const priority = determineNotificationPriority(trends);

      expect(priority).toBe('critical');
    });

    it('should return high for 2 consecutive failures', () => {
      const trends = {
        totalRuns: 10,
        successfulRuns: 8,
        failedRuns: 2,
        skippedRuns: 0,
        successRate: 80,
        failureRate: 20,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        runsByDate: {},
        failuresByDate: {},
        lastFailureDate: '2024-12-20',
        consecutiveFailures: 2,
        periodDays: 7,
      };

      const priority = determineNotificationPriority(trends);

      expect(priority).toBe('high');
    });

    it('should return high for 25%+ failure rate', () => {
      const trends = {
        totalRuns: 10,
        successfulRuns: 7,
        failedRuns: 3,
        skippedRuns: 0,
        successRate: 70,
        failureRate: 30,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        runsByDate: {},
        failuresByDate: {},
        lastFailureDate: '2024-12-20',
        consecutiveFailures: 1,
        periodDays: 7,
      };

      const priority = determineNotificationPriority(trends);

      expect(priority).toBe('high');
    });

    it('should return normal for low failure rate', () => {
      const trends = {
        totalRuns: 10,
        successfulRuns: 9,
        failedRuns: 1,
        skippedRuns: 0,
        successRate: 90,
        failureRate: 10,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        runsByDate: {},
        failuresByDate: {},
        lastFailureDate: '2024-12-18',
        consecutiveFailures: 0,
        periodDays: 7,
      };

      const priority = determineNotificationPriority(trends);

      expect(priority).toBe('normal');
    });

    it('should return low for no failures', () => {
      const trends = {
        totalRuns: 10,
        successfulRuns: 10,
        failedRuns: 0,
        skippedRuns: 0,
        successRate: 100,
        failureRate: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        runsByDate: {},
        failuresByDate: {},
        lastFailureDate: undefined,
        consecutiveFailures: 0,
        periodDays: 7,
      };

      const priority = determineNotificationPriority(trends);

      expect(priority).toBe('low');
    });

    it('should prioritize consecutive failures over failure rate', () => {
      const trends = {
        totalRuns: 100,
        successfulRuns: 85,
        failedRuns: 15,
        skippedRuns: 0,
        successRate: 85,
        failureRate: 15, // Low failure rate
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        runsByDate: {},
        failuresByDate: {},
        lastFailureDate: '2024-12-20',
        consecutiveFailures: 4, // But 4 consecutive failures
        periodDays: 7,
      };

      const priority = determineNotificationPriority(trends);

      expect(priority).toBe('critical'); // Consecutive failures take precedence
    });

    it('should handle edge case of exactly 25% failure rate', () => {
      const trends = {
        totalRuns: 4,
        successfulRuns: 3,
        failedRuns: 1,
        skippedRuns: 0,
        successRate: 75,
        failureRate: 25,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        runsByDate: {},
        failuresByDate: {},
        lastFailureDate: '2024-12-20',
        consecutiveFailures: 1,
        periodDays: 7,
      };

      const priority = determineNotificationPriority(trends);

      expect(priority).toBe('high'); // >= 25% should be high
    });

    it('should handle edge case of exactly 50% failure rate', () => {
      const trends = {
        totalRuns: 2,
        successfulRuns: 1,
        failedRuns: 1,
        skippedRuns: 0,
        successRate: 50,
        failureRate: 50,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        runsByDate: {},
        failuresByDate: {},
        lastFailureDate: '2024-12-20',
        consecutiveFailures: 1,
        periodDays: 7,
      };

      const priority = determineNotificationPriority(trends);

      expect(priority).toBe('critical'); // >= 50% should be critical
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete trend analysis workflow', async () => {
      const mockRuns = [
        createMockWorkflowRun({
          id: 1,
          conclusion: 'failure',
          created_at: '2024-12-20T10:00:00Z',
          run_duration_ms: 180000,
        }),
        createMockWorkflowRun({
          id: 2,
          conclusion: 'failure',
          created_at: '2024-12-19T10:00:00Z',
          run_duration_ms: 120000,
        }),
        createMockWorkflowRun({
          id: 3,
          conclusion: 'success',
          created_at: '2024-12-18T10:00:00Z',
          run_duration_ms: 150000,
        }),
      ];

      mockSpawnSync.mockReturnValueOnce(createMockSpawnResult(JSON.stringify(mockRuns)));

      // Get trends
      const trends = await getWorkflowTrends('owner/repo', 'test.yml', 7);

      // Verify analysis
      expect(trends.totalRuns).toBe(3);
      expect(trends.failedRuns).toBe(2);
      expect(trends.consecutiveFailures).toBe(2);
      expect(trends.averageDuration).toBe(150); // (180+120+150)/3 = 150

      // Check priority
      const priority = determineNotificationPriority(trends);
      expect(priority).toBe('critical'); // 66% failure rate is critical

      // Format for display
      const formatted = formatTrendAnalysis(trends);
      expect(formatted).toContain('📊 7-Day Trend Analysis');
      expect(formatted).toContain('⚠️ Consecutive Failures: 2');
    });

    it('should handle workflow with improving trends', async () => {
      const mockRuns = [
        // Recent successes
        createMockWorkflowRun({
          conclusion: 'success',
          created_at: '2024-12-20T10:00:00Z',
        }),
        createMockWorkflowRun({
          conclusion: 'success',
          created_at: '2024-12-19T10:00:00Z',
        }),
        // Past failures
        createMockWorkflowRun({
          conclusion: 'failure',
          created_at: '2024-12-18T10:00:00Z',
        }),
        createMockWorkflowRun({
          conclusion: 'failure',
          created_at: '2024-12-17T10:00:00Z',
        }),
      ];

      mockSpawnSync.mockReturnValueOnce(createMockSpawnResult(JSON.stringify(mockRuns)));

      const trends = await getWorkflowTrends('owner/repo');

      expect(trends.consecutiveFailures).toBe(0); // No recent failures
      expect(trends.lastFailureDate).toBe('2024-12-18');

      const priority = determineNotificationPriority(trends);
      expect(priority).toBe('critical'); // 50% failure rate is critical

      const formatted = formatTrendAnalysis(trends);
      expect(formatted).toContain('🚨 Critical - Very high failure rate'); // 50% is critical
    });

    it('should handle workflow with degrading performance', async () => {
      const mockRuns = [
        // Increasing duration over time
        createMockWorkflowRun({
          conclusion: 'success',
          created_at: '2024-12-20T10:00:00Z',
          run_duration_ms: 600000, // 10 minutes
        }),
        createMockWorkflowRun({
          conclusion: 'success',
          created_at: '2024-12-19T10:00:00Z',
          run_duration_ms: 480000, // 8 minutes
        }),
        createMockWorkflowRun({
          conclusion: 'success',
          created_at: '2024-12-18T10:00:00Z',
          run_duration_ms: 360000, // 6 minutes
        }),
        createMockWorkflowRun({
          conclusion: 'success',
          created_at: '2024-12-17T10:00:00Z',
          run_duration_ms: 240000, // 4 minutes
        }),
      ];

      mockSpawnSync.mockReturnValueOnce(createMockSpawnResult(JSON.stringify(mockRuns)));

      const trends = await getWorkflowTrends('owner/repo');

      expect(trends.minDuration).toBe(240); // 4 minutes
      expect(trends.maxDuration).toBe(600); // 10 minutes
      expect(trends.averageDuration).toBe(420); // 7 minutes average

      const formatted = formatTrendAnalysis(trends);
      expect(formatted).toContain('Min: 240s');
      expect(formatted).toContain('Max: 600s');
      expect(formatted).toContain('Average: 420s');
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle spawn error gracefully', async () => {
      mockSpawnSync.mockImplementation(
        () =>
          ({
            error: new Error('spawn ENOENT'),
            stdout: '',
            stderr: '',
            status: null,
            signal: null,
            output: [],
            pid: 0,
          }) as any
      );

      const runs = await getWorkflowHistory('owner/repo', 'test.yml');

      expect(runs).toEqual([]);
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle timeout scenarios', async () => {
      mockSpawnSync.mockReturnValueOnce({
        stdout: '',
        stderr: 'Command timed out',
        status: null,
        signal: 'SIGTERM',
        output: [''],
        pid: 123,
      } as any);

      const runs = await getWorkflowHistory('owner/repo', 'test.yml');

      expect(runs).toEqual([]);
    });

    it('should handle large dataset correctly', async () => {
      const largeDataset = Array(1000)
        .fill(null)
        .map((_, i) =>
          createMockWorkflowRun({
            id: i,
            conclusion: i % 3 === 0 ? 'failure' : 'success',
            created_at: new Date(Date.now() - i * 3600000).toISOString(),
          })
        );

      mockSpawnSync.mockReturnValueOnce(createMockSpawnResult(JSON.stringify(largeDataset)));

      const runs = await getWorkflowHistory('owner/repo', 'test.yml');
      const analysis = analyzeTrends(runs);

      expect(analysis.totalRuns).toBe(1000);
      expect(analysis.failedRuns).toBe(334); // Every 3rd run fails (indices 0, 3, 6, ...)
    });

    it('should handle special characters in error messages', async () => {
      mockSpawnSync.mockReturnValueOnce({
        stdout: '',
        stderr: 'Error: "special" <characters> & symbols',
        status: 1,
        signal: null,
        output: [''],
        pid: 123,
      } as any);

      const runs = await getWorkflowHistory('owner/repo', 'test.yml');

      expect(runs).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to get workflow history:',
        expect.objectContaining({
          message: expect.stringContaining('special'),
        })
      );
    });
  });
});
