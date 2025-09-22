# Smoke Test Utilities

This directory contains utilities for managing production E2E smoke test execution limits.

## Files

### `smoke-test-utils.ts`

Core implementation of the execution limit checking functionality. This module provides:

- `checkExecutionLimit()` - Main function to check if execution is allowed
- `getExecutionLimitStatus()` - Get detailed status information
- `formatExecutionLimitStatus()` - Format status for display

### `smoke-test-example.ts`

Example usage demonstrating how to integrate the utilities in different contexts:

- GitHub Actions workflows
- Local development
- Standalone scripts

### `.github/workflows/production-e2e-smoke-test.yml.example`

Example GitHub Actions workflow showing complete integration with:

- Execution limit checking
- Conditional test execution
- Slack notifications

## Usage

### Basic Usage

```typescript
import { checkExecutionLimit } from './smoke-test-utils';

const canExecute = await checkExecutionLimit();
if (!canExecute) {
  console.log('Daily execution limit exceeded');
  process.exit(0);
}
```

### Custom Configuration

```typescript
import { checkExecutionLimit } from './smoke-test-utils';

const canExecute = await checkExecutionLimit({
  maxExecutions: 10, // Allow 10 executions per day
  workflowName: 'my-workflow.yml', // Custom workflow name
  repository: 'org/repo', // Custom repository
  useJST: true, // Use JST timezone
});
```

### GitHub Actions Integration

In your workflow file:

```yaml
- name: Check execution limit
  id: check
  run: |
    npx tsx apps/web/e2e/smoke-test-example.ts
```

## Environment Variables

- `GITHUB_REPOSITORY` - Repository in format "owner/repo" (auto-set in GitHub Actions)
- `GITHUB_TOKEN` or `GH_TOKEN` - GitHub API authentication token

## Features

- **Daily Limits**: Configurable daily execution limits (default: 5)
- **JST Support**: Built-in JST timezone support for Japan-based operations
- **Error Handling**: Robust error handling with fail-safe behavior
- **GitHub API Integration**: Uses `gh` CLI for reliable API access
- **Detailed Logging**: Comprehensive logging for debugging

## Security

- Fails safe by blocking execution on errors
- No sensitive data logged
- Uses GitHub's recommended `gh` CLI for API access

## Implementation Details

The function uses GitHub API to:

1. Query workflow run history for the current day
2. Count successful completed runs
3. Compare against the configured limit
4. Return whether execution is allowed

For Issue #451 requirements.
