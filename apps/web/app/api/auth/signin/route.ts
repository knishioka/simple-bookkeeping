import type { Database } from '@/lib/supabase/database.types';

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

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
  console.warn('[SignIn Route] Starting sign in process');

  try {
    const body = await request.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      console.warn('[SignIn Route] Validation failed: missing credentials');
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

    // CRITICAL PATTERN: Create temporary response to collect cookies
    // We'll create the final redirect response after authentication succeeds
    const response = NextResponse.json({ success: true });

    // Create Supabase client that sets cookies on the response object
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // CRITICAL: Set cookies directly on response object
          // This ensures cookies are in the HTTP response
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    // Supabase Authでログイン
    console.warn('[SignIn Route] Authenticating with Supabase Auth');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.warn('[SignIn Route] Authentication failed:', authError.message);
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
      console.warn('[SignIn Route] Authentication failed: no user returned');
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

    console.warn('[SignIn Route] Authentication successful for user:', authData.user.id);
    console.warn('[SignIn Route] Current app_metadata:', authData.user.app_metadata);

    // ユーザーの組織情報を取得
    console.warn('[SignIn Route] Fetching user organization');
    const { data: userOrgs } = await supabase
      .from('user_organizations')
      .select('organization_id, role')
      .eq('user_id', authData.user.id)
      .eq('is_default', true)
      .single();

    // CRITICAL: Check if app_metadata needs to be fixed (production bug fix)
    const currentAppMetadata = authData.user.app_metadata;
    const needsMetadataUpdate =
      userOrgs?.organization_id &&
      (!currentAppMetadata?.current_organization_id ||
        currentAppMetadata.current_organization_id !== userOrgs.organization_id);

    if (needsMetadataUpdate) {
      console.warn('[SignIn Route] FIXING: app_metadata is missing or incorrect, updating now');
      console.warn('[SignIn Route] Expected org:', userOrgs.organization_id);
      console.warn(
        '[SignIn Route] Current org in metadata:',
        currentAppMetadata?.current_organization_id
      );

      // Use service client for admin operations
      const serviceClient = await createServiceClient();
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
        console.warn('[SignIn Route] WARNING: Failed to fix app_metadata:', updateError);
        // Continue anyway - the user can still use the app
      } else {
        console.warn('[SignIn Route] Successfully fixed app_metadata');
      }
    } else if (userOrgs?.organization_id) {
      console.warn('[SignIn Route] app_metadata is correctly set');
    } else {
      console.warn('[SignIn Route] No organization found for user');
    }

    // Determine redirect path
    const redirectPath = !userOrgs?.organization_id ? '/auth/select-organization' : '/dashboard';

    console.warn(`[SignIn Route] Redirecting to: ${redirectPath}`);

    // CRITICAL: Create redirect response and copy cookies from temporary response
    const redirectUrl = new URL(redirectPath, request.url);
    const redirectResponse = NextResponse.redirect(redirectUrl, {
      status: 303, // Use 303 See Other for POST -> GET redirect
    });

    // Copy all cookies from the temporary response to the redirect response
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });

    console.warn('[SignIn Route] Returning redirect response with cookies');
    return redirectResponse;
  } catch (error) {
    console.error('[SignIn Route] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'ログインに失敗しました。',
        },
      },
      { status: 500 }
    );
  }
}
