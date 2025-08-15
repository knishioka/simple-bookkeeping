import { PrismaClient, AccountType, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';

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

  console.log('Created accounting period:', accountingPeriod.name);

  // Create standard accounts (標準勘定科目)
  const accounts: Array<{
    code: string;
    name: string;
    nameKana?: string;
    description?: string;
    accountType: AccountType;
    parentId?: null;
    parentCode?: string;
  }> = [
    // ========== 資産 (Assets) ==========

    // 流動資産 (Current Assets)
    {
      code: '1000',
      name: '流動資産',
      description: '1年以内に現金化される可能性の高い資産の総称',
      accountType: AccountType.ASSET,
      parentId: null,
    },
    {
      code: '1110',
      name: '現金',
      nameKana: 'ゲンキン',
      accountType: AccountType.ASSET,
      parentCode: '1000',
    },
    {
      code: '1120',
      name: '小口現金',
      nameKana: 'コグチゲンキン',
      accountType: AccountType.ASSET,
      parentCode: '1000',
    },
    {
      code: '1130',
      name: '普通預金',
      nameKana: 'フツウヨキン',
      accountType: AccountType.ASSET,
      parentCode: '1000',
    },
    {
      code: '1131',
      name: '当座預金',
      nameKana: 'トウザヨキン',
      accountType: AccountType.ASSET,
      parentCode: '1000',
    },
    {
      code: '1132',
      name: '定期預金',
      nameKana: 'テイキヨキン',
      accountType: AccountType.ASSET,
      parentCode: '1000',
    },
    {
      code: '1133',
      name: '外貨預金',
      nameKana: 'ガイカヨキン',
      accountType: AccountType.ASSET,
      parentCode: '1000',
    },
    {
      code: '1140',
      name: '売掛金',
      nameKana: 'ウリカケキン',
      accountType: AccountType.ASSET,
      parentCode: '1000',
    },
    {
      code: '1141',
      name: '受取手形',
      nameKana: 'ウケトリテガタ',
      accountType: AccountType.ASSET,
      parentCode: '1000',
    },
    { code: '1142', name: '電子記録債権', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1150', name: '商品', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1151', name: '製品', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1152', name: '原材料', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1153', name: '仕掛品', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1154', name: '貯蔵品', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1160', name: '前払費用', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1161', name: '前払金', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1162', name: '立替金', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1163', name: '仮払金', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1164', name: '短期貸付金', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1170', name: '有価証券', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1180', name: '貸倒引当金', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1190', name: '未収入金', accountType: AccountType.ASSET, parentCode: '1000' },
    { code: '1191', name: '未収収益', accountType: AccountType.ASSET, parentCode: '1000' },

    // 固定資産 (Fixed Assets)
    { code: '1500', name: '固定資産', accountType: AccountType.ASSET, parentId: null },

    // 有形固定資産 (Tangible Fixed Assets)
    { code: '1510', name: '建物', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1511', name: '建物附属設備', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1512', name: '構築物', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1513', name: '機械装置', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1520', name: '車両運搬具', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1530', name: '工具器具備品', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1531', name: 'リース資産', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1532', name: '土地', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1533', name: '建設仮勘定', accountType: AccountType.ASSET, parentCode: '1500' },

    // 減価償却累計額 (Accumulated Depreciation)
    {
      code: '1550',
      name: '建物減価償却累計額',
      accountType: AccountType.ASSET,
      parentCode: '1500',
    },
    {
      code: '1551',
      name: '建物附属設備減価償却累計額',
      accountType: AccountType.ASSET,
      parentCode: '1500',
    },
    {
      code: '1552',
      name: '構築物減価償却累計額',
      accountType: AccountType.ASSET,
      parentCode: '1500',
    },
    {
      code: '1553',
      name: '機械装置減価償却累計額',
      accountType: AccountType.ASSET,
      parentCode: '1500',
    },
    {
      code: '1554',
      name: '車両運搬具減価償却累計額',
      accountType: AccountType.ASSET,
      parentCode: '1500',
    },
    {
      code: '1555',
      name: '工具器具備品減価償却累計額',
      accountType: AccountType.ASSET,
      parentCode: '1500',
    },
    {
      code: '1556',
      name: 'リース資産減価償却累計額',
      accountType: AccountType.ASSET,
      parentCode: '1500',
    },

    // 無形固定資産 (Intangible Fixed Assets)
    { code: '1560', name: 'ソフトウェア', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1561', name: 'のれん', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1562', name: '特許権', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1563', name: '商標権', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1564', name: '営業権', accountType: AccountType.ASSET, parentCode: '1500' },
    {
      code: '1565',
      name: 'ソフトウェア償却累計額',
      accountType: AccountType.ASSET,
      parentCode: '1500',
    },

    // 投資その他の資産 (Investments and Other Assets)
    { code: '1570', name: '投資有価証券', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1571', name: '長期貸付金', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1572', name: '差入保証金', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1573', name: '敷金', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1574', name: '長期前払費用', accountType: AccountType.ASSET, parentCode: '1500' },
    { code: '1575', name: '繰延税金資産', accountType: AccountType.ASSET, parentCode: '1500' },

    // ========== 負債 (Liabilities) ==========

    // 流動負債 (Current Liabilities)
    { code: '2000', name: '流動負債', accountType: AccountType.LIABILITY, parentId: null },
    { code: '2110', name: '買掛金', accountType: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2111', name: '支払手形', accountType: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2112', name: '電子記録債務', accountType: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2120', name: '未払金', accountType: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2130', name: '未払費用', accountType: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2131', name: '未払給与', accountType: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2132', name: '未払役員報酬', accountType: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2133', name: '未払法人税等', accountType: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2134', name: '未払消費税', accountType: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2140', name: '前受金', accountType: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2141', name: '前受収益', accountType: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2150', name: '預り金', accountType: AccountType.LIABILITY, parentCode: '2000' },
    {
      code: '2151',
      name: '源泉所得税預り金',
      accountType: AccountType.LIABILITY,
      parentCode: '2000',
    },
    { code: '2152', name: '住民税預り金', accountType: AccountType.LIABILITY, parentCode: '2000' },
    {
      code: '2153',
      name: '社会保険料預り金',
      accountType: AccountType.LIABILITY,
      parentCode: '2000',
    },
    { code: '2160', name: '短期借入金', accountType: AccountType.LIABILITY, parentCode: '2000' },
    {
      code: '2161',
      name: '１年内返済予定長期借入金',
      accountType: AccountType.LIABILITY,
      parentCode: '2000',
    },
    {
      code: '2170',
      name: 'リース債務（流動）',
      accountType: AccountType.LIABILITY,
      parentCode: '2000',
    },
    { code: '2180', name: '仮受消費税', accountType: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2190', name: '仮受金', accountType: AccountType.LIABILITY, parentCode: '2000' },
    { code: '2191', name: '賞与引当金', accountType: AccountType.LIABILITY, parentCode: '2000' },

    // 固定負債 (Long-term Liabilities)
    { code: '2500', name: '固定負債', accountType: AccountType.LIABILITY, parentId: null },
    { code: '2510', name: '長期借入金', accountType: AccountType.LIABILITY, parentCode: '2500' },
    { code: '2511', name: '社債', accountType: AccountType.LIABILITY, parentCode: '2500' },
    {
      code: '2520',
      name: 'リース債務（固定）',
      accountType: AccountType.LIABILITY,
      parentCode: '2500',
    },
    {
      code: '2530',
      name: '退職給付引当金',
      accountType: AccountType.LIABILITY,
      parentCode: '2500',
    },
    {
      code: '2531',
      name: '役員退職慰労引当金',
      accountType: AccountType.LIABILITY,
      parentCode: '2500',
    },
    { code: '2540', name: '繰延税金負債', accountType: AccountType.LIABILITY, parentCode: '2500' },
    { code: '2550', name: '長期預り金', accountType: AccountType.LIABILITY, parentCode: '2500' },

    // ========== 純資産 (Net Assets/Equity) ==========
    {
      code: '3000',
      name: '純資産',
      description: '資産から負債を差し引いた正味の財産',
      accountType: AccountType.EQUITY,
      parentId: null,
    },

    // 個人事業主向け (For Sole Proprietors)
    {
      code: '3110',
      name: '元入金',
      description: '個人事業主が事業に投入した資本',
      accountType: AccountType.EQUITY,
      parentCode: '3000',
    },
    {
      code: '3120',
      name: '事業主貸',
      description: '事業主が事業資金を個人的に使用した金額',
      accountType: AccountType.EQUITY,
      parentCode: '3000',
    },
    {
      code: '3130',
      name: '事業主借',
      description: '事業主が個人資金を事業に投入した金額',
      accountType: AccountType.EQUITY,
      parentCode: '3000',
    },

    // 法人向け (For Corporations)
    { code: '3200', name: '資本金', accountType: AccountType.EQUITY, parentCode: '3000' },
    { code: '3210', name: '資本剰余金', accountType: AccountType.EQUITY, parentCode: '3000' },
    { code: '3220', name: '利益剰余金', accountType: AccountType.EQUITY, parentCode: '3000' },
    { code: '3221', name: '繰越利益剰余金', accountType: AccountType.EQUITY, parentCode: '3000' },
    { code: '3230', name: '自己株式', accountType: AccountType.EQUITY, parentCode: '3000' },
    {
      code: '3240',
      name: 'その他有価証券評価差額金',
      accountType: AccountType.EQUITY,
      parentCode: '3000',
    },

    // ========== 収益 (Revenue) ==========

    // 売上高 (Sales Revenue)
    { code: '4000', name: '売上高', accountType: AccountType.REVENUE, parentId: null },
    { code: '4110', name: '製品売上高', accountType: AccountType.REVENUE, parentCode: '4000' },
    { code: '4111', name: '商品売上高', accountType: AccountType.REVENUE, parentCode: '4000' },
    { code: '4112', name: 'サービス売上高', accountType: AccountType.REVENUE, parentCode: '4000' },
    { code: '4113', name: '受託開発売上高', accountType: AccountType.REVENUE, parentCode: '4000' },
    { code: '4120', name: '売上値引高', accountType: AccountType.REVENUE, parentCode: '4000' },
    { code: '4130', name: '売上戻り高', accountType: AccountType.REVENUE, parentCode: '4000' },
    { code: '4140', name: '売上割戻高', accountType: AccountType.REVENUE, parentCode: '4000' },

    // 営業外収益 (Non-operating Revenue)
    { code: '4500', name: '営業外収益', accountType: AccountType.REVENUE, parentId: null },
    { code: '4510', name: '受取利息', accountType: AccountType.REVENUE, parentCode: '4500' },
    { code: '4511', name: '受取配当金', accountType: AccountType.REVENUE, parentCode: '4500' },
    { code: '4520', name: '雑収入', accountType: AccountType.REVENUE, parentCode: '4500' },
    { code: '4521', name: '受取手数料', accountType: AccountType.REVENUE, parentCode: '4500' },
    { code: '4522', name: '受取家賃', accountType: AccountType.REVENUE, parentCode: '4500' },
    { code: '4523', name: '受取保険金', accountType: AccountType.REVENUE, parentCode: '4500' },
    { code: '4524', name: '助成金収入', accountType: AccountType.REVENUE, parentCode: '4500' },
    { code: '4525', name: '補助金収入', accountType: AccountType.REVENUE, parentCode: '4500' },
    { code: '4526', name: '為替差益', accountType: AccountType.REVENUE, parentCode: '4500' },
    { code: '4527', name: '仕入割引', accountType: AccountType.REVENUE, parentCode: '4500' },
    {
      code: '4528',
      name: 'スクラップ売却益',
      accountType: AccountType.REVENUE,
      parentCode: '4500',
    },

    // 特別利益 (Extraordinary Gains)
    { code: '4800', name: '特別利益', accountType: AccountType.REVENUE, parentId: null },
    { code: '4810', name: '固定資産売却益', accountType: AccountType.REVENUE, parentCode: '4800' },
    {
      code: '4820',
      name: '投資有価証券売却益',
      accountType: AccountType.REVENUE,
      parentCode: '4800',
    },
    { code: '4830', name: '債務免除益', accountType: AccountType.REVENUE, parentCode: '4800' },

    // ========== 費用 (Expenses) ==========

    // 売上原価 (Cost of Goods Sold)
    { code: '5000', name: '売上原価', accountType: AccountType.EXPENSE, parentId: null },
    { code: '5110', name: '仕入高', accountType: AccountType.EXPENSE, parentCode: '5000' },
    { code: '5111', name: '製品仕入高', accountType: AccountType.EXPENSE, parentCode: '5000' },
    { code: '5112', name: '商品仕入高', accountType: AccountType.EXPENSE, parentCode: '5000' },
    { code: '5120', name: '仕入値引高', accountType: AccountType.EXPENSE, parentCode: '5000' },
    { code: '5130', name: '仕入戻し高', accountType: AccountType.EXPENSE, parentCode: '5000' },
    { code: '5140', name: '外注費', accountType: AccountType.EXPENSE, parentCode: '5000' },
    { code: '5141', name: '外注加工費', accountType: AccountType.EXPENSE, parentCode: '5000' },
    { code: '5150', name: '労務費', accountType: AccountType.EXPENSE, parentCode: '5000' },
    { code: '5160', name: '製造経費', accountType: AccountType.EXPENSE, parentCode: '5000' },

    // 販売費及び一般管理費 (Selling, General & Administrative Expenses)
    {
      code: '6000',
      name: '販売費及び一般管理費',
      accountType: AccountType.EXPENSE,
      parentId: null,
    },

    // 人件費 (Personnel Expenses)
    { code: '6110', name: '給料手当', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6111', name: '役員給与', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6120', name: '役員報酬', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6130', name: '法定福利費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6131', name: '健康保険料', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6132', name: '厚生年金保険料', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6133', name: '雇用保険料', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6134', name: '労災保険料', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6140', name: '福利厚生費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6141', name: '退職金', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6142', name: '賞与', accountType: AccountType.EXPENSE, parentCode: '6000' },

    // 経費 (Operating Expenses)
    { code: '6150', name: '旅費交通費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6160', name: '通信費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6161', name: '電話代', accountType: AccountType.EXPENSE, parentCode: '6000' },
    {
      code: '6162',
      name: 'インターネット代',
      accountType: AccountType.EXPENSE,
      parentCode: '6000',
    },
    { code: '6170', name: '水道光熱費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6171', name: '電気代', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6172', name: 'ガス代', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6173', name: '水道代', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6180', name: '消耗品費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6190', name: '事務用品費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6200', name: '地代家賃', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6201', name: '家賃', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6202', name: '地代', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6210', name: '支払手数料', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6211', name: '銀行手数料', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6212', name: '振込手数料', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6213', name: '税理士報酬', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6214', name: '弁護士報酬', accountType: AccountType.EXPENSE, parentCode: '6000' },
    {
      code: '6215',
      name: 'コンサルティング費',
      accountType: AccountType.EXPENSE,
      parentCode: '6000',
    },
    { code: '6220', name: '広告宣伝費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6221', name: 'Web広告費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6222', name: '印刷費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6230', name: '接待交際費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6240', name: '会議費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6250', name: '減価償却費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6260', name: '修繕費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6270', name: '保険料', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6271', name: '車両保険料', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6272', name: '損害保険料', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6280', name: '仮払消費税', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6290', name: '雑費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6291', name: '新聞図書費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6292', name: '研修費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6293', name: 'ライセンス費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6294', name: 'リース料', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6295', name: '租税公課', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6296', name: '寄付金', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6297', name: '諸会費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6298', name: '車両費', accountType: AccountType.EXPENSE, parentCode: '6000' },
    { code: '6299', name: '支払報酬', accountType: AccountType.EXPENSE, parentCode: '6000' },

    // 営業外費用 (Non-operating Expenses)
    { code: '7000', name: '営業外費用', accountType: AccountType.EXPENSE, parentId: null },
    { code: '7110', name: '支払利息', accountType: AccountType.EXPENSE, parentCode: '7000' },
    { code: '7111', name: '借入利息', accountType: AccountType.EXPENSE, parentCode: '7000' },
    { code: '7112', name: '社債利息', accountType: AccountType.EXPENSE, parentCode: '7000' },
    { code: '7120', name: '雑損失', accountType: AccountType.EXPENSE, parentCode: '7000' },
    { code: '7121', name: '為替差損', accountType: AccountType.EXPENSE, parentCode: '7000' },
    { code: '7122', name: '売上割引', accountType: AccountType.EXPENSE, parentCode: '7000' },
    { code: '7123', name: '貸倒損失', accountType: AccountType.EXPENSE, parentCode: '7000' },
    {
      code: '7124',
      name: '減価償却費（営業外）',
      accountType: AccountType.EXPENSE,
      parentCode: '7000',
    },

    // 特別損失 (Extraordinary Losses)
    { code: '7800', name: '特別損失', accountType: AccountType.EXPENSE, parentId: null },
    { code: '7810', name: '固定資産売却損', accountType: AccountType.EXPENSE, parentCode: '7800' },
    { code: '7811', name: '固定資産除却損', accountType: AccountType.EXPENSE, parentCode: '7800' },
    {
      code: '7820',
      name: '投資有価証券売却損',
      accountType: AccountType.EXPENSE,
      parentCode: '7800',
    },
    { code: '7830', name: '債務保証損失', accountType: AccountType.EXPENSE, parentCode: '7800' },
    { code: '7840', name: '災害損失', accountType: AccountType.EXPENSE, parentCode: '7800' },

    // 税金 (Taxes)
    { code: '8000', name: '税金', accountType: AccountType.EXPENSE, parentId: null },
    { code: '8110', name: '法人税', accountType: AccountType.EXPENSE, parentCode: '8000' },
    { code: '8111', name: '住民税', accountType: AccountType.EXPENSE, parentCode: '8000' },
    { code: '8112', name: '事業税', accountType: AccountType.EXPENSE, parentCode: '8000' },
    { code: '8113', name: '消費税', accountType: AccountType.EXPENSE, parentCode: '8000' },
    { code: '8114', name: '固定資産税', accountType: AccountType.EXPENSE, parentCode: '8000' },
    { code: '8115', name: '印紙税', accountType: AccountType.EXPENSE, parentCode: '8000' },
    { code: '8116', name: '登録免許税', accountType: AccountType.EXPENSE, parentCode: '8000' },
  ];

  // Create parent accounts first
  const parentAccounts = new Map<string, string>();

  for (const account of accounts.filter((a) => !a.parentCode)) {
    const created = await prisma.account.create({
      data: {
        code: account.code,
        name: account.name,
        nameKana: account.nameKana,
        accountType: account.accountType,
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
        nameKana: account.nameKana,
        accountType: account.accountType,
        parentId: parentAccounts.get(account.parentCode || ''),
        organizationId: organization.id,
      },
    });
  }

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
        code: 'C002',
        name: '株式会社テクノロジー',
        nameKana: 'カブシキガイシャテクノロジー',
        partnerType: 'CUSTOMER',
        address: '東京都渋谷区渋谷2-21-1',
        phone: '03-3456-7890',
        email: 'contact@technology.co.jp',
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
    prisma.partner.create({
      data: {
        code: 'V002',
        name: '文具ショップ田中',
        nameKana: 'ブングショップタナカ',
        partnerType: 'VENDOR',
        address: '東京都台東区浅草1-1-1',
        phone: '03-4567-8901',
        email: 'info@tanaka-bungu.jp',
        organizationId: organization.id,
      },
    }),
    prisma.partner.create({
      data: {
        code: 'B001',
        name: '総合商社ABC',
        nameKana: 'ソウゴウショウシャエービーシー',
        partnerType: 'BOTH',
        address: '東京都港区六本木6-10-1',
        phone: '03-5678-9012',
        email: 'info@abc-trading.co.jp',
        taxId: '1234567890123',
        organizationId: organization.id,
      },
    }),
  ]);

  console.log('Created sample partners:', partners.length);

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
