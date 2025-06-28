import { Account, Prisma } from '@prisma/client';
import {
  CacheManager,
  createCacheManager,
  Cacheable,
  CacheInvalidate,
  Logger,
} from '@simple-bookkeeping/shared';

import { prisma } from '../lib/prisma';

export class CachedAccountService {
  private cache: CacheManager;
  private logger: Logger;

  constructor() {
    this.cache = createCacheManager();
    this.logger = new Logger({ component: 'CachedAccountService' });
  }

  /**
   * Get account by ID with caching
   * Cache key: AccountService:getById:{organizationId}:{accountId}
   * TTL: 1 hour
   */
  @Cacheable((args) => `${args[0]}:${args[1]}`, 3600)
  async getById(organizationId: string, accountId: string): Promise<Account | null> {
    this.logger.debug('Fetching account from database', { organizationId, accountId });

    return await prisma.account.findFirst({
      where: {
        id: accountId,
        organizationId,
      },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  /**
   * Get all accounts for organization with caching
   * Cache key: AccountService:getAllByOrganization:{organizationId}:{active?}
   * TTL: 30 minutes
   */
  @Cacheable((args) => `${args[0]}:${args[1] || 'all'}`, 1800)
  async getAllByOrganization(organizationId: string, isActive?: boolean): Promise<Account[]> {
    this.logger.debug('Fetching accounts from database', { organizationId, isActive });

    const where: Prisma.AccountWhereInput = {
      organizationId,
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return await prisma.account.findMany({
      where,
      include: {
        parent: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        _count: {
          select: {
            children: true,
          },
        },
      },
      orderBy: {
        code: 'asc',
      },
    });
  }

  /**
   * Get account tree (hierarchical structure) with caching
   * Cache key: AccountService:getAccountTree:{organizationId}
   * TTL: 30 minutes
   */
  @Cacheable((args) => args[0], 1800)
  async getAccountTree(organizationId: string): Promise<Account[]> {
    this.logger.debug('Fetching account tree from database', { organizationId });

    return await prisma.account.findMany({
      where: {
        parentId: null,
        organizationId,
      },
      include: {
        children: {
          include: {
            children: true,
          },
        },
      },
      orderBy: {
        code: 'asc',
      },
    });
  }

  /**
   * Create account and invalidate related caches
   * Invalidates: AccountService:getAllByOrganization:*, AccountService:getAccountTree:*
   */
  @CacheInvalidate(['AccountService:getAllByOrganization:*', 'AccountService:getAccountTree:*'])
  async create(organizationId: string, data: Prisma.AccountCreateInput): Promise<Account> {
    this.logger.info('Creating new account', { organizationId, code: data.code });

    const account = await prisma.account.create({
      data: {
        ...data,
        organization: {
          connect: { id: organizationId },
        },
      },
      include: {
        parent: true,
      },
    });

    // Also invalidate the specific account cache
    await this.cache.delete(`AccountService:getById:${organizationId}:${account.id}`);

    return account;
  }

  /**
   * Update account and invalidate related caches
   * Invalidates: Specific account cache and list caches
   */
  @CacheInvalidate(['AccountService:getAllByOrganization:*', 'AccountService:getAccountTree:*'])
  async update(
    organizationId: string,
    accountId: string,
    data: Prisma.AccountUpdateInput
  ): Promise<Account> {
    this.logger.info('Updating account', { organizationId, accountId });

    const account = await prisma.account.update({
      where: {
        id: accountId,
      },
      data,
      include: {
        parent: true,
      },
    });

    // Invalidate specific account cache
    await this.cache.delete(`AccountService:getById:${organizationId}:${accountId}`);

    return account;
  }

  /**
   * Soft delete (deactivate) account and invalidate caches
   */
  @CacheInvalidate(['AccountService:getAllByOrganization:*', 'AccountService:getAccountTree:*'])
  async deactivate(organizationId: string, accountId: string): Promise<Account> {
    this.logger.info('Deactivating account', { organizationId, accountId });

    const account = await prisma.account.update({
      where: {
        id: accountId,
      },
      data: {
        isActive: false,
      },
    });

    // Invalidate specific account cache
    await this.cache.delete(`AccountService:getById:${organizationId}:${accountId}`);

    return account;
  }

  /**
   * Warm up cache for an organization
   * Pre-loads commonly accessed data
   */
  async warmUpCache(organizationId: string): Promise<void> {
    this.logger.info('Warming up cache for organization', { organizationId });

    try {
      // Pre-load all active accounts
      await this.getAllByOrganization(organizationId, true);

      // Pre-load account tree
      await this.getAccountTree(organizationId);

      this.logger.info('Cache warm-up completed', { organizationId });
    } catch (error) {
      this.logger.error('Cache warm-up failed', error, { organizationId });
    }
  }

  /**
   * Clear all caches for an organization
   */
  async clearOrganizationCache(organizationId: string): Promise<void> {
    this.logger.info('Clearing cache for organization', { organizationId });

    await this.cache.deletePattern(`*:${organizationId}:*`);
  }
}

// Export singleton instance
export const cachedAccountService = new CachedAccountService();
