import { UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

import { prisma } from '../lib/prisma';
import { generateTokens } from '../utils/jwt';

export interface TestUser {
  user: { id: string; email: string; name: string };
  organization: { id: string; code: string; name: string };
  token: string;
}

export async function createTestUser(
  email: string,
  name: string,
  role: UserRole = UserRole.ADMIN,
  orgCode?: string
): Promise<TestUser> {
  // Create test organization
  const organization = await prisma.organization.create({
    data: {
      code: orgCode || `TEST-${Date.now()}`,
      name: `Test Organization for ${name}`,
      taxId: '1234567890123',
    },
  });

  // Create test user
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash('password', 10),
      name,
    },
  });

  // Link user to organization with specified role
  await prisma.userOrganization.create({
    data: {
      userId: user.id,
      organizationId: organization.id,
      role,
      isDefault: true,
    },
  });

  const tokens = generateTokens(user.id, user.email, role);

  return {
    user,
    organization,
    token: tokens.accessToken,
  };
}

export async function cleanupTestData() {
  // Clean up test data in reverse order of dependencies
  await prisma.journalEntryLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.account.deleteMany();
  await prisma.accountingPeriod.deleteMany();
  await prisma.partner.deleteMany();
  await prisma.userOrganization.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
}
