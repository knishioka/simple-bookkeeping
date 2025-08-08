/**
 * 認証・認可に関する型定義
 */

import { UserRole } from './enums';

import type {
  User as PrismaUser,
  Organization as PrismaOrganization,
} from '@simple-bookkeeping/database';

// ユーザー型（Prismaの型を拡張）
export interface User extends PrismaUser {
  organizations?: UserOrganization[];
}

// 組織型（Prismaの型を拡張）
export type Organization = PrismaOrganization;

// ユーザーと組織の関連
export interface UserOrganization {
  id: string;
  userId: string;
  organizationId: string;
  role: UserRole;
  isDefault: boolean;
  joinedAt: Date;
  organization?: Organization;
}

// 認証情報
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organization: Organization;
  role: UserRole;
}

// ログイン情報
export interface LoginCredentials {
  email: string;
  password: string;
}

// 認証レスポンス
export interface AuthResponse {
  user: AuthUser;
  token: string;
  refreshToken?: string;
}

// ユーザー作成DTO
export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  organizationId?: string;
}

// ユーザー更新DTO
export interface UpdateUserDto {
  email?: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
}
