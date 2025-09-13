import { faker } from '@faker-js/faker';
// Account types (migrated from @simple-bookkeeping/types)
const AccountType = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE',
} as const;

type AccountType = (typeof AccountType)[keyof typeof AccountType];

type AccountCategory =
  | 'current_asset'
  | 'fixed_asset'
  | 'current_liability'
  | 'long_term_liability'
  | 'equity'
  | 'operating_revenue'
  | 'operating_expense'
  | 'non_operating_revenue'
  | 'non_operating_expense';

interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  category: AccountCategory;
  description?: string;
  isActive: boolean;
  organizationId: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
  parent?: Account;
  children?: Account[];
}

/**
 * Factory for creating test account data
 */
export class AccountFactory {
  private static accountCounter = 1000;

  /**
   * Create a test account with optional overrides
   * @param overrides - Optional properties to override
   * @returns Account object
   */
  static create(overrides?: Partial<Account>): Account {
    const code = overrides?.code || `${this.accountCounter++}`;
    const now = new Date();

    return {
      id: faker.string.uuid(),
      code,
      name: faker.commerce.department(),
      type: this.randomAccountType(),
      category: this.randomCategory(),
      isActive: true,
      organizationId: faker.string.uuid(),
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  /**
   * Create multiple test accounts
   * @param count - Number of accounts to create
   * @param overrides - Optional properties to override for all accounts
   * @returns Array of Account objects
   */
  static createMany(count: number, overrides?: Partial<Account>): Account[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create a cash account
   * @param overrides - Optional properties to override
   * @returns Cash Account object
   */
  static createCashAccount(overrides?: Partial<Account>): Account {
    return this.create({
      code: '1010',
      name: '現金',
      type: AccountType.ASSET,
      category: 'current_asset' as AccountCategory,
      ...overrides,
    });
  }

  /**
   * Create a sales account
   * @param overrides - Optional properties to override
   * @returns Sales Account object
   */
  static createSalesAccount(overrides?: Partial<Account>): Account {
    return this.create({
      code: '4010',
      name: '売上高',
      type: AccountType.REVENUE,
      category: 'operating_revenue' as AccountCategory,
      ...overrides,
    });
  }

  /**
   * Create an expense account
   * @param overrides - Optional properties to override
   * @returns Expense Account object
   */
  static createExpenseAccount(overrides?: Partial<Account>): Account {
    return this.create({
      code: '5010',
      name: `${faker.commerce.productMaterial()}費`,
      type: AccountType.EXPENSE,
      category: 'operating_expense' as AccountCategory,
      ...overrides,
    });
  }

  /**
   * Create a standard chart of accounts
   * @param organizationId - Organization ID
   * @returns Array of standard accounts
   */
  static createChartOfAccounts(organizationId: string): Account[] {
    return [
      // Assets
      this.create({
        code: '1010',
        name: '現金',
        type: AccountType.ASSET,
        category: 'current_asset' as AccountCategory,
        organizationId,
      }),
      this.create({
        code: '1020',
        name: '普通預金',
        type: AccountType.ASSET,
        category: 'current_asset' as AccountCategory,
        organizationId,
      }),
      this.create({
        code: '1030',
        name: '売掛金',
        type: AccountType.ASSET,
        category: 'current_asset' as AccountCategory,
        organizationId,
      }),

      // Liabilities
      this.create({
        code: '2010',
        name: '買掛金',
        type: AccountType.LIABILITY,
        category: 'current_liability' as AccountCategory,
        organizationId,
      }),
      this.create({
        code: '2020',
        name: '未払金',
        type: AccountType.LIABILITY,
        category: 'current_liability' as AccountCategory,
        organizationId,
      }),

      // Equity
      this.create({
        code: '3010',
        name: '資本金',
        type: AccountType.EQUITY,
        category: 'equity' as AccountCategory,
        organizationId,
      }),

      // Revenue
      this.create({
        code: '4010',
        name: '売上高',
        type: AccountType.REVENUE,
        category: 'operating_revenue' as AccountCategory,
        organizationId,
      }),

      // Expenses
      this.create({
        code: '5010',
        name: '仕入高',
        type: AccountType.EXPENSE,
        category: 'operating_expense' as AccountCategory,
        organizationId,
      }),
      this.create({
        code: '5020',
        name: '給与手当',
        type: AccountType.EXPENSE,
        category: 'operating_expense' as AccountCategory,
        organizationId,
      }),
    ];
  }

  /**
   * Get a random account type
   * @returns Random account type
   */
  private static randomAccountType(): AccountType {
    const types = [
      AccountType.ASSET,
      AccountType.LIABILITY,
      AccountType.EQUITY,
      AccountType.REVENUE,
      AccountType.EXPENSE,
    ];
    return faker.helpers.arrayElement(types);
  }

  /**
   * Get a random category based on account type
   * @returns Random category
   */
  private static randomCategory(): AccountCategory {
    const categories: AccountCategory[] = [
      'current_asset',
      'fixed_asset',
      'current_liability',
      'long_term_liability',
      'equity',
      'operating_revenue',
      'operating_expense',
      'non_operating_revenue',
      'non_operating_expense',
    ];
    return faker.helpers.arrayElement(categories);
  }

  /**
   * Create account creation DTO (without id and timestamps)
   * @param overrides - Optional properties to override
   * @returns Account creation DTO
   */
  static createDTO(overrides?: Partial<Omit<Account, 'id' | 'createdAt' | 'updatedAt'>>) {
    const account = this.create(overrides as Partial<Account>);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, updatedAt, ...dto } = account;
    return dto;
  }
}
