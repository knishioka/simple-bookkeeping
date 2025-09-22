/**
 * Smoke Test Utilities
 *
 * This module provides utilities for managing production smoke test executions,
 * including execution limit checking to prevent excessive load on production systems.
 */

import { execSync } from 'child_process';

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
 *   console.log('Daily execution limit exceeded');
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

    console.log(
      `[Execution Limit Check] Checking workflow runs for ${currentDate} (${useJST ? 'JST' : 'UTC'})`
    );
    console.log(`[Execution Limit Check] Repository: ${repository}, Workflow: ${workflowName}`);

    // Query GitHub API for workflow runs
    const executionCount = await getWorkflowExecutionCount({
      repository,
      workflowName,
      startDate,
      endDate,
    });

    console.log(
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

  try {
    // Use gh CLI to query GitHub API
    // gh is the recommended way to interact with GitHub API in GitHub Actions
    const command =
      `gh api repos/${repository}/actions/workflows/${workflowName}/runs ` +
      `--jq '[.workflow_runs[] | select(.status == "completed" and .conclusion == "success" and .created_at >= "${startDate}" and .created_at <= "${endDate}")] | length'`;

    console.log(`[Execution Limit Check] Executing GitHub API query...`);

    const result = execSync(command, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'], // Capture stdout and stderr
      env: {
        ...process.env,
        // Ensure gh uses the correct authentication
        GH_TOKEN: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
      },
    }).trim();

    const count = parseInt(result, 10);

    if (isNaN(count)) {
      throw new Error(`Invalid execution count returned from API: ${result}`);
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
