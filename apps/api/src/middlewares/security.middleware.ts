/* eslint-disable import/order */
import crypto from 'crypto';

import { Logger, metrics } from '@simple-bookkeeping/shared';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
/* eslint-enable import/order */

const logger = new Logger({ component: 'SecurityMiddleware' });

// Rate limiting configurations for different endpoints
export const rateLimiters = {
  // Strict rate limit for authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '認証試行回数の上限に達しました。15分後に再試行してください。',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn('Auth rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        organizationId: (req as any).organizationId,
      });

      metrics.recordAuthenticationAttempt('failure', 'rate_limited');

      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: '認証試行回数の上限に達しました。15分後に再試行してください。',
        },
      });
    },
  }),

  // Standard rate limit for API endpoints
  api: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'リクエスト数の上限に達しました。しばらく待ってから再試行してください。',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => {
      // Skip rate limiting for monitoring endpoints
      return req.path.startsWith('/health') || req.path.startsWith('/metrics');
    },
  }),

  // Strict rate limit for data modification endpoints
  write: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 write requests per minute
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'データ更新リクエストの上限に達しました。',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Rate limit for file uploads
  upload: rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10, // 10 uploads per 10 minutes
    message: {
      error: {
        code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
        message: 'ファイルアップロードの上限に達しました。',
      },
    },
  }),

  // Rate limit for report generation
  reports: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // 20 reports per 5 minutes
    message: {
      error: {
        code: 'REPORT_RATE_LIMIT_EXCEEDED',
        message: 'レポート生成の上限に達しました。',
      },
    },
  }),
};

// Speed limiting to slow down repeated requests
export const speedLimiters = {
  // Slow down authentication attempts
  auth: slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 2, // Allow 2 requests at full speed
    delayMs: 1000, // Add 1 second delay per request after delayAfter
    maxDelayMs: 5000, // Maximum delay of 5 seconds
  }),

  // Slow down API requests
  api: slowDown({
    windowMs: 1 * 60 * 1000, // 1 minute
    delayAfter: 50, // Allow 50 requests at full speed
    delayMs: 100, // Add 100ms delay per request after delayAfter
    maxDelayMs: 1000, // Maximum delay of 1 second
  }),
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');

  // HSTS for production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
};

// IP-based blocking middleware
const blockedIPs = new Set<string>();
const ipAttempts = new Map<string, { count: number; lastAttempt: number }>();

export const ipBlockingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || '';

  // Check if IP is blocked
  if (blockedIPs.has(ip)) {
    logger.warn('Blocked IP attempted access', { ip, path: req.path });
    return res.status(403).json({
      error: {
        code: 'IP_BLOCKED',
        message: 'Access denied',
      },
    });
  }

  // Track failed authentication attempts
  if (req.path.includes('/auth') && res.statusCode === 401) {
    const attempts = ipAttempts.get(ip) || { count: 0, lastAttempt: Date.now() };
    attempts.count++;
    attempts.lastAttempt = Date.now();

    // Block IP after 10 failed attempts within 1 hour
    if (attempts.count >= 10 && Date.now() - attempts.lastAttempt < 3600000) {
      blockedIPs.add(ip);
      logger.error('IP blocked due to multiple failed auth attempts', {
        ip,
        attemptCount: attempts.count,
      });
    }

    ipAttempts.set(ip, attempts);
  }

  next();
};

// Clean up old IP attempts periodically
setInterval(() => {
  const oneHourAgo = Date.now() - 3600000;
  for (const [ip, attempts] of ipAttempts.entries()) {
    if (attempts.lastAttempt < oneHourAgo) {
      ipAttempts.delete(ip);
    }
  }
}, 300000); // Clean up every 5 minutes

// Input sanitization middleware
import { body, validationResult } from 'express-validator';
import DOMPurify from 'isomorphic-dompurify';

export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  next();
};

function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    // Remove any HTML tags and scripts
    return DOMPurify.sanitize(obj, { ALLOWED_TAGS: [] });
  } else if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  } else if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  return obj;
}

// Common validation rules
export const validationRules = {
  uuid: body('id').isUUID().withMessage('Invalid ID format'),
  email: body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
  password: body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
    ),
  amount: body('amount')
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  date: body('date').isISO8601().toDate().withMessage('Invalid date format'),
};

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation failed', {
      path: req.path,
      errors: errors.array(),
      ip: req.ip,
    });

    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: '入力値が不正です',
        details: errors.array().map((err) => ({
          field: err.type === 'field' ? err.path : undefined,
          message: err.msg,
        })),
      },
    });
  }
  next();
};

// CSRF protection for state-changing operations
const csrfTokens = new Map<string, { token: string; expires: number }>();

export const generateCSRFToken = (sessionId: string): string => {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 3600000; // 1 hour

  csrfTokens.set(sessionId, { token, expires });

  // Clean up expired tokens
  for (const [sid, data] of csrfTokens.entries()) {
    if (data.expires < Date.now()) {
      csrfTokens.delete(sid);
    }
  }

  return token;
};

export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for GET requests and API tokens
  if (req.method === 'GET' || req.headers.authorization?.startsWith('Bearer')) {
    return next();
  }

  const sessionId = (req as any).sessionID || req.headers['x-session-id'];
  const token = req.headers['x-csrf-token'] || req.body._csrf;

  if (!sessionId || !token) {
    return res.status(403).json({
      error: {
        code: 'CSRF_TOKEN_MISSING',
        message: 'CSRF token is required',
      },
    });
  }

  const storedData = csrfTokens.get(sessionId);

  if (!storedData || storedData.token !== token || storedData.expires < Date.now()) {
    logger.warn('Invalid CSRF token', {
      sessionId,
      path: req.path,
      ip: req.ip,
    });

    return res.status(403).json({
      error: {
        code: 'CSRF_TOKEN_INVALID',
        message: 'Invalid or expired CSRF token',
      },
    });
  }

  next();
};

// SQL injection prevention (additional layer on top of Prisma)
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b.*\b(from|into|where|table)\b)/i,
    /(--|\||;|\/\*|\*\/|xp_|sp_)/i,
    /(<script|<\/script|javascript:|onerror=|onload=)/i,
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some((pattern) => pattern.test(value));
    } else if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  if (checkValue(req.body) || checkValue(req.query) || checkValue(req.params)) {
    logger.error('Potential SQL injection attempt', {
      ip: req.ip,
      path: req.path,
      body: req.body,
      query: req.query,
    });

    return res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: 'Invalid characters in request',
      },
    });
  }

  next();
};
