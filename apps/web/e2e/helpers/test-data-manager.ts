/**
 * E2Eテストデータ管理ユーティリティ
 *
 * Supabase環境でのテストデータのセットアップとクリーンアップを管理します。
 * テストの独立性を保つため、各テストケースで適切なデータの初期化と削除を行います。
 */

import { createClient } from '@supabase/supabase-js';

import { UserRole } from './supabase-auth';

/**
 * テスト組織データ
 */
export interface TestOrganization {
  id: string;
  name: string;
  plan: 'free' | 'standard' | 'premium';
  created_at: string;
}

/**
 * テスト勘定科目データ
 */
export interface TestAccount {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  balance: number;
}

/**
 * テスト仕訳データ
 */
export interface TestJournalEntry {
  id: string;
  organization_id: string;
  date: string;
  description: string;
  amount: number;
  debit_account_id: string;
  credit_account_id: string;
  status: 'draft' | 'posted' | 'canceled';
}

/**
 * テストデータマネージャークラス
 */
export class TestDataManager {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase test environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * テスト組織を作成
   */
  async createTestOrganization(overrides?: Partial<TestOrganization>): Promise<TestOrganization> {
    const defaultOrg: TestOrganization = {
      id: overrides?.id || `test-org-${Date.now()}`,
      name: overrides?.name || 'Test Organization',
      plan: overrides?.plan || 'standard',
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('organizations')
      .insert(defaultOrg)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test organization: ${error.message}`);
    }

    return data;
  }

  /**
   * テスト勘定科目を作成
   */
  async createTestAccounts(
    organizationId: string,
    accounts?: Partial<TestAccount>[]
  ): Promise<TestAccount[]> {
    const defaultAccounts: TestAccount[] = accounts?.map((acc, index) => ({
      id: acc.id || `test-account-${Date.now()}-${index}`,
      organization_id: organizationId,
      code: acc.code || `${1000 + index}`,
      name: acc.name || `Test Account ${index + 1}`,
      type: acc.type || 'asset',
      balance: acc.balance || 0,
      ...acc,
    })) || [
      {
        id: `test-cash-${Date.now()}`,
        organization_id: organizationId,
        code: '1001',
        name: '現金',
        type: 'asset',
        balance: 100000,
      },
      {
        id: `test-bank-${Date.now()}`,
        organization_id: organizationId,
        code: '1002',
        name: '普通預金',
        type: 'asset',
        balance: 500000,
      },
      {
        id: `test-revenue-${Date.now()}`,
        organization_id: organizationId,
        code: '4001',
        name: '売上高',
        type: 'revenue',
        balance: 0,
      },
      {
        id: `test-expense-${Date.now()}`,
        organization_id: organizationId,
        code: '5001',
        name: '仕入高',
        type: 'expense',
        balance: 0,
      },
    ];

    const { data, error } = await this.supabase.from('accounts').insert(defaultAccounts).select();

    if (error) {
      throw new Error(`Failed to create test accounts: ${error.message}`);
    }

    return data;
  }

  /**
   * テスト仕訳を作成
   */
  async createTestJournalEntry(
    organizationId: string,
    debitAccountId: string,
    creditAccountId: string,
    amount: number,
    description?: string
  ): Promise<TestJournalEntry> {
    const entry: TestJournalEntry = {
      id: `test-journal-${Date.now()}`,
      organization_id: organizationId,
      date: new Date().toISOString().split('T')[0],
      description: description || 'Test Journal Entry',
      amount,
      debit_account_id: debitAccountId,
      credit_account_id: creditAccountId,
      status: 'posted',
    };

    const { data, error } = await this.supabase
      .from('journal_entries')
      .insert(entry)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test journal entry: ${error.message}`);
    }

    return data;
  }

  /**
   * 組織に関連するすべてのデータを削除
   */
  async cleanupOrganizationData(organizationId: string): Promise<void> {
    // 仕訳を削除
    await this.supabase.from('journal_entries').delete().eq('organization_id', organizationId);

    // 勘定科目を削除
    await this.supabase.from('accounts').delete().eq('organization_id', organizationId);

    // 組織を削除
    await this.supabase.from('organizations').delete().eq('id', organizationId);
  }

  /**
   * テストユーザーに組織を割り当て
   */
  async assignUserToOrganization(
    userId: string,
    organizationId: string,
    role: UserRole
  ): Promise<void> {
    const { error } = await this.supabase.from('user_organizations').insert({
      user_id: userId,
      organization_id: organizationId,
      role,
      created_at: new Date().toISOString(),
    });

    if (error) {
      // 既に割り当て済みの場合はスキップ
      if (!error.message.includes('duplicate')) {
        throw new Error(`Failed to assign user to organization: ${error.message}`);
      }
    }
  }

  /**
   * 会計期間を作成
   */
  async createAccountingPeriod(
    organizationId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ id: string; start_date: string; end_date: string }> {
    const currentYear = new Date().getFullYear();
    const period = {
      id: `test-period-${Date.now()}`,
      organization_id: organizationId,
      start_date: startDate || `${currentYear}-01-01`,
      end_date: endDate || `${currentYear}-12-31`,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('accounting_periods')
      .insert(period)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create accounting period: ${error.message}`);
    }

    return data;
  }

  /**
   * すべてのテストデータをクリーンアップ
   */
  async cleanupAllTestData(): Promise<void> {
    // テスト組織のIDパターン（test-org-で始まる）
    const { data: organizations } = await this.supabase
      .from('organizations')
      .select('id')
      .like('id', 'test-org-%');

    if (organizations) {
      for (const org of organizations) {
        await this.cleanupOrganizationData(org.id);
      }
    }

    // テストユーザーの削除は supabase-auth.ts の cleanupAllTestUsers() で行う
  }

  /**
   * 完全なテスト環境をセットアップ
   */
  async setupCompleteTestEnvironment(role: UserRole = 'admin'): Promise<{
    organizationId: string;
    accounts: TestAccount[];
    periodId: string;
  }> {
    // 組織を作成
    const org = await this.createTestOrganization({
      id: `test-org-${role}-${Date.now()}`,
      name: `Test Organization for ${role}`,
    });

    // 会計期間を作成
    const period = await this.createAccountingPeriod(org.id);

    // 勘定科目を作成
    const accounts = await this.createTestAccounts(org.id);

    return {
      organizationId: org.id,
      accounts,
      periodId: period.id,
    };
  }

  /**
   * サンプル仕訳データを生成
   */
  async createSampleJournalEntries(
    organizationId: string,
    accounts: TestAccount[],
    count: number = 5
  ): Promise<TestJournalEntry[]> {
    const entries: TestJournalEntry[] = [];

    const cashAccount = accounts.find((a) => a.code === '1001');
    const bankAccount = accounts.find((a) => a.code === '1002');
    const revenueAccount = accounts.find((a) => a.code === '4001');
    const expenseAccount = accounts.find((a) => a.code === '5001');

    if (!cashAccount || !bankAccount || !revenueAccount || !expenseAccount) {
      throw new Error('Required accounts not found');
    }

    const sampleEntries = [
      {
        debit: cashAccount.id,
        credit: revenueAccount.id,
        amount: 50000,
        description: '現金売上',
      },
      {
        debit: expenseAccount.id,
        credit: cashAccount.id,
        amount: 20000,
        description: '仕入（現金）',
      },
      {
        debit: bankAccount.id,
        credit: revenueAccount.id,
        amount: 100000,
        description: '振込売上',
      },
      {
        debit: expenseAccount.id,
        credit: bankAccount.id,
        amount: 30000,
        description: '仕入（振込）',
      },
      {
        debit: cashAccount.id,
        credit: bankAccount.id,
        amount: 10000,
        description: '現金引き出し',
      },
    ];

    for (let i = 0; i < Math.min(count, sampleEntries.length); i++) {
      const sample = sampleEntries[i];
      const entry = await this.createTestJournalEntry(
        organizationId,
        sample.debit,
        sample.credit,
        sample.amount,
        sample.description
      );
      entries.push(entry);
    }

    return entries;
  }

  /**
   * データベース接続をテスト
   */
  async testConnection(): Promise<boolean> {
    try {
      const { error } = await this.supabase.from('organizations').select('count').single();
      return !error;
    } catch {
      return false;
    }
  }
}

/**
 * シングルトンインスタンス
 */
let testDataManagerInstance: TestDataManager | null = null;

/**
 * TestDataManager のシングルトンを取得
 */
export function getTestDataManager(): TestDataManager {
  if (!testDataManagerInstance) {
    testDataManagerInstance = new TestDataManager();
  }
  return testDataManagerInstance;
}

/**
 * E2Eテスト用のヘルパー関数
 */

/**
 * テスト前の環境セットアップ
 */
export async function setupTestEnvironment(role: UserRole = 'admin') {
  const manager = getTestDataManager();
  return await manager.setupCompleteTestEnvironment(role);
}

/**
 * テスト後のクリーンアップ
 */
export async function cleanupTestEnvironment(organizationId?: string) {
  const manager = getTestDataManager();

  if (organizationId) {
    await manager.cleanupOrganizationData(organizationId);
  } else {
    await manager.cleanupAllTestData();
  }
}

/**
 * サンプルデータ生成
 */
export async function generateSampleData(organizationId: string, accounts: TestAccount[]) {
  const manager = getTestDataManager();
  return await manager.createSampleJournalEntries(organizationId, accounts);
}
