# E2E Test Environment Improvements

## Issue #201: Docker E2Eテスト環境の改善

This document describes the improvements made to the E2E test environment to address technical debt identified in Issue #198.

## Overview of Improvements

### 1. Unified Environment Variable Management

**Problem:** Multiple environment variables (BASE_URL, API_URL, TEST_WEB_URL, TEST_API_URL) served the same purpose, causing confusion.

**Solution:** Created a centralized test environment configuration module at `packages/config/src/test-env.ts`.

**Benefits:**

- Single source of truth for test environment configuration
- Automatic Docker environment detection
- Consistent URL handling across all test files
- Built-in validation and debugging utilities

**Usage:**

```typescript
import { getTestConfig, TEST_ENV } from '@simple-bookkeeping/config';

const config = getTestConfig();
console.log(config.urls.web); // Automatically uses correct URL based on environment
```

### 2. Centralized Mock Management System

**Problem:** API mocks were duplicated across multiple test files, leading to maintenance issues and inconsistencies.

**Solution:** Created a centralized mock management system at `apps/web/e2e/mocks/api/index.ts`.

**Features:**

- Pre-defined mock responses for all API endpoints
- Mock data generators with proper TypeScript types
- Scenario-based testing (empty, basic, complex)
- Error simulation utilities

**Usage:**

```typescript
import { applyStandardMocks, createMockScenario } from './mocks/api';

// Apply standard mocks with a specific scenario
const scenario = createMockScenario('basic');
await applyStandardMocks(context, scenario);
```

### 3. Optimized Docker Compose Configuration

**Problem:** Docker Compose configuration had duplicated settings and wasn't optimized for testing.

**Solution:** Created an optimized configuration at `docker-compose.test.optimized.yml`.

**Improvements:**

- Environment variables extracted to `.env.test` file
- Better build caching with cache_from directives
- Optimized PostgreSQL settings for testing
- Resource limits for CI environments
- Improved health checks

**Usage:**

```bash
# Copy and configure environment variables
cp .env.test.example .env.test

# Run tests with optimized configuration
docker-compose -f docker-compose.test.optimized.yml up --build
```

### 4. Enhanced Test Utilities

**Problem:** Poor error messages and lack of performance monitoring made debugging difficult.

**Solution:** Created enhanced test utilities at `apps/web/e2e/helpers/test-utils.ts`.

**Features:**

- Custom error class with detailed debugging information
- Automatic screenshot capture on failures
- Performance monitoring utilities
- Smart wait functions that reduce unnecessary waiting
- Batch operation support for better performance
- Retry logic for flaky operations

**Usage:**

```typescript
import { navigateTo, waitForElement, PerformanceMonitor } from './helpers/test-utils';

const perf = new PerformanceMonitor();
perf.mark('start');

await navigateTo(page, '/dashboard', { retries: 3 });
await waitForElement(page, 'h1', { description: 'Dashboard title' });

perf.measure('navigation', 'start');
perf.logReport();
```

## Performance Improvements

### Before

- 126 tests in ~1.7 minutes
- Frequent timeouts
- Unnecessary wait times

### After

- Reduced wait times through smart waiting
- Better parallelization with optimized worker count
- Improved Docker container performance
- Faster test execution with batch operations

## Migration Guide

### For Existing Tests

1. **Update imports:**

```typescript
// Before
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

// After
import { getTestConfig } from '@simple-bookkeeping/config';
const config = getTestConfig();
const baseUrl = config.urls.web;
```

2. **Use centralized mocks:**

```typescript
// Before - Individual mock definitions in each test
await context.route('**/api/v1/accounts', ...);

// After - Use centralized mocks
await applyStandardMocks(context, {
  accounts: [mockData.account()]
});
```

3. **Use enhanced utilities:**

```typescript
// Before
await page.goto('/dashboard');
await page.waitForSelector('h1');

// After
await navigateTo(page, '/dashboard');
await waitForElement(page, 'h1', { description: 'Dashboard title' });
```

### For Docker Testing

1. **Setup environment:**

```bash
cp .env.test.example .env.test
# Edit .env.test as needed
```

2. **Run tests:**

```bash
# Use optimized configuration
docker-compose -f docker-compose.test.optimized.yml up --build

# Or use the helper script
./scripts/docker-e2e-test.sh --optimized
```

## Configuration Reference

### Environment Variables

The test environment supports the following variables:

| Variable       | Description                  | Default                 |
| -------------- | ---------------------------- | ----------------------- |
| `BASE_URL`     | Web application URL (Docker) | `http://localhost:3000` |
| `API_URL`      | API server URL (Docker)      | `http://localhost:3001` |
| `TEST_WEB_URL` | Legacy web URL               | Same as BASE_URL        |
| `TEST_API_URL` | Legacy API URL               | Same as API_URL         |
| `DOCKER_ENV`   | Docker environment flag      | `false`                 |
| `CI`           | CI environment flag          | `false`                 |
| `TEST_RETRIES` | Number of test retries       | `2` in CI, `0` locally  |
| `TEST_WORKERS` | Number of parallel workers   | `4` in CI, `2` locally  |
| `TEST_TIMEOUT` | Test timeout in milliseconds | `60000`                 |
| `DEBUG`        | Enable debug output          | `false`                 |
| `VERBOSE`      | Enable verbose logging       | `false`                 |

### Test Configuration API

```typescript
// Get complete test configuration
const config = getTestConfig();

// Access specific settings
config.urls.web; // Web application URL
config.urls.api; // API base URL
config.urls.apiV1; // API v1 URL
config.execution.timeout; // Test timeout
config.execution.retries; // Retry count
config.environment.isDocker; // Docker detection

// Validate configuration
const validation = validateTestEnvironment();
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}

// Debug configuration
logTestEnvironment(); // Prints formatted configuration
```

## Best Practices

1. **Always use the unified configuration:**
   - Import from `@simple-bookkeeping/config`
   - Don't hardcode URLs or ports

2. **Leverage centralized mocks:**
   - Use pre-defined mock responses
   - Create scenarios for different test cases
   - Keep mock data consistent with types

3. **Use enhanced utilities:**
   - Better error messages for debugging
   - Automatic retries for flaky operations
   - Performance monitoring for optimization

4. **Docker testing:**
   - Use the optimized configuration
   - Set resource limits for CI
   - Use tmpfs for database in tests

5. **Error handling:**
   - Use custom error classes
   - Capture screenshots on failures
   - Include context in error messages

## Troubleshooting

### Common Issues

1. **"about:blank" errors:**
   - Ensure page is loaded before setting auth data
   - Use `navigateTo()` instead of `page.goto()`

2. **Mock not applied:**
   - Apply mocks before navigation
   - Check URL patterns match exactly

3. **Timeout errors:**
   - Increase timeout for slow operations
   - Use retry logic for network operations
   - Check health endpoints are responding

4. **Docker connection issues:**
   - Verify service names in docker-compose
   - Check health checks are passing
   - Ensure proper network configuration

## Future Improvements

- [ ] Implement visual regression testing
- [ ] Add test result caching
- [ ] Create test data factories
- [ ] Implement parallel test execution optimization
- [ ] Add test coverage reporting
- [ ] Create automated performance benchmarks

## Related Documentation

- [Docker E2E Testing Guide](./docker-e2e-testing.md)
- [E2E Test Implementation](./e2e-test-implementation.md)
- [User Story Testing Guide](./user-story-testing-guide.md)
