/**
 * Smoke Test Utilities
 *
 * This module provides utilities for managing production smoke test executions,
 * including execution limit checking to prevent excessive load on production systems.
 */

import { spawnSync } from 'child_process';

/**
 * Configuration for execution limit checking
 */
interface ExecutionLimitConfig {
  /** Maximum number of allowed executions per day (default: 5) */
  maxExecutions?: number;
  /** GitHub repository in the format "owner/repo" */
  repository?: string;
  /** Workflow name to check */
  workflowName?: string;
  /** Whether to use JST timezone (default: true) */
  useJST?: boolean;
}

/**
 * Result of execution limit check
 */
interface ExecutionLimitResult {
  /** Whether the execution limit has been exceeded */
  isLimitExceeded: boolean;
  /** Current number of executions today */
  currentCount: number;
  /** Maximum allowed executions */
  maxCount: number;
  /** ISO date string for the current day */
  currentDate: string;
  /** Error message if any */
  error?: string;
}

/**
 * Checks if the daily execution limit for production E2E smoke tests has been exceeded.
 *
 * This function queries the GitHub API to count successful workflow runs for the current day
 * (in JST timezone by default) and compares against the configured limit.
 *
 * @param config - Configuration for execution limit checking
 * @returns Promise resolving to true if execution is allowed (under limit), false if limit exceeded
 *
 * @example
 * ```typescript
 * // Basic usage with defaults
 * const canExecute = await checkExecutionLimit();
 * if (!canExecute) {
 *   console.warn('Daily execution limit exceeded');
 *   process.exit(0);
 * }
 *
 * // Custom configuration
 * const canExecute = await checkExecutionLimit({
 *   maxExecutions: 10,
 *   workflowName: 'production-e2e-smoke-test.yml',
 *   repository: 'myorg/myrepo'
 * });
 * ```
 *
 * @throws Will throw an error if GitHub API call fails or if required environment variables are missing
 */
export async function checkExecutionLimit(config?: ExecutionLimitConfig): Promise<boolean> {
  const {
    maxExecutions = 5,
    repository = process.env.GITHUB_REPOSITORY || '',
    workflowName = 'production-e2e-smoke-test.yml',
    useJST = true,
  } = config || {};

  try {
    // Validate required configuration
    if (!repository) {
      throw new Error(
        'GitHub repository not specified. Provide it via config or set GITHUB_REPOSITORY environment variable.'
      );
    }

    // Get current date in appropriate timezone
    const currentDate = getCurrentDate(useJST);
    const startDate = `${currentDate}T00:00:00${useJST ? '+09:00' : 'Z'}`;
    const endDate = `${currentDate}T23:59:59${useJST ? '+09:00' : 'Z'}`;

    console.warn(
      `[Execution Limit Check] Checking workflow runs for ${currentDate} (${useJST ? 'JST' : 'UTC'})`
    );
    console.warn(`[Execution Limit Check] Repository: ${repository}, Workflow: ${workflowName}`);

    // Query GitHub API for workflow runs
    const executionCount = await getWorkflowExecutionCount({
      repository,
      workflowName,
      startDate,
      endDate,
    });

    console.warn(
      `[Execution Limit Check] Current executions today: ${executionCount}/${maxExecutions}`
    );

    const isUnderLimit = executionCount < maxExecutions;

    if (!isUnderLimit) {
      console.warn(
        `[Execution Limit Check] ⚠️ Daily execution limit exceeded: ${executionCount}/${maxExecutions}`
      );
      console.warn(
        `[Execution Limit Check] Further executions will be blocked until tomorrow (${useJST ? 'JST' : 'UTC'}).`
      );
    }

    return isUnderLimit;
  } catch (error) {
    // Log error details for debugging
    console.error('[Execution Limit Check] Error checking execution limit:', error);

    // In case of error, we should fail safe by blocking execution
    // This prevents unlimited executions if the check system fails
    console.error('[Execution Limit Check] Failing safe - blocking execution due to error');
    return false;
  }
}

/**
 * Gets the current date in YYYY-MM-DD format
 *
 * @param useJST - Whether to use JST timezone (UTC+9)
 * @returns Date string in YYYY-MM-DD format
 */
function getCurrentDate(useJST: boolean): string {
  const now = new Date();

  if (useJST) {
    // Convert to JST (UTC+9)
    const jstOffset = 9 * 60 * 60 * 1000; // 9 hours in milliseconds
    const jstTime = new Date(now.getTime() + jstOffset);
    return jstTime.toISOString().split('T')[0];
  }

  return now.toISOString().split('T')[0];
}

/**
 * Queries GitHub API for workflow execution count
 *
 * @param params - Query parameters
 * @returns Number of successful workflow executions
 */
async function getWorkflowExecutionCount(params: {
  repository: string;
  workflowName: string;
  startDate: string;
  endDate: string;
}): Promise<number> {
  const { repository, workflowName, startDate, endDate } = params;

  // Input validation to prevent injection attacks
  // Repository must be in format: owner/repo (alphanumeric, hyphens, underscores, periods allowed)
  // GitHub allows periods in repo names, but not consecutive or at the start/end
  if (!/^[\w-]+\/[\w.-]+$/.test(repository)) {
    throw new Error(
      `Invalid repository format: ${repository}. Must be 'owner/repo' with alphanumeric characters, hyphens, periods, and underscores only.`
    );
  }

  // Workflow name must be a valid filename with .yml or .yaml extension
  if (!/^[\w.-]+\.(yml|yaml)$/.test(workflowName)) {
    throw new Error(
      `Invalid workflow name: ${workflowName}. Must be a valid filename ending in .yml or .yaml`
    );
  }

  // Date validation (ISO 8601 format)
  const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/;
  if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
    throw new Error('Invalid date format. Dates must be in ISO 8601 format.');
  }

  try {
    // Use gh CLI to query GitHub API
    // Using spawnSync instead of execSync for better security
    const jqQuery = `[.workflow_runs[] | select(.status == "completed" and .conclusion == "success" and .created_at >= "${startDate}" and .created_at <= "${endDate}")] | length`;

    console.warn(`[Execution Limit Check] Executing GitHub API query...`);

    const result = spawnSync(
      'gh',
      ['api', `repos/${repository}/actions/workflows/${workflowName}/runs`, '--jq', jqQuery],
      {
        encoding: 'utf8',
        env: {
          // Only pass necessary environment variables
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          GH_TOKEN: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
          GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        },
      }
    );

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      const stderr = result.stderr || '';
      throw new Error(`GitHub CLI failed with status ${result.status}: ${stderr}`);
    }

    const output = (result.stdout || '').trim();

    const count = parseInt(output, 10);

    if (isNaN(count)) {
      throw new Error(`Invalid execution count returned from API: ${output}`);
    }

    return count;
  } catch (error) {
    // Handle specific error cases
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('HTTP 404')) {
      console.warn(
        `[Execution Limit Check] Workflow '${workflowName}' not found. This may be normal if it hasn't been created yet.`
      );
      return 0; // No executions if workflow doesn't exist
    }

    if (errorMessage.includes('HTTP 401') || errorMessage.includes('HTTP 403')) {
      throw new Error(
        'GitHub API authentication failed. Ensure GITHUB_TOKEN or GH_TOKEN is set with appropriate permissions.'
      );
    }

    // Re-throw other errors
    throw new Error(`Failed to query GitHub API: ${errorMessage}`);
  }
}

/**
 * Gets detailed execution limit status
 *
 * This is a more detailed version of checkExecutionLimit that returns
 * additional information about the current execution state.
 *
 * @param config - Configuration for execution limit checking
 * @returns Detailed execution limit result
 */
export async function getExecutionLimitStatus(
  config?: ExecutionLimitConfig
): Promise<ExecutionLimitResult> {
  const {
    maxExecutions = 5,
    repository = process.env.GITHUB_REPOSITORY || '',
    workflowName = 'production-e2e-smoke-test.yml',
    useJST = true,
  } = config || {};

  const currentDate = getCurrentDate(useJST);

  try {
    // Validate required configuration
    if (!repository) {
      return {
        isLimitExceeded: true,
        currentCount: 0,
        maxCount: maxExecutions,
        currentDate,
        error: 'GitHub repository not specified',
      };
    }

    const startDate = `${currentDate}T00:00:00${useJST ? '+09:00' : 'Z'}`;
    const endDate = `${currentDate}T23:59:59${useJST ? '+09:00' : 'Z'}`;

    const currentCount = await getWorkflowExecutionCount({
      repository,
      workflowName,
      startDate,
      endDate,
    });

    return {
      isLimitExceeded: currentCount >= maxExecutions,
      currentCount,
      maxCount: maxExecutions,
      currentDate,
    };
  } catch (error) {
    return {
      isLimitExceeded: true,
      currentCount: 0,
      maxCount: maxExecutions,
      currentDate,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Formats execution limit status for display
 *
 * @param status - Execution limit status
 * @returns Formatted status message
 */
export function formatExecutionLimitStatus(status: ExecutionLimitResult): string {
  const { isLimitExceeded, currentCount, maxCount, currentDate, error } = status;

  if (error) {
    return `❌ Execution limit check failed: ${error}`;
  }

  if (isLimitExceeded) {
    return `⚠️ Daily execution limit exceeded (${currentCount}/${maxCount}) for ${currentDate}. Please wait until tomorrow to run more tests.`;
  }

  const remaining = maxCount - currentCount;
  return `✅ Execution allowed (${currentCount}/${maxCount} used today, ${remaining} remaining) for ${currentDate}`;
}

// Export default configuration for convenience
export const defaultConfig: ExecutionLimitConfig = {
  maxExecutions: 5,
  workflowName: 'production-e2e-smoke-test.yml',
  useJST: true,
};

/**
 * Workflow run data for trend analysis
 */
interface WorkflowRun {
  id: number;
  conclusion: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  run_started_at?: string;
  run_duration_ms?: number;
  html_url: string;
}

/**
 * Trend analysis result
 */
interface TrendAnalysis {
  /** Total number of runs in the period */
  totalRuns: number;
  /** Number of successful runs */
  successfulRuns: number;
  /** Number of failed runs */
  failedRuns: number;
  /** Number of skipped runs */
  skippedRuns: number;
  /** Success rate percentage */
  successRate: number;
  /** Failure rate percentage */
  failureRate: number;
  /** Average duration in seconds */
  averageDuration: number;
  /** Minimum duration in seconds */
  minDuration: number;
  /** Maximum duration in seconds */
  maxDuration: number;
  /** Runs grouped by date */
  runsByDate: Record<string, number>;
  /** Failures grouped by date */
  failuresByDate: Record<string, number>;
  /** Most recent failure date */
  lastFailureDate?: string;
  /** Consecutive failures count */
  consecutiveFailures: number;
  /** Analysis period in days */
  periodDays: number;
}

/**
 * Gets workflow run history for trend analysis
 *
 * @param repository - GitHub repository (owner/repo)
 * @param workflowName - Workflow filename
 * @param days - Number of days to look back (default: 7)
 * @returns Array of workflow runs
 */
export async function getWorkflowHistory(
  repository: string,
  workflowName: string,
  days: number = 7
): Promise<WorkflowRun[]> {
  try {
    // Input validation
    if (!/^[\w-]+\/[\w.-]+$/.test(repository)) {
      throw new Error(`Invalid repository format: ${repository}`);
    }

    if (!/^[\w.-]+\.(yml|yaml)$/.test(workflowName)) {
      throw new Error(`Invalid workflow name: ${workflowName}`);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateISO = startDate.toISOString();
    // Use gh CLI to get workflow runs
    const result = spawnSync(
      'gh',
      [
        'api',
        `repos/${repository}/actions/workflows/${workflowName}/runs`,
        '--paginate',
        '--jq',
        `[.workflow_runs[] | select(.created_at >= "${startDateISO}")]`,
      ],
      {
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          GH_TOKEN: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
          GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        },
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for paginated results
      }
    );

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      const stderr = result.stderr || '';
      throw new Error(`GitHub CLI failed: ${stderr}`);
    }

    const output = (result.stdout || '').trim();
    if (!output || output === '[]') {
      return [];
    }

    const runs = JSON.parse(output);
    return Array.isArray(runs) ? runs : [];
  } catch (error) {
    console.error('Failed to get workflow history:', error);
    return [];
  }
}

/**
 * Analyzes workflow run trends
 *
 * @param runs - Array of workflow runs
 * @param periodDays - Analysis period in days
 * @returns Trend analysis results
 */
export function analyzeTrends(runs: WorkflowRun[], periodDays: number = 7): TrendAnalysis {
  const analysis: TrendAnalysis = {
    totalRuns: runs.length,
    successfulRuns: 0,
    failedRuns: 0,
    skippedRuns: 0,
    successRate: 0,
    failureRate: 0,
    averageDuration: 0,
    minDuration: Number.MAX_VALUE,
    maxDuration: 0,
    runsByDate: {},
    failuresByDate: {},
    lastFailureDate: undefined,
    consecutiveFailures: 0,
    periodDays,
  };

  if (runs.length === 0) {
    analysis.minDuration = 0; // Fix minDuration for empty runs
    return analysis;
  }

  // Sort runs by date (newest first)
  const sortedRuns = [...runs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  let totalDuration = 0;
  let durationCount = 0;
  let foundSuccess = false;

  for (const run of sortedRuns) {
    const date = run.created_at.split('T')[0]; // YYYY-MM-DD

    // Count by status
    if (run.conclusion === 'success') {
      analysis.successfulRuns++;
      foundSuccess = true;
    } else if (run.conclusion === 'failure') {
      analysis.failedRuns++;

      // Track last failure
      if (!analysis.lastFailureDate) {
        analysis.lastFailureDate = date;
      }

      // Count consecutive failures (from most recent)
      if (!foundSuccess) {
        analysis.consecutiveFailures++;
      }

      // Track failures by date
      analysis.failuresByDate[date] = (analysis.failuresByDate[date] || 0) + 1;
    } else if (run.conclusion === 'skipped' || run.conclusion === 'cancelled') {
      analysis.skippedRuns++;
    }

    // Track runs by date
    analysis.runsByDate[date] = (analysis.runsByDate[date] || 0) + 1;

    // Calculate duration stats
    if (run.run_duration_ms) {
      const durationSeconds = run.run_duration_ms / 1000;
      totalDuration += durationSeconds;
      durationCount++;

      if (durationSeconds < analysis.minDuration) {
        analysis.minDuration = durationSeconds;
      }
      if (durationSeconds > analysis.maxDuration) {
        analysis.maxDuration = durationSeconds;
      }
    }
  }

  // Calculate rates
  if (analysis.totalRuns > 0) {
    analysis.successRate = Math.round((analysis.successfulRuns / analysis.totalRuns) * 100);
    analysis.failureRate = Math.round((analysis.failedRuns / analysis.totalRuns) * 100);
  }

  // Calculate average duration
  if (durationCount > 0) {
    analysis.averageDuration = Math.round(totalDuration / durationCount);
  }

  // Fix min duration if no runs had duration
  if (analysis.minDuration === Number.MAX_VALUE) {
    analysis.minDuration = 0;
  }

  return analysis;
}

/**
 * Gets a workflow trend analysis for the specified period
 *
 * @param repository - GitHub repository
 * @param workflowName - Workflow filename
 * @param days - Number of days to analyze
 * @returns Trend analysis
 */
export async function getWorkflowTrends(
  repository: string,
  workflowName: string = 'production-e2e-smoke-test.yml',
  days: number = 7
): Promise<TrendAnalysis> {
  const runs = await getWorkflowHistory(repository, workflowName, days);
  return analyzeTrends(runs, days);
}

/**
 * Formats trend analysis for display
 *
 * @param trends - Trend analysis results
 * @returns Formatted trend summary
 */
export function formatTrendAnalysis(trends: TrendAnalysis): string {
  const lines: string[] = [];

  lines.push(`📊 ${trends.periodDays}-Day Trend Analysis`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // Overall stats
  lines.push(`Total Runs: ${trends.totalRuns}`);
  lines.push(`✅ Successful: ${trends.successfulRuns} (${trends.successRate}%)`);
  lines.push(`❌ Failed: ${trends.failedRuns} (${trends.failureRate}%)`);

  if (trends.skippedRuns > 0) {
    lines.push(`⏸️ Skipped: ${trends.skippedRuns}`);
  }

  // Duration stats
  if (trends.averageDuration > 0) {
    lines.push('');
    lines.push('⏱️ Duration Statistics:');
    lines.push(`  Average: ${trends.averageDuration}s`);
    lines.push(`  Min: ${trends.minDuration}s`);
    lines.push(`  Max: ${trends.maxDuration}s`);
  }

  // Failure analysis
  if (trends.failedRuns > 0) {
    lines.push('');
    lines.push('🔍 Failure Analysis:');
    lines.push(`  Last Failure: ${trends.lastFailureDate || 'Unknown'}`);

    if (trends.consecutiveFailures > 0) {
      lines.push(`  ⚠️ Consecutive Failures: ${trends.consecutiveFailures}`);
    }

    // Show daily failure distribution
    const failureDates = Object.keys(trends.failuresByDate).sort();
    if (failureDates.length > 0) {
      lines.push('  Failures by Date:');
      failureDates.slice(-5).forEach((date) => {
        lines.push(`    ${date}: ${trends.failuresByDate[date]} failure(s)`);
      });
    }
  }

  // Health indicator
  lines.push('');
  lines.push('🏥 System Health:');
  if (trends.failureRate === 0) {
    lines.push('  ✅ Excellent - No failures');
  } else if (trends.failureRate < 10) {
    lines.push('  ✅ Good - Low failure rate');
  } else if (trends.failureRate < 25) {
    lines.push('  ⚠️ Warning - Moderate failure rate');
  } else if (trends.failureRate < 50) {
    lines.push('  🔥 Poor - High failure rate');
  } else {
    lines.push('  🚨 Critical - Very high failure rate');
  }

  if (trends.consecutiveFailures >= 3) {
    lines.push('  🚨 ALERT: Multiple consecutive failures detected!');
  }

  return lines.join('\n');
}

/**
 * Determines notification priority based on trends
 *
 * @param trends - Trend analysis results
 * @returns Suggested notification priority
 */
export function determineNotificationPriority(
  trends: TrendAnalysis
): 'low' | 'normal' | 'high' | 'critical' {
  // Critical: Multiple consecutive failures or very high failure rate
  if (trends.consecutiveFailures >= 3 || trends.failureRate >= 50) {
    return 'critical';
  }

  // High: Recent failures with moderate rate
  if (trends.consecutiveFailures >= 2 || trends.failureRate >= 25) {
    return 'high';
  }

  // Normal: Some failures but not concerning
  if (trends.failureRate > 0 && trends.failureRate < 25) {
    return 'normal';
  }

  // Low: No recent failures
  return 'low';
}
