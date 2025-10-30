import type { NextRequest } from 'next/server';

import { createServerClient } from '@supabase/ssr';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// Define public routes that don't require authentication
const publicRoutes = [
  '/',
  '/auth/login',
  '/auth/signup',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/select-organization', // Added to prevent redirect loops
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
    return rateLimiters.get(pathname) || null;
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
  // Issue #514: Also check cookie for E2E_USE_MOCK_AUTH for better test reliability
  // Issue #520: Add localhost:8000 (Docker Compose Supabase) to trigger mock auth in E2E tests
  const mockAuthCookie = request.cookies.get('mockAuth')?.value === 'true';
  const isTestMode =
    process.env.NODE_ENV !== 'production' &&
    (process.env.E2E_USE_MOCK_AUTH === 'true' || // Explicit CI mock auth flag
      mockAuthCookie || // Cookie-based mock auth (for E2E tests)
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co' ||
      process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://placeholder.supabase.co' ||
      process.env.NEXT_PUBLIC_SUPABASE_URL === 'http://localhost:8000');

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
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.warn(`[Middleware] Path: ${pathname}, User: ${user?.id || 'none'}`);

  if (!user) {
    // Redirect to login if not authenticated
    console.warn('[Middleware] No user found, redirecting to login');
    const redirectUrl = new URL('/auth/login', request.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Check organization context
  const userMetadata = user.app_metadata;
  const currentOrganizationId = userMetadata?.current_organization_id;

  console.warn(`[Middleware] User ${user.id} app_metadata:`, userMetadata);
  console.warn(`[Middleware] Current organization: ${currentOrganizationId || 'NONE'}`);

  // Redirect loop detection
  const redirectCount = parseInt(request.headers.get('x-redirect-count') || '0');
  console.warn(`[Middleware] Redirect count: ${redirectCount}`);

  if (redirectCount > 5) {
    console.warn('[Middleware] ERROR: Redirect loop detected! Breaking loop.');
    // Break the loop by allowing access to dashboard even without organization
    // This will help us debug the issue
    if (pathname !== '/dashboard') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    // If already on dashboard, just continue
    return response;
  }

  if (!currentOrganizationId) {
    // Special handling for organization selection page to prevent loops
    if (pathname === '/auth/select-organization') {
      console.warn('[Middleware] Already on select-organization page, allowing access');
      return response;
    }

    console.warn('[Middleware] No organization ID found in app_metadata, checking database');

    // PERFORMANCE NOTE: Database fallback query
    // This is only executed when app_metadata is missing or incorrect.
    // Normally, app_metadata should be set during signup/signin (see auth.ts)
    // This fallback exists for legacy users or edge cases where metadata update failed.
    // TODO: Monitor frequency of this fallback - if common, investigate root cause
    const { data: userOrg } = await supabase
      .from('user_organizations')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .single();

    if (userOrg?.organization_id) {
      console.warn('[Middleware] Found organization in database:', userOrg.organization_id);
      console.warn('[Middleware] Attempting to fix app_metadata');

      // Try to update app_metadata (this might fail if we don't have service role key)
      // But we should still allow the user to continue
      response.headers.set('x-user-id', user.id);
      response.headers.set('x-organization-id', userOrg.organization_id);
      response.headers.set('x-user-role', userOrg.role || 'viewer');

      // Add a header to indicate metadata needs fixing
      response.headers.set('x-fix-metadata', 'true');

      console.warn('[Middleware] Allowing access with organization from database');
      return response;
    }

    // Redirect to organization selection if no organization is found anywhere
    console.warn('[Middleware] No organization found, redirecting to select-organization');
    const redirectUrl = new URL('/auth/select-organization', request.url);
    redirectUrl.searchParams.set('redirectTo', pathname);

    // Add redirect count header to detect loops
    const nextResponse = NextResponse.redirect(redirectUrl);
    nextResponse.headers.set('x-redirect-count', (redirectCount + 1).toString());
    return nextResponse;
  }

  // Add user context to headers for API routes
  if (pathname.startsWith('/api/')) {
    response.headers.set('x-user-id', user.id);
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
