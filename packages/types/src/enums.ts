/**
 * 共通の列挙型定義
 * Prismaスキーマと同期
 */

// 勘定科目タイプ（Prismaと同じ）
export const AccountType = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE',
} as const;

export type AccountType = (typeof AccountType)[keyof typeof AccountType];

// ユーザーロール
export const UserRole = {
  ADMIN: 'ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
  VIEWER: 'VIEWER',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// 仕訳ステータス
export const JournalEntryStatus = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  POSTED: 'POSTED',
  CANCELLED: 'CANCELLED',
} as const;

export type JournalEntryStatus = (typeof JournalEntryStatus)[keyof typeof JournalEntryStatus];

// 日本語ラベル
export const AccountTypeLabels: Record<AccountType, string> = {
  ASSET: '資産',
  LIABILITY: '負債',
  EQUITY: '純資産',
  REVENUE: '収益',
  EXPENSE: '費用',
};

export const UserRoleLabels: Record<UserRole, string> = {
  ADMIN: '管理者',
  ACCOUNTANT: '経理担当者',
  VIEWER: '閲覧者',
};

export const JournalEntryStatusLabels: Record<JournalEntryStatus, string> = {
  DRAFT: '下書き',
  APPROVED: '承認済み',
  POSTED: '転記済み',
  CANCELLED: 'キャンセル',
};
