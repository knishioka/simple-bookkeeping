/**
 * 勘定科目に関する型定義
 */

import { AccountType } from './enums';

import type { Account as PrismaAccount } from '@simple-bookkeeping/database';

// 基本的な勘定科目型（Prismaの型を拡張）
export interface Account extends PrismaAccount {
  // Prismaの型に追加のプロパティが必要な場合はここに追加
  parent?: Account | null;
  children?: Account[];
  _count?: {
    children: number;
    lines?: number;
  };
}

// 勘定科目作成用DTO
export interface CreateAccountDto {
  code: string;
  name: string;
  accountType: AccountType;
  parentId?: string | null;
  organizationId?: string; // APIでは自動設定されるが、型としては含める
}

// 勘定科目更新用DTO
export interface UpdateAccountDto {
  code?: string;
  name?: string;
  accountType?: AccountType;
  parentId?: string | null;
  isActive?: boolean;
}

// 勘定科目フィルター
export interface AccountFilter {
  accountType?: AccountType;
  isActive?: boolean;
  parentId?: string | null;
  searchTerm?: string;
}

// 勘定科目と残高
export interface AccountWithBalance extends Account {
  balance: number;
  debitTotal: number;
  creditTotal: number;
}

// 勘定科目ツリー表示用
export interface AccountTreeNode extends Account {
  children: AccountTreeNode[];
  level: number;
  isExpanded?: boolean;
}

// 勘定科目選択オプション（ドロップダウン用）
export interface AccountOption {
  value: string; // id
  label: string; // code + name
  type: AccountType;
  disabled?: boolean;
}
