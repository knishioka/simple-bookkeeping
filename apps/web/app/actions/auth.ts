'use server';

import { revalidatePath } from 'next/cache';

import {
  ActionResult,
  createSuccessResult,
  createErrorResult,
  createValidationErrorResult,
  handleSupabaseError,
  ERROR_CODES,
} from './types';

import { createClient, createServiceClient } from '@/lib/supabase/server';

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
  console.log('[SignUp] Starting signup process for:', { email: input.email });

  try {
    const { email, password, name, organizationName } = input;

    // バリデーション
    if (!email || !password || !name) {
      console.log('[SignUp] Validation failed: missing required fields');
      return createValidationErrorResult('必須項目が入力されていません。', {
        email: !email ? 'メールアドレスは必須です' : undefined,
        password: !password ? 'パスワードは必須です' : undefined,
        name: !name ? '氏名は必須です' : undefined,
      });
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('[SignUp] Validation failed: invalid email format');
      return createValidationErrorResult('メールアドレスの形式が正しくありません。');
    }

    // パスワードの強度チェック
    if (password.length < 8) {
      console.log('[SignUp] Validation failed: password too short');
      return createValidationErrorResult('パスワードは8文字以上で入力してください。');
    }

    const supabase = await createClient();

    // Step 1: Supabase Authでユーザーを作成
    console.log('[SignUp] Step 1: Creating auth user');
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
      console.log('[SignUp] Auth creation failed:', authError.message);
      if (authError.message.includes('already registered')) {
        return createErrorResult(
          ERROR_CODES.ALREADY_EXISTS,
          'このメールアドレスは既に登録されています。'
        );
      }
      return handleSupabaseError(authError);
    }

    if (!authData.user) {
      console.log('[SignUp] Auth creation failed: no user returned');
      return createErrorResult(ERROR_CODES.INTERNAL_ERROR, 'ユーザーの作成に失敗しました。');
    }

    console.log('[SignUp] Auth user created successfully:', authData.user.id);

    // 組織を作成する場合（デフォルトで常に作成する）
    let organizationId: string | undefined;
    const userRole: string = 'admin'; // デフォルトで管理者

    // 組織名がない場合はデフォルト名を使用
    const finalOrgName = organizationName || `${name}の組織`;
    console.log('[SignUp] Creating organization with name:', finalOrgName);

    try {
      // Step 2: 組織を作成
      console.log('[SignUp] Step 2: Creating organization');
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: finalOrgName,
          code: `ORG-${Date.now()}`, // 仮のコード（後で変更可能）
          // is_active: true, // Temporarily commented out due to schema cache issue
        })
        .select()
        .single();

      if (orgError || !newOrg) {
        console.log('[SignUp] Organization creation failed:', orgError);
        // Authユーザーは作成済みなので、削除を試みる
        const serviceClient = await createServiceClient();
        await serviceClient.auth.admin.deleteUser(authData.user.id).catch((err) => {
          console.log('[SignUp] Failed to rollback auth user:', err);
        });
        return createErrorResult(
          ERROR_CODES.INTERNAL_ERROR,
          '組織の作成に失敗しました。もう一度お試しください。'
        );
      }

      organizationId = newOrg.id;
      console.log('[SignUp] Organization created successfully:', organizationId);

      // Step 3: users テーブルにユーザー情報を保存
      console.log('[SignUp] Step 3: Creating user record');
      const { error: userError } = await supabase.from('users').insert({
        id: authData.user.id,
        email,
        name,
        organization_id: organizationId,
        role: userRole,
        password_hash: 'supabase_auth', // Supabase Authを使用していることを示す
        // is_active: true, // Temporarily commented out due to schema cache issue
      });

      if (userError) {
        console.log('[SignUp] User table insert failed:', userError);
        // 重要なエラーなので処理を続行しない
        return createErrorResult(
          ERROR_CODES.INTERNAL_ERROR,
          'ユーザー情報の保存に失敗しました。管理者にお問い合わせください。'
        );
      }
      console.log('[SignUp] User record created successfully');

      // Step 4: ユーザーを組織に関連付け（管理者として）
      console.log('[SignUp] Step 4: Creating user-organization association');
      const { error: userOrgError } = await supabase.from('user_organizations').insert({
        user_id: authData.user.id,
        organization_id: organizationId,
        role: userRole,
        is_default: true,
      });

      if (userOrgError) {
        console.log('[SignUp] User-organization association failed:', userOrgError);
        // 重要なエラーなので処理を続行しない
        return createErrorResult(
          ERROR_CODES.INTERNAL_ERROR,
          '組織への関連付けに失敗しました。管理者にお問い合わせください。'
        );
      }
      console.log('[SignUp] User-organization association created successfully');

      // Step 5: CRITICAL - Update user's app_metadata with organization info
      console.log('[SignUp] Step 5: Updating user app_metadata');

      // Use service client for admin operations
      const serviceClient = await createServiceClient();
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
        console.log('[SignUp] WARNING: Failed to update app_metadata:', updateError);
        // app_metadataの更新に失敗しても、ログイン時に修正を試みるので続行
        // ただし、警告はログに残す
        console.log('[SignUp] Will attempt to fix app_metadata on next login');
      } else {
        console.log('[SignUp] User app_metadata updated successfully');
      }

      // 成功レスポンス
      console.log('[SignUp] Signup completed successfully');
      return createSuccessResult({
        id: authData.user.id,
        email: authData.user.email || '',
        name,
        organizationId,
        role: userRole,
      });
    } catch (dbError) {
      console.log('[SignUp] Database operation failed:', dbError);
      // Authユーザーは作成済みなので、削除を試みる（ベストエフォート）
      const serviceClient = await createServiceClient();
      await serviceClient.auth.admin.deleteUser(authData.user.id).catch((err) => {
        console.log('[SignUp] Failed to rollback auth user:', err);
      });
      return createErrorResult(
        ERROR_CODES.INTERNAL_ERROR,
        'データベースエラーが発生しました。もう一度お試しください。'
      );
    }
  } catch (error) {
    console.log('[SignUp] Unexpected error:', error);
    return handleSupabaseError(error);
  }
}

/**
 * ログイン
 */
export async function signIn(input: SignInInput): Promise<ActionResult<AuthUser>> {
  console.log('[SignIn] Starting sign in process for:', { email: input.email });

  try {
    const { email, password } = input;

    // バリデーション
    if (!email || !password) {
      console.log('[SignIn] Validation failed: missing credentials');
      return createValidationErrorResult('必須項目が入力されていません。', {
        email: !email ? 'メールアドレスは必須です' : undefined,
        password: !password ? 'パスワードは必須です' : undefined,
      });
    }

    const supabase = await createClient();

    // Supabase Authでログイン
    console.log('[SignIn] Authenticating with Supabase Auth');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.log('[SignIn] Authentication failed:', authError.message);
      if (authError.message.includes('Invalid login credentials')) {
        return createErrorResult(
          ERROR_CODES.UNAUTHORIZED,
          'メールアドレスまたはパスワードが正しくありません。'
        );
      }
      return handleSupabaseError(authError);
    }

    if (!authData.user) {
      console.log('[SignIn] Authentication failed: no user returned');
      return createErrorResult(ERROR_CODES.INTERNAL_ERROR, 'ログインに失敗しました。');
    }

    console.log('[SignIn] Authentication successful for user:', authData.user.id);
    console.log('[SignIn] Current app_metadata:', authData.user.app_metadata);

    // ユーザーの組織情報を取得
    console.log('[SignIn] Fetching user organization');
    const { data: userOrgs } = await supabase
      .from('user_organizations')
      .select('organization_id, role')
      .eq('user_id', authData.user.id)
      .eq('is_default', true)
      .single();

    // ユーザー情報を取得
    console.log('[SignIn] Fetching user data');
    const { data: userData } = await supabase
      .from('users')
      .select('name')
      .eq('id', authData.user.id)
      .single();

    // CRITICAL: Check if app_metadata needs to be fixed (production bug fix)
    const currentAppMetadata = authData.user.app_metadata;
    const needsMetadataUpdate =
      userOrgs?.organization_id &&
      (!currentAppMetadata?.current_organization_id ||
        currentAppMetadata.current_organization_id !== userOrgs.organization_id);

    if (needsMetadataUpdate) {
      console.log('[SignIn] FIXING: app_metadata is missing or incorrect, updating now');
      console.log('[SignIn] Expected org:', userOrgs.organization_id);
      console.log('[SignIn] Current org in metadata:', currentAppMetadata?.current_organization_id);

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
        console.log('[SignIn] WARNING: Failed to fix app_metadata:', updateError);
        // Continue anyway - the user can still use the app
      } else {
        console.log('[SignIn] Successfully fixed app_metadata');
      }
    } else if (userOrgs?.organization_id) {
      console.log('[SignIn] app_metadata is correctly set');
    } else {
      console.log('[SignIn] No organization found for user');
    }

    // キャッシュを再検証
    revalidatePath('/dashboard');
    revalidatePath('/');

    console.log('[SignIn] Sign in completed successfully');
    return createSuccessResult({
      id: authData.user.id,
      email: authData.user.email || '',
      name: userData?.name || authData.user.user_metadata?.name,
      organizationId: userOrgs?.organization_id,
      role: userOrgs?.role,
    });
  } catch (error) {
    console.log('[SignIn] Unexpected error:', error);
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
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return createSuccessResult(null);
    }

    // ユーザーの組織情報を取得
    const { data: userOrgs } = await supabase
      .from('user_organizations')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .single();

    // ユーザー情報を取得
    const { data: userData } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    return createSuccessResult({
      id: user.id,
      email: user.email || '',
      name: userData?.name || user.user_metadata?.name,
      organizationId: userOrgs?.organization_id,
      role: userOrgs?.role,
    });
  } catch (error) {
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
