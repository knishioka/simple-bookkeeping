import { AccountType, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';
import { Router, Request, Response } from 'express';

import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middlewares/auth';

import type { Router as RouterType } from 'express';

const router: RouterType = Router();

// Apply authentication and admin authorization to all seed routes
router.use(authenticate);
router.use(authorize(UserRole.ADMIN));

// Reset database and seed with standard data
router.post('/reset', async (req: Request, res: Response) => {
  try {
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

    // Create standard accounts (標準勘定科目)
    interface AccountData {
      code: string;
      name: string;
      accountType: AccountType;
      parentId?: null;
      parentCode?: string;
    }

    const accounts: AccountData[] = [
      // ========== 資産 (Assets) ==========

      // 流動資産 (Current Assets)
      {
        code: '1000',
        name: '流動資産',
        accountType: AccountType.ASSET,
        parentId: null,
      },
      {
        code: '1110',
        name: '現金',
        accountType: AccountType.ASSET,
        parentCode: '1000',
      },
      {
        code: '1120',
        name: '小口現金',
        accountType: AccountType.ASSET,
        parentCode: '1000',
      },
      {
        code: '1130',
        name: '普通預金',
        accountType: AccountType.ASSET,
        parentCode: '1000',
      },
      {
        code: '1140',
        name: '売掛金',
        accountType: AccountType.ASSET,
        parentCode: '1000',
      },
      {
        code: '1150',
        name: '商品',
        accountType: AccountType.ASSET,
        parentCode: '1000',
      },

      // 固定資産 (Fixed Assets)
      {
        code: '1500',
        name: '固定資産',
        accountType: AccountType.ASSET,
        parentId: null,
      },
      {
        code: '1510',
        name: '建物',
        accountType: AccountType.ASSET,
        parentCode: '1500',
      },
      {
        code: '1520',
        name: '車両運搬具',
        accountType: AccountType.ASSET,
        parentCode: '1500',
      },
      {
        code: '1530',
        name: '工具器具備品',
        accountType: AccountType.ASSET,
        parentCode: '1500',
      },
      {
        code: '1560',
        name: 'ソフトウェア',
        accountType: AccountType.ASSET,
        parentCode: '1500',
      },

      // ========== 負債 (Liabilities) ==========

      // 流動負債 (Current Liabilities)
      {
        code: '2000',
        name: '流動負債',
        accountType: AccountType.LIABILITY,
        parentId: null,
      },
      {
        code: '2110',
        name: '買掛金',
        accountType: AccountType.LIABILITY,
        parentCode: '2000',
      },
      {
        code: '2120',
        name: '未払金',
        accountType: AccountType.LIABILITY,
        parentCode: '2000',
      },
      {
        code: '2150',
        name: '預り金',
        accountType: AccountType.LIABILITY,
        parentCode: '2000',
      },
      {
        code: '2180',
        name: '仮受消費税',
        accountType: AccountType.LIABILITY,
        parentCode: '2000',
      },

      // 固定負債 (Long-term Liabilities)
      {
        code: '2500',
        name: '固定負債',
        accountType: AccountType.LIABILITY,
        parentId: null,
      },
      {
        code: '2510',
        name: '長期借入金',
        accountType: AccountType.LIABILITY,
        parentCode: '2500',
      },

      // ========== 純資産 (Net Assets/Equity) ==========
      {
        code: '3000',
        name: '純資産',
        accountType: AccountType.EQUITY,
        parentId: null,
      },

      // 個人事業主向け (For Sole Proprietors)
      {
        code: '3110',
        name: '元入金',
        accountType: AccountType.EQUITY,
        parentCode: '3000',
      },
      {
        code: '3120',
        name: '事業主貸',
        accountType: AccountType.EQUITY,
        parentCode: '3000',
      },
      {
        code: '3130',
        name: '事業主借',
        accountType: AccountType.EQUITY,
        parentCode: '3000',
      },

      // 法人向け (For Corporations)
      {
        code: '3200',
        name: '資本金',
        accountType: AccountType.EQUITY,
        parentCode: '3000',
      },
      {
        code: '3220',
        name: '利益剰余金',
        accountType: AccountType.EQUITY,
        parentCode: '3000',
      },

      // ========== 収益 (Revenue) ==========

      // 売上高 (Sales Revenue)
      {
        code: '4000',
        name: '売上高',
        accountType: AccountType.REVENUE,
        parentId: null,
      },
      {
        code: '4110',
        name: '製品売上高',
        accountType: AccountType.REVENUE,
        parentCode: '4000',
      },
      {
        code: '4111',
        name: '商品売上高',
        accountType: AccountType.REVENUE,
        parentCode: '4000',
      },
      {
        code: '4112',
        name: 'サービス売上高',
        accountType: AccountType.REVENUE,
        parentCode: '4000',
      },

      // 営業外収益 (Non-operating Revenue)
      {
        code: '4500',
        name: '営業外収益',
        accountType: AccountType.REVENUE,
        parentId: null,
      },
      {
        code: '4510',
        name: '受取利息',
        accountType: AccountType.REVENUE,
        parentCode: '4500',
      },
      {
        code: '4520',
        name: '雑収入',
        accountType: AccountType.REVENUE,
        parentCode: '4500',
      },

      // ========== 費用 (Expenses) ==========

      // 売上原価 (Cost of Goods Sold)
      {
        code: '5000',
        name: '売上原価',
        accountType: AccountType.EXPENSE,
        parentId: null,
      },
      {
        code: '5110',
        name: '仕入高',
        accountType: AccountType.EXPENSE,
        parentCode: '5000',
      },

      // 販売費及び一般管理費 (Selling, General & Administrative Expenses)
      {
        code: '6000',
        name: '販売費及び一般管理費',
        accountType: AccountType.EXPENSE,
        parentId: null,
      },

      // 人件費 (Personnel Expenses)
      {
        code: '6110',
        name: '給料手当',
        accountType: AccountType.EXPENSE,
        parentCode: '6000',
      },
      {
        code: '6120',
        name: '役員報酬',
        accountType: AccountType.EXPENSE,
        parentCode: '6000',
      },
      {
        code: '6130',
        name: '法定福利費',
        accountType: AccountType.EXPENSE,
        parentCode: '6000',
      },
      {
        code: '6140',
        name: '福利厚生費',
        accountType: AccountType.EXPENSE,
        parentCode: '6000',
      },

      // 経費 (Operating Expenses)
      {
        code: '6150',
        name: '旅費交通費',
        accountType: AccountType.EXPENSE,
        parentCode: '6000',
      },
      {
        code: '6160',
        name: '通信費',
        accountType: AccountType.EXPENSE,
        parentCode: '6000',
      },
      {
        code: '6170',
        name: '水道光熱費',
        accountType: AccountType.EXPENSE,
        parentCode: '6000',
      },
      {
        code: '6180',
        name: '消耗品費',
        accountType: AccountType.EXPENSE,
        parentCode: '6000',
      },
      {
        code: '6200',
        name: '地代家賃',
        accountType: AccountType.EXPENSE,
        parentCode: '6000',
      },
      {
        code: '6210',
        name: '支払手数料',
        accountType: AccountType.EXPENSE,
        parentCode: '6000',
      },
      {
        code: '6220',
        name: '広告宣伝費',
        accountType: AccountType.EXPENSE,
        parentCode: '6000',
      },
      {
        code: '6230',
        name: '接待交際費',
        accountType: AccountType.EXPENSE,
        parentCode: '6000',
      },
      {
        code: '6250',
        name: '減価償却費',
        accountType: AccountType.EXPENSE,
        parentCode: '6000',
      },
      {
        code: '6280',
        name: '仮払消費税',
        accountType: AccountType.EXPENSE,
        parentCode: '6000',
      },
      {
        code: '6290',
        name: '雑費',
        accountType: AccountType.EXPENSE,
        parentCode: '6000',
      },

      // 営業外費用 (Non-operating Expenses)
      {
        code: '7000',
        name: '営業外費用',
        accountType: AccountType.EXPENSE,
        parentId: null,
      },
      {
        code: '7110',
        name: '支払利息',
        accountType: AccountType.EXPENSE,
        parentCode: '7000',
      },
      {
        code: '7120',
        name: '雑損失',
        accountType: AccountType.EXPENSE,
        parentCode: '7000',
      },
    ];

    // Create parent accounts first
    const parentAccounts = new Map<string, string>();

    for (const account of accounts.filter((a) => !('parentCode' in a))) {
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
    for (const account of accounts.filter((a) => 'parentCode' in a)) {
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

    res.status(200).json({
      data: {
        message: 'データベースのリセットとseedデータの登録が完了しました',
        organization: {
          id: organization.id,
          name: organization.name,
        },
        accounts: accounts.length,
        partners: partners.length,
        accountingPeriod: {
          id: accountingPeriod.id,
          name: accountingPeriod.name,
        },
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    const errorDetails = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'seedデータの登録中にエラーが発生しました',
        details: errorDetails,
      },
    });
  }
});

export default router;
