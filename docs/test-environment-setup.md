# Test Environment Setup Guide

This guide describes how to set up and troubleshoot the test environment for Simple Bookkeeping.

## Overview

The project uses different testing frameworks:

- **Jest** - Unit and integration tests for both API and Web apps
- **Playwright** - End-to-end (E2E) tests for the Web app

## Database Configuration

### Local Development

The test environment supports multiple database configurations:

1. **Default Configuration (CI)**
   - User: `postgres`
   - Password: `postgres`
   - Database: `simple_bookkeeping_test`
   - Connection: `postgresql://postgres:postgres@localhost:5432/simple_bookkeeping_test`

2. **Custom User Configuration (Local)**
   - User: `bookkeeping`
   - Password: `bookkeeping`
   - Database: `simple_bookkeeping_test`
   - Connection: `postgresql://bookkeeping:bookkeeping@localhost:5432/simple_bookkeeping_test`

### Setting Up Test Database

```bash
# Using default postgres user
createdb -U postgres simple_bookkeeping_test

# Using custom user
createuser -U postgres bookkeeping
createdb -U postgres -O bookkeeping simple_bookkeeping_test

# Grant permissions
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE simple_bookkeeping_test TO bookkeeping;"
```

### Environment Variables

Set the `TEST_DATABASE_URL` environment variable to use a custom database configuration:

```bash
# In .env.test or .env.local
TEST_DATABASE_URL=postgresql://bookkeeping:bookkeeping@localhost:5432/simple_bookkeeping_test
```

## Port Configuration

The application uses configurable ports to avoid conflicts:

- **Web Server**: Default 3000 (configurable via `WEB_PORT`)
- **API Server**: Default 3001 (configurable via `API_PORT`)

### Checking Port Availability

```bash
# Check if ports are available
pnpm dev:check-ports

# Use custom ports
export WEB_PORT=3002
export API_PORT=3003
pnpm dev
```

### Handling Port Conflicts

If you encounter port conflicts:

1. **Find what's using the port:**

   ```bash
   lsof -i :3000  # Check web port
   lsof -i :3001  # Check API port
   ```

2. **Stop the process:**

   ```bash
   kill $(lsof -t -i:3000)  # Stop process on port 3000
   kill $(lsof -t -i:3001)  # Stop process on port 3001
   ```

3. **Use alternative ports:**
   ```bash
   export WEB_PORT=3002
   export API_PORT=3003
   ```

## Common Issues and Solutions

### 1. Database Connection Errors

**Error:** `PrismaClientInitializationError: User was denied access on the database`

**Solutions:**

1. Check if the database user exists:

   ```bash
   psql -U postgres -c "\du"
   ```

2. Create the test user if missing:

   ```bash
   createuser -U postgres bookkeeping
   psql -U postgres -c "ALTER USER bookkeeping WITH PASSWORD 'bookkeeping';"
   ```

3. Grant database permissions:

   ```bash
   psql -U postgres -c "GRANT ALL ON DATABASE simple_bookkeeping_test TO bookkeeping;"
   ```

4. Use environment variable override:
   ```bash
   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/simple_bookkeeping_test pnpm test
   ```

### 2. JSDOM Navigation Warnings

**Warning:** `Not implemented: navigation (except hash changes)`

This warning occurs in Jest tests when code attempts to navigate (e.g., `window.location.href = '...'`).

**Solution:** The warning is now automatically suppressed in `jest.setup.js`. No action required.

### 3. Port Already in Use

**Error:** `Port 3001 is already in use`

**Solutions:**

1. Check what's using the port:

   ```bash
   pnpm dev:check-ports
   ```

2. Stop the conflicting process or use different ports:
   ```bash
   export WEB_PORT=4000
   export API_PORT=4001
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
pnpm --filter @simple-bookkeeping/api test
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

- [ ] Database server is running
- [ ] Test database exists
- [ ] Database user has proper permissions
- [ ] Ports are available (3000, 3001)
- [ ] Environment variables are set correctly
- [ ] Dependencies are installed (`pnpm install`)
- [ ] Prisma client is generated (`pnpm --filter @simple-bookkeeping/database prisma:generate`)
- [ ] Config package is built (`pnpm --filter @simple-bookkeeping/config build`)

## Related Documentation

- [E2E Test Implementation](./e2e-test-implementation.md)
- [User Story Testing Guide](./user-story-testing-guide.md)
- [CI/CD Configuration](./.github/workflows/)
