# Code Quality Guide

## Overview

This guide outlines the code quality standards and best practices implemented in the Simple Bookkeeping project. Following these guidelines ensures consistent, maintainable, and high-quality code.

## Table of Contents

1. [Type Safety](#type-safety)
2. [Error Handling](#error-handling)
3. [Validation](#validation)
4. [Logging](#logging)
5. [Testing](#testing)
6. [Performance](#performance)
7. [Security](#security)
8. [Code Organization](#code-organization)

## Type Safety

### 1. No 'any' Types Policy

**✅ Good:**

```typescript
interface ApiResponse<T> {
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

async function fetchUser(id: string): Promise<ApiResponse<User>> {
  // Implementation
}
```

**❌ Bad:**

```typescript
async function fetchUser(id: any): Promise<any> {
  // Loses all type safety
}
```

### 2. Strict Type Definitions

All shared types are defined in `@simple-bookkeeping/types`:

```typescript
// packages/types/src/account.ts
export interface Account {
  id: string;
  code: string;
  name: string;
  accountType: AccountType;
  parentId: string | null;
  balance: number;
  isActive: boolean;
}

export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
}
```

### 3. Generic Types for Reusability

```typescript
// Pagination type
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// Usage
type AccountsResponse = PaginatedResponse<Account>;
```

## Error Handling

### 1. Custom Error Classes

Location: `/packages/shared/src/errors/`

```typescript
export class ValidationError extends BaseError {
  constructor(field: string, message: string) {
    super(`Validation failed for ${field}: ${message}`);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class NotFoundError extends BaseError {
  constructor(resource: string, id?: string) {
    super(`${resource}${id ? ` with id ${id}` : ''} not found`);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}
```

### 2. Error Handling Pattern

```typescript
import { Logger } from '@simple-bookkeeping/shared';

const logger = new Logger({ service: 'AccountService' });

export async function getAccount(id: string): Promise<Account> {
  try {
    const account = await prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundError('Account', id);
    }

    return account;
  } catch (error) {
    if (error instanceof NotFoundError) {
      // Re-throw expected errors
      throw error;
    }

    // Log unexpected errors
    logger.error('Failed to fetch account', error, { accountId: id });
    throw new InternalError('Failed to fetch account');
  }
}
```

### 3. Express Error Middleware

```typescript
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const logger = Logger.fromRequest(req);

  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        field: err.field,
      },
    });
  }

  if (err instanceof NotFoundError) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: err.message,
      },
    });
  }

  // Log unexpected errors
  logger.error('Unhandled error', err);

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
};
```

## Validation

### 1. Zod Schema Validation

Location: `/packages/shared/src/schemas/validation/`

```typescript
import { z } from 'zod';

// Define validation schema
export const createAccountSchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .max(20, 'Code must be 20 characters or less')
    .regex(/^\d+$/, 'Code must contain only numbers'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().max(500).optional(),
});

// Generate TypeScript type
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
```

### 2. Validation Middleware

```typescript
import { validate } from '@simple-bookkeeping/shared';

router.post(
  '/accounts',
  authenticate,
  validate(createAccountSchema),
  async (req: Request, res: Response) => {
    // req.body is now typed and validated
    const account = await accountService.create(req.body);
    res.json({ data: account });
  }
);
```

### 3. Business Logic Validation

```typescript
// Custom validation for business rules
const journalEntrySchema = z.object({
  lines: z
    .array(journalEntryLineSchema)
    .min(2, 'At least 2 lines required')
    .refine(
      (lines) => {
        const totalDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
        const totalCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);
        return Math.abs(totalDebit - totalCredit) < 0.01;
      },
      { message: 'Total debits must equal total credits' }
    ),
});
```

## Logging

### 1. Structured Logging

```typescript
import { Logger } from '@simple-bookkeeping/shared';

const logger = new Logger({
  service: 'JournalEntryService',
  module: 'import',
});

// Contextual logging
logger.info('Starting CSV import', {
  fileName: file.name,
  fileSize: file.size,
  userId: req.user.id,
});

// Error logging with context
logger.error('CSV import failed', error, {
  fileName: file.name,
  row: currentRow,
  reason: error.message,
});
```

### 2. Request Context Logging

```typescript
// Middleware adds request context
app.use((req, res, next) => {
  req.logger = Logger.fromRequest(req);
  next();
});

// Use in routes
router.get('/accounts/:id', async (req, res) => {
  req.logger.info('Fetching account', { accountId: req.params.id });
  // ...
});
```

### 3. Log Levels

```typescript
// Log levels in order of severity
logger.error('Critical error', error); // System errors
logger.warn('Warning condition', meta); // Warnings
logger.info('Information', meta); // General info
logger.http('HTTP request', meta); // HTTP logs
logger.debug('Debug information', meta); // Debug info
```

## Testing

### 1. Unit Testing Pattern

```typescript
describe('AccountService', () => {
  let service: AccountService;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = new PrismaClient();
    service = new AccountService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an account with valid data', async () => {
      const input: CreateAccountInput = {
        code: '1110',
        name: '現金',
        accountType: 'ASSET',
      };

      const mockAccount = { id: '123', ...input };
      jest.spyOn(prisma.account, 'create').mockResolvedValue(mockAccount);

      const result = await service.create(input);

      expect(result).toEqual(mockAccount);
      expect(prisma.account.create).toHaveBeenCalledWith({
        data: input,
      });
    });

    it('should throw ValidationError for duplicate code', async () => {
      jest.spyOn(prisma.account, 'create').mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: '5.0.0',
        })
      );

      await expect(service.create(input)).rejects.toThrow(ValidationError);
    });
  });
});
```

### 2. Integration Testing

```typescript
describe('POST /api/v1/accounts', () => {
  it('should create an account', async () => {
    const response = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: '1110',
        name: '現金',
        accountType: 'ASSET',
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      code: '1110',
      name: '現金',
      accountType: 'ASSET',
    });
  });

  it('should return 400 for invalid data', async () => {
    const response = await request(app)
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        code: 'invalid',
        name: '',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

### 3. E2E Testing

```typescript
test('user can create and approve journal entry', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Navigate to journal entries
  await page.goto('/dashboard/journal-entries');
  await page.click('button:has-text("新規作成")');

  // Fill form
  await page.fill('[name="description"]', '売上計上');
  await page.fill('[name="lines.0.debitAmount"]', '110000');
  await page.selectOption('[name="lines.0.accountId"]', 'cash-account-id');

  // Submit and verify
  await page.click('button:has-text("保存")');
  await expect(page.locator('.toast-success')).toHaveText('仕訳を作成しました');
});
```

## Performance

### 1. Database Query Optimization

```typescript
// ❌ Bad: N+1 query problem
const entries = await prisma.journalEntry.findMany();
for (const entry of entries) {
  const lines = await prisma.journalEntryLine.findMany({
    where: { journalEntryId: entry.id },
  });
}

// ✅ Good: Eager loading
const entries = await prisma.journalEntry.findMany({
  include: {
    lines: {
      include: {
        account: true,
      },
    },
  },
});
```

### 2. Caching Strategy

```typescript
import { Cacheable, CacheKey } from '@simple-bookkeeping/shared';

class AccountService {
  @Cacheable({ ttl: 300 })
  async getAccountsWithBalance(
    @CacheKey organizationId: string,
    date: Date
  ): Promise<AccountWithBalance[]> {
    // Expensive calculation cached for 5 minutes
    return this.calculateBalances(organizationId, date);
  }

  async updateAccount(id: string, data: UpdateAccountInput) {
    const account = await prisma.account.update({
      where: { id },
      data,
    });

    // Invalidate cache
    await cache.invalidate(`accounts:${account.organizationId}:*`);

    return account;
  }
}
```

### 3. Pagination

```typescript
interface PaginationParams {
  page: number;
  pageSize: number;
}

async function paginate<T>(
  query: Prisma.PrismaPromise<T[]>,
  countQuery: Prisma.PrismaPromise<number>,
  params: PaginationParams
): Promise<PaginatedResponse<T>> {
  const { page, pageSize } = params;
  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([query.skip(skip).take(pageSize), countQuery]);

  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
```

## Security

### 1. Input Sanitization

```typescript
import DOMPurify from 'isomorphic-dompurify';

// Sanitize user input
const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
};

// Apply to user inputs
const description = sanitizeInput(req.body.description);
```

### 2. SQL Injection Prevention

```typescript
// ❌ Bad: Direct SQL concatenation
const query = `SELECT * FROM accounts WHERE name = '${userInput}'`;

// ✅ Good: Use Prisma (parameterized queries)
const accounts = await prisma.account.findMany({
  where: {
    name: userInput,
  },
});

// ✅ Good: Raw queries with parameters
const accounts = await prisma.$queryRaw`
  SELECT * FROM accounts 
  WHERE name = ${userInput}
`;
```

### 3. Authentication & Authorization

```typescript
// Middleware for authentication
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'No token provided',
      },
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Invalid token',
      },
    });
  }
};

// Role-based authorization
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: 'Insufficient permissions',
        },
      });
    }
    next();
  };
};
```

## Code Organization

### 1. Module Structure

```
packages/
├── shared/           # Shared utilities
│   ├── src/
│   │   ├── cache/    # Caching utilities
│   │   ├── constants/# Centralized constants
│   │   ├── errors/   # Error classes
│   │   ├── logger/   # Logging utilities
│   │   ├── schemas/  # Validation schemas
│   │   └── monitoring/ # Metrics and monitoring
│   └── package.json
├── types/           # TypeScript type definitions
│   ├── src/
│   │   ├── account.ts
│   │   ├── journal.ts
│   │   └── index.ts
│   └── package.json
└── database/        # Prisma schema and migrations
    ├── prisma/
    │   ├── schema.prisma
    │   └── migrations/
    └── package.json
```

### 2. Naming Conventions

```typescript
// Interfaces: PascalCase with descriptive names
interface CreateAccountInput {}
interface AccountWithBalance {}

// Enums: PascalCase for name, UPPER_CASE for values
enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
}

// Functions: camelCase, verb-first
async function createAccount() {}
function validateBalance() {}

// Constants: UPPER_CASE with underscores
const MAX_PAGE_SIZE = 100;
const DEFAULT_TIMEOUT = 5000;

// File names: kebab-case
// account-service.ts
// journal-entry.controller.ts
```

### 3. Import Organization

```typescript
// 1. External imports
import express from 'express';
import { z } from 'zod';

// 2. Internal package imports
import { Logger, ValidationError } from '@simple-bookkeeping/shared';
import { Account, AccountType } from '@simple-bookkeeping/types';

// 3. Relative imports
import { AccountService } from '../services/account.service';
import { authenticate } from '../middleware/auth';

// 4. Type imports
import type { Request, Response, NextFunction } from 'express';
```

### 4. Export Patterns

```typescript
// Named exports for utilities
export { Logger } from './logger';
export { cache, Cacheable } from './cache';

// Default export for main class/function
export default class AccountService {}

// Re-exports in index files
export * from './errors';
export * from './constants';
export * from './schemas';
```

## Best Practices Summary

1. **Always use TypeScript strict mode**
2. **No any types - define proper interfaces**
3. **Handle errors explicitly with custom error classes**
4. **Validate all user input with Zod schemas**
5. **Log with context using structured logging**
6. **Write tests for all business logic**
7. **Optimize database queries to avoid N+1**
8. **Implement caching for expensive operations**
9. **Sanitize user input to prevent XSS**
10. **Use proper authentication and authorization**
