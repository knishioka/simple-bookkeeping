# Shell Scripts Documentation

This directory contains shell scripts for various development and deployment tasks. The scripts have been consolidated for better maintainability (Issue #403).

## Consolidated Scripts

### 🛠️ build-tools.sh

Consolidated build management tool that replaces:

- `check-build.sh` (pre-commit checks)
- `check-full-build.sh` (pre-push checks)

**Usage:**

```bash
# Quick check (pre-commit) - checks only changed files
./scripts/build-tools.sh check

# Full check (pre-push) - checks all packages
./scripts/build-tools.sh check-full

# Type checking only
./scripts/build-tools.sh typecheck

# Full validation with tests
./scripts/build-tools.sh validate
```

### 🚀 vercel-tools.sh

Consolidated Vercel management tool that replaces:

- `vercel-api-status.sh`
- `vercel-logs.sh`
- `check-deployments.sh`

**Usage:**

```bash
# Show deployment status
./scripts/vercel-tools.sh status

# View logs (runtime, build, error, etc.)
./scripts/vercel-tools.sh logs runtime
./scripts/vercel-tools.sh logs build --limit 200

# List deployments
./scripts/vercel-tools.sh deployments

# Check API connectivity
./scripts/vercel-tools.sh api-status
```

### 🧪 test-runner.sh

Consolidated test execution tool that replaces:

- `docker-e2e-test.sh`
- `e2e-test.sh`
- `test-e2e-configs.sh`

**Usage:**

```bash
# Run unit tests
./scripts/test-runner.sh unit

# Run E2E tests locally
./scripts/test-runner.sh e2e

# Run E2E tests in Docker
./scripts/test-runner.sh e2e-docker

# Test configurations
./scripts/test-runner.sh config

# Run all test suites
./scripts/test-runner.sh all
```

### 📚 lib/common.sh

Shared utilities library providing:

- Color definitions and output formatting
- Error handling and logging functions
- Process and port management
- Git and package utilities
- Vercel configuration helpers

This file is automatically sourced by the consolidated scripts.

### 📝 lib/config.sh

Configuration helper for Vercel settings. Automatically loaded when needed.

## Legacy Scripts (Kept for Compatibility)

The following scripts are kept for backward compatibility but internally use the consolidated tools:

- `check-build.sh` → Calls `build-tools.sh check`
- `check-full-build.sh` → Calls `build-tools.sh check-full`
- `vercel-api-status.sh` → Calls `vercel-tools.sh api-status`
- `vercel-logs.sh` → Calls `vercel-tools.sh logs`
- `check-deployments.sh` → Calls `vercel-tools.sh deployments`

## Removed Scripts

- `start-dev.sh` - Removed as it referenced the deprecated Express.js API server

## NPM Scripts

The package.json scripts have been updated to use the consolidated tools:

```json
{
  "scripts": {
    // Build checks
    "precommit:check": "./scripts/build-tools.sh check",
    "prepush:check": "./scripts/build-tools.sh check-full",
    "build:check": "./scripts/build-tools.sh check-full",
    "build:validate": "./scripts/build-tools.sh validate",

    // Vercel operations
    "vercel:status": "./scripts/vercel-tools.sh status",
    "vercel:logs": "./scripts/vercel-tools.sh logs",
    "vercel:api": "./scripts/vercel-tools.sh api-status",
    "vercel:deployments": "./scripts/vercel-tools.sh deployments",
    "deploy:check": "./scripts/vercel-tools.sh deployments --prod",

    // Testing
    "test:e2e:docker": "./scripts/test-runner.sh e2e-docker",
    "test:e2e:docker:debug": "./scripts/test-runner.sh e2e-docker --debug",
    "test:e2e:docker:watch": "./scripts/test-runner.sh e2e-docker --headed"
  }
}
```

## Environment Variables

The consolidated scripts respect the following environment variables:

- `DEBUG=1` - Enable debug output
- `NO_COLOR=1` - Disable colored output
- `CI=true` - Running in CI environment (auto-confirms prompts)
- `VERCEL_TOKEN` - Vercel API token for enhanced features
- `BUILD_MODE` - Build mode (quick|full|typecheck|validate)
- `TEST_ENV` - Test environment (local|docker|ci)

## Migration Guide

If you have scripts or CI/CD pipelines using the old scripts, update them as follows:

| Old Command                        | New Command                              |
| ---------------------------------- | ---------------------------------------- |
| `./scripts/check-build.sh`         | `./scripts/build-tools.sh check`         |
| `./scripts/check-full-build.sh`    | `./scripts/build-tools.sh check-full`    |
| `./scripts/vercel-api-status.sh`   | `./scripts/vercel-tools.sh api-status`   |
| `./scripts/vercel-logs.sh runtime` | `./scripts/vercel-tools.sh logs runtime` |
| `./scripts/check-deployments.sh`   | `./scripts/vercel-tools.sh deployments`  |
| `./scripts/docker-e2e-test.sh`     | `./scripts/test-runner.sh e2e-docker`    |
| `./scripts/e2e-test.sh`            | `./scripts/test-runner.sh e2e`           |

## Benefits of Consolidation

1. **Reduced Duplication**: Common utilities are now shared via `lib/common.sh`
2. **Consistent Interface**: All tools follow the same command pattern
3. **Better Error Handling**: Centralized error handling and recovery
4. **Enhanced Features**: New capabilities like progress tracking and better output formatting
5. **Easier Maintenance**: Changes to common functionality only need to be made once
6. **Improved Documentation**: Built-in help for all commands

## Contributing

When adding new scripts:

1. Consider if it can be added as a command to an existing consolidated tool
2. Use the utilities from `lib/common.sh` for consistency
3. Follow the established command pattern: `script.sh <command> [options]`
4. Include comprehensive help documentation
5. Add corresponding npm scripts to package.json
