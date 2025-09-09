# E2E Test Infrastructure Migration for Server Actions

## Overview

This document describes the migration of E2E tests from REST API mocking to Server Actions support. This migration is part of Issue #353, which addresses the need to update the E2E test infrastructure to work with Next.js Server Actions instead of the deprecated Express.js API.

## Problem Statement

The existing E2E tests were built to mock REST API endpoints (`/api/v1/*`), but the application has migrated to Server Actions. Server Actions are internal Next.js mechanisms that cannot be intercepted like traditional REST APIs, requiring a complete overhaul of the test infrastructure.

## Solution Architecture

### New Test Infrastructure Components

#### 1. Server Actions Mock Helper (`server-actions-mock.ts`)

A comprehensive mocking framework specifically designed for Server Actions:

- **Module-level mocking**: Injects mock implementations at the browser context level
- **Test data builders**: Factory functions for creating consistent test data
- **Mock implementations**: Pre-built mock responses for common Server Actions

```typescript
// Example usage
import { ServerActionsMock, TestDataBuilder } from './helpers/server-actions-mock';

// Register a mock for a Server Action
ServerActionsMock.registerMock({
  modulePath: '@/app/actions/accounting-periods-wrapper',
  actionName: 'getAccountingPeriodsWithAuth',
  mockImplementation: async () => ({
    success: true,
    data: {
      items: [TestDataBuilder.createAccountingPeriod()],
      total: 1,
      page: 1,
      limit: 10,
    },
  }),
});
```

#### 2. Supabase Authentication Helper (`supabase-auth.ts`)

Replacement for JWT-based authentication with Supabase support:

- **Cookie-based authentication**: Sets up Supabase auth cookies for test sessions
- **Role-based testing**: Support for admin, accountant, and viewer roles
- **LocalStorage integration**: Manages auth state in browser storage

```typescript
// Example usage
import { SupabaseAuth } from './helpers/supabase-auth';

// Set up authentication for a test
await SupabaseAuth.setup(context, page, { role: 'admin' });
```

#### 3. Unified Mock Manager (`server-actions-unified-mock.ts`)

Backward-compatible layer that maintains the existing test interface while using Server Actions:

- **Legacy interface support**: Maintains compatibility with existing test code
- **Automatic mock injection**: Injects Server Actions mocks into the page context
- **fetch override**: Intercepts Server Action calls at the network level

```typescript
// Example usage
import { UnifiedMock } from './helpers/server-actions-unified-mock';

// Set up all mocks (backward compatible)
await UnifiedMock.setupAll(context, {
  enabled: true,
  customResponses: {
    'accounting-periods': [
      /* mock data */
    ],
  },
});
```

## Migration Strategy

### Step 1: Update Test Imports

Replace old imports with new ones:

```typescript
// Before
import { UnifiedAuth } from './helpers/unified-auth';
import { UnifiedMock } from './helpers/unified-mock';

// After
import { SupabaseAuth } from './helpers/supabase-auth';
import { UnifiedMock } from './helpers/server-actions-unified-mock';
```

### Step 2: Update Authentication Setup

Replace JWT authentication with Supabase:

```typescript
// Before
await UnifiedAuth.setupMockRoutes(context);
await UnifiedAuth.setAuthData(page);

// After
await SupabaseAuth.setup(context, page, { role: 'admin' });
```

### Step 3: Update API Mocking

Replace REST API route mocking with Server Actions mocking:

```typescript
// Before
await context.route('**/api/v1/accounting-periods', async (route) => {
  await route.fulfill({
    status: 200,
    body: JSON.stringify({ data: periods }),
  });
});

// After
UnifiedMock.customizeResponse('accounting-periods', periods);
```

### Step 4: Update Playwright Configuration

Remove Express.js API server from webServer configuration:

```typescript
// playwright.config.ts
webServer: {
  command: 'pnpm --filter @simple-bookkeeping/web dev',
  port: PORTS.WEB,
  // Remove API server configuration
}
```

## Test Categories and Migration Status

### Completed Migrations

1. **accounting-periods.spec.ts** ✅
   - Updated to use SupabaseAuth
   - Replaced API route mocking with UnifiedMock
   - All tests updated to work with Server Actions

2. **audit-logs.spec.ts** ✅
   - Updated authentication mechanism
   - Implemented Server Actions mocking for audit logs
   - Maintained backward compatibility

3. **basic.spec.ts** ✅
   - Updated import to use new UnifiedMock
   - No authentication required (public pages)

### Pending Migrations

- extended-coverage.spec.ts
- responsive-navigation.spec.ts
- Other test files using REST API mocking

## Key Implementation Details

### Mock Injection Mechanism

The Server Actions mock system works by:

1. **Page initialization**: Injects mock handlers during page load
2. **fetch interception**: Overrides the browser's fetch function
3. **Pattern matching**: Identifies Server Action calls by URL patterns
4. **Response synthesis**: Returns mock data in Server Action format

```javascript
// Injected into the browser context
window.fetch = async function (...args) {
  const [url, options] = args;

  // Detect Server Action calls
  if (url.includes('_action')) {
    // Return mocked response
    return new Response(JSON.stringify(mockData), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Pass through non-mocked calls
  return originalFetch(...args);
};
```

### Test Data Consistency

The TestDataBuilder class ensures consistent test data across all tests:

```typescript
TestDataBuilder.createAccountingPeriod({
  id: 'custom-id',
  name: 'Custom Period',
  // Other overrides...
});
```

### Authentication State Management

Supabase authentication is managed through:

1. **Cookies**: HTTP-only cookies for server-side auth
2. **LocalStorage**: Client-side session management
3. **Global variables**: Test-specific user data injection

## Best Practices

### 1. Use Helper Functions

Always use the provided helper functions for consistency:

```typescript
// Good
await SupabaseAuth.setupAsAdmin(context, page);

// Avoid
await page.evaluate(() => {
  localStorage.setItem('auth', '...');
});
```

### 2. Mock at the Appropriate Level

- **Unit tests**: Mock individual Server Actions
- **Integration tests**: Mock external dependencies only
- **E2E tests**: Mock authentication and external services

### 3. Clean Up After Tests

Always clean up mock state:

```typescript
test.afterEach(async () => {
  UnifiedMock.reset();
  await SupabaseAuth.clear(context, page);
});
```

### 4. Use Realistic Test Data

Use TestDataBuilder to create realistic test data:

```typescript
const period = TestDataBuilder.createAccountingPeriod({
  is_active: true,
  start_date: '2024-01-01',
  end_date: '2024-12-31',
});
```

## Troubleshooting

### Common Issues and Solutions

1. **Tests timing out**
   - Ensure the Next.js server is running
   - Check that Supabase environment variables are set
   - Verify mock data is properly formatted

2. **Authentication failures**
   - Clear browser cookies and storage between tests
   - Ensure correct role is set for the test
   - Verify Supabase mock is properly initialized

3. **Mock data not appearing**
   - Check that UnifiedMock.setupAll() is called before navigation
   - Verify the mock response format matches Server Action expectations
   - Ensure customizeResponse() is called with correct key

4. **Server Actions not being intercepted**
   - Verify the fetch override is properly injected
   - Check that the URL pattern matching is correct
   - Ensure mocks are registered before page navigation

## Future Improvements

1. **Mock Recording**: Implement ability to record real Server Action responses for replay
2. **Type Safety**: Add TypeScript generics for mock data validation
3. **Performance**: Optimize mock injection for faster test execution
4. **Coverage**: Add mock coverage reporting to ensure all Server Actions are tested
5. **Debug Mode**: Add detailed logging for mock matching and execution

## Migration Checklist

- [ ] Update all test file imports
- [ ] Replace UnifiedAuth with SupabaseAuth
- [ ] Replace API route mocking with UnifiedMock
- [ ] Update playwright.config.ts to remove API server
- [ ] Run all tests to verify migration
- [ ] Update CI/CD configuration if needed
- [ ] Document any test-specific workarounds
- [ ] Remove deprecated test helpers

## Conclusion

This migration provides a robust testing infrastructure for Server Actions while maintaining backward compatibility where possible. The new system is more aligned with Next.js best practices and provides better type safety and maintainability.
