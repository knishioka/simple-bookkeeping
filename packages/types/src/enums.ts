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

// 組織タイプ（Prismaと同じ）
export const OrganizationType = {
  SOLE_PROPRIETOR: 'SOLE_PROPRIETOR',
  CORPORATION: 'CORPORATION',
  BOTH: 'BOTH',
} as const;

export type OrganizationType = (typeof OrganizationType)[keyof typeof OrganizationType];

// 取引先タイプ（Prismaと同じ）
export const PartnerType = {
  CUSTOMER: 'CUSTOMER',
  VENDOR: 'VENDOR',
  BOTH: 'BOTH',
} as const;

export type PartnerType = (typeof PartnerType)[keyof typeof PartnerType];

// 監査アクション（Prismaと同じ）
export const AuditAction = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  APPROVE: 'APPROVE',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

// ユーザーロール
export const UserRole = {
  ADMIN: 'ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
  VIEWER: 'VIEWER',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// 仕訳ステータス（Prismaスキーマと一致）
export const JournalStatus = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  LOCKED: 'LOCKED',
} as const;

export type JournalStatus = (typeof JournalStatus)[keyof typeof JournalStatus];

// 後方互換性のための型エイリアス（非推奨）
/** @deprecated Use JournalStatus instead */
export const JournalEntryStatus = JournalStatus;
/** @deprecated Use JournalStatus instead */
export type JournalEntryStatus = JournalStatus;

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

export const JournalStatusLabels: Record<JournalStatus, string> = {
  DRAFT: '下書き',
  APPROVED: '承認済み',
  LOCKED: 'ロック済み',
};

// 後方互換性のための型エイリアス（非推奨）
/** @deprecated Use JournalStatusLabels instead */
export const JournalEntryStatusLabels = JournalStatusLabels;

export const OrganizationTypeLabels: Record<OrganizationType, string> = {
  SOLE_PROPRIETOR: '個人事業主',
  CORPORATION: '法人',
  BOTH: '両方',
};

export const PartnerTypeLabels: Record<PartnerType, string> = {
  CUSTOMER: '顧客',
  VENDOR: '仕入先',
  BOTH: '両方',
};

export const AuditActionLabels: Record<AuditAction, string> = {
  CREATE: '作成',
  UPDATE: '更新',
  DELETE: '削除',
  APPROVE: '承認',
};
