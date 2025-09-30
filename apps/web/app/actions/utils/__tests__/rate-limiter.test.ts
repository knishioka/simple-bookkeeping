import { headers } from 'next/headers';

import { ERROR_CODES } from '../../types';
import {
  checkRateLimit,
  rateLimitMiddleware,
  withRateLimit,
  resetRateLimit,
  clearAllRateLimits,
  RATE_LIMIT_CONFIGS,
  RateLimitConfig,
} from '../rate-limiter';

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn(),
}));

const mockHeaders = headers as jest.MockedFunction<typeof headers>;

describe('Rate Limiter', () => {
  beforeEach(() => {
    // Clear all rate limits before each test
    clearAllRateLimits();
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    const testConfig: RateLimitConfig = {
      maxRequests: 3,
      windowMs: 1000, // 1 second
      keyPrefix: 'test',
    };

    it('should allow requests within limit', async () => {
      mockHeaders.mockResolvedValue({
        get: jest.fn().mockReturnValue('192.168.1.1'),
      } as any);

      const result1 = await checkRateLimit(testConfig);
      expect(result1.allowed).toBe(true);
      expect(result1.retryAfter).toBeUndefined();

      const result2 = await checkRateLimit(testConfig);
      expect(result2.allowed).toBe(true);

      const result3 = await checkRateLimit(testConfig);
      expect(result3.allowed).toBe(true);
    });

    it('should block requests exceeding limit', async () => {
      mockHeaders.mockResolvedValue({
        get: jest.fn().mockReturnValue('192.168.1.1'),
      } as any);

      // Make max requests
      for (let i = 0; i < testConfig.maxRequests; i++) {
        const result = await checkRateLimit(testConfig);
        expect(result.allowed).toBe(true);
      }

      // Next request should be blocked
      const blockedResult = await checkRateLimit(testConfig);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.retryAfter).toBeGreaterThan(0);
      expect(blockedResult.retryAfter).toBeLessThanOrEqual(1);
    });

    it('should reset after window expires', async () => {
      mockHeaders.mockResolvedValue({
        get: jest.fn().mockReturnValue('192.168.1.1'),
      } as any);

      const shortConfig: RateLimitConfig = {
        maxRequests: 1,
        windowMs: 100, // 100ms
        keyPrefix: 'short',
      };

      // First request should succeed
      const result1 = await checkRateLimit(shortConfig);
      expect(result1.allowed).toBe(true);

      // Second request should be blocked
      const result2 = await checkRateLimit(shortConfig);
      expect(result2.allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Request should succeed again
      const result3 = await checkRateLimit(shortConfig);
      expect(result3.allowed).toBe(true);
    });

    it('should track different users separately', async () => {
      mockHeaders.mockResolvedValue({
        get: jest.fn().mockReturnValue('192.168.1.1'),
      } as any);

      const configWithUser: RateLimitConfig = {
        maxRequests: 2,
        windowMs: 1000,
        keyPrefix: 'user',
      };

      // User 1 requests
      const user1Result1 = await checkRateLimit(configWithUser, 'user1');
      const user1Result2 = await checkRateLimit(configWithUser, 'user1');
      const user1Result3 = await checkRateLimit(configWithUser, 'user1');

      expect(user1Result1.allowed).toBe(true);
      expect(user1Result2.allowed).toBe(true);
      expect(user1Result3.allowed).toBe(false); // User 1 blocked

      // User 2 should still be allowed
      const user2Result1 = await checkRateLimit(configWithUser, 'user2');
      expect(user2Result1.allowed).toBe(true);
    });

    it('should use different IP addresses from headers', async () => {
      const config: RateLimitConfig = {
        maxRequests: 1,
        windowMs: 1000,
      };

      // Test x-forwarded-for header
      mockHeaders.mockResolvedValueOnce({
        get: jest.fn((header) => {
          if (header === 'x-forwarded-for') return '10.0.0.1, 10.0.0.2';
          return null;
        }),
      } as any);

      const result1 = await checkRateLimit(config);
      expect(result1.allowed).toBe(true);

      // Test x-real-ip header
      mockHeaders.mockResolvedValueOnce({
        get: jest.fn((header) => {
          if (header === 'x-real-ip') return '10.0.0.3';
          return null;
        }),
      } as any);

      const result2 = await checkRateLimit(config);
      expect(result2.allowed).toBe(true); // Different IP, should be allowed

      // Test cf-connecting-ip header
      mockHeaders.mockResolvedValueOnce({
        get: jest.fn((header) => {
          if (header === 'cf-connecting-ip') return '10.0.0.4';
          return null;
        }),
      } as any);

      const result3 = await checkRateLimit(config);
      expect(result3.allowed).toBe(true); // Different IP, should be allowed
    });

    it('should handle missing headers gracefully', async () => {
      // Mock console.warn to prevent output during test
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      mockHeaders.mockRejectedValue(new Error('Headers not available'));

      const config: RateLimitConfig = {
        maxRequests: 2,
        windowMs: 1000,
      };

      const result = await checkRateLimit(config);
      expect(result.allowed).toBe(true);

      // When headers fail, it uses 'unknown' as the identifier
      // All requests with same prefix and 'unknown' share the same limit
      const result2 = await checkRateLimit(config);
      expect(result2.allowed).toBe(true);

      const result3 = await checkRateLimit(config);
      expect(result3.allowed).toBe(false); // Should enforce limits even with 'unknown'

      // Verify console.warn was called
      expect(consoleWarnSpy).toHaveBeenCalled();

      // Restore console.warn
      consoleWarnSpy.mockRestore();
    });
  });

  describe('rateLimitMiddleware', () => {
    it('should return undefined when rate limit not exceeded', async () => {
      mockHeaders.mockResolvedValue({
        get: jest.fn().mockReturnValue('192.168.1.1'),
      } as any);

      const config: RateLimitConfig = {
        maxRequests: 5,
        windowMs: 1000,
      };

      const result = await rateLimitMiddleware(config);
      expect(result).toBeUndefined();
    });

    it('should return error result when rate limit exceeded', async () => {
      mockHeaders.mockResolvedValue({
        get: jest.fn().mockReturnValue('192.168.1.1'),
      } as any);

      const config: RateLimitConfig = {
        maxRequests: 1,
        windowMs: 1000,
      };

      // First request should pass
      const result1 = await rateLimitMiddleware(config);
      expect(result1).toBeUndefined();

      // Second request should be blocked
      const result2 = await rateLimitMiddleware(config);
      expect(result2).toBeDefined();
      expect(result2?.success).toBe(false);
      expect(result2?.error?.code).toBe(ERROR_CODES.LIMIT_EXCEEDED);
      expect((result2?.error?.details as any)?.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('withRateLimit', () => {
    it('should wrap action with rate limiting', async () => {
      mockHeaders.mockResolvedValue({
        get: jest.fn().mockReturnValue('192.168.1.1'),
      } as any);

      const mockAction = jest.fn().mockResolvedValue({
        success: true,
        data: { result: 'success' },
      });

      const config: RateLimitConfig = {
        maxRequests: 2,
        windowMs: 1000,
      };

      const rateLimitedAction = withRateLimit(mockAction, config);

      // First two calls should succeed
      const result1 = await rateLimitedAction({ test: 'data' });
      expect(result1.success).toBe(true);
      expect(mockAction).toHaveBeenCalledWith({ test: 'data' });

      const result2 = await rateLimitedAction({ test: 'data2' });
      expect(result2.success).toBe(true);
      expect(mockAction).toHaveBeenCalledTimes(2);

      // Third call should be rate limited
      const result3 = await rateLimitedAction({ test: 'data3' });
      expect(result3.success).toBe(false);
      expect(result3.error?.code).toBe(ERROR_CODES.LIMIT_EXCEEDED);
      expect(mockAction).toHaveBeenCalledTimes(2); // Should not call the action
    });

    it('should extract userId from first argument if available', async () => {
      mockHeaders.mockResolvedValue({
        get: jest.fn().mockReturnValue('192.168.1.1'),
      } as any);

      const mockAction = jest.fn().mockResolvedValue({
        success: true,
        data: { result: 'success' },
      });

      const config: RateLimitConfig = {
        maxRequests: 1,
        windowMs: 1000,
        keyPrefix: 'user-action',
      };

      const rateLimitedAction = withRateLimit(mockAction, config);

      // Call with userId in first argument
      const result1 = await rateLimitedAction({ userId: 'user123', data: 'test' });
      expect(result1.success).toBe(true);

      // Same user should be rate limited
      const result2 = await rateLimitedAction({ userId: 'user123', data: 'test2' });
      expect(result2.success).toBe(false);

      // Different user should succeed
      const result3 = await rateLimitedAction({ userId: 'user456', data: 'test3' });
      expect(result3.success).toBe(true);
    });

    it('should handle actions with multiple arguments', async () => {
      mockHeaders.mockResolvedValue({
        get: jest.fn().mockReturnValue('192.168.1.1'),
      } as any);

      const mockAction = jest.fn().mockResolvedValue({
        success: true,
        data: { result: 'success' },
      });

      const config: RateLimitConfig = {
        maxRequests: 2,
        windowMs: 1000,
      };

      const rateLimitedAction = withRateLimit(mockAction, config);

      // Call with multiple arguments
      const result = await rateLimitedAction('arg1', 'arg2', { key: 'value' });
      expect(result.success).toBe(true);
      expect(mockAction).toHaveBeenCalledWith('arg1', 'arg2', { key: 'value' });
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for specific key', async () => {
      mockHeaders.mockResolvedValue({
        get: jest.fn().mockReturnValue('192.168.1.1'),
      } as any);

      const config: RateLimitConfig = {
        maxRequests: 1,
        windowMs: 10000, // Long window
        keyPrefix: 'reset-test',
      };

      // Exhaust rate limit
      await checkRateLimit(config);
      const blocked = await checkRateLimit(config);
      expect(blocked.allowed).toBe(false);

      // Reset rate limit
      resetRateLimit('reset-test', '192.168.1.1');

      // Should be allowed again
      const afterReset = await checkRateLimit(config);
      expect(afterReset.allowed).toBe(true);
    });
  });

  describe('clearAllRateLimits', () => {
    it('should clear all rate limits', async () => {
      mockHeaders.mockResolvedValue({
        get: jest.fn().mockReturnValue('192.168.1.1'),
      } as any);

      const config1: RateLimitConfig = {
        maxRequests: 1,
        windowMs: 10000,
        keyPrefix: 'test1',
      };

      const config2: RateLimitConfig = {
        maxRequests: 1,
        windowMs: 10000,
        keyPrefix: 'test2',
      };

      // Exhaust both rate limits
      await checkRateLimit(config1);
      await checkRateLimit(config2);

      const blocked1 = await checkRateLimit(config1);
      const blocked2 = await checkRateLimit(config2);
      expect(blocked1.allowed).toBe(false);
      expect(blocked2.allowed).toBe(false);

      // Clear all rate limits
      clearAllRateLimits();

      // Both should be allowed again
      const afterClear1 = await checkRateLimit(config1);
      const afterClear2 = await checkRateLimit(config2);
      expect(afterClear1.allowed).toBe(true);
      expect(afterClear2.allowed).toBe(true);
    });
  });

  describe('RATE_LIMIT_CONFIGS', () => {
    it('should have correct default configurations', () => {
      expect(RATE_LIMIT_CONFIGS.DELETE).toEqual({
        maxRequests: 5,
        windowMs: 60000,
        keyPrefix: 'delete',
      });

      expect(RATE_LIMIT_CONFIGS.CREATE).toEqual({
        maxRequests: 20,
        windowMs: 60000,
        keyPrefix: 'create',
      });

      expect(RATE_LIMIT_CONFIGS.UPDATE).toEqual({
        maxRequests: 30,
        windowMs: 60000,
        keyPrefix: 'update',
      });

      expect(RATE_LIMIT_CONFIGS.READ).toEqual({
        maxRequests: 100,
        windowMs: 60000,
        keyPrefix: 'read',
      });

      expect(RATE_LIMIT_CONFIGS.SENSITIVE).toEqual({
        maxRequests: 3,
        windowMs: 60000,
        keyPrefix: 'sensitive',
      });
    });
  });

  describe('Interval cleanup', () => {
    it('should clean up expired entries periodically', async () => {
      // Note: This test is more conceptual as we can't easily test the interval
      // In a real implementation, you might want to expose a method to trigger cleanup
      // or use dependency injection for the timer

      mockHeaders.mockResolvedValue({
        get: jest.fn().mockReturnValue('192.168.1.1'),
      } as any);

      const config: RateLimitConfig = {
        maxRequests: 1,
        windowMs: 100, // Very short window
      };

      // Create an entry
      await checkRateLimit(config);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // The entry should be cleaned up on next access or by the interval
      const result = await checkRateLimit(config);
      expect(result.allowed).toBe(true);
    });
  });
});
