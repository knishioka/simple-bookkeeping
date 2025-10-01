/**
 * Base Data Access Layer (DAL) class
 * Provides common functionality for all DAL classes
 */

import { logErrorSecurely } from '@/lib/error-messages';
import { createClient } from '@/lib/supabase';

import type { Database } from '@simple-bookkeeping/database';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Base DAL configuration
 */
export interface DALConfig {
  tableName: string;
  enableCache?: boolean;
  cacheTimeout?: number;
}

/**
 * Query options for list operations
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
}

/**
 * Result wrapper for DAL operations
 */
export interface DALResult<T> {
  data: T | null;
  error: Error | null;
  success: boolean;
}

/**
 * List result with pagination info
 */
export interface DALListResult<T> {
  data: T[];
  error: Error | null;
  success: boolean;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Abstract base class for Data Access Layer
 */
export abstract class BaseDAL<T> {
  protected supabasePromise: Promise<SupabaseClient<Database>>;
  protected tableName: string;
  protected enableCache: boolean;
  protected cacheTimeout: number;
  private cache: Map<string, { data: T; timestamp: number }> = new Map();

  constructor(config: DALConfig) {
    this.tableName = config.tableName;
    this.enableCache = config.enableCache ?? false;
    this.cacheTimeout = config.cacheTimeout ?? 60000; // 1 minute default
    this.supabasePromise = this.initSupabase();
  }

  /**
   * Initialize Supabase client
   */
  private async initSupabase(): Promise<SupabaseClient<Database>> {
    return (await createClient()) as SupabaseClient<Database>;
  }

  /**
   * Get Supabase client
   */
  protected async getSupabase(): Promise<SupabaseClient<Database>> {
    return await this.supabasePromise;
  }

  /**
   * Get current authenticated user
   */
  protected async getCurrentUser() {
    const supabase = await this.getSupabase();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new Error('User not authenticated');
    }

    return user;
  }

  /**
   * Get cache key for a query
   */
  private getCacheKey(method: string, params: unknown): string {
    return `${this.tableName}:${method}:${JSON.stringify(params)}`;
  }

  /**
   * Get cached data if available and not expired
   */
  private getCachedData<R>(key: string): R | null {
    if (!this.enableCache) return null;

    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as unknown as R;
  }

  /**
   * Set cached data
   */
  private setCachedData(key: string, data: T): void {
    if (!this.enableCache) return;

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache for this DAL
   */
  protected clearCache(): void {
    this.cache.clear();
  }

  /**
   * Execute a query with error handling and optional caching
   */
  protected async executeQuery<R>(
    queryFn: () => Promise<{ data: R | null; error: unknown }>,
    options?: {
      cacheKey?: string;
      skipCache?: boolean;
    }
  ): Promise<DALResult<R>> {
    try {
      // Check cache first
      if (options?.cacheKey && !options.skipCache) {
        const cached = this.getCachedData<R>(options.cacheKey);
        if (cached) {
          return {
            data: cached,
            error: null,
            success: true,
          };
        }
      }

      // Execute query
      const { data, error } = await queryFn();

      if (error) {
        const errorObj = error as { message?: string };
        logErrorSecurely({
          error,
          context: { tableName: this.tableName },
        });
        return {
          data: null,
          error: new Error(errorObj.message || 'Database operation failed'),
          success: false,
        };
      }

      // Cache successful result
      if (options?.cacheKey && data) {
        this.setCachedData(options.cacheKey, data as unknown as T);
      }

      return {
        data,
        error: null,
        success: true,
      };
    } catch (error) {
      logErrorSecurely({
        error,
        context: { tableName: this.tableName },
      });
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
        success: false,
      };
    }
  }

  /**
   * Find a single record by ID
   */
  async findById(id: string): Promise<DALResult<T>> {
    const cacheKey = this.getCacheKey('findById', { id });

    return this.executeQuery<T>(
      async () => {
        const supabase = await this.getSupabase();
        return await supabase.from(this.tableName).select('*').eq('id', id).single();
      },
      { cacheKey }
    );
  }

  /**
   * Find multiple records with filters
   */
  async findMany(options: QueryOptions = {}): Promise<DALListResult<T>> {
    const cacheKey = this.getCacheKey('findMany', options);
    const cached = this.getCachedData<DALListResult<T>>(cacheKey);
    if (cached) return cached;

    try {
      const supabase = await this.getSupabase();
      let query = supabase.from(this.tableName).select('*', { count: 'exact' });

      // Apply filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });
      }

      // Apply sorting
      if (options.orderBy) {
        query = query.order(options.orderBy, {
          ascending: options.orderDirection !== 'desc',
        });
      }

      // Apply pagination
      const limit = options.limit ?? 50;
      const offset = options.offset ?? 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        logErrorSecurely({
          error,
          context: { tableName: this.tableName, options },
        });
        return {
          data: [],
          error: new Error(error.message || 'Failed to fetch records'),
          success: false,
        };
      }

      const result: DALListResult<T> = {
        data: (data as T[]) || [],
        error: null,
        success: true,
        pagination: {
          total: count ?? 0,
          limit,
          offset,
          hasNext: (count ?? 0) > offset + limit,
          hasPrev: offset > 0,
        },
      };

      if (this.enableCache) {
        this.setCachedData(cacheKey, result as unknown as T);
      }

      return result;
    } catch (error) {
      logErrorSecurely({
        error,
        context: { tableName: this.tableName, options },
      });
      return {
        data: [],
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
        success: false,
      };
    }
  }

  /**
   * Create a new record
   */
  async create(data: Partial<T>): Promise<DALResult<T>> {
    this.clearCache(); // Invalidate cache on write

    return this.executeQuery<T>(async () => {
      const user = await this.getCurrentUser();
      const supabase = await this.getSupabase();
      const enrichedData = {
        ...data,
        created_by: user.id,
        created_at: new Date().toISOString(),
      } as Record<string, unknown>;

      return await supabase
        .from(this.tableName)
        .insert(enrichedData as never)
        .select()
        .single();
    });
  }

  /**
   * Update a record by ID
   */
  async update(id: string, data: Partial<T>): Promise<DALResult<T>> {
    this.clearCache(); // Invalidate cache on write

    return this.executeQuery<T>(async () => {
      const user = await this.getCurrentUser();
      const supabase = await this.getSupabase();
      const enrichedData = {
        ...data,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>;

      return await supabase
        .from(this.tableName)
        .update(enrichedData as never)
        .eq('id', id)
        .select()
        .single();
    });
  }

  /**
   * Delete a record by ID (soft delete if supported)
   */
  async delete(id: string, soft: boolean = true): Promise<DALResult<boolean>> {
    this.clearCache(); // Invalidate cache on write

    if (soft) {
      // Soft delete - update deleted_at timestamp
      return this.executeQuery<boolean>(async () => {
        const user = await this.getCurrentUser();
        const supabase = await this.getSupabase();
        const updateData = {
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        } as Record<string, unknown>;
        const { error } = await supabase
          .from(this.tableName)
          .update(updateData as never)
          .eq('id', id);

        return { data: !error, error };
      });
    } else {
      // Hard delete
      return this.executeQuery<boolean>(async () => {
        const supabase = await this.getSupabase();
        const { error } = await supabase.from(this.tableName).delete().eq('id', id);

        return { data: !error, error };
      });
    }
  }

  /**
   * Check if a record exists
   */
  async exists(filters: Record<string, unknown>): Promise<boolean> {
    const supabase = await this.getSupabase();
    let query = supabase.from(this.tableName).select('id');

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });

    const { data, error } = await query.limit(1);

    if (error) {
      logErrorSecurely({
        error,
        context: { tableName: this.tableName, filters },
      });
      return false;
    }

    return (data?.length ?? 0) > 0;
  }

  /**
   * Count records with optional filters
   */
  async count(filters?: Record<string, unknown>): Promise<number> {
    const supabase = await this.getSupabase();
    let query = supabase.from(this.tableName).select('*', { count: 'exact', head: true });

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }

    const { count, error } = await query;

    if (error) {
      logErrorSecurely({
        error,
        context: { tableName: this.tableName, filters },
      });
      return 0;
    }

    return count ?? 0;
  }

  /**
   * Execute a raw SQL query (use with caution)
   */
  protected async executeRawQuery<R>(sql: string, params?: unknown[]): Promise<DALResult<R>> {
    try {
      const supabase = await this.getSupabase();
      const rpcParams = {
        query: sql,
        params: params ?? [],
      } as Record<string, unknown>;
      const { data, error } = await supabase.rpc('exec_sql', rpcParams as never);

      if (error) {
        logErrorSecurely({
          error,
          context: { sql, params },
        });
        return {
          data: null,
          error: new Error(error.message || 'Raw query failed'),
          success: false,
        };
      }

      return {
        data: data as R,
        error: null,
        success: true,
      };
    } catch (error) {
      logErrorSecurely({
        error,
        context: { sql, params },
      });
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error occurred'),
        success: false,
      };
    }
  }
}

export default BaseDAL;
