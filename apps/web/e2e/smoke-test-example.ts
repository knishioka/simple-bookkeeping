/**
 * Example usage of smoke-test-utils for production E2E smoke tests
 *
 * This script demonstrates how to use the checkExecutionLimit function
 * in a GitHub Actions workflow or local development environment.
 */

import {
  checkExecutionLimit,
  getExecutionLimitStatus,
  formatExecutionLimitStatus,
} from './smoke-test-utils';

/**
 * Main execution function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Production E2E Smoke Test - Execution Limit Check');
  console.log('='.repeat(60));
  console.log();

  try {
    // Method 1: Simple check (returns boolean)
    console.log('Method 1: Simple execution limit check');
    console.log('-'.repeat(40));

    const canExecute = await checkExecutionLimit({
      maxExecutions: 5,
      repository: process.env.GITHUB_REPOSITORY,
      workflowName: 'production-e2e-smoke-test.yml',
      useJST: true,
    });

    if (!canExecute) {
      console.log('❌ Daily execution limit exceeded. Exiting...');
      process.exit(0); // Exit gracefully without error
    }

    console.log('✅ Execution limit check passed. Proceeding with tests...');
    console.log();

    // Method 2: Detailed status check
    console.log('Method 2: Detailed execution status');
    console.log('-'.repeat(40));

    const status = await getExecutionLimitStatus({
      maxExecutions: 5,
      repository: process.env.GITHUB_REPOSITORY,
      workflowName: 'production-e2e-smoke-test.yml',
      useJST: true,
    });

    console.log('Status details:');
    console.log(`  - Current executions: ${status.currentCount}`);
    console.log(`  - Maximum allowed: ${status.maxCount}`);
    console.log(`  - Remaining today: ${status.maxCount - status.currentCount}`);
    console.log(`  - Current date (JST): ${status.currentDate}`);
    console.log(`  - Limit exceeded: ${status.isLimitExceeded ? 'Yes' : 'No'}`);

    if (status.error) {
      console.log(`  - Error: ${status.error}`);
    }

    console.log();
    console.log('Formatted status message:');
    console.log(formatExecutionLimitStatus(status));
    console.log();

    // Example: Integration with actual E2E tests
    if (!status.isLimitExceeded) {
      console.log('🚀 Starting production E2E smoke tests...');
      console.log();

      // Here you would typically run your E2E tests
      // For example:
      // await runE2ETests();

      console.log('Example test execution would happen here.');
      console.log('In a real scenario, you would call your Playwright tests.');
    } else {
      console.log('⏸️  Skipping tests due to execution limit.');
    }
  } catch (error) {
    console.error('❌ Error during execution limit check:', error);
    console.error();
    console.error('For safety, tests will not be executed.');
    process.exit(1);
  }

  console.log();
  console.log('='.repeat(60));
  console.log('Execution limit check completed');
  console.log('='.repeat(60));
}

/**
 * Example: GitHub Actions integration
 *
 * This function shows how you might integrate the check into a GitHub Actions workflow
 */
async function githubActionsExample() {
  console.log('GitHub Actions Integration Example');
  console.log('='.repeat(40));

  // Set up environment (normally done by GitHub Actions)
  if (!process.env.GITHUB_REPOSITORY) {
    console.log('Setting example GITHUB_REPOSITORY...');
    process.env.GITHUB_REPOSITORY = 'example-org/example-repo';
  }

  if (!process.env.GITHUB_TOKEN) {
    console.log('⚠️  Warning: GITHUB_TOKEN not set. API calls will fail.');
    console.log('In GitHub Actions, this is automatically provided.');
  }

  // Check execution limit
  const canExecute = await checkExecutionLimit();

  // Set output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const fs = await import('fs');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `can_execute=${canExecute}\n`);
  }

  // Exit with appropriate code
  if (!canExecute) {
    console.log('::warning::Daily execution limit exceeded for production E2E tests');
    process.exit(0); // Exit without error to not fail the workflow
  }

  console.log('::notice::Production E2E tests can proceed');
}

/**
 * Example: Local development usage
 */
async function localDevelopmentExample() {
  console.log('Local Development Example');
  console.log('='.repeat(40));

  // For local development, you might want to bypass the check
  if (process.env.SKIP_EXECUTION_LIMIT === 'true') {
    console.log('⚠️  Execution limit check skipped (SKIP_EXECUTION_LIMIT=true)');
    return true;
  }

  // Or use a different configuration for local testing
  const localConfig = {
    maxExecutions: 100, // Higher limit for local development
    repository: 'local/testing',
    workflowName: 'local-test.yml',
    useJST: false, // Use UTC for local development
  };

  const canExecute = await checkExecutionLimit(localConfig);
  return canExecute;
}

// Determine which example to run based on environment
if (process.env.CI === 'true') {
  // Running in CI/CD environment
  void githubActionsExample().catch(console.error);
} else if (typeof module !== 'undefined' && require.main === module) {
  // Running as a standalone script
  void main().catch(console.error);
}

// Export for use in other scripts
export { main, githubActionsExample, localDevelopmentExample };
