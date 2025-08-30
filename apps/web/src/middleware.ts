import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

import type { NextRequest } from 'next/server';

// Define public routes that don't require authentication
const publicRoutes = [
  '/',
  '/auth/login',
  '/auth/signup',
  '/auth/reset-password',
  '/auth/verify-email',
  '/demo',
];

// Define route patterns for public access
const publicPatterns = [
  /^\/demo\/.*/,
  /^\/api\/auth\/.*/,
  /^\/api\/health/,
  /^\/_next\/.*/,
  /^\/static\/.*/,
  /^\/favicon\.ico/,
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.includes(pathname) || publicPatterns.some((pattern) => pattern.test(pathname))) {
    return NextResponse.next();
  }

  // Skip authentication in test/development environment when Supabase is not configured
  const isTestMode =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co' ||
    process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://placeholder.supabase.co' ||
    process.env.NODE_ENV === 'test';

  // Allow test mode in production if using placeholder Supabase URLs (for CI E2E tests)
  const allowTestModeInProduction =
    process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://placeholder.supabase.co' ||
    process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co';

  if (isTestMode && (process.env.NODE_ENV !== 'production' || allowTestModeInProduction)) {
    // In test environment, allow all routes without authentication
    const response = NextResponse.next();

    // Set dummy user context for API routes
    if (pathname.startsWith('/api/')) {
      response.headers.set('x-user-id', 'test-user-id');
      response.headers.set('x-organization-id', 'test-org-id');
    }

    return response;
  }

  // Create Supabase client
  const response = NextResponse.next();

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
