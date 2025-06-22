import { PrismaClient, AccountType, UserRole } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Clean up existing data
  await prisma.auditLog.deleteMany();
  await prisma.journalEntryLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.partner.deleteMany();
  await prisma.account.deleteMany();
  await prisma.accountingPeriod.deleteMany();
  await prisma.userOrganization.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // Create default admin user
  const hashedPassword = await hash('admin123', 10);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash: hashedPassword,
      name: '管理者',
    },
  });

  // eslint-disable-next-line no-console
  console.log('Created admin user:', adminUser.email);

  // Create default organization
  const organization = await prisma.organization.create({
    data: {
      name: 'サンプル会社',
      code: 'SAMPLE',
      email: 'info@sample.co.jp',
      address: '東京都千代田区大手町1-1-1',
      phone: '03-1234-5678',
    },
  });

  // eslint-disable-next-line no-console
  console.log('Created organization:', organization.name);

  // Add admin user to organization
  await prisma.userOrganization.create({
    data: {
      userId: adminUser.id,
      organizationId: organization.id,
      role: UserRole.ADMIN,
      isDefault: true,
    },
  });

  // Create accounting period
  const currentYear = new Date().getFullYear();
  const accountingPeriod = await prisma.accountingPeriod.create({
    data: {
      name: `${currentYear}年度`,
      startDate: new Date(currentYear, 0, 1),
      endDate: new Date(currentYear, 11, 31),
      isActive: true,
      organizationId: organization.id,
    },
  });

  // eslint-disable-next-line no-console
  console.log('Created accounting period:', accountingPeriod.name);

  // Create standard accounts (標準勘定科目)
  const accounts = [
    // 資産
    { code: '1000', name: '流動資産', accountType: AccountType.ASSET, parentId: null },
    { code: '1110', name: '現金', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1120', name: '小口現金', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1130', name: '普通預金', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1140', name: '売掛金', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1150', name: '商品', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1160', name: '前払費用', accountType: AccountType.ASSET, parentCode: '1000' },

    { code: '1500', name: '固定資産', accountType: AccountType.ASSET, parentId: null },
    { code: '1510', name: '建物', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1520', name: '車両運搬具', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1530', name: '工具器具備品', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1540', name: 'ソフトウェア', accountType: AccountType.ASSET, parentCode: '1500' },

    // 負債
    { code: '2000', name: '流動負債', accountType: AccountType.LIABILITY, parentId: null },
    { code: '2110', name: '買掛金', accountType: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2120', name: '未払金', accountType: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2130', name: '未払費用', accountType: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2140', name: '前受金', accountType: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2150', name: '預り金', accountType: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2180', name: '仮受消費税', accountType: AccountType.LIABILITY, parentCode: '2000' },

    { code: '2500', name: '固定負債', accountType: AccountType.LIABILITY, parentId: null },
    { code: '2510', name: '長期借入金', accountType: AccountType.LIABILITY, parentCode: '2500' },

    // 純資産
    { code: '3000', name: '純資産', accountType: AccountType.EQUITY, parentId: null },
    { code: '3110', name: '元入金', accountType: AccountType.EQUITY, parentCode: '3000' },
    { code: '3120', name: '事業主貸', accountType: AccountType.EQUITY, parentCode: '3000' },
    { code: '3130', name: '事業主借', accountType: AccountType.EQUITY, parentCode: '3000' },

    // 収益
    { code: '4000', name: '売上高', accountType: AccountType.REVENUE, parentId: null },
    { code: '4110', name: '売上高', accountType: AccountType.REVENUE, parentCode: '4000' },
    { code: '4120', name: '売上値引高', accountType: AccountType.REVENUE, parentCode: '4000' },
    { code: '4130', name: '売上戻り高', accountType: AccountType.REVENUE, parentCode: '4000' },

    { code: '4500', name: '営業外収益', accountType: AccountType.REVENUE, parentId: null },
    { code: '4510', name: '受取利息', accountType: AccountType.REVENUE, parentCode: '4500' },
    { code: '4520', name: '雑収入', accountType: AccountType.REVENUE, parentCode: '4500' },

    // 費用
    { code: '5000', name: '売上原価', accountType: AccountType.EXPENSE, parentId: null },
    { code: '5110', name: '仕入高', accountType: AccountType.EXPENSE, parentCode: '5000' },
    { code: '5120', name: '仕入値引高', accountType: AccountType.EXPENSE, parentCode: '5000' },
    { code: '5130', name: '仕入戻し高', accountType: AccountType.EXPENSE, parentCode: '5000' },

    {
      code: '6000',
      name: '販売費及び一般管理費',
      accountType: AccountType.EXPENSE,
      parentId: null,
    },
    { code: '6110', name: '給料手当', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6120', name: '役員報酬', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6130', name: '法定福利費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6140', name: '福利厚生費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6150', name: '旅費交通費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6160', name: '通信費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6170', name: '水道光熱費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6180', name: '消耗品費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6190', name: '事務用品費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6200', name: '地代家賃', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6210', name: '支払手数料', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6220', name: '広告宣伝費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6230', name: '接待交際費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6240', name: '会議費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6250', name: '減価償却費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6280', name: '仮払消費税', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6290', name: '雑費', accountType: AccountType.EXPENSE, parentCode: '6000' },

    { code: '7000', name: '営業外費用', accountType: AccountType.EXPENSE, parentId: null },
    { code: '7110', name: '支払利息', accountType: AccountType.EXPENSE, parentCode: '7000' },
    { code: '7120', name: '雑損失', accountType: AccountType.EXPENSE, parentCode: '7000' },
  ];

  // Create parent accounts first
  const parentAccounts = new Map<string, string>();

  for (const account of accounts.filter((a) => !a.parentCode)) {
    const created = await prisma.account.create({
      data: {
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        isSystem: true,
        organizationId: organization.id,
      },
    });
    parentAccounts.set(account.code, created.id);
  }

  // Create child accounts
  for (const account of accounts.filter((a) => a.parentCode)) {
    await prisma.account.create({
      data: {
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        parentId: parentAccounts.get(account.parentCode || ''),
        isSystem: true,
        organizationId: organization.id,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Created standard accounts');

  // Create sample partners
  const partners = await Promise.all([
    prisma.partner.create({
      data: {
        code: 'C001',
        name: '株式会社サンプル商事',
        nameKana: 'カブシキガイシャサンプルショウジ',
        partnerType: 'CUSTOMER',
        address: '東京都千代田区丸の内1-1-1',
        phone: '03-1234-5678',
        email: 'info@sample-shoji.co.jp',
        organizationId: organization.id,
      },
    }),
    prisma.partner.create({
      data: {
        code: 'V001',
        name: 'オフィスサプライ株式会社',
        nameKana: 'オフィスサプライカブシキガイシャ',
        partnerType: 'VENDOR',
        address: '東京都新宿区西新宿2-2-2',
        phone: '03-2345-6789',
        email: 'sales@office-supply.co.jp',
        organizationId: organization.id,
      },
    }),
  ]);

  // eslint-disable-next-line no-console
  console.log('Created sample partners:', partners.length);

  // eslint-disable-next-line no-console
  console.log('Seed data created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
