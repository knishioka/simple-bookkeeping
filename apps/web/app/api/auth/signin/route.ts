import type { Database } from '@/lib/supabase/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Sign in Route Handler
 *
 * CRITICAL: Correct cookie handling pattern for Supabase SSR
 * - Create Response object FIRST
 * - Set cookies directly on Response object via Supabase client
 * - This ensures Set-Cookie headers are in the redirect response
 *
 * Why this pattern works:
 * - Supabase client's setAll() callback writes directly to Response.cookies
 * - Browser receives both Set-Cookie and Location headers in same HTTP response
 * - No race condition between cookie setting and redirect
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '必須項目が入力されていません。',
            fields: {
              email: !email ? 'メールアドレスは必須です' : undefined,
              password: !password ? 'パスワードは必須です' : undefined,
            },
          },
        },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFIG_ERROR',
            message: 'Missing Supabase configuration',
          },
        },
        { status: 500 }
      );
    }

    // CRITICAL: Store cookies with their full options for later use
    // response.cookies.getAll() only returns {name, value} without options like httpOnly, secure, sameSite
    // We need to preserve these options to maintain proper session security
    let cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = [];

    // Create Supabase client that captures cookies with full options
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookies) {
          // CRITICAL: Save cookies with full options (httpOnly, secure, sameSite, maxAge, etc.)
          // These will be applied to the redirect response later
          cookiesToSet = cookies;

          // Also set on request for immediate use by Supabase client
          cookies.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
        },
      },
    });

    // Supabase Authでログイン
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      if (authError.message.includes('Invalid login credentials')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'メールアドレスまたはパスワードが正しくありません。',
            },
          },
          { status: 401 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_ERROR',
            message: authError.message,
          },
        },
        { status: 500 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'ログインに失敗しました。',
          },
        },
        { status: 500 }
      );
    }

    // CRITICAL: Create service client for admin operations
    // Use service client instead of regular client for organization lookup
    // because RLS may not recognize the session immediately after sign-in
    const serviceClient: SupabaseClient<Database> = createServiceClient();

    // ユーザーの組織情報を取得
    const { data: userOrgs } = await serviceClient
      .from('user_organizations')
      .select('organization_id, role')
      .eq('user_id', authData.user.id)
      .eq('is_default', true)
      .single<{ organization_id: string; role: string }>();

    // CRITICAL: Check if app_metadata needs to be fixed (production bug fix)
    const currentAppMetadata = authData.user.app_metadata;
    const needsMetadataUpdate =
      userOrgs?.organization_id &&
      (!currentAppMetadata?.current_organization_id ||
        currentAppMetadata.current_organization_id !== userOrgs.organization_id);

    if (needsMetadataUpdate) {
      // Service client already created above
      const { error: updateError } = await serviceClient.auth.admin.updateUserById(
        authData.user.id,
        {
          app_metadata: {
            current_organization_id: userOrgs.organization_id,
            current_role: userOrgs.role || 'viewer',
          },
        }
      );

      if (updateError) {
        // Continue anyway - the user can still use the app
      }
    }

    // Determine redirect path
    const redirectPath = !userOrgs?.organization_id ? '/auth/select-organization' : '/dashboard';

    // CRITICAL: Return JSON response instead of redirect
    // This allows the client to receive and store cookies BEFORE redirecting
    // Fixes the issue where cookies are not available during server-side redirect
    const successResponse = NextResponse.json(
      {
        success: true,
        redirectTo: redirectPath,
        organizationId: userOrgs?.organization_id,
      },
      { status: 200 }
    );

    // Apply all Supabase session cookies with their full options
    cookiesToSet.forEach(({ name, value, options }) => {
      successResponse.cookies.set(name, value, options);
    });

    return successResponse;
  } catch (error) {
    logger.error('[SignIn Route] Unexpected error:', error);
    const isLegacyKeyError = error instanceof Error && error.message.includes('レガシー形式');
    return NextResponse.json(
      {
        success: false,
        error: {
          code: isLegacyKeyError ? 'CONFIGURATION_ERROR' : 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'ログインに失敗しました。',
        },
      },
      { status: 500 }
    );
  }
}
