import {
  getSecureErrorMessage,
  logErrorSecurely,
  sanitizeErrorForLogging,
  createErrorResponse,
  isErrorType,
  ErrorType,
  Language,
} from '../error-messages';

// Mock console methods
const originalConsoleError = console.error;
let consoleErrorMock: jest.Mock;

// Mock isProduction
jest.mock('@/lib/env', () => ({
  isProduction: jest.fn(() => false),
}));

beforeEach(() => {
  consoleErrorMock = jest.fn();
  console.error = consoleErrorMock;
});

afterEach(() => {
  console.error = originalConsoleError;
});

describe('Error Message Security', () => {
  describe('getSecureErrorMessage', () => {
    describe('Authentication Errors', () => {
      it('should return generic message for invalid credentials', () => {
        const errors = [
          new Error('Invalid email or password'),
          new Error('User not found'),
          new Error('Password incorrect'),
          new Error('Account does not exist'),
          new Error('Invalid login credentials'),
          new Error('authentication failed'),
        ];

        errors.forEach((error) => {
          const message = getSecureErrorMessage(error, Language.EN);
          expect(message).toBe('Invalid credentials');
          expect(message).not.toContain('email');
          expect(message).not.toContain('password');
          expect(message).not.toContain('user');
        });
      });

      it('should handle authentication error codes', () => {
        const errorCodes = [
          'auth/invalid-credentials',
          'auth/user-not-found',
          'auth/wrong-password',
        ];

        errorCodes.forEach((code) => {
          const message = getSecureErrorMessage(code, Language.EN);
          expect(message).toBe('Invalid email or password');
        });
      });

      it('should handle expired session errors', () => {
        const message = getSecureErrorMessage('auth/expired-token', Language.EN);
        expect(message).toBe('Session expired. Please login again');
      });
    });

    describe('Database Errors', () => {
      it('should sanitize database connection errors', () => {
        const errors = [
          new Error('Connection to database failed at 192.168.1.1:5432'),
          new Error('ECONNREFUSED 10.0.0.1:5432'),
          new Error('PostgreSQL connection timeout'),
          new Error('Cannot connect to MySQL server'),
          new Error('database query failed'),
        ];

        errors.forEach((error) => {
          const message = getSecureErrorMessage(error, Language.EN);
          expect(message).toBe('Database error occurred');
          expect(message).not.toContain('192.168');
          expect(message).not.toContain('5432');
          expect(message).not.toContain('PostgreSQL');
          expect(message).not.toContain('MySQL');
        });
      });
    });

    describe('Network Errors', () => {
      it('should sanitize network errors', () => {
        const errors = [
          new Error('fetch failed: https://api.internal.com/secret'),
          new Error('Network request failed'),
          new Error('ENOTFOUND api.example.com'),
          new Error('connection refused'),
        ];

        errors.forEach((error) => {
          const message = getSecureErrorMessage(error, Language.EN);
          expect(message).toBe('Network error. Please check your connection');
          expect(message).not.toContain('api.internal.com');
          expect(message).not.toContain('10.0.0.1');
        });
      });
    });

    describe('Permission Errors', () => {
      it('should sanitize permission errors', () => {
        const errors = [
          new Error('User 12345 does not have permission to access resource 67890'),
          new Error('Access denied to /admin/users'),
          new Error('Insufficient privileges for operation DELETE on table accounts'),
          new Error('permission denied'),
          new Error('unauthorized access'),
        ];

        errors.forEach((error) => {
          const message = getSecureErrorMessage(error, Language.EN);
          expect(message).toBe('You do not have permission to perform this action');
          expect(message).not.toContain('12345');
          expect(message).not.toContain('67890');
          expect(message).not.toContain('/admin');
          expect(message).not.toContain('DELETE');
          expect(message).not.toContain('accounts');
        });
      });
    });

    describe('Validation Errors', () => {
      it('should handle validation error codes', () => {
        expect(getSecureErrorMessage('validation/invalid-email', Language.EN)).toBe(
          'Please enter a valid email address'
        );
        expect(getSecureErrorMessage('validation/required-field', Language.EN)).toBe(
          'This field is required'
        );
        expect(getSecureErrorMessage('validation/invalid-format', Language.EN)).toBe(
          'Invalid format'
        );
      });

      it('should handle validation errors from Error objects', () => {
        const errors = [
          new Error('validation failed'),
          new Error('invalid input'),
          new Error('field is required'),
        ];

        errors.forEach((error) => {
          const message = getSecureErrorMessage(error, Language.EN);
          expect(message).toBe('Invalid input provided');
        });
      });
    });

    describe('Rate Limiting Errors', () => {
      it('should handle rate limit errors', () => {
        const errors = [
          new Error('Rate limit exceeded'),
          new Error('Too many requests'),
          new Error('too many attempts'),
        ];

        errors.forEach((error) => {
          const message = getSecureErrorMessage(error, Language.EN);
          expect(message).toBe('Too many requests. Please try again later');
        });
      });

      it('should handle specific rate limit codes', () => {
        const message = getSecureErrorMessage('rate-limit/too-many-attempts', Language.EN);
        expect(message).toBe('Too many login attempts. Please try again in 15 minutes');
      });
    });

    describe('Edge Cases', () => {
      it('should handle null and undefined', () => {
        expect(getSecureErrorMessage(null, Language.EN)).toBe(
          'A server error occurred. Please try again later'
        );
        expect(getSecureErrorMessage(undefined, Language.EN)).toBe(
          'A server error occurred. Please try again later'
        );
      });

      it('should handle non-error objects', () => {
        expect(getSecureErrorMessage('unknown-error-code', Language.EN)).toBe(
          'A server error occurred. Please try again later'
        );
        expect(getSecureErrorMessage(123, Language.EN)).toBe(
          'A server error occurred. Please try again later'
        );
        expect(getSecureErrorMessage({}, Language.EN)).toBe(
          'A server error occurred. Please try again later'
        );
        expect(getSecureErrorMessage([], Language.EN)).toBe(
          'A server error occurred. Please try again later'
        );
      });

      it('should handle errors with no message', () => {
        expect(getSecureErrorMessage(new Error(), Language.EN)).toBe(
          'A server error occurred. Please try again later'
        );
        expect(getSecureErrorMessage(new Error(''), Language.EN)).toBe(
          'A server error occurred. Please try again later'
        );
      });
    });

    describe('Language Support', () => {
      it('should return Japanese messages by default', () => {
        const error = new Error('authentication failed');
        const message = getSecureErrorMessage(error);
        expect(message).toBe('認証情報が正しくありません');
      });

      it('should return English messages when specified', () => {
        const error = new Error('authentication failed');
        const message = getSecureErrorMessage(error, Language.EN);
        expect(message).toBe('Invalid credentials');
      });

      it('should handle all error types in both languages', () => {
        const errorTypes = [
          {
            error: new Error('auth failed'),
            type: 'authentication',
            ja: '認証情報が正しくありません',
            en: 'Invalid credentials',
          },
          {
            error: new Error('permission denied'),
            type: 'authorization',
            ja: 'このアクションを実行する権限がありません',
            en: 'You do not have permission to perform this action',
          },
          {
            error: new Error('validation error'),
            type: 'validation',
            ja: '入力内容に問題があります',
            en: 'Invalid input provided',
          },
          {
            error: new Error('not found'),
            type: 'not_found',
            ja: 'リソースが見つかりません',
            en: 'Resource not found',
          },
          {
            error: new Error('rate limit'),
            type: 'rate_limit',
            ja: 'リクエストが多すぎます。しばらくしてからお試しください',
            en: 'Too many requests. Please try again later',
          },
          {
            error: new Error('network error'),
            type: 'network',
            ja: 'ネットワークエラーが発生しました。接続を確認してください',
            en: 'Network error. Please check your connection',
          },
          {
            error: new Error('database error'),
            type: 'database',
            ja: 'データベースエラーが発生しました',
            en: 'Database error occurred',
          },
        ];

        errorTypes.forEach(({ error, ja, en }) => {
          expect(getSecureErrorMessage(error)).toBe(ja);
          expect(getSecureErrorMessage(error, Language.EN)).toBe(en);
        });
      });
    });
  });

  describe('logErrorSecurely', () => {
    it('should log errors with context in development', () => {
      const error = new Error('Test error');
      logErrorSecurely({
        error,
        context: { action: 'login' },
        userId: '123',
        sessionId: 'session-456',
      });

      expect(consoleErrorMock).toHaveBeenCalledWith(
        'Application Error (Development)',
        expect.objectContaining({
          error,
          context: { action: 'login' },
          userId: '123',
          sessionId: 'session-456',
          timestamp: expect.any(String),
          environment: 'test',
        })
      );
    });

    it('should use anonymous defaults when IDs not provided', () => {
      const error = new Error('Test error');
      logErrorSecurely({ error });

      expect(consoleErrorMock).toHaveBeenCalledWith(
        'Application Error (Development)',
        expect.objectContaining({
          userId: 'anonymous',
          sessionId: 'no-session',
        })
      );
    });
  });

  describe('sanitizeErrorForLogging', () => {
    it('should remove email addresses', () => {
      const error = 'User user@example.com not found';
      const sanitized = sanitizeErrorForLogging(error);
      expect(sanitized).toBe('User [REDACTED] not found');
      expect(sanitized).not.toContain('@example.com');
    });

    it('should remove potential API keys and tokens', () => {
      const error = 'Invalid token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdefghijklmnopqrstuvwxyz';
      const sanitized = sanitizeErrorForLogging(error);
      expect(sanitized).toContain('[REDACTED]');
      expect(sanitized).not.toContain('eyJ');
    });

    it('should remove Bearer tokens', () => {
      const error = 'Authorization failed: Bearer sk_live_1234567890abcdef';
      const sanitized = sanitizeErrorForLogging(error);
      expect(sanitized).toBe('Authorization failed: [REDACTED]');
      expect(sanitized).not.toContain('Bearer');
      expect(sanitized).not.toContain('sk_live');
    });

    it('should handle Error objects', () => {
      const error = new Error('Email user@test.com is invalid');
      const sanitized = sanitizeErrorForLogging(error);
      expect(sanitized).toBe('Email [REDACTED] is invalid');
    });
  });

  describe('createErrorResponse', () => {
    it('should create standardized error response', () => {
      const error = new Error('authentication failed');
      const response = createErrorResponse(error, Language.EN);

      expect(response).toMatchObject({
        success: false,
        error: {
          message: 'Invalid credentials',
          type: ErrorType.AUTHENTICATION,
          code: 'authentication failed', // In development
        },
        timestamp: expect.any(String),
      });
    });

    it('should handle string errors', () => {
      const response = createErrorResponse('auth/invalid-credentials', Language.EN);

      expect(response).toMatchObject({
        success: false,
        error: {
          message: 'Invalid email or password',
          type: ErrorType.SERVER_ERROR,
          code: 'auth/invalid-credentials',
        },
      });
    });

    it('should default to Japanese language', () => {
      const error = new Error('network error');
      const response = createErrorResponse(error);

      expect(response.error.message).toBe(
        'ネットワークエラーが発生しました。接続を確認してください'
      );
    });
  });

  describe('isErrorType', () => {
    it('should correctly identify error types', () => {
      expect(isErrorType(new Error('authentication failed'), ErrorType.AUTHENTICATION)).toBe(true);
      expect(isErrorType(new Error('permission denied'), ErrorType.AUTHORIZATION)).toBe(true);
      expect(isErrorType(new Error('validation error'), ErrorType.VALIDATION)).toBe(true);
      expect(isErrorType(new Error('not found'), ErrorType.NOT_FOUND)).toBe(true);
      expect(isErrorType(new Error('rate limit exceeded'), ErrorType.RATE_LIMIT)).toBe(true);
      expect(isErrorType(new Error('network failed'), ErrorType.NETWORK)).toBe(true);
      expect(isErrorType(new Error('database connection lost'), ErrorType.DATABASE)).toBe(true);
      expect(isErrorType(new Error('unknown error'), ErrorType.SERVER_ERROR)).toBe(true);
    });

    it('should return false for non-Error objects', () => {
      expect(isErrorType('string', ErrorType.AUTHENTICATION)).toBe(false);
      expect(isErrorType(null, ErrorType.AUTHENTICATION)).toBe(false);
      expect(isErrorType(undefined, ErrorType.AUTHENTICATION)).toBe(false);
      expect(isErrorType({}, ErrorType.AUTHENTICATION)).toBe(false);
    });
  });

  describe('Security Considerations', () => {
    it('should not expose sensitive details in error messages', () => {
      const sensitiveErrors = [
        new Error('Connection to database at 192.168.1.1:5432 failed'),
        new Error('User admin@company.com does not have permission'),
        new Error('API key sk_live_123456 is invalid'),
        new Error('JWT token eyJhbGciOiJIUzI1NiIs expired'),
      ];

      sensitiveErrors.forEach((error) => {
        const message = getSecureErrorMessage(error, Language.EN);
        expect(message).not.toContain('192.168');
        expect(message).not.toContain('admin@company.com');
        expect(message).not.toContain('sk_live');
        expect(message).not.toContain('eyJ');
      });
    });
  });
});
