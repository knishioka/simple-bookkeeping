import { UserRole, JournalStatus, AccountType } from '@simple-bookkeeping/database';
import { TEST_CREDENTIALS, TEST_JWT_CONFIG } from '@simple-bookkeeping/test-utils';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';

import { prisma } from '../lib/prisma';

/**
 * Test helper utilities for API controller tests
 */

// Test data cleanup
export const cleanupTestData = async () => {
  // Delete in correct order to respect foreign key constraints
  await prisma.journalEntryLine.deleteMany({});
  await prisma.journalEntry.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.accountingPeriod.deleteMany({});
  await prisma.userOrganization.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});
};

// Create test organization
export const createTestOrganization = async (data?: {
  name?: string;
  code?: string;
  isActive?: boolean;
}) => {
  return await prisma.organization.create({
    data: {
      name: data?.name || 'Test Organization',
      code: data?.code || `TEST-${Date.now()}`,
      isActive: data?.isActive ?? true,
    },
  });
};

// Create test user with organization
export const createTestUser = async (
  organizationId: string,
  role: UserRole = UserRole.VIEWER,
  data?: {
    email?: string;
    password?: string;
    name?: string;
    isActive?: boolean;
  }
) => {
  // Use centralized test credentials as defaults
  const defaultCreds =
    role === UserRole.ADMIN
      ? TEST_CREDENTIALS.admin
      : role === UserRole.ACCOUNTANT
        ? TEST_CREDENTIALS.accountant
        : TEST_CREDENTIALS.viewer;

  const passwordHash = await bcrypt.hash(data?.password || defaultCreds.password, 10);

  const user = await prisma.user.create({
    data: {
      email: data?.email || `test-${Date.now()}@example.com`,
      passwordHash,
      name: data?.name || 'Test User',
      isActive: data?.isActive ?? true,
    },
  });

  // Create user-organization relationship
  await prisma.userOrganization.create({
    data: {
      userId: user.id,
      organizationId,
      role,
      isDefault: true,
    },
  });

  return user;
};

// Generate JWT token for testing with role
export const generateTestToken = (
  userId: string,
  organizationId: string,
  role: UserRole = UserRole.VIEWER
) => {
  // Use centralized JWT config
  const secret = process.env.JWT_SECRET || TEST_JWT_CONFIG.secret;
  return jwt.sign(
    {
      sub: userId, // JWT standard claim for subject (user ID)
      userId, // Keep for backwards compatibility
      organizationId,
      role, // Include the role for the organization
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    {
      expiresIn: TEST_JWT_CONFIG.expiresIn,
    } as SignOptions
  );
};

// Create test accounting period
export const createTestAccountingPeriod = async (
  organizationId: string,
  data?: {
    name?: string;
    startDate?: Date;
    endDate?: Date;
    isClosed?: boolean;
  }
) => {
  const startDate = data?.startDate || new Date('2024-01-01');
  const endDate = data?.endDate || new Date('2024-12-31');

  return await prisma.accountingPeriod.create({
    data: {
      organizationId,
      name: data?.name || '2024年度',
      startDate,
      endDate,
      isActive: !(data?.isClosed ?? false),
    },
  });
};

// Create test account
export const createTestAccount = async (
  organizationId: string,
  data?: {
    code?: string;
    name?: string;
    accountType?: AccountType;
    isActive?: boolean;
  }
) => {
  return await prisma.account.create({
    data: {
      organizationId,
      code: data?.code || `ACC-${Date.now()}`,
      name: data?.name || 'Test Account',
      accountType: data?.accountType || AccountType.ASSET,
      isActive: data?.isActive ?? true,
    },
  });
};

// Create test journal entry with lines
export const createTestJournalEntry = async (
  organizationId: string,
  accountingPeriodId: string,
  balanced = true,
  data?: {
    entryNumber?: string;
    entryDate?: Date;
    description?: string;
    status?: JournalStatus;
    lines?: Array<{
      accountId: string;
      debitAmount?: number;
      creditAmount?: number;
      description?: string;
    }>;
  }
) => {
  // Create accounts if lines are not provided
  let lines = data?.lines;
  if (!lines) {
    const cashAccount = await createTestAccount(organizationId, {
      code: `CASH-${Date.now()}`,
      name: '現金',
      accountType: AccountType.ASSET,
    });

    const salesAccount = await createTestAccount(organizationId, {
      code: `SALES-${Date.now() + 1}`,
      name: '売上',
      accountType: AccountType.REVENUE,
    });

    lines = balanced
      ? [
          { accountId: cashAccount.id, debitAmount: 1000, creditAmount: 0 },
          { accountId: salesAccount.id, debitAmount: 0, creditAmount: 1000 },
        ]
      : [
          { accountId: cashAccount.id, debitAmount: 1000, creditAmount: 0 },
          { accountId: salesAccount.id, debitAmount: 0, creditAmount: 500 }, // Unbalanced
        ];
  }

  // Need to create a user for createdById
  const testUser =
    (await prisma.user.findFirst({
      where: {
        userOrganizations: {
          some: { organizationId },
        },
      },
    })) || (await createTestUser(organizationId, UserRole.ACCOUNTANT));

  const entry = await prisma.journalEntry.create({
    data: {
      organizationId,
      accountingPeriodId,
      entryNumber: data?.entryNumber || `JE-${Date.now()}`,
      entryDate: data?.entryDate || new Date(),
      description: data?.description || 'Test Journal Entry',
      status: data?.status || JournalStatus.DRAFT,
      createdById: testUser.id,
      lines: {
        create: lines.map((line, index) => ({
          accountId: line.accountId,
          debitAmount: line.debitAmount || 0,
          creditAmount: line.creditAmount || 0,
          description: line.description || '',
          lineNumber: index + 1,
        })),
      },
    },
    include: {
      lines: {
        include: {
          account: true,
        },
      },
    },
  });

  return entry;
};

// Create test user with full setup (org, period, accounts)
export const createFullTestSetup = async (role: UserRole = UserRole.ACCOUNTANT) => {
  const organization = await createTestOrganization();
  const user = await createTestUser(organization.id, role);
  const token = generateTestToken(user.id, organization.id, role);
  const accountingPeriod = await createTestAccountingPeriod(organization.id);

  // Create basic accounts
  const cashAccount = await createTestAccount(organization.id, {
    code: '1001',
    name: '現金',
    accountType: AccountType.ASSET,
  });

  const salesAccount = await createTestAccount(organization.id, {
    code: '4001',
    name: '売上高',
    accountType: AccountType.REVENUE,
  });

  const expenseAccount = await createTestAccount(organization.id, {
    code: '5001',
    name: '仕入高',
    accountType: AccountType.EXPENSE,
  });

  return {
    organization,
    user,
    token,
    accountingPeriod,
    accounts: {
      cash: cashAccount,
      sales: salesAccount,
      expense: expenseAccount,
    },
  };
};

// Wait for async operations
export const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
