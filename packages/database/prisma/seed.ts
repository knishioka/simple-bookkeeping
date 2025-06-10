import { PrismaClient, UserRole, AccountType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create test organization
  const organization = await prisma.organization.upsert({
    where: { code: 'TEST001' },
    update: {},
    create: {
      code: 'TEST001',
      name: 'テスト会社',
      fiscalYearStart: 4,
      taxId: '1234567890123',
      address: '東京都渋谷区',
      phone: '03-1234-5678',
    },
  });

  console.log('Created organization:', organization.name);

  // Create test user with random password
  const testPassword = process.env.SEED_TEST_PASSWORD || `test${Math.random().toString(36).substring(2, 15)}`;
  const hashedPassword = await bcrypt.hash(testPassword, 10);
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      passwordHash: hashedPassword,
      name: 'テストユーザー',
    },
  });

  console.log('Created user:', user.email);
  console.log('Test user password:', testPassword);

  // Link user to organization
  const userOrg = await prisma.userOrganization.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: organization.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      organizationId: organization.id,
      role: UserRole.ADMIN,
      isDefault: true,
    },
  });

  console.log('Linked user to organization with role:', userOrg.role);

  // Create accounting period
  const currentYear = new Date().getFullYear();
  const accountingPeriod = await prisma.accountingPeriod.upsert({
    where: {
      organizationId_startDate_endDate: {
        organizationId: organization.id,
        startDate: new Date(currentYear, 3, 1), // April 1
        endDate: new Date(currentYear + 1, 2, 31), // March 31
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      name: `${currentYear}年度`,
      startDate: new Date(currentYear, 3, 1),
      endDate: new Date(currentYear + 1, 2, 31),
      isCurrent: true,
    },
  });

  console.log('Created accounting period:', accountingPeriod.name);

  // Create standard accounts
  const accounts = [
    // Assets
    { code: '1110', name: '現金', accountType: AccountType.ASSET },
    { code: '1120', name: '当座預金', accountType: AccountType.ASSET },
    { code: '1130', name: '普通預金', accountType: AccountType.ASSET },
    { code: '1140', name: '売掛金', accountType: AccountType.ASSET },
    { code: '1150', name: '商品', accountType: AccountType.ASSET },
    
    // Liabilities
    { code: '2110', name: '買掛金', accountType: AccountType.LIABILITY },
    { code: '2120', name: '未払金', accountType: AccountType.LIABILITY },
    { code: '2130', name: '預り金', accountType: AccountType.LIABILITY },
    
    // Equity
    { code: '3110', name: '資本金', accountType: AccountType.EQUITY },
    { code: '3120', name: '利益剰余金', accountType: AccountType.EQUITY },
    
    // Revenue
    { code: '4110', name: '売上高', accountType: AccountType.REVENUE },
    { code: '4120', name: '受取利息', accountType: AccountType.REVENUE },
    
    // Expenses
    { code: '5110', name: '仕入高', accountType: AccountType.EXPENSE },
    { code: '5210', name: '給料手当', accountType: AccountType.EXPENSE },
    { code: '5220', name: '地代家賃', accountType: AccountType.EXPENSE },
    { code: '5230', name: '水道光熱費', accountType: AccountType.EXPENSE },
    { code: '5240', name: '通信費', accountType: AccountType.EXPENSE },
    { code: '5250', name: '消耗品費', accountType: AccountType.EXPENSE },
  ];

  for (const account of accounts) {
    await prisma.account.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: account.code,
        },
      },
      update: {},
      create: {
        ...account,
        organizationId: organization.id,
        isSystem: true,
      },
    });
    console.log('Created account:', account.code, account.name);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });