/**
 * 認証関連のバリデーションスキーマ
 */

import { z } from 'zod';

import { UserRole } from '../types/enums';

// ログインスキーマ
export const loginSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
});

// ユーザー作成スキーマ
export const createUserSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
  name: z.string().min(1, '名前を入力してください'),
  role: z.enum([UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.VIEWER]),
});

// ユーザー更新スキーマ
export const updateUserSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません').optional(),
  name: z.string().min(1, '名前を入力してください').optional(),
  role: z.enum([UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.VIEWER]).optional(),
  isActive: z.boolean().optional(),
});

// ユーザープロフィール更新スキーマ
export const updateUserProfileSchema = z.object({
  name: z.string().min(1, '名前を入力してください'),
});

// パスワード変更スキーマ
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '現在のパスワードを入力してください'),
    newPassword: z.string().min(8, '新しいパスワードは8文字以上で入力してください'),
    confirmPassword: z.string().min(1, '確認用パスワードを入力してください'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
  });

// 型のエクスポート
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
