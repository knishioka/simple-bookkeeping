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

import { createClient } from '@/lib/supabase/server';

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
  try {
    const { email, password, name, organizationName } = input;

    // バリデーション
    if (!email || !password || !name) {
      return createValidationErrorResult('必須項目が入力されていません。', {
        email: !email ? 'メールアドレスは必須です' : undefined,
        password: !password ? 'パスワードは必須です' : undefined,
        name: !name ? '氏名は必須です' : undefined,
      });
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return createValidationErrorResult('メールアドレスの形式が正しくありません。');
    }

    // パスワードの強度チェック
    if (password.length < 8) {
      return createValidationErrorResult('パスワードは8文字以上で入力してください。');
    }

    const supabase = await createClient();

    // Supabase Authでユーザーを作成
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
      if (authError.message.includes('already registered')) {
        return createErrorResult(
          ERROR_CODES.ALREADY_EXISTS,
          'このメールアドレスは既に登録されています。'
        );
      }
      return handleSupabaseError(authError);
    }

    if (!authData.user) {
      return createErrorResult(ERROR_CODES.INTERNAL_ERROR, 'ユーザーの作成に失敗しました。');
    }

    // 組織を作成する場合
    let organizationId: string | undefined;
    let userRole: string | undefined;

    if (organizationName) {
      // 組織を作成
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: organizationName,
          code: `ORG-${Date.now()}`, // 仮のコード（後で変更可能）
          is_active: true,
        })
        .select()
        .single();

      if (orgError || !newOrg) {
        // ユーザー作成は成功したが組織作成に失敗した場合
        console.error('Organization creation failed:', orgError);
        return createErrorResult(
          ERROR_CODES.INTERNAL_ERROR,
          'ユーザーは作成されましたが、組織の作成に失敗しました。ログイン後に組織を作成してください。'
        );
      }

      organizationId = newOrg.id;

      // ユーザーを組織に関連付け（管理者として）
      const { error: userOrgError } = await supabase.from('user_organizations').insert({
        user_id: authData.user.id,
        organization_id: newOrg.id,
        role: 'admin',
        is_default: true,
      });

      if (userOrgError) {
        console.error('User-organization association failed:', userOrgError);
      }

      userRole = 'admin';
    }

    // users テーブルにもユーザー情報を保存（互換性のため）
    const { error: userError } = await supabase.from('users').insert({
      id: authData.user.id,
      email,
      name,
      password_hash: 'supabase_auth', // Supabase Authを使用していることを示す
      is_active: true,
    });

    if (userError) {
      console.error('User table insert failed:', userError);
    }

    return createSuccessResult({
      id: authData.user.id,
      email: authData.user.email || '',
      name,
      organizationId,
      role: userRole,
    });
  } catch (error) {
    return handleSupabaseError(error);
  }
}

/**
 * ログイン
 */
export async function signIn(input: SignInInput): Promise<ActionResult<AuthUser>> {
  try {
    const { email, password } = input;

    // バリデーション
    if (!email || !password) {
      return createValidationErrorResult('必須項目が入力されていません。', {
        email: !email ? 'メールアドレスは必須です' : undefined,
        password: !password ? 'パスワードは必須です' : undefined,
      });
    }

    const supabase = await createClient();

    // Supabase Authでログイン
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      if (authError.message.includes('Invalid login credentials')) {
        return createErrorResult(
          ERROR_CODES.UNAUTHORIZED,
          'メールアドレスまたはパスワードが正しくありません。'
        );
      }
      return handleSupabaseError(authError);
    }

    if (!authData.user) {
      return createErrorResult(ERROR_CODES.INTERNAL_ERROR, 'ログインに失敗しました。');
    }

    // ユーザーの組織情報を取得
    const { data: userOrgs } = await supabase
      .from('user_organizations')
      .select('organization_id, role')
      .eq('user_id', authData.user.id)
      .eq('is_default', true)
      .single();

    // ユーザー情報を取得
    const { data: userData } = await supabase
      .from('users')
      .select('name')
      .eq('id', authData.user.id)
      .single();

    // キャッシュを再検証
    revalidatePath('/dashboard');
    revalidatePath('/');

    return createSuccessResult({
      id: authData.user.id,
      email: authData.user.email || '',
      name: userData?.name || authData.user.user_metadata?.name,
      organizationId: userOrgs?.organization_id,
      role: userOrgs?.role,
    });
  } catch (error) {
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
