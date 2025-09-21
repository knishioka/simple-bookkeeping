# Test Environment Setup Guide

This guide describes how to set up and troubleshoot the test environment for Simple Bookkeeping.

## Overview

The project uses different testing frameworks:

- **Jest** - Unit and integration tests for the Web app and packages
- **Playwright** - End-to-end (E2E) tests for the Web app
- **Supabase Local** - Local Supabase instance for testing

## Database Configuration

### Local Development

The test environment uses Supabase for database and authentication:

1. **Supabase Local Configuration**
   - User: `postgres`
   - Password: `postgres`
   - Database: `postgres`
   - Connection: `postgresql://postgres:postgres@localhost:54323/postgres`
   - Studio URL: `http://localhost:54321`

2. **CI Configuration**
   - User: `postgres`
   - Password: `postgres`
   - Database: `simple_bookkeeping_test`
   - Connection: `postgresql://postgres:postgres@localhost:5432/simple_bookkeeping_test`

### Setting Up Test Database

```bash
# Start Supabase locally
pnpm supabase:start

# Reset database for clean state
pnpm supabase:reset

# Check status
pnpm supabase:status
```

### Environment Variables

Set the environment variables for Supabase:

```bash
# In .env.test or .env.local
DATABASE_URL=postgresql://postgres:postgres@localhost:54323/postgres
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Port Configuration

The application uses configurable ports to avoid conflicts:

- **Web Server**: Default 3000 (configurable via `PORT`)
- **Supabase Studio**: 54321
- **Supabase API**: 54322
- **PostgreSQL**: 54323

### Checking Port Availability

```bash
# Check if ports are available
lsof -i :3000  # Next.js
lsof -i :54321 # Supabase Studio
lsof -i :54323 # PostgreSQL

# Use custom port for Next.js
export PORT=3002
pnpm dev
```

### Handling Port Conflicts

If you encounter port conflicts:

1. **Find what's using the port:**

   ```bash
   lsof -i :3000  # Check web port
   lsof -i :54321 # Check Supabase Studio
   ```

2. **Stop the process:**

   ```bash
   kill $(lsof -t -i:3000)  # Stop process on port 3000
   pnpm supabase:stop       # Stop Supabase services
   ```

3. **Use alternative ports:**
   ```bash
   export PORT=3002
   ```

## Common Issues and Solutions

### 1. Database Connection Errors

**Error:** `PrismaClientInitializationError: User was denied access on the database`

**Solutions:**

1. Check if the database user exists:

   ```bash
   psql -U postgres -c "\du"
   ```

2. Start Supabase if not running:

   ```bash
   pnpm supabase:start
   ```

3. Reset database if needed:

   ```bash
   pnpm supabase:reset
   ```

4. Use environment variable override:
   ```bash
   DATABASE_URL=postgresql://postgres:postgres@localhost:54323/postgres pnpm test
   ```

### 2. JSDOM Navigation Warnings

**Warning:** `Not implemented: navigation (except hash changes)`

This warning occurs in Jest tests when code attempts to navigate (e.g., `window.location.href = '...'`).

**Solution:** The warning is now automatically suppressed in `jest.setup.js`. No action required.

### 3. Port Already in Use

**Error:** `Port 3000 is already in use`

**Solutions:**

1. Check what's using the port:

   ```bash
   lsof -i :3000
   ```

2. Stop the conflicting process or use different port:
   ```bash
   export PORT=4000
   pnpm dev
   ```

### 4. CI Environment Issues

The CI environment uses GitHub Actions with PostgreSQL service. The configuration is automatic, but if you need to debug:

1. **Check CI logs** for database connection details
2. **Verify environment variables** are set correctly in workflow files
3. **Use retry logic** for health checks (already implemented)

## Running Tests

### Unit Tests

```bash
# Run all unit tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run in watch mode
pnpm test:watch

# Run specific package tests
pnpm --filter @simple-bookkeeping/database test
pnpm --filter @simple-bookkeeping/web test
```

### E2E Tests

```bash
# Run E2E tests locally
pnpm test:e2e

# Run with headed browser
pnpm --filter @simple-bookkeeping/web test:e2e:headed

# Run specific test file
pnpm --filter @simple-bookkeeping/web test:e2e auth-test.spec.ts
```

### Debugging Tests

1. **Enable debug output:**

   ```bash
   DEBUG=true pnpm test
   ```

2. **Run tests with verbose output:**

   ```bash
   pnpm test -- --verbose
   ```

3. **Debug E2E tests:**
   ```bash
   pnpm --filter @simple-bookkeeping/web test:e2e:debug
   ```

## Best Practices

1. **Always use test database** - Never run tests against production or development databases
2. **Clean state between tests** - Tests should not depend on each other
3. **Use environment variables** - Configure test environment via `.env.test`
4. **Check ports before running** - Use `pnpm dev:check-ports` to avoid conflicts
5. **Monitor CI logs** - Check GitHub Actions logs for CI-specific issues

## Troubleshooting Checklist

- [ ] Supabase is running (`pnpm supabase:status`)
- [ ] Test database exists
- [ ] Ports are available (3000, 54321, 54323)
- [ ] Environment variables are set correctly
- [ ] Dependencies are installed (`pnpm install`)
- [ ] Prisma client is generated (`pnpm db:generate`)
- [ ] Database migrations are applied (`pnpm db:migrate`)

## Related Documentation

- [E2E Test Implementation](./e2e-test-implementation.md)
- [User Story Testing Guide](./user-story-testing-guide.md)
- [CI/CD Configuration](./.github/workflows/)
