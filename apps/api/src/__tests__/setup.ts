import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Clear database before tests
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.journalEntryLine.deleteMany(),
    prisma.journalEntry.deleteMany(),
    prisma.partner.deleteMany(),
    prisma.account.deleteMany(),
    prisma.accountingPeriod.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
