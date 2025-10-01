import { createServerClient } from '@supabase/ssr';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

// Define public routes that don't require authentication
const publicRoutes = [
  '/',
  '/auth/login',
  '/auth/signup',
  '/auth/reset-password',
  '/auth/verify-email',
];

// Define route patterns for public access
const publicPatterns = [
  /^\/api\/auth\/.*/,
  /^\/api\/health/,
  /^\/_next\/.*/,
  /^\/static\/.*/,
  /^\/favicon\.ico/,
];

/**
 * Rate limit configuration for different endpoints
 */
const RATE_LIMIT_CONFIG = {
  // Authentication endpoints - strict limits
  '/auth/login': { limit: 5, window: '15m' },
  '/auth/signup': { limit: 3, window: '1h' },
  '/auth/reset-password': { limit: 3, window: '1h' },
  '/api/auth/signin': { limit: 5, window: '15m' },
  '/api/auth/signup': { limit: 3, window: '1h' },
  '/api/mfa/verify': { limit: 5, window: '5m' },
  '/api/mfa/enroll': { limit: 3, window: '1h' },

  // API endpoints - moderate limits
  '/api': { limit: 100, window: '1m' },

  // Default for all other routes
  default: { limit: 200, window: '1m' },
};

/**
 * Initialize Redis client for rate limiting
 */
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

/**
 * Create rate limiter instances
 */
const rateLimiters = new Map<string, Ratelimit>();

if (redis) {
  Object.entries(RATE_LIMIT_CONFIG).forEach(([path, config]) => {
    rateLimiters.set(
      path,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(
          config.limit,
          config.window as `${number}${'ms' | 's' | 'm' | 'h' | 'd'}`
        ),
        analytics: true,
        prefix: `ratelimit:${path}`,
      })
    );
  });
}

/**
 * Get rate limiter for a path
 */
function getRateLimiter(pathname: string): Ratelimit | null {
  if (!redis) return null;

  // Check exact match
  if (rateLimiters.has(pathname)) {
    return rateLimiters.get(pathname)!;
  }

  // Check prefix matches
  const entries = Array.from(rateLimiters.entries());
  for (const [path, limiter] of entries) {
    if (pathname.startsWith(path) && path !== 'default') {
      return limiter;
    }
  }

  return rateLimiters.get('default') || null;
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || '127.0.0.1';
  return `ip:${ip}`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // Skip rate limiting for static assets
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2)$/)
  ) {
    return response;
  }

  // Apply rate limiting if Redis is configured
  const rateLimiter = getRateLimiter(pathname);
  if (rateLimiter) {
    const identifier = getClientIdentifier(request);

    try {
      const { success, limit, reset, remaining } = await rateLimiter.limit(identifier);

      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', limit.toString());
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      response.headers.set('X-RateLimit-Reset', new Date(reset).toISOString());

      if (!success) {
        // Rate limit exceeded
        return new NextResponse(
          JSON.stringify({
            error: 'リクエストが多すぎます。しばらくしてからお試しください。',
            retryAfter: Math.ceil((reset - Date.now()) / 1000),
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(reset).toISOString(),
            },
          }
        );
      }
    } catch (error) {
      // Log error but don't block the request if rate limiting fails
      console.error('Rate limiting error:', error);
    }
  }

  // Allow public routes
  if (publicRoutes.includes(pathname) || publicPatterns.some((pattern) => pattern.test(pathname))) {
    return response;
  }

  // Skip authentication in test/development environment when Supabase is not configured
  // or when explicitly using mock authentication in CI
  // CRITICAL SECURITY: Only allow test mode in non-production environments
  const isTestMode =
    process.env.NODE_ENV !== 'production' &&
    (process.env.E2E_USE_MOCK_AUTH === 'true' || // Explicit CI mock auth flag
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co' ||
      process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://placeholder.supabase.co');

  if (isTestMode) {
    // In test environment, allow all routes without authentication

    // Set dummy user context for API routes
    if (pathname.startsWith('/api/')) {
      response.headers.set('x-user-id', 'test-user-id');
      response.headers.set('x-organization-id', 'test-org-id');
    }

    return response;
  }

  // Create Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options) {
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  // Check if user is authenticated
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // Redirect to login if not authenticated
    const redirectUrl = new URL('/auth/login', request.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Check organization context
  const userMetadata = session.user.app_metadata;
  const currentOrganizationId = userMetadata?.current_organization_id;

  if (!currentOrganizationId) {
    // Redirect to organization selection if no organization is selected
    const redirectUrl = new URL('/auth/select-organization', request.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Add user context to headers for API routes
  if (pathname.startsWith('/api/')) {
    response.headers.set('x-user-id', session.user.id);
    response.headers.set('x-organization-id', currentOrganizationId);
    response.headers.set('x-user-role', userMetadata?.current_role || 'viewer');
  }

  // Check role-based access for admin routes
  if (pathname.startsWith('/admin/') || pathname.startsWith('/settings/')) {
    const userRole = userMetadata?.current_role;
    if (userRole !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // Check role-based access for accountant routes
  if (pathname.startsWith('/accounting/') || pathname.startsWith('/reports/')) {
    const userRole = userMetadata?.current_role;
    if (userRole !== 'admin' && userRole !== 'accountant') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
