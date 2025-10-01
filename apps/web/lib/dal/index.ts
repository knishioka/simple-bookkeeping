/**
 * Data Access Layer (DAL) exports
 * Central export point for all DAL classes
 */

export { BaseDAL } from './base';
export type { DALConfig, QueryOptions, DALResult, DALListResult } from './base';

import { AccountsDAL as AccountsDALClass, accountsDAL as accountsInstance } from './accounts';
import { UsersDAL as UsersDALClass, usersDAL as usersInstance } from './users';

export { AccountsDALClass as AccountsDAL, accountsInstance as accountsDAL };
export type { AccountQueryOptions, AccountWithBalance } from './accounts';

export { UsersDALClass as UsersDAL, usersInstance as usersDAL };
export type { UserProfile, UserCompanyMembership } from './users';

/**
 * DAL Factory for creating DAL instances
 */
export class DALFactory {
  private static instances = new Map<string, unknown>();

  /**
   * Get or create a DAL instance
   */
  static get<T>(DALClass: new () => T): T {
    const className = DALClass.name;

    if (!this.instances.has(className)) {
      this.instances.set(className, new DALClass());
    }

    return this.instances.get(className) as T;
  }

  /**
   * Clear all DAL instances (useful for testing)
   */
  static clear(): void {
    this.instances.clear();
  }
}

// Export pre-configured instances
export const dal = {
  accounts: accountsInstance,
  users: usersInstance,
} as const;

export default dal;
