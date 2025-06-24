import { AccountType, UserRole, OrganizationType } from '@simple-bookkeeping/database';
import { hash } from 'bcrypt';
import { Router, Request, Response } from 'express';

import { prisma } from '../lib/prisma';
// import { authenticate, authorize } from '../middlewares/auth';

import type { Router as RouterType } from 'express';

const router: RouterType = Router();

// Apply authentication and admin authorization to all seed routes
// Temporarily disabled for development
// router.use(authenticate);
// router.use(authorize(UserRole.ADMIN));

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
    const accounts = [
      // ========== 資産 (Assets) ==========

      // 流動資産 (Current Assets)
      {
        code: '1000',
        name: '流動資産',
        description: '1年以内に現金化される可能性の高い資産の総称',
        accountType: AccountType.ASSET,
        organizationType: OrganizationType.BOTH,
        parentId: null,
      },
      {
        code: '1110',
        name: '現金',
        description: '紙幣、硬貨など手元にある現金',
        accountType: AccountType.ASSET,
        organizationType: OrganizationType.BOTH,
        parentCode: '1000',
      },
      {
        code: '1120',
        name: '小口現金',
        description: '日常的な少額支払い用の現金',
        accountType: AccountType.ASSET,
        organizationType: OrganizationType.BOTH,
        parentCode: '1000',
      },
      {
        code: '1130',
        name: '普通預金',
        description: '銀行の普通預金口座の残高',
        accountType: AccountType.ASSET,
        organizationType: OrganizationType.BOTH,
        parentCode: '1000',
      },
      {
        code: '1140',
        name: '売掛金',
        description: '商品やサービスの売上による未回収金',
        accountType: AccountType.ASSET,
        organizationType: OrganizationType.BOTH,
        parentCode: '1000',
      },
      {
        code: '1150',
        name: '商品',
        description: '販売目的で保有する商品の在庫',
        accountType: AccountType.ASSET,
        organizationType: OrganizationType.BOTH,
        parentCode: '1000',
      },

      // 固定資産 (Fixed Assets)
      {
        code: '1500',
        name: '固定資産',
        description: '長期間にわたって事業に使用される資産',
        accountType: AccountType.ASSET,
        organizationType: OrganizationType.BOTH,
        parentId: null,
      },
      {
        code: '1510',
        name: '建物',
        description: '事業用建物',
        accountType: AccountType.ASSET,
        organizationType: OrganizationType.BOTH,
        parentCode: '1500',
      },
      {
        code: '1520',
        name: '車両運搬具',
        description: '事業用車両',
        accountType: AccountType.ASSET,
        organizationType: OrganizationType.BOTH,
        parentCode: '1500',
      },
      {
        code: '1530',
        name: '工具器具備品',
        description: '事業用の工具や備品',
        accountType: AccountType.ASSET,
        organizationType: OrganizationType.BOTH,
        parentCode: '1500',
      },
      {
        code: '1560',
        name: 'ソフトウェア',
        description: '事業用ソフトウェア',
        accountType: AccountType.ASSET,
        organizationType: OrganizationType.BOTH,
        parentCode: '1500',
      },

      // ========== 負債 (Liabilities) ==========

      // 流動負債 (Current Liabilities)
      {
        code: '2000',
        name: '流動負債',
        description: '1年以内に支払期限が到来する負債',
        accountType: AccountType.LIABILITY,
        organizationType: OrganizationType.BOTH,
        parentId: null,
      },
      {
        code: '2110',
        name: '買掛金',
        description: '商品仕入による未払金',
        accountType: AccountType.LIABILITY,
        organizationType: OrganizationType.BOTH,
        parentCode: '2000',
      },
      {
        code: '2120',
        name: '未払金',
        description: '営業目的以外の代金の未払い',
        accountType: AccountType.LIABILITY,
        organizationType: OrganizationType.BOTH,
        parentCode: '2000',
      },
      {
        code: '2150',
        name: '預り金',
        description: '従業員からの預り金',
        accountType: AccountType.LIABILITY,
        organizationType: OrganizationType.BOTH,
        parentCode: '2000',
      },
      {
        code: '2180',
        name: '仮受消費税',
        description: '売上時に受け取った消費税',
        accountType: AccountType.LIABILITY,
        organizationType: OrganizationType.BOTH,
        parentCode: '2000',
      },

      // 固定負債 (Long-term Liabilities)
      {
        code: '2500',
        name: '固定負債',
        description: '1年を超える長期の負債',
        accountType: AccountType.LIABILITY,
        organizationType: OrganizationType.BOTH,
        parentId: null,
      },
      {
        code: '2510',
        name: '長期借入金',
        description: '1年を超える借入金',
        accountType: AccountType.LIABILITY,
        organizationType: OrganizationType.BOTH,
        parentCode: '2500',
      },

      // ========== 純資産 (Net Assets/Equity) ==========
      {
        code: '3000',
        name: '純資産',
        description: '資産から負債を差し引いた正味の財産',
        accountType: AccountType.EQUITY,
        organizationType: OrganizationType.BOTH,
        parentId: null,
      },

      // 個人事業主向け (For Sole Proprietors)
      {
        code: '3110',
        name: '元入金',
        description: '個人事業主が事業に投入した資本',
        accountType: AccountType.EQUITY,
        organizationType: OrganizationType.SOLE_PROPRIETOR,
        parentCode: '3000',
      },
      {
        code: '3120',
        name: '事業主貸',
        description: '事業主が事業資金を個人的に使用した金額',
        accountType: AccountType.EQUITY,
        organizationType: OrganizationType.SOLE_PROPRIETOR,
        parentCode: '3000',
      },
      {
        code: '3130',
        name: '事業主借',
        description: '事業主が個人資金を事業に投入した金額',
        accountType: AccountType.EQUITY,
        organizationType: OrganizationType.SOLE_PROPRIETOR,
        parentCode: '3000',
      },

      // 法人向け (For Corporations)
      {
        code: '3200',
        name: '資本金',
        description: '株主が出資した資本',
        accountType: AccountType.EQUITY,
        organizationType: OrganizationType.CORPORATION,
        parentCode: '3000',
      },
      {
        code: '3220',
        name: '利益剰余金',
        description: '会社の利益の蓄積',
        accountType: AccountType.EQUITY,
        organizationType: OrganizationType.CORPORATION,
        parentCode: '3000',
      },

      // ========== 収益 (Revenue) ==========

      // 売上高 (Sales Revenue)
      {
        code: '4000',
        name: '売上高',
        description: '商品やサービスの販売による収益',
        accountType: AccountType.REVENUE,
        organizationType: OrganizationType.BOTH,
        parentId: null,
      },
      {
        code: '4110',
        name: '製品売上高',
        description: '自社製造品の売上',
        accountType: AccountType.REVENUE,
        organizationType: OrganizationType.BOTH,
        parentCode: '4000',
      },
      {
        code: '4111',
        name: '商品売上高',
        description: '仕入商品の売上',
        accountType: AccountType.REVENUE,
        organizationType: OrganizationType.BOTH,
        parentCode: '4000',
      },
      {
        code: '4112',
        name: 'サービス売上高',
        description: 'サービス提供による売上',
        accountType: AccountType.REVENUE,
        organizationType: OrganizationType.BOTH,
        parentCode: '4000',
      },

      // 営業外収益 (Non-operating Revenue)
      {
        code: '4500',
        name: '営業外収益',
        description: '本業以外から生じる収益',
        accountType: AccountType.REVENUE,
        organizationType: OrganizationType.BOTH,
        parentId: null,
      },
      {
        code: '4510',
        name: '受取利息',
        description: '預金や貸付金から生じる利息収入',
        accountType: AccountType.REVENUE,
        organizationType: OrganizationType.BOTH,
        parentCode: '4500',
      },
      {
        code: '4520',
        name: '雑収入',
        description: 'その他の収益',
        accountType: AccountType.REVENUE,
        organizationType: OrganizationType.BOTH,
        parentCode: '4500',
      },

      // ========== 費用 (Expenses) ==========

      // 売上原価 (Cost of Goods Sold)
      {
        code: '5000',
        name: '売上原価',
        description: '売上に直接対応する商品・製品の原価',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentId: null,
      },
      {
        code: '5110',
        name: '仕入高',
        description: '商品の仕入れ費用',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentCode: '5000',
      },

      // 販売費及び一般管理費 (Selling, General & Administrative Expenses)
      {
        code: '6000',
        name: '販売費及び一般管理費',
        description: '販売活動及び一般管理業務に関する費用',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentId: null,
      },

      // 人件費 (Personnel Expenses)
      {
        code: '6110',
        name: '給料手当',
        description: '従業員に支払う給与',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentCode: '6000',
      },
      {
        code: '6120',
        name: '役員報酬',
        description: '役員に支払う報酬',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.CORPORATION,
        parentCode: '6000',
      },
      {
        code: '6130',
        name: '法定福利費',
        description: '社会保険料等の法定福利費',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentCode: '6000',
      },
      {
        code: '6140',
        name: '福利厚生費',
        description: '従業員の福利厚生費',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentCode: '6000',
      },

      // 経費 (Operating Expenses)
      {
        code: '6150',
        name: '旅費交通費',
        description: '出張費や交通費',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentCode: '6000',
      },
      {
        code: '6160',
        name: '通信費',
        description: '電話代やインターネット代',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentCode: '6000',
      },
      {
        code: '6170',
        name: '水道光熱費',
        description: '電気・ガス・水道代',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentCode: '6000',
      },
      {
        code: '6180',
        name: '消耗品費',
        description: '事務用品等の消耗品',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentCode: '6000',
      },
      {
        code: '6200',
        name: '地代家賃',
        description: '事務所家賃や土地代',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentCode: '6000',
      },
      {
        code: '6210',
        name: '支払手数料',
        description: '銀行手数料や専門家報酬',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentCode: '6000',
      },
      {
        code: '6220',
        name: '広告宣伝費',
        description: '広告や宣伝にかかる費用',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentCode: '6000',
      },
      {
        code: '6230',
        name: '接待交際費',
        description: '取引先との接待費用',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentCode: '6000',
      },
      {
        code: '6250',
        name: '減価償却費',
        description: '固定資産の減価償却',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentCode: '6000',
      },
      {
        code: '6280',
        name: '仮払消費税',
        description: '支払い時に負担した消費税',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentCode: '6000',
      },
      {
        code: '6290',
        name: '雑費',
        description: 'その他の経費',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentCode: '6000',
      },

      // 営業外費用 (Non-operating Expenses)
      {
        code: '7000',
        name: '営業外費用',
        description: '本業以外から生じる費用',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentId: null,
      },
      {
        code: '7110',
        name: '支払利息',
        description: '借入金の利息',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
        parentCode: '7000',
      },
      {
        code: '7120',
        name: '雑損失',
        description: 'その他の損失',
        accountType: AccountType.EXPENSE,
        organizationType: OrganizationType.BOTH,
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
          description: account.description,
          accountType: account.accountType,
          organizationType: account.organizationType || OrganizationType.BOTH,
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
          description: account.description,
          accountType: account.accountType,
          organizationType: account.organizationType || OrganizationType.BOTH,
          parentId: parentAccounts.get((account as any).parentCode || ''),
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
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'seedデータの登録中にエラーが発生しました',
      },
    });
  }
});

export default router;
