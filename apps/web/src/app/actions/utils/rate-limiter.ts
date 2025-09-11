/**
 * Rate Limiting for Server Actions
 *
 * Implements in-memory rate limiting for sensitive operations like delete actions
 */

import { headers } from 'next/headers';

import { createRateLimitErrorResult } from '../types';

import type { ActionResult } from '../types';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limit tracking
// In production, consider using Redis or a similar distributed cache
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    rateLimitStore.forEach((entry, key) => {
      if (entry.resetTime < now) {
        rateLimitStore.delete(key);
      }
    });
  },
  5 * 60 * 1000
);

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

/**
 * Default rate limit configurations for different operation types
 */
export const RATE_LIMIT_CONFIGS = {
  // Delete operations: 5 requests per minute
  DELETE: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
    keyPrefix: 'delete',
  },
  // Create operations: 20 requests per minute
  CREATE: {
    maxRequests: 20,
    windowMs: 60 * 1000,
    keyPrefix: 'create',
  },
  // Update operations: 30 requests per minute
  UPDATE: {
    maxRequests: 30,
    windowMs: 60 * 1000,
    keyPrefix: 'update',
  },
  // Read operations: 100 requests per minute
  READ: {
    maxRequests: 100,
    windowMs: 60 * 1000,
    keyPrefix: 'read',
  },
  // Sensitive operations (like closing accounting periods): 3 requests per minute
  SENSITIVE: {
    maxRequests: 3,
    windowMs: 60 * 1000,
    keyPrefix: 'sensitive',
  },
} as const;

/**
 * Get client identifier from request headers
 */
async function getClientIdentifier(userId?: string): Promise<string> {
  // In test environment, skip headers() call
  if (process.env.NODE_ENV === 'test') {
    return userId || 'test-client';
  }

  try {
    const headersList = await headers();

    // Try to get IP address
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
      headersList.get('x-real-ip') ||
      headersList.get('cf-connecting-ip') ||
      'unknown';

    // Combine with user ID if available for more accurate tracking
    return userId ? `${userId}:${ip}` : ip;
  } catch (error) {
    console.warn('Unable to get client identifier:', error);
    return userId || 'unknown';
  }
}

/**
 * Check rate limit for a given operation
 *
 * @param config - Rate limit configuration
 * @param userId - Optional user ID for more accurate tracking
 * @returns true if within rate limit, false if exceeded
 */
export async function checkRateLimit(
  config: RateLimitConfig,
  userId?: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const clientId = await getClientIdentifier(userId);
  const key = config.keyPrefix ? `${config.keyPrefix}:${clientId}` : clientId;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    // New window or expired entry
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return { allowed: true };
  }

  if (entry.count >= config.maxRequests) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(key, entry);
  return { allowed: true };
}

/**
 * Rate limit middleware for Server Actions
 *
 * @param config - Rate limit configuration
 * @param userId - Optional user ID
 * @returns ActionResult with error if rate limit exceeded, undefined otherwise
 */
export async function rateLimitMiddleware(
  config: RateLimitConfig,
  userId?: string
): Promise<ActionResult<never> | undefined> {
  const { allowed, retryAfter } = await checkRateLimit(config, userId);

  if (!allowed) {
    return createRateLimitErrorResult(retryAfter);
  }

  return undefined;
}

/**
 * Higher-order function to wrap Server Actions with rate limiting
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withRateLimit<T extends (...args: any[]) => any>(
  action: T,
  config: RateLimitConfig
): T {
  const wrappedAction = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    // Try to extract userId from the first argument if it's an object with userId
    let userId: string | undefined;
    if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
      const firstArg = args[0] as Record<string, unknown>;
      if (typeof firstArg.userId === 'string') {
        userId = firstArg.userId;
      }
    }

    const rateLimitResult = await rateLimitMiddleware(config, userId);
    if (rateLimitResult) {
      // Cast is safe because rate limit error has the same shape as ActionResult<T>
      // The error case of ActionResult doesn't depend on the generic T
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return rateLimitResult as any;
    }

    return action(...args);
  };

  return wrappedAction as T;
}

/**
 * Reset rate limit for a specific key (useful for testing)
 */
export function resetRateLimit(keyPrefix: string, identifier: string): void {
  const key = `${keyPrefix}:${identifier}`;
  rateLimitStore.delete(key);
}

/**
 * Clear all rate limits (useful for testing)
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
}
