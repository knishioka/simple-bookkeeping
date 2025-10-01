'use server';

import crypto from 'crypto';

import { cookies } from 'next/headers';
import * as QRCode from 'qrcode';
import * as speakeasy from 'speakeasy';
import { z } from 'zod';

import { getSecureErrorMessage, Language, logErrorSecurely } from '@/lib/error-messages';
import { createServerClient } from '@/lib/supabase';

/**
 * MFA configuration
 */
const MFA_CONFIG = {
  issuer: 'Simple Bookkeeping',
  algorithm: 'sha256' as const,
  digits: 6,
  step: 30, // Time step in seconds
  window: 2, // Allow 2 time steps before/after current
  backupCodeCount: 10,
  backupCodeLength: 8,
};

/**
 * MFA enrollment response
 */
export interface MFAEnrollmentResponse {
  success: boolean;
  secret?: string;
  qrCodeUrl?: string;
  backupCodes?: string[];
  error?: string;
}

/**
 * MFA verification response
 */
export interface MFAVerificationResponse {
  success: boolean;
  verified: boolean;
  error?: string;
}

/**
 * MFA status response
 */
export interface MFAStatusResponse {
  success: boolean;
  enabled: boolean;
  enrolledAt?: string;
  lastUsedAt?: string;
  error?: string;
}

/**
 * Input validation schemas
 */
const enrollMFASchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

const verifyMFASchema = z.object({
  token: z.string().length(6).regex(/^\d+$/, 'Token must be 6 digits'),
});

const disableMFASchema = z.object({
  password: z.string().min(1, 'Password is required'),
  token: z.string().length(6).regex(/^\d+$/, 'Token must be 6 digits'),
});

/**
 * Generate backup codes
 */
function generateBackupCodes(count: number = MFA_CONFIG.backupCodeCount): string[] {
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = crypto
      .randomBytes(MFA_CONFIG.backupCodeLength)
      .toString('hex')
      .substring(0, MFA_CONFIG.backupCodeLength)
      .toUpperCase();
    codes.push(code);
  }

  return codes;
}

/**
 * Hash backup codes for storage
 */
function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Enroll user in MFA (TOTP)
 */
export async function enrollMFA(formData: FormData): Promise<MFAEnrollmentResponse> {
  try {
    // Validate input
    const validation = enrollMFASchema.safeParse({
      password: formData.get('password'),
    });

    if (!validation.success) {
      return {
        success: false,
        error: validation.error.errors[0].message,
      };
    }

    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    });

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        error: getSecureErrorMessage('auth/invalid-token', Language.JA),
      };
    }

    // Verify password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: validation.data.password,
    });

    if (signInError) {
      return {
        success: false,
        error: getSecureErrorMessage('auth/wrong-password', Language.JA),
      };
    }

    // Check if MFA is already enabled
    const { data: profile } = await supabase
      .from('profiles')
      .select('mfa_enabled')
      .eq('user_id', user.id)
      .single();

    if (profile?.mfa_enabled) {
      return {
        success: false,
        error: 'MFAは既に有効になっています',
      };
    }

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `${MFA_CONFIG.issuer} (${user.email})`,
      issuer: MFA_CONFIG.issuer,
      length: 32,
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    // Generate backup codes
    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = backupCodes.map(hashBackupCode);

    // Store MFA secret and backup codes (encrypted)
    // Note: In production, encrypt the secret before storing
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        mfa_secret: secret.base32, // Should be encrypted in production
        mfa_backup_codes: hashedBackupCodes,
        mfa_enrolled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      logErrorSecurely({
        error: updateError,
        context: { action: 'enrollMFA', userId: user.id },
      });
      return {
        success: false,
        error: 'MFA登録に失敗しました',
      };
    }

    return {
      success: true,
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
    };
  } catch (error) {
    logErrorSecurely({
      error,
      context: { action: 'enrollMFA' },
    });
    return {
      success: false,
      error: getSecureErrorMessage(error, Language.JA),
    };
  }
}

/**
 * Verify MFA token
 */
export async function verifyMFA(formData: FormData): Promise<MFAVerificationResponse> {
  try {
    // Validate input
    const validation = verifyMFASchema.safeParse({
      token: formData.get('token'),
    });

    if (!validation.success) {
      return {
        success: false,
        verified: false,
        error: validation.error.errors[0].message,
      };
    }

    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    });

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        verified: false,
        error: getSecureErrorMessage('auth/invalid-token', Language.JA),
      };
    }

    // Get MFA secret from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('mfa_secret, mfa_enabled, mfa_backup_codes')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.mfa_secret) {
      return {
        success: false,
        verified: false,
        error: 'MFAが設定されていません',
      };
    }

    const token = validation.data.token;

    // First, try to verify as TOTP token
    const verified = speakeasy.totp.verify({
      secret: profile.mfa_secret,
      encoding: 'base32',
      token,
      algorithm: MFA_CONFIG.algorithm,
      digits: MFA_CONFIG.digits,
      step: MFA_CONFIG.step,
      window: MFA_CONFIG.window,
    });

    if (verified) {
      // Update last used timestamp
      await supabase
        .from('profiles')
        .update({
          mfa_last_used_at: new Date().toISOString(),
          mfa_enabled: true, // Enable MFA if first successful verification
        })
        .eq('user_id', user.id);

      return {
        success: true,
        verified: true,
      };
    }

    // If TOTP fails, check backup codes
    if (profile.mfa_backup_codes && Array.isArray(profile.mfa_backup_codes)) {
      const hashedToken = hashBackupCode(token.toUpperCase());
      const backupCodeIndex = profile.mfa_backup_codes.indexOf(hashedToken);

      if (backupCodeIndex !== -1) {
        // Remove used backup code
        const updatedCodes = [...profile.mfa_backup_codes];
        updatedCodes.splice(backupCodeIndex, 1);

        await supabase
          .from('profiles')
          .update({
            mfa_backup_codes: updatedCodes,
            mfa_last_used_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        return {
          success: true,
          verified: true,
        };
      }
    }

    return {
      success: false,
      verified: false,
      error: '認証コードが正しくありません',
    };
  } catch (error) {
    logErrorSecurely({
      error,
      context: { action: 'verifyMFA' },
    });
    return {
      success: false,
      verified: false,
      error: getSecureErrorMessage(error, Language.JA),
    };
  }
}

/**
 * Disable MFA for user
 */
export async function disableMFA(formData: FormData): Promise<MFAVerificationResponse> {
  try {
    // Validate input
    const validation = disableMFASchema.safeParse({
      password: formData.get('password'),
      token: formData.get('token'),
    });

    if (!validation.success) {
      return {
        success: false,
        verified: false,
        error: validation.error.errors[0].message,
      };
    }

    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    });

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        verified: false,
        error: getSecureErrorMessage('auth/invalid-token', Language.JA),
      };
    }

    // Verify password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: validation.data.password,
    });

    if (signInError) {
      return {
        success: false,
        verified: false,
        error: getSecureErrorMessage('auth/wrong-password', Language.JA),
      };
    }

    // Verify MFA token first
    const verifyResult = await verifyMFA(formData);
    if (!verifyResult.verified) {
      return verifyResult;
    }

    // Disable MFA
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        mfa_enabled: false,
        mfa_secret: null,
        mfa_backup_codes: null,
        mfa_enrolled_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      logErrorSecurely({
        error: updateError,
        context: { action: 'disableMFA', userId: user.id },
      });
      return {
        success: false,
        verified: false,
        error: 'MFA無効化に失敗しました',
      };
    }

    return {
      success: true,
      verified: true,
    };
  } catch (error) {
    logErrorSecurely({
      error,
      context: { action: 'disableMFA' },
    });
    return {
      success: false,
      verified: false,
      error: getSecureErrorMessage(error, Language.JA),
    };
  }
}

/**
 * Get MFA status for current user
 */
export async function getMFAStatus(): Promise<MFAStatusResponse> {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    });

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        enabled: false,
        error: getSecureErrorMessage('auth/invalid-token', Language.JA),
      };
    }

    // Get MFA status from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('mfa_enabled, mfa_enrolled_at, mfa_last_used_at')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      logErrorSecurely({
        error: profileError,
        context: { action: 'getMFAStatus', userId: user.id },
      });
      return {
        success: false,
        enabled: false,
        error: 'MFAステータスの取得に失敗しました',
      };
    }

    return {
      success: true,
      enabled: profile?.mfa_enabled || false,
      enrolledAt: profile?.mfa_enrolled_at,
      lastUsedAt: profile?.mfa_last_used_at,
    };
  } catch (error) {
    logErrorSecurely({
      error,
      context: { action: 'getMFAStatus' },
    });
    return {
      success: false,
      enabled: false,
      error: getSecureErrorMessage(error, Language.JA),
    };
  }
}

/**
 * Generate new backup codes
 */
export async function regenerateBackupCodes(formData: FormData): Promise<MFAEnrollmentResponse> {
  try {
    // Validate input (requires password and current MFA token)
    const validation = disableMFASchema.safeParse({
      password: formData.get('password'),
      token: formData.get('token'),
    });

    if (!validation.success) {
      return {
        success: false,
        error: validation.error.errors[0].message,
      };
    }

    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    });

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        error: getSecureErrorMessage('auth/invalid-token', Language.JA),
      };
    }

    // Verify password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: validation.data.password,
    });

    if (signInError) {
      return {
        success: false,
        error: getSecureErrorMessage('auth/wrong-password', Language.JA),
      };
    }

    // Verify MFA token
    const verifyResult = await verifyMFA(formData);
    if (!verifyResult.verified) {
      return {
        success: false,
        error: verifyResult.error,
      };
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes();
    const hashedBackupCodes = backupCodes.map(hashBackupCode);

    // Update backup codes
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        mfa_backup_codes: hashedBackupCodes,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      logErrorSecurely({
        error: updateError,
        context: { action: 'regenerateBackupCodes', userId: user.id },
      });
      return {
        success: false,
        error: 'バックアップコードの再生成に失敗しました',
      };
    }

    return {
      success: true,
      backupCodes,
    };
  } catch (error) {
    logErrorSecurely({
      error,
      context: { action: 'regenerateBackupCodes' },
    });
    return {
      success: false,
      error: getSecureErrorMessage(error, Language.JA),
    };
  }
}
