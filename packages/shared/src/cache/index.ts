import { createClient, RedisClientType } from 'redis';

import { Logger } from '../logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Key prefix
}

export interface CacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<void>;
  flush(): Promise<void>;
  isConnected(): boolean;
}

export class RedisCacheManager implements CacheManager {
  private client: RedisClientType;
  private logger: Logger;
  private defaultTTL: number;
  private keyPrefix: string;
  private connected: boolean = false;

  constructor(
    redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379',
    defaultTTL: number = 3600, // 1 hour default
    keyPrefix: string = 'sb:'
  ) {
    this.logger = new Logger({ component: 'RedisCacheManager' });
    this.defaultTTL = defaultTTL;
    this.keyPrefix = keyPrefix;

    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            this.logger.error('Redis connection failed after 10 retries');
            return false;
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    this.client.on('error', (err: Error) => {
      this.logger.error('Redis client error', err);
      this.connected = false;
    });

    this.client.on('connect', () => {
      this.logger.info('Redis client connected');
      this.connected = true;
    });

    this.client.on('ready', () => {
      this.logger.info('Redis client ready');
      this.connected = true;
    });

    this.client.on('end', () => {
      this.logger.info('Redis client disconnected');
      this.connected = false;
    });

    // Connect to Redis
    this.connect();
  }

  private async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error);
    }
  }

  private getKey(key: string, prefix?: string): string {
    return `${prefix || this.keyPrefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.connected) {
      this.logger.debug('Cache miss - Redis not connected', { key });
      return null;
    }

    try {
      const fullKey = this.getKey(key);
      const value = await this.client.get(fullKey);

      if (!value) {
        this.logger.debug('Cache miss', { key: fullKey });
        return null;
      }

      this.logger.debug('Cache hit', { key: fullKey });
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error('Cache get error', error, { key });
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    if (!this.connected) {
      this.logger.debug('Cache set skipped - Redis not connected', { key });
      return;
    }

    try {
      const fullKey = this.getKey(key, options?.prefix);
      const ttl = options?.ttl || this.defaultTTL;
      const serialized = JSON.stringify(value);

      await this.client.setEx(fullKey, ttl, serialized);
      this.logger.debug('Cache set', { key: fullKey, ttl });
    } catch (error) {
      this.logger.error('Cache set error', error, { key });
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      const fullKey = this.getKey(key);
      await this.client.del(fullKey);
      this.logger.debug('Cache delete', { key: fullKey });
    } catch (error) {
      this.logger.error('Cache delete error', error, { key });
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      const fullPattern = this.getKey(pattern);
      const keys = await this.client.keys(fullPattern);

      if (keys.length > 0) {
        await this.client.del(keys);
        this.logger.debug('Cache pattern delete', { pattern: fullPattern, count: keys.length });
      }
    } catch (error) {
      this.logger.error('Cache pattern delete error', error, { pattern });
    }
  }

  async flush(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      await this.client.flushDb();
      this.logger.info('Cache flushed');
    } catch (error) {
      this.logger.error('Cache flush error', error);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
      this.connected = false;
      this.logger.info('Redis client disconnected');
    }
  }
}

// In-memory cache implementation for development/testing
export class InMemoryCacheManager implements CacheManager {
  private cache: Map<string, { value: unknown; expiresAt: number }> = new Map();
  private logger: Logger;
  private defaultTTL: number;
  private keyPrefix: string;

  constructor(defaultTTL: number = 3600, keyPrefix: string = 'sb:') {
    this.logger = new Logger({ component: 'InMemoryCacheManager' });
    this.defaultTTL = defaultTTL;
    this.keyPrefix = keyPrefix;

    // Clean up expired entries every minute
    setInterval(() => this.cleanupExpired(), 60000);
  }

  private getKey(key: string, prefix?: string): string {
    return `${prefix || this.keyPrefix}${key}`;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug('Cleaned up expired cache entries', { count: cleaned });
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.getKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      this.logger.debug('Cache miss', { key: fullKey });
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(fullKey);
      this.logger.debug('Cache miss (expired)', { key: fullKey });
      return null;
    }

    this.logger.debug('Cache hit', { key: fullKey });
    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.getKey(key, options?.prefix);
    const ttl = options?.ttl || this.defaultTTL;
    const expiresAt = Date.now() + ttl * 1000;

    this.cache.set(fullKey, { value, expiresAt });
    this.logger.debug('Cache set', { key: fullKey, ttl });
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getKey(key);
    this.cache.delete(fullKey);
    this.logger.debug('Cache delete', { key: fullKey });
  }

  async deletePattern(pattern: string): Promise<void> {
    const fullPattern = this.getKey(pattern);
    // eslint-disable-next-line security/detect-non-literal-regexp -- pattern is from internal cache operations
    const regex = new RegExp(`^${fullPattern.replace(/\*/g, '.*')}$`);
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    this.logger.debug('Cache pattern delete', { pattern: fullPattern, count: deleted });
  }

  async flush(): Promise<void> {
    this.cache.clear();
    this.logger.info('Cache flushed');
  }

  isConnected(): boolean {
    return true; // Always connected for in-memory
  }
}

// Factory function to create appropriate cache manager
export function createCacheManager(): CacheManager {
  const useRedis = process.env.REDIS_URL && process.env.NODE_ENV === 'production';

  if (useRedis) {
    return new RedisCacheManager(
      process.env.REDIS_URL,
      parseInt(process.env.CACHE_DEFAULT_TTL || '3600'),
      process.env.CACHE_KEY_PREFIX || 'sb:'
    );
  }

  return new InMemoryCacheManager(
    parseInt(process.env.CACHE_DEFAULT_TTL || '3600'),
    process.env.CACHE_KEY_PREFIX || 'sb:'
  );
}

// Cache decorators for easy method caching
export function Cacheable(keyGenerator?: (args: unknown[]) => string, ttl?: number) {
  return function (target: object, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      // Get cache instance from the class
      const cache = (this as { cache?: CacheManager }).cache;
      if (!cache || !cache.isConnected()) {
        return method.apply(this, args);
      }

      // Generate cache key
      const baseKey = `${target.constructor.name}:${propertyName}`;
      const key = keyGenerator ? `${baseKey}:${keyGenerator(args)}` : baseKey;

      // Try to get from cache
      const cached = await cache.get(key);
      if (cached !== null) {
        return cached;
      }

      // Execute method and cache result
      const result = await method.apply(this, args);
      await cache.set(key, result, { ttl });

      return result;
    };

    return descriptor;
  };
}

// Cache invalidation decorator
export function CacheInvalidate(patterns: string[]) {
  return function (target: object, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const result = await method.apply(this, args);

      // Invalidate cache after successful execution
      const cache = (this as { cache?: CacheManager }).cache;
      if (cache && cache.isConnected()) {
        for (const pattern of patterns) {
          await cache.deletePattern(pattern);
        }
      }

      return result;
    };

    return descriptor;
  };
}
