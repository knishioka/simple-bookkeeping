/**
 * Centralized API Mock Management
 * Issue #201: E2Eテストのモック管理システム
 *
 * This module provides centralized mock definitions for E2E tests,
 * reducing duplication and ensuring consistency across test files.
 */

import { BrowserContext } from '@playwright/test';

import type {
  User,
  Account,
  JournalEntry,
  Organization,
  AccountingPeriod,
  AuditLog,
} from '@simple-bookkeeping/types';

/**
 * Standard mock response templates
 */
export const mockResponses = {
  // Authentication mocks
  auth: {
    login: {
      success: (token: string, user: User) => ({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            token,
            refreshToken: `${token}-refresh`,
            user,
          },
        }),
      }),
      failure: {
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        }),
      },
    },
    me: {
      success: (user: User) => ({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: user }),
      }),
      unauthorized: {
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        }),
      },
    },
    verify: {
      valid: (user: User) => ({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            valid: true,
            user,
          },
        }),
      }),
      invalid: {
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token is invalid or expired',
          },
        }),
      },
    },
    refresh: {
      success: (newToken: string) => ({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            token: newToken,
            refreshToken: `${newToken}-refresh`,
          },
        }),
      }),
      failure: {
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'REFRESH_TOKEN_EXPIRED',
            message: 'Refresh token has expired',
          },
        }),
      },
    },
    logout: {
      success: {
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { success: true },
        }),
      },
    },
  },

  // Account mocks
  accounts: {
    list: {
      success: (accounts: Account[]) => ({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: accounts,
          meta: {
            total: accounts.length,
            page: 1,
            perPage: 100,
          },
        }),
      }),
      empty: {
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          meta: { total: 0, page: 1, perPage: 100 },
        }),
      },
    },
    create: {
      success: (account: Account) => ({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: account }),
      }),
      validation: {
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: {
              code: 'Account code already exists',
            },
          },
        }),
      },
    },
    update: {
      success: (account: Account) => ({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: account }),
      }),
      notFound: {
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'NOT_FOUND',
            message: 'Account not found',
          },
        }),
      },
    },
    delete: {
      success: {
        status: 204,
      },
      conflict: {
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'CONFLICT',
            message: 'Cannot delete account with existing transactions',
          },
        }),
      },
    },
  },

  // Journal entry mocks
  journalEntries: {
    list: {
      success: (entries: JournalEntry[]) => ({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: entries,
          meta: {
            total: entries.length,
            page: 1,
            perPage: 50,
          },
        }),
      }),
      empty: {
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          meta: { total: 0, page: 1, perPage: 50 },
        }),
      },
    },
    create: {
      success: (entry: JournalEntry) => ({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: entry }),
      }),
      unbalanced: {
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'UNBALANCED_ENTRY',
            message: 'Debit and credit amounts must be equal',
          },
        }),
      },
    },
  },

  // Organization mocks
  organizations: {
    list: {
      success: (orgs: Organization[]) => ({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: orgs }),
      }),
    },
    current: {
      success: (org: Organization) => ({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: org }),
      }),
    },
  },

  // Report mocks
  reports: {
    balanceSheet: {
      success: (data: unknown) => ({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data }),
      }),
    },
    incomeStatement: {
      success: (data: unknown) => ({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data }),
      }),
    },
    trialBalance: {
      success: (data: unknown) => ({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data }),
      }),
    },
  },

  // Audit log mocks
  auditLogs: {
    list: {
      success: (logs: AuditLog[]) => ({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: logs,
          meta: {
            total: logs.length,
            page: 1,
            perPage: 50,
          },
        }),
      }),
    },
  },

  // Accounting period mocks
  accountingPeriods: {
    list: {
      success: (periods: AccountingPeriod[]) => ({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: periods }),
      }),
    },
    current: {
      success: (period: AccountingPeriod) => ({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: period }),
      }),
      notFound: {
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'NO_ACTIVE_PERIOD',
            message: 'No active accounting period found',
          },
        }),
      },
    },
  },
};

/**
 * Mock data generators
 */
export const mockData = {
  user: (overrides: Partial<User> = {}): User =>
    ({
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      organizationId: 'org-1',
      role: 'ADMIN',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    }) as User,

  account: (overrides: Partial<Account> = {}): Account =>
    ({
      id: 'acc-1',
      code: '1000',
      name: 'Cash',
      accountType: 'ASSET',
      category: 'CURRENT_ASSET',
      isActive: true,
      organizationId: 'org-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    }) as Account,

  journalEntry: (overrides: Partial<JournalEntry> = {}): JournalEntry =>
    ({
      id: 'je-1',
      entryNumber: 'JE-001',
      entryDate: new Date().toISOString(),
      description: 'Test entry',
      status: 'APPROVED',
      organizationId: 'org-1',
      accountingPeriodId: 'ap-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdById: '1',
      lines: [
        {
          id: 'jel-1',
          journalEntryId: 'je-1',
          accountId: 'acc-1',
          debitAmount: 1000,
          creditAmount: 0,
          lineNumber: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'jel-2',
          journalEntryId: 'je-1',
          accountId: 'acc-2',
          debitAmount: 0,
          creditAmount: 1000,
          lineNumber: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      ...overrides,
    }) as JournalEntry,

  organization: (overrides: Partial<Organization> = {}): Organization =>
    ({
      id: 'org-1',
      name: 'Test Organization',
      fiscalYearEnd: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    }) as Organization,

  auditLog: (overrides: Partial<AuditLog> = {}): AuditLog =>
    ({
      id: 'al-1',
      action: 'CREATE',
      entityType: 'JOURNAL_ENTRY',
      entityId: 'je-1',
      userId: '1',
      organizationId: 'org-1',
      changes: {},
      createdAt: new Date().toISOString(),
      ...overrides,
    }) as AuditLog,

  accountingPeriod: (overrides: Partial<AccountingPeriod> = {}): AccountingPeriod =>
    ({
      id: 'ap-1',
      name: '2024年度',
      startDate: new Date('2024-04-01').toISOString(),
      endDate: new Date('2025-03-31').toISOString(),
      isClosed: false,
      organizationId: 'org-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    }) as AccountingPeriod,
};

/**
 * Apply standard API mocks to a browser context
 */
export async function applyStandardMocks(
  context: BrowserContext,
  options: {
    user?: User;
    accounts?: Account[];
    journalEntries?: JournalEntry[];
    organization?: Organization;
    accountingPeriod?: AccountingPeriod;
    skipAuth?: boolean;
  } = {}
) {
  const {
    user = mockData.user(),
    accounts = [mockData.account()],
    journalEntries = [],
    organization = mockData.organization(),
    accountingPeriod = mockData.accountingPeriod(),
    skipAuth = false,
  } = options;

  // Authentication mocks
  if (!skipAuth) {
    await context.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill(mockResponses.auth.login.success('test-token', user));
    });

    await context.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill(mockResponses.auth.me.success(user));
    });

    await context.route('**/api/v1/auth/verify', async (route) => {
      await route.fulfill(mockResponses.auth.verify.valid(user));
    });

    await context.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill(mockResponses.auth.refresh.success('new-token'));
    });

    await context.route('**/api/v1/auth/logout', async (route) => {
      await route.fulfill(mockResponses.auth.logout.success);
    });
  }

  // Account mocks
  await context.route('**/api/v1/accounts', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill(mockResponses.accounts.list.success(accounts));
    } else if (route.request().method() === 'POST') {
      const newAccount = await route.request().postDataJSON();
      await route.fulfill(
        mockResponses.accounts.create.success({ ...mockData.account(), ...newAccount })
      );
    }
  });

  await context.route('**/api/v1/accounts/*', async (route) => {
    const accountId = route.request().url().split('/').pop();
    const account = accounts.find((a) => a.id === accountId);

    if (route.request().method() === 'GET') {
      if (account) {
        await route.fulfill(mockResponses.accounts.update.success(account));
      } else {
        await route.fulfill(mockResponses.accounts.update.notFound);
      }
    } else if (route.request().method() === 'PUT') {
      if (account) {
        const updates = await route.request().postDataJSON();
        await route.fulfill(mockResponses.accounts.update.success({ ...account, ...updates }));
      } else {
        await route.fulfill(mockResponses.accounts.update.notFound);
      }
    } else if (route.request().method() === 'DELETE') {
      await route.fulfill(mockResponses.accounts.delete.success);
    }
  });

  // Journal entry mocks
  await context.route('**/api/v1/journal-entries', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill(mockResponses.journalEntries.list.success(journalEntries));
    } else if (route.request().method() === 'POST') {
      const newEntry = await route.request().postDataJSON();
      await route.fulfill(
        mockResponses.journalEntries.create.success({ ...mockData.journalEntry(), ...newEntry })
      );
    }
  });

  // Organization mocks
  await context.route('**/api/v1/organizations', async (route) => {
    await route.fulfill(mockResponses.organizations.list.success([organization]));
  });

  await context.route('**/api/v1/organizations/current', async (route) => {
    await route.fulfill(mockResponses.organizations.current.success(organization));
  });

  // Accounting period mocks
  await context.route('**/api/v1/accounting-periods', async (route) => {
    await route.fulfill(mockResponses.accountingPeriods.list.success([accountingPeriod]));
  });

  await context.route('**/api/v1/accounting-periods/current', async (route) => {
    await route.fulfill(mockResponses.accountingPeriods.current.success(accountingPeriod));
  });
}

/**
 * Helper to create a specific mock scenario
 */
export function createMockScenario(scenario: 'empty' | 'basic' | 'complex') {
  switch (scenario) {
    case 'empty':
      return {
        accounts: [],
        journalEntries: [],
      };

    case 'basic':
      return {
        accounts: [
          mockData.account({ id: 'acc-1', code: '1000', name: 'Cash' }),
          mockData.account({ id: 'acc-2', code: '3000', name: 'Revenue' }),
        ],
        journalEntries: [mockData.journalEntry()],
      };

    case 'complex':
      return {
        accounts: [
          mockData.account({ id: 'acc-1', code: '1000', name: 'Cash' }),
          mockData.account({ id: 'acc-2', code: '1100', name: 'Accounts Receivable' }),
          mockData.account({ id: 'acc-3', code: '2000', name: 'Accounts Payable' }),
          mockData.account({ id: 'acc-4', code: '3000', name: 'Revenue' }),
          mockData.account({ id: 'acc-5', code: '4000', name: 'Cost of Sales' }),
        ],
        journalEntries: [
          mockData.journalEntry({ id: 'je-1', entryNumber: 'JE-001' }),
          mockData.journalEntry({ id: 'je-2', entryNumber: 'JE-002' }),
          mockData.journalEntry({ id: 'je-3', entryNumber: 'JE-003' }),
        ],
      };
  }
}

/**
 * Wait for API call and capture request/response
 */
export async function captureApiCall(context: BrowserContext, urlPattern: string, method = 'GET') {
  return new Promise((resolve) => {
    context.route(urlPattern, async (route) => {
      if (route.request().method() === method) {
        const request = {
          url: route.request().url(),
          method: route.request().method(),
          headers: route.request().headers(),
          postData: route.request().postData(),
        };
        resolve(request);
      }
      await route.continue();
    });
  });
}

/**
 * Mock API error responses
 */
export async function mockApiError(
  context: BrowserContext,
  urlPattern: string,
  errorType: 'network' | 'timeout' | 'server' | 'validation' = 'server'
) {
  await context.route(urlPattern, async (route) => {
    switch (errorType) {
      case 'network':
        await route.abort('failed');
        break;
      case 'timeout':
        await new Promise((resolve) => setTimeout(resolve, 30000));
        await route.abort('timedout');
        break;
      case 'server':
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'An unexpected error occurred',
            },
          }),
        });
        break;
      case 'validation':
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request validation failed',
              details: {
                field: 'Invalid field value',
              },
            },
          }),
        });
        break;
    }
  });
}
