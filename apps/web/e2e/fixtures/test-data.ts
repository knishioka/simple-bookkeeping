/**
 * E2Eテスト用の共通テストデータ
 *
 * すべてのテストで一貫したデータを使用することで、
 * テストの安定性と保守性を向上させます。
 */

/**
 * 勘定科目のテストデータ
 */
export const TestAccounts = {
  // 資産勘定
  cash: {
    id: '550e8400-e29b-41d4-a716-446655440001',
    code: '1110',
    name: '現金',
    accountType: 'ASSET' as const,
    parentId: null,
  },

  bankAccount: {
    id: '550e8400-e29b-41d4-a716-446655440002',
    code: '1120',
    name: '普通預金',
    accountType: 'ASSET' as const,
    parentId: null,
  },

  accountsReceivable: {
    id: '550e8400-e29b-41d4-a716-446655440003',
    code: '1310',
    name: '売掛金',
    accountType: 'ASSET' as const,
    parentId: null,
  },

  // 負債勘定
  accountsPayable: {
    id: '550e8400-e29b-41d4-a716-446655440004',
    code: '2110',
    name: '買掛金',
    accountType: 'LIABILITY' as const,
    parentId: null,
  },

  // 収益勘定
  sales: {
    id: '550e8400-e29b-41d4-a716-446655440005',
    code: '4110',
    name: '売上高',
    accountType: 'REVENUE' as const,
    parentId: null,
  },

  // 費用勘定
  utilities: {
    id: '550e8400-e29b-41d4-a716-446655440006',
    code: '5210',
    name: '水道光熱費',
    accountType: 'EXPENSE' as const,
    parentId: null,
  },

  // 追加の勘定科目（テスト用）
  testAsset: {
    id: '550e8400-e29b-41d4-a716-446655440007',
    code: '1900',
    name: 'テスト資産',
    accountType: 'ASSET' as const,
    parentId: null,
  },
};

/**
 * 勘定科目の配列（API レスポンス用）
 */
export const TestAccountsList = Object.values(TestAccounts);

/**
 * 仕訳入力のテストデータ
 */
export const TestJournalEntries = {
  simpleSale: {
    id: '660e8400-e29b-41d4-a716-446655440001',
    entryNumber: 'JE-2024-001',
    entryDate: '2024-03-15',
    description: '商品売上',
    lines: [
      {
        id: '770e8400-e29b-41d4-a716-446655440001',
        accountId: TestAccounts.cash.id,
        accountCode: TestAccounts.cash.code,
        accountName: TestAccounts.cash.name,
        debitAmount: 100000,
        creditAmount: 0,
        description: '現金売上',
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440002',
        accountId: TestAccounts.sales.id,
        accountCode: TestAccounts.sales.code,
        accountName: TestAccounts.sales.name,
        debitAmount: 0,
        creditAmount: 100000,
        description: '商品売上',
      },
    ],
  },

  creditSale: {
    id: '660e8400-e29b-41d4-a716-446655440002',
    entryNumber: 'JE-2024-002',
    entryDate: '2024-03-16',
    description: '掛売上',
    lines: [
      {
        id: '770e8400-e29b-41d4-a716-446655440003',
        accountId: TestAccounts.accountsReceivable.id,
        accountCode: TestAccounts.accountsReceivable.code,
        accountName: TestAccounts.accountsReceivable.name,
        debitAmount: 200000,
        creditAmount: 0,
        description: '掛売上',
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440004',
        accountId: TestAccounts.sales.id,
        accountCode: TestAccounts.sales.code,
        accountName: TestAccounts.sales.name,
        debitAmount: 0,
        creditAmount: 200000,
        description: '商品売上',
      },
    ],
  },

  paymentReceived: {
    id: '660e8400-e29b-41d4-a716-446655440003',
    entryNumber: 'JE-2024-003',
    entryDate: '2024-03-17',
    description: '売掛金回収',
    lines: [
      {
        id: '770e8400-e29b-41d4-a716-446655440005',
        accountId: TestAccounts.bankAccount.id,
        accountCode: TestAccounts.bankAccount.code,
        accountName: TestAccounts.bankAccount.name,
        debitAmount: 200000,
        creditAmount: 0,
        description: '銀行振込',
      },
      {
        id: '770e8400-e29b-41d4-a716-446655440006',
        accountId: TestAccounts.accountsReceivable.id,
        accountCode: TestAccounts.accountsReceivable.code,
        accountName: TestAccounts.accountsReceivable.name,
        debitAmount: 0,
        creditAmount: 200000,
        description: '売掛金回収',
      },
    ],
  },
};

/**
 * 仕訳の配列（API レスポンス用）
 */
export const TestJournalEntriesList = Object.values(TestJournalEntries);

/**
 * フォーム入力用のテストデータ
 */
export const FormTestData = {
  validAccount: {
    code: '1999',
    name: 'テスト勘定科目',
    type: '資産',
  },

  invalidAccount: {
    code: '', // 空のコード（バリデーションエラー）
    name: 'テスト勘定科目',
    type: '資産',
  },

  duplicateCodeAccount: {
    code: '1110', // 既存のコード（重複エラー）
    name: '重複テスト',
    type: '資産',
  },

  validJournalEntry: {
    date: '2024-03-20',
    description: 'テスト仕訳入力',
    lines: [
      {
        accountCode: '1110',
        debitAmount: 50000,
        creditAmount: 0,
        description: 'テスト借方',
      },
      {
        accountCode: '4110',
        debitAmount: 0,
        creditAmount: 50000,
        description: 'テスト貸方',
      },
    ],
  },

  unbalancedJournalEntry: {
    date: '2024-03-20',
    description: '不一致テスト仕訳',
    lines: [
      {
        accountCode: '1110',
        debitAmount: 50000,
        creditAmount: 0,
        description: 'テスト借方',
      },
      {
        accountCode: '4110',
        debitAmount: 0,
        creditAmount: 30000, // 意図的に不一致
        description: 'テスト貸方',
      },
    ],
  },
};

/**
 * ユーザーストーリーテスト用のペルソナデータ
 */
export const PersonaData = {
  freelancerDesigner: {
    name: '田中さん',
    role: 'フリーランスデザイナー',
    businessType: '個人事業主',
    monthlyRevenue: 500000,
    clients: ['ABC株式会社', 'XYZ商事', 'DEF企画'],
  },

  smallBusinessOwner: {
    name: '佐藤さん',
    role: '小規模事業者',
    businessType: '法人',
    monthlyRevenue: 2000000,
    employees: 5,
  },
};

/**
 * ダッシュボード表示用のテストデータ
 */
export const DashboardTestData = {
  summary: {
    yesterday: {
      revenue: 150000,
      expenses: 30000,
      profit: 120000,
    },
    monthToDate: {
      revenue: 2500000,
      expenses: 500000,
      profit: 2000000,
    },
    yearOverYear: {
      revenue: { current: 2500000, previous: 2000000, growth: 25 },
      profit: { current: 2000000, previous: 1500000, growth: 33.3 },
    },
  },

  chartData: {
    dailyRevenue: [
      { date: '2024-03-01', amount: 120000 },
      { date: '2024-03-02', amount: 150000 },
      { date: '2024-03-03', amount: 180000 },
      { date: '2024-03-04', amount: 200000 },
      { date: '2024-03-05', amount: 160000 },
    ],
  },
};

/**
 * エラーメッセージのテストデータ
 */
export const ErrorMessages = {
  validation: {
    required: 'この項目は必須です',
    codeRequired: '勘定科目コードを入力してください',
    nameRequired: '勘定科目名を入力してください',
    typeRequired: '勘定科目タイプを選択してください',
    duplicateCode: '既に存在する勘定科目コードです',
    balanceMismatch: '借方と貸方の合計が一致していません',
    invalidAmount: '金額は0以上の数値を入力してください',
  },

  network: {
    connectionFailed: '通信エラーが発生しました',
    serverError: 'サーバーで問題が発生しました',
    timeout: 'リクエストがタイムアウトしました',
  },

  auth: {
    tokenExpired: 'セッションが期限切れです',
    unauthorized: '認証が必要です',
    forbidden: 'この操作を行う権限がありません',
  },
};

/**
 * 成功メッセージのテストデータ
 */
export const SuccessMessages = {
  account: {
    created: '勘定科目を作成しました',
    updated: '勘定科目を更新しました',
    deleted: '勘定科目を削除しました',
  },

  journalEntry: {
    created: '仕訳を作成しました',
    updated: '仕訳を更新しました',
    deleted: '仕訳を削除しました',
  },
};
