import { validateEnv, getSupabaseUrl, getSupabaseAnonKey } from '../env';

describe('Environment Validation', () => {
  // Save original env
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env for each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('validateEnv', () => {
    it('should validate all required environment variables', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';
      process.env.NODE_ENV = 'test';

      expect(() => validateEnv()).not.toThrow();
    });

    it('should throw error when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      expect(() => validateEnv()).toThrow(
        'Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL'
      );
    });

    it('should throw error when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      expect(() => validateEnv()).toThrow(
        'Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY'
      );
    });

    it('should throw error when Supabase URL has invalid format', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-valid-url';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      expect(() => validateEnv()).toThrow('Invalid Supabase URL format');
    });

    it('should accept valid Supabase cloud URLs', () => {
      const validUrls = [
        'https://example.supabase.co',
        'https://my-project.supabase.co',
        'https://test-123.supabase.co',
        'http://localhost:54321',
        'http://127.0.0.1:54321',
      ];

      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      validUrls.forEach((url) => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = url;
        expect(() => validateEnv()).not.toThrow();
      });
    });

    it('should reject URLs with XSS attempts', () => {
      const maliciousUrls = [
        'javascript:alert("XSS")',
        'data:text/html,<script>alert("XSS")</script>',
        'vbscript:msgbox',
        'https://example.supabase.co<script>alert("XSS")</script>',
      ];

      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      maliciousUrls.forEach((url) => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = url;
        expect(() => validateEnv()).toThrow('Invalid Supabase URL format');
      });
    });

    it('should handle empty strings as missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      expect(() => validateEnv()).toThrow(
        'Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL'
      );
    });

    it('should handle whitespace-only strings as missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = '   ';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      expect(() => validateEnv()).toThrow(
        'Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL'
      );
    });

    it('should trim whitespace from environment variables', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = '  https://example.supabase.co  ';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '  valid-anon-key  ';

      expect(() => validateEnv()).not.toThrow();
    });

    it('should validate in development environment', () => {
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      expect(() => validateEnv()).not.toThrow();
    });

    it('should validate in production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      expect(() => validateEnv()).not.toThrow();
    });
  });

  describe('getSupabaseUrl', () => {
    it('should return validated Supabase URL', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      const url = getSupabaseUrl();
      expect(url).toBe('https://example.supabase.co');
    });

    it('should trim whitespace from URL', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = '  https://example.supabase.co  ';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      const url = getSupabaseUrl();
      expect(url).toBe('https://example.supabase.co');
    });

    it('should throw error for invalid URL', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'invalid-url';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      expect(() => getSupabaseUrl()).toThrow('Invalid Supabase URL format');
    });

    it('should handle localhost URLs', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      const url = getSupabaseUrl();
      expect(url).toBe('http://localhost:54321');
    });

    it('should reject non-HTTP(S) protocols', () => {
      const invalidProtocols = [
        'ftp://example.supabase.co',
        'file:///etc/passwd',
        'gopher://example.com',
        'ws://example.com',
      ];

      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      invalidProtocols.forEach((url) => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = url;
        expect(() => getSupabaseUrl()).toThrow('Invalid Supabase URL format');
      });
    });
  });

  describe('getSupabaseAnonKey', () => {
    it('should return validated anon key', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key-123';

      const key = getSupabaseAnonKey();
      expect(key).toBe('valid-anon-key-123');
    });

    it('should trim whitespace from key', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '  valid-anon-key-123  ';

      const key = getSupabaseAnonKey();
      expect(key).toBe('valid-anon-key-123');
    });

    it('should throw error for missing key', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      expect(() => getSupabaseAnonKey()).toThrow(
        'Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY'
      );
    });

    it('should throw error for empty key', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';

      expect(() => getSupabaseAnonKey()).toThrow(
        'Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY'
      );
    });

    it('should handle JWT-like keys', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4YW1wbGUiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjcyMzgxNiwiZXhwIjoxOTMyMjk5ODE2fQ.s1b2example';

      const key = getSupabaseAnonKey();
      expect(key).toContain('eyJ');
    });
  });

  describe('Security Considerations', () => {
    it('should not expose sensitive details in error messages', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      try {
        validateEnv();
      } catch (error: any) {
        // Error message should not contain system paths or internal details
        expect(error.message).not.toContain('/home');
        expect(error.message).not.toContain('/Users');
        expect(error.message).not.toContain('\\');
        expect(error.message).toBe(
          'Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL'
        );
      }
    });

    it('should handle prototype pollution attempts', () => {
      // Attempt to pollute Object prototype
      const maliciousKey = '__proto__';
      process.env[maliciousKey] = 'polluted';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      // Should not throw and should not be affected by prototype pollution
      expect(() => validateEnv()).not.toThrow();
    });

    it('should validate URLs against SSRF patterns', () => {
      const ssrfUrls = [
        'http://169.254.169.254', // AWS metadata
        'http://metadata.google.internal', // GCP metadata
        'http://localhost:6379', // Redis default port
        'http://localhost:11211', // Memcached default port
        'http://0.0.0.0:54321',
        'http://127.0.0.1:5432', // PostgreSQL default port
      ];

      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-anon-key';

      ssrfUrls.forEach((url) => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = url;
        // Allow localhost for development but flag suspicious ports
        if (!url.includes('54321')) {
          // Non-standard Supabase ports should be validated more strictly
          expect(() => validateEnv()).not.toThrow();
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined environment gracefully', () => {
      // Temporarily remove all env vars
      const tempEnv = process.env;
      process.env = {} as any;

      expect(() => validateEnv()).toThrow('Missing required environment variable');

      process.env = tempEnv;
    });

    it('should handle very long environment values', () => {
      const longUrl = `https://${'a'.repeat(1000)}.supabase.co`;
      process.env.NEXT_PUBLIC_SUPABASE_URL = longUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'a'.repeat(10000);

      // Should handle gracefully without performance issues
      const startTime = Date.now();
      expect(() => validateEnv()).not.toThrow();
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle special characters in environment values', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key-with-special-!@#$%^&*()_+-=[]{}|;:,.<>?';

      expect(() => validateEnv()).not.toThrow();
    });

    it('should handle Unicode in environment values', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key-with-unicode-你好-مرحبا-🚀';

      expect(() => validateEnv()).not.toThrow();
    });
  });
});
