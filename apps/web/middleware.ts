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
  '/test-cookies', // Cookie debugging page
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

  // Allow public routes and internal API routes
  if (
    publicRoutes.includes(pathname) ||
    publicPatterns.some((pattern) => pattern.test(pathname)) ||
    pathname.startsWith('/api/internal/')
  ) {
    return response;
  }

  // Skip authentication in test/development environment when Supabase is not configured
  // or when explicitly using mock authentication in CI
  // CRITICAL SECURITY: Multi-layer production detection to prevent authentication bypass
  // Issue #554: Removed user-controllable mockAuth cookie vulnerability
  // Issue #514: Use E2E_USE_MOCK_AUTH environment variable for E2E tests
  // Issue #520: Support localhost:8000 (Docker Compose Supabase) for E2E tests

  // Multi-layer production detection (defense-in-depth)
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.CI === 'true';

  // Test mode is ONLY enabled when:
  // 1. NOT in production (any layer)
  // 2. AND one of the following:
  //    - Explicit E2E_USE_MOCK_AUTH flag
  //    - Supabase URL is not configured or is a known test placeholder
  const isTestMode =
    !isProduction &&
    (process.env.E2E_USE_MOCK_AUTH === 'true' || // Explicit CI mock auth flag
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co' ||
      process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://placeholder.supabase.co' ||
      process.env.NEXT_PUBLIC_SUPABASE_URL === 'http://localhost:8000');

  // Production safety assertion - MUST NEVER happen
  if (isProduction && isTestMode) {
    const error = new Error('CRITICAL SECURITY ERROR: Test mode enabled in production environment');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('🚨 CRITICAL SECURITY ERROR');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Test mode is enabled in production environment!');
    console.error('This should NEVER happen and indicates a serious misconfiguration.');
    console.error('Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      CI: process.env.CI,
      E2E_USE_MOCK_AUTH: process.env.E2E_USE_MOCK_AUTH,
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    throw error;
  }

  if (isTestMode) {
    // Explicit warning in non-production environment
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.warn('⚠️  TEST MODE ACTIVE - Authentication Bypassed');
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.warn('Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      CI: process.env.CI,
      E2E_USE_MOCK_AUTH: process.env.E2E_USE_MOCK_AUTH,
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
    console.warn('This is ONLY safe in non-production environments.');
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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
  // CRITICAL: Use getSession() instead of getUser() to avoid API timeout issues
  // getSession() reads from cookies (fast), while getUser() calls Supabase API (slow/timeout)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;

  if (!user) {
    // Redirect to login if not authenticated
    const redirectUrl = new URL('/auth/login', request.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Check organization context
  // CRITICAL: Check temporary cookie first (set by signin route)
  // This ensures we have organization info immediately after signin
  // even before app_metadata is refreshed in the JWT token
  const tempOrgId = request.cookies.get('x-temp-org-id')?.value;
  const tempOrgRole = request.cookies.get('x-temp-org-role')?.value;

  const userMetadata = user.app_metadata;
  const currentOrganizationId = tempOrgId || userMetadata?.current_organization_id;

  // Redirect loop detection
  const redirectCount = parseInt(request.headers.get('x-redirect-count') || '0');

  if (redirectCount > 5) {
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
      return response;
    }

    // CRITICAL: Call internal API route for database fallback
    // Issue #553: Use Node runtime API route to keep Service Role Key out of Edge middleware
    // This API route runs on Node runtime and can safely access Service Role Key
    // Regular client with RLS may not have permissions immediately after signin
    // API route bypasses RLS via Server Action with Service Client
    // PERFORMANCE NOTE: Database fallback query via internal API
    // This is only executed when app_metadata is missing or incorrect.
    // Normally, app_metadata should be set during signup/signin (see auth.ts)
    // This fallback exists for legacy users or edge cases where metadata update failed.
    // TODO: Monitor frequency of this fallback - if common, investigate root cause

    try {
      // Call internal API route (runs on Node runtime, not Edge)
      const apiUrl = new URL('/api/internal/default-organization', request.url);
      const apiResponse = await fetch(apiUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!apiResponse.ok) {
        console.error('[Middleware] API call failed:', apiResponse.status, apiResponse.statusText);
        const redirectUrl = new URL('/auth/select-organization', request.url);
        redirectUrl.searchParams.set('redirectTo', pathname);
        const nextResponse = NextResponse.redirect(redirectUrl);
        nextResponse.headers.set('x-redirect-count', (redirectCount + 1).toString());
        return nextResponse;
      }

      const orgResult = await apiResponse.json();

      if (!orgResult.success || !orgResult.data) {
        console.error('[Middleware] Failed to get default organization:', orgResult.error);
        // Redirect to organization selection if no organization is found
        const redirectUrl = new URL('/auth/select-organization', request.url);
        redirectUrl.searchParams.set('redirectTo', pathname);
        const nextResponse = NextResponse.redirect(redirectUrl);
        nextResponse.headers.set('x-redirect-count', (redirectCount + 1).toString());
        return nextResponse;
      }

      // Successfully retrieved default organization
      const userOrg = orgResult.data;
      response.headers.set('x-user-id', user.id);
      response.headers.set('x-organization-id', userOrg.organization_id);
      response.headers.set('x-user-role', userOrg.role || 'viewer');

      // Add a header to indicate metadata needs fixing
      response.headers.set('x-fix-metadata', 'true');

      return response;
    } catch (error) {
      console.error('[Middleware] Error calling internal API:', error);
      // Redirect to organization selection on error
      const redirectUrl = new URL('/auth/select-organization', request.url);
      redirectUrl.searchParams.set('redirectTo', pathname);
      const nextResponse = NextResponse.redirect(redirectUrl);
      nextResponse.headers.set('x-redirect-count', (redirectCount + 1).toString());
      return nextResponse;
    }
  }

  // Add user context to headers for API routes
  if (pathname.startsWith('/api/')) {
    response.headers.set('x-user-id', user.id);
    response.headers.set('x-organization-id', currentOrganizationId);
    response.headers.set('x-user-role', tempOrgRole || userMetadata?.current_role || 'viewer');
  }

  // Check role-based access for admin routes
  if (pathname.startsWith('/admin/') || pathname.startsWith('/settings/')) {
    const userRole = tempOrgRole || userMetadata?.current_role;
    if (userRole !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // Check role-based access for accountant routes
  if (pathname.startsWith('/accounting/') || pathname.startsWith('/reports/')) {
    const userRole = tempOrgRole || userMetadata?.current_role;
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
