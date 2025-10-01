/**
 * Accounts Data Access Layer
 * Handles all account-related database operations
 */

import { BaseDAL, type DALResult, type DALListResult, type QueryOptions } from './base';

import type { Database } from '@simple-bookkeeping/database';

type Account = Database['public']['Tables']['accounts']['Row'];
type AccountInsert = Database['public']['Tables']['accounts']['Insert'];
type AccountUpdate = Database['public']['Tables']['accounts']['Update'];

/**
 * Account-specific query options
 */
export interface AccountQueryOptions extends QueryOptions {
  companyId?: string;
  fiscalYearId?: string;
  accountType?: string;
  isActive?: boolean;
  parentId?: string | null;
}

/**
 * Account with computed fields
 */
export interface AccountWithBalance extends Account {
  balance?: number;
  childrenCount?: number;
}

/**
 * Account with children count from database query
 */
interface AccountWithChildrenCount extends Account {
  children?: Array<{ count: number }>;
}

/**
 * Journal entry item for balance calculation
 */
interface JournalEntryItem {
  debit_amount: number | null;
  credit_amount: number | null;
}

/**
 * Accounts Data Access Layer
 */
export class AccountsDAL extends BaseDAL<Account> {
  constructor() {
    super({
      tableName: 'accounts',
      enableCache: true,
      cacheTimeout: 300000, // 5 minutes
    });
  }

  /**
   * Find accounts for a specific company
   */
  async findByCompany(
    companyId: string,
    options: AccountQueryOptions = {}
  ): Promise<DALListResult<Account>> {
    const filters: Record<string, unknown> = {
      company_id: companyId,
      ...options.filters,
    };

    if (options.fiscalYearId) {
      filters.fiscal_year_id = options.fiscalYearId;
    }

    if (options.accountType) {
      filters.account_type = options.accountType;
    }

    if (options.isActive !== undefined) {
      filters.is_active = options.isActive;
    }

    if (options.parentId !== undefined) {
      filters.parent_id = options.parentId;
    }

    return this.findMany({
      ...options,
      filters,
      orderBy: options.orderBy ?? 'code',
      orderDirection: options.orderDirection ?? 'asc',
    });
  }

  /**
   * Get account hierarchy (tree structure)
   */
  async getAccountTree(companyId: string): Promise<DALResult<AccountWithBalance[]>> {
    return this.executeQuery<AccountWithBalance[]>(
      async () => {
        const supabase = await this.getSupabase();
        // Get all accounts for the company
        const { data: accounts, error } = await supabase
          .from('accounts')
          .select(
            `
            *,
            children:accounts!parent_id(count)
          `
          )
          .eq('company_id', companyId)
          .order('code');

        if (error) return { data: null, error };

        // Build tree structure
        const accountMap = new Map<string, AccountWithBalance>();
        const rootAccounts: AccountWithBalance[] = [];

        // First pass: create map
        const typedAccounts = accounts as unknown as AccountWithChildrenCount[];
        typedAccounts?.forEach((account) => {
          accountMap.set(account.id, {
            ...account,
            childrenCount: account.children?.[0]?.count || 0,
          });
        });

        // Second pass: build tree
        accountMap.forEach((account) => {
          if (!account.parent_id) {
            rootAccounts.push(account);
          }
        });

        return { data: rootAccounts, error: null };
      },
      { cacheKey: this.getAccountsCacheKey('getAccountTree', { companyId }) }
    );
  }

  /**
   * Get account with balance
   */
  async getAccountWithBalance(
    accountId: string,
    fiscalYearId: string
  ): Promise<DALResult<AccountWithBalance>> {
    return this.executeQuery<AccountWithBalance>(
      async () => {
        const supabase = await this.getSupabase();
        // Get account details
        const { data: account, error: accountError } = await supabase
          .from('accounts')
          .select('*')
          .eq('id', accountId)
          .single();

        if (accountError) return { data: null, error: accountError };

        // Calculate balance from journal entries
        const { data: balanceData, error: balanceError } = await supabase
          .from('journal_entry_items')
          .select('debit_amount, credit_amount')
          .eq('account_id', accountId)
          .eq('fiscal_year_id', fiscalYearId);

        if (balanceError) return { data: null, error: balanceError };

        const typedBalanceData = balanceData as unknown as JournalEntryItem[];
        const balance =
          typedBalanceData?.reduce((sum, item) => {
            const debit = item.debit_amount || 0;
            const credit = item.credit_amount || 0;
            return sum + (debit - credit);
          }, 0) || 0;

        const typedAccount = account as unknown as Account;
        return {
          data: {
            ...typedAccount,
            balance,
          },
          error: null,
        };
      },
      { cacheKey: this.getAccountsCacheKey('getAccountWithBalance', { accountId, fiscalYearId }) }
    );
  }

  /**
   * Create a new account
   */
  async createAccount(data: AccountInsert): Promise<DALResult<Account>> {
    // Validate account code uniqueness
    const exists = await this.exists({
      company_id: data.company_id,
      code: data.code,
    });

    if (exists) {
      return {
        data: null,
        error: new Error('Account code already exists'),
        success: false,
      };
    }

    // Validate parent account if specified
    if (data.parent_id) {
      const parentExists = await this.exists({
        id: data.parent_id,
        company_id: data.company_id,
      });

      if (!parentExists) {
        return {
          data: null,
          error: new Error('Parent account not found'),
          success: false,
        };
      }
    }

    return this.create(data);
  }

  /**
   * Update an account
   */
  async updateAccount(accountId: string, data: AccountUpdate): Promise<DALResult<Account>> {
    // If updating code, check uniqueness
    if (data.code) {
      const { data: account } = await this.findById(accountId);
      if (account && account.code !== data.code) {
        const exists = await this.exists({
          company_id: account.company_id,
          code: data.code,
        });

        if (exists) {
          return {
            data: null,
            error: new Error('Account code already exists'),
            success: false,
          };
        }
      }
    }

    return this.update(accountId, data);
  }

  /**
   * Get account types for a company
   */
  async getAccountTypes(companyId: string): Promise<string[]> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from('accounts')
      .select('account_type')
      .eq('company_id', companyId)
      .not('account_type', 'is', null);

    if (error) {
      console.error('Failed to fetch account types:', error);
      return [];
    }

    const typedData = data as unknown as Array<{ account_type: string }>;
    const types = new Set(typedData?.map((a) => a.account_type).filter(Boolean) || []);
    return Array.from(types).sort();
  }

  /**
   * Search accounts by name or code
   */
  async searchAccounts(companyId: string, searchTerm: string): Promise<DALListResult<Account>> {
    return this.executeQuery<Account[]>(async () => {
      const supabase = await this.getSupabase();
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('company_id', companyId)
        .or(`name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`)
        .order('code')
        .limit(20);

      return { data: data || [], error };
    }).then((result) => ({
      data: result.data || [],
      error: result.error,
      success: result.success,
    }));
  }

  /**
   * Get cache key for custom methods
   */
  private getAccountsCacheKey(method: string, params: unknown): string {
    return `accounts:${method}:${JSON.stringify(params)}`;
  }
}

// Export singleton instance
export const accountsDAL = new AccountsDAL();

export default AccountsDAL;
