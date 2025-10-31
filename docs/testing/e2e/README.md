# E2E Testing Documentation

This directory contains all documentation related to End-to-End (E2E) testing for the Simple Bookkeeping system.

## 📁 Documentation Structure

### Core Documentation

- [**guidelines.md**](./guidelines.md) - E2E testing guidelines and best practices
- [**implementation.md**](./implementation.md) - Implementation guide for E2E tests
- [**test-structure.md**](./test-structure.md) - Test file organization and structure

### Implementation Details

- [**implementation-summary.md**](./implementation-summary.md) - Summary of implemented E2E tests
- [**wait-strategies.md**](./wait-strategies.md) - Wait strategies for robust testing
- [**docker-testing.md**](./docker-testing.md) - Docker-based E2E testing setup

### Reports & Results

- [**performance-report.md**](./performance-report.md) - E2E test performance analysis
- [**migration-results.md**](./migration-results.md) - Results of E2E test migration
- [**improvements-201.md**](./improvements-201.md) - Issue #201 improvements documentation

## 🚀 Quick Start

1. **New to E2E testing?** Start with [guidelines.md](./guidelines.md)
2. **Writing tests?** Follow [implementation.md](./implementation.md)
3. **Setting up Docker?** See [docker-testing.md](./docker-testing.md)
4. **Debugging flaky tests?** Check [wait-strategies.md](./wait-strategies.md)

## 🎯 Test Location

Actual E2E test files are located in:

- `/apps/web/e2e/` - Playwright E2E tests

## 🛠️ Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test file
pnpm --filter web test:e2e accounting-periods.spec.ts

# Run with UI mode for debugging
pnpm --filter web test:e2e:ui

# Run in Docker
./scripts/test-runner.sh e2e-docker
```

## 📊 Test Coverage

Our E2E tests cover:

- ✅ Authentication flows
- ✅ Account management (勘定科目)
- ✅ Journal entries (仕訳入力)
- ✅ Accounting periods (会計期間)
- ✅ Reports generation
- ✅ Dialog interactions
- ✅ Responsive design
- ✅ Error handling

## 🔍 Key Technologies

- **Playwright** - E2E testing framework
- **TypeScript** - Type-safe test code
- **Docker** - Containerized test environment
- **GitHub Actions** - CI/CD integration
