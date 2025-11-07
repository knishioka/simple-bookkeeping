'use server';

import type { Database } from '@/lib/supabase/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  ActionResult,
  createSuccessResult,
  createErrorResult,
  createValidationErrorResult,
  handleSupabaseError,
  ERROR_CODES,
} from './types';

import { createClient, createActionClient, createServiceClient } from '@/lib/supabase/server';

// SECURITY NOTE: createServiceClient() should ONLY be used on the server side for admin operations.
// This module has 'use server' directive, ensuring all functions run only on the server.
// DO NOT import or call createServiceClient() in any client-side code, as this would expose
// the SUPABASE_SERVICE_ROLE_KEY environment variable.
// The service client grants admin access to bypass RLS and perform privileged operations.

interface SignUpInput {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
}

interface SignInInput {
  email: string;
  password: string;
}

interface ResetPasswordInput {
  email: string;
}

interface UpdatePasswordInput {
  currentPassword: string;
  newPassword: string;
}

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  organizationId?: string;
  role?: string;
}

/**
 * ユーザー登録
 */
export async function signUp(input: SignUpInput): Promise<ActionResult<AuthUser>> {
  console.warn('[SignUp] Starting signup process for:', { email: input.email });

  try {
    const { email, password, name, organizationName } = input;

    // バリデーション
    if (!email || !password || !name) {
      console.warn('[SignUp] Validation failed: missing required fields');
      return createValidationErrorResult('必須項目が入力されていません。', {
        email: !email ? 'メールアドレスは必須です' : undefined,
        password: !password ? 'パスワードは必須です' : undefined,
        name: !name ? '氏名は必須です' : undefined,
      });
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.warn('[SignUp] Validation failed: invalid email format');
      return createValidationErrorResult('メールアドレスの形式が正しくありません。');
    }

    // パスワードの強度チェック
    if (password.length < 8) {
      console.warn('[SignUp] Validation failed: password too short');
      return createValidationErrorResult('パスワードは8文字以上で入力してください。');
    }

    const supabase = await createClient();

    // Step 1: Supabase Authでユーザーを作成
    console.warn('[SignUp] Step 1: Creating auth user');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          display_name: name,
        },
      },
    });

    if (authError) {
      console.warn('[SignUp] Auth creation failed:', authError.message);
      if (authError.message.includes('already registered')) {
        return createErrorResult(
          ERROR_CODES.ALREADY_EXISTS,
          'このメールアドレスは既に登録されています。'
        );
      }
      return handleSupabaseError(authError);
    }

    if (!authData.user) {
      console.warn('[SignUp] Auth creation failed: no user returned');
      return createErrorResult(ERROR_CODES.INTERNAL_ERROR, 'ユーザーの作成に失敗しました。');
    }

    console.warn('[SignUp] Auth user created successfully:', authData.user.id);

    // 組織を作成する場合（デフォルトで常に作成する）
    let organizationId: string | undefined;
    const userRole: string = 'admin'; // デフォルトで管理者

    // 組織名がない場合はデフォルト名を使用
    const finalOrgName = organizationName || `${name}の組織`;
    console.warn('[SignUp] Creating organization with name:', finalOrgName);

    try {
      // Create service client for RLS bypass during signup
      // IMPORTANT: serviceClient is required because new users don't have organization
      // membership yet, and RLS policies would block standard client operations
      // SECURITY: This is safe because:
      // 1. Runs only server-side in 'use server' context (never exposed to client)
      // 2. User authentication is validated via Supabase Auth before DB operations
      // 3. Service client usage is minimal and limited to initial signup setup only
      const serviceClient: SupabaseClient<Database> = createServiceClient();

      // Step 2: 組織を作成
      console.warn('[SignUp] Step 2: Creating organization');
      const {
        data: newOrg,
        error: orgError,
      }: {
        data: Database['public']['Tables']['organizations']['Row'] | null;
        error: Error | null;
      } = await serviceClient
        .from('organizations')
        // @ts-expect-error - Type inference issue with @supabase/supabase-js v2.50.0 and service client
        // TypeScript incorrectly infers 'never' for insert operations on service client
        // This is a known compatibility issue and does not affect runtime behavior
        // TODO: Consider upgrading @supabase/supabase-js to v2.56+ when stable
        .insert({
          name: finalOrgName,
          code: `ORG-${Date.now()}`, // 仮のコード（後で変更可能）
          // is_active: true, // Temporarily commented out due to schema cache issue
        })
        .select()
        .single();

      if (orgError || !newOrg) {
        console.warn('[SignUp] Organization creation failed:', orgError);
        // Authユーザーは作成済みなので、削除を試みる
        try {
          await serviceClient.auth.admin.deleteUser(authData.user.id);
          console.warn('[SignUp] Successfully rolled back auth user');
        } catch (rollbackError) {
          console.warn('[SignUp] Failed to rollback auth user:', rollbackError);
          // Rollback failure is logged but doesn't affect the error response
        }
        return createErrorResult(
          ERROR_CODES.INTERNAL_ERROR,
          '組織の作成に失敗しました。もう一度お試しください。'
        );
      }

      organizationId = newOrg.id;
      console.warn('[SignUp] Organization created successfully:', organizationId);

      // Step 3: users テーブルにユーザー情報を保存
      console.warn('[SignUp] Step 3: Creating user record');
      const { error: userError } = await serviceClient
        .from('users')
        // @ts-expect-error - Type inference issue with @supabase/supabase-js v2.50.0 and service client (see Step 2)
        .insert({
          id: authData.user.id,
          email,
          name,
          organization_id: organizationId,
          role: userRole,
          is_active: true,
        });

      if (userError) {
        console.warn('[SignUp] User table insert failed:', userError);
        // 重要なエラーなので処理を続行しない
        return createErrorResult(
          ERROR_CODES.INTERNAL_ERROR,
          'ユーザー情報の保存に失敗しました。管理者にお問い合わせください。'
        );
      }
      console.warn('[SignUp] User record created successfully');

      // Step 4: ユーザーを組織に関連付け（管理者として）
      console.warn('[SignUp] Step 4: Creating user-organization association');
      const { error: userOrgError } = await serviceClient
        .from('user_organizations')
        // @ts-expect-error - Type inference issue with @supabase/supabase-js v2.50.0 and service client (see Step 2)
        .insert({
          user_id: authData.user.id,
          organization_id: organizationId,
          role: userRole,
          is_default: true,
        });

      if (userOrgError) {
        console.warn('[SignUp] User-organization association failed:', userOrgError);
        // 重要なエラーなので処理を続行しない
        return createErrorResult(
          ERROR_CODES.INTERNAL_ERROR,
          '組織への関連付けに失敗しました。管理者にお問い合わせください。'
        );
      }
      console.warn('[SignUp] User-organization association created successfully');

      // Step 5a: Auto-confirm email so users can log in immediately
      console.warn('[SignUp] Step 5a: Auto confirming user email for immediate access');
      const { error: emailConfirmError } = await serviceClient.auth.admin.updateUserById(
        authData.user.id,
        {
          email_confirm: true,
        }
      );

      if (emailConfirmError) {
        console.warn('[SignUp] WARNING: Failed to auto confirm email:', emailConfirmError);
        // Continue even if email confirmation fails; user will need to verify via email
      } else {
        console.warn('[SignUp] Email auto confirmation completed');
      }

      // Step 5: CRITICAL - Update user's app_metadata with organization info
      console.warn('[SignUp] Step 5: Updating user app_metadata');

      // Use service client for admin operations (already created above)
      const { error: updateError } = await serviceClient.auth.admin.updateUserById(
        authData.user.id,
        {
          app_metadata: {
            current_organization_id: organizationId,
            current_role: userRole,
          },
        }
      );

      if (updateError) {
        console.warn('[SignUp] WARNING: Failed to update app_metadata:', updateError);
        // app_metadataの更新に失敗しても、ログイン時に修正を試みるので続行
        // ただし、警告はログに残す
        console.warn('[SignUp] Will attempt to fix app_metadata on next login');
      } else {
        console.warn('[SignUp] User app_metadata updated successfully');
      }

      // 成功レスポンス
      console.warn('[SignUp] Signup completed successfully');
      return createSuccessResult({
        id: authData.user.id,
        email: authData.user.email || '',
        name,
        organizationId,
        role: userRole,
      });
    } catch (dbError) {
      console.warn('[SignUp] Database operation failed:', dbError);
      // Authユーザーは作成済みなので、削除を試みる（ベストエフォート）
      try {
        const serviceClient: SupabaseClient<Database> = createServiceClient();
        await serviceClient.auth.admin.deleteUser(authData.user.id);
        console.warn('[SignUp] Successfully rolled back auth user after DB error');
      } catch (rollbackError) {
        console.warn('[SignUp] Failed to rollback auth user:', rollbackError);
        // Continue to return the main error
      }
      return createErrorResult(
        ERROR_CODES.INTERNAL_ERROR,
        'データベースエラーが発生しました。もう一度お試しください。'
      );
    }
  } catch (error) {
    console.warn('[SignUp] Unexpected error:', error);
    return handleSupabaseError(error);
  }
}

/**
 * ログイン
 */
export async function signIn(input: SignInInput): Promise<ActionResult<AuthUser>> {
  console.warn('[SignIn] Starting sign in process for:', { email: input.email });

  try {
    const { email, password } = input;

    // バリデーション
    if (!email || !password) {
      console.warn('[SignIn] Validation failed: missing credentials');
      return createValidationErrorResult('必須項目が入力されていません。', {
        email: !email ? 'メールアドレスは必須です' : undefined,
        password: !password ? 'パスワードは必須です' : undefined,
      });
    }

    // CRITICAL: Use createActionClient() to surface cookie-setting errors
    // createClient() has try-catch that silently hides errors, which prevents proper authentication
    const supabase = await createActionClient();

    // Supabase Authでログイン
    console.warn('[SignIn] Authenticating with Supabase Auth');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Check cookie state after authentication
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    console.warn(
      '[SignIn] Cookies after signIn:',
      allCookies.map((c) => ({ name: c.name, hasValue: !!c.value, valueLength: c.value.length }))
    );
    console.warn('[SignIn] Total cookies set:', allCookies.length);
    console.warn(
      '[SignIn] Auth cookies:',
      allCookies.filter((c) => c.name.includes('auth') || c.name.includes('sb')).map((c) => c.name)
    );

    if (authError) {
      console.warn('[SignIn] Authentication failed:', authError.message);
      if (authError.message.includes('Invalid login credentials')) {
        return createErrorResult(
          ERROR_CODES.UNAUTHORIZED,
          'メールアドレスまたはパスワードが正しくありません。'
        );
      }
      return handleSupabaseError(authError);
    }

    if (!authData.user) {
      console.warn('[SignIn] Authentication failed: no user returned');
      return createErrorResult(ERROR_CODES.INTERNAL_ERROR, 'ログインに失敗しました。');
    }

    console.warn('[SignIn] Authentication successful for user:', authData.user.id);
    console.warn('[SignIn] Current app_metadata:', authData.user.app_metadata);

    // ユーザーの組織情報を取得
    console.warn('[SignIn] Fetching user organization');
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
      console.warn('[SignIn] FIXING: app_metadata is missing or incorrect, updating now');
      console.warn('[SignIn] Expected org:', userOrgs.organization_id);
      console.warn(
        '[SignIn] Current org in metadata:',
        currentAppMetadata?.current_organization_id
      );

      // Use service client for admin operations
      const serviceClient: SupabaseClient<Database> = createServiceClient();
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
        console.warn('[SignIn] WARNING: Failed to fix app_metadata:', updateError);
        // Continue anyway - the user can still use the app
      } else {
        console.warn('[SignIn] Successfully fixed app_metadata');
      }
    } else if (userOrgs?.organization_id) {
      console.warn('[SignIn] app_metadata is correctly set');
    } else {
      console.warn('[SignIn] No organization found for user');
    }

    // キャッシュを再検証
    revalidatePath('/dashboard');
    revalidatePath('/');

    console.warn('[SignIn] Sign in completed successfully');

    // CRITICAL FIX: Use redirect() directly in Server Action
    // This ensures Set-Cookie and Location headers are sent in the same HTTP response
    // The browser will set cookies before following the redirect
    const redirectPath = !userOrgs?.organization_id ? '/auth/select-organization' : '/dashboard';

    console.warn(`[SignIn] Redirecting to: ${redirectPath}`);

    // redirect() throws an exception, so code after this won't execute
    redirect(redirectPath);
  } catch (error) {
    // redirect() throws a special NEXT_REDIRECT error that should not be caught
    // Re-throw it so Next.js can handle the redirect properly
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      String(error.digest).startsWith('NEXT_REDIRECT')
    ) {
      throw error;
    }

    console.warn('[SignIn] Unexpected error:', error);
    return handleSupabaseError(error);
  }
}

/**
 * ログアウト
 */
export async function signOut(): Promise<ActionResult<{ success: boolean }>> {
  try {
    const supabase = await createClient();

    // getUser()を使用してサーバー側で認証を検証（getSession()はクライアント側のCookieから直接取得するため安全でない）
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      // ユーザーが認証されていない場合も成功として扱う（冪等性を保つため）
      return createSuccessResult({ success: true });
    }

    // Supabase Authからログアウト
    const { error } = await supabase.auth.signOut();

    if (error) {
      return handleSupabaseError(error);
    }

    // キャッシュを再検証
    revalidatePath('/');
    revalidatePath('/dashboard');

    return createSuccessResult({ success: true });
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * パスワードリセット
 */
export async function resetPassword(
  input: ResetPasswordInput
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { email } = input;

    // バリデーション
    if (!email) {
      return createValidationErrorResult('メールアドレスを入力してください。');
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return createValidationErrorResult('メールアドレスの形式が正しくありません。');
    }

    const supabase = await createClient();

    // パスワードリセットメールを送信
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset-password`,
    });

    if (error) {
      // セキュリティのため、ユーザーが存在しない場合でも同じメッセージを返す
      console.error('Password reset error:', error);
    }

    // セキュリティのため、常に成功を返す
    return createSuccessResult({
      success: true,
    });
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * パスワード更新
 */
export async function updatePassword(
  input: UpdatePasswordInput
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const { currentPassword, newPassword } = input;

    // バリデーション
    if (!currentPassword || !newPassword) {
      return createValidationErrorResult('必須項目が入力されていません。', {
        currentPassword: !currentPassword ? '現在のパスワードは必須です' : undefined,
        newPassword: !newPassword ? '新しいパスワードは必須です' : undefined,
      });
    }

    // パスワードの強度チェック
    if (newPassword.length < 8) {
      return createValidationErrorResult('新しいパスワードは8文字以上で入力してください。');
    }

    if (currentPassword === newPassword) {
      return createValidationErrorResult(
        '新しいパスワードは現在のパスワードと異なる必要があります。'
      );
    }

    const supabase = await createClient();

    // 現在のユーザーを取得
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return createErrorResult(ERROR_CODES.UNAUTHORIZED, 'ログインが必要です。');
    }

    // 現在のパスワードで再認証（セキュリティのため）
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email || '',
      password: currentPassword,
    });

    if (signInError) {
      return createErrorResult(ERROR_CODES.UNAUTHORIZED, '現在のパスワードが正しくありません。');
    }

    // パスワードを更新
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      return handleSupabaseError(updateError);
    }

    return createSuccessResult({
      success: true,
    });
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * 現在のユーザー情報を取得
 */
export async function getCurrentUser(): Promise<ActionResult<AuthUser | null>> {
  try {
    console.warn('[getCurrentUser] Starting user fetch');
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    console.warn('[getCurrentUser] getUser() result:', {
      hasUser: !!user,
      userId: user?.id,
      email: user?.email,
      error: error?.message,
    });

    if (error || !user) {
      console.warn('[getCurrentUser] No authenticated user, returning null');
      return createSuccessResult(null);
    }

    // ユーザーの組織情報を取得
    console.warn('[getCurrentUser] Fetching user_organizations for user:', user.id);
    const { data: userOrgs, error: userOrgsError } = await supabase
      .from('user_organizations')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .single();

    console.warn('[getCurrentUser] user_organizations query result:', {
      hasData: !!userOrgs,
      organizationId: userOrgs?.organization_id,
      role: userOrgs?.role,
      error: userOrgsError?.message,
      errorCode: userOrgsError?.code,
      errorDetails: userOrgsError?.details,
    });

    // ユーザー情報を取得
    console.warn('[getCurrentUser] Fetching users table for user:', user.id);
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    console.warn('[getCurrentUser] users query result:', {
      hasData: !!userData,
      name: userData?.name,
      error: userDataError?.message,
    });

    const result = {
      id: user.id,
      email: user.email || '',
      name: userData?.name || user.user_metadata?.name,
      organizationId: userOrgs?.organization_id,
      role: userOrgs?.role,
    };

    console.warn('[getCurrentUser] Returning user data:', result);
    return createSuccessResult(result);
  } catch (error) {
    console.error('[getCurrentUser] Unexpected error:', error);
    return handleSupabaseError(error);
  }
}

/**
 * メール確認
 */
export async function confirmEmail(token: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    if (!token) {
      return createValidationErrorResult('確認トークンが必要です。');
    }

    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'email',
    });

    if (error) {
      return createErrorResult(
        ERROR_CODES.INVALID_OPERATION,
        'メールアドレスの確認に失敗しました。リンクの有効期限が切れている可能性があります。'
      );
    }

    return createSuccessResult({
      success: true,
    });
  } catch (error) {
    return handleSupabaseError(error);
  }
}
