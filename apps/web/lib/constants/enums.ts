/**
 * Shared enums for the application
 * These were previously imported from @simple-bookkeeping/database
 * but are now defined directly in the app after Prisma removal (Issue #557)
 */

/**
 * User role enum - defines permission levels
 */
export const UserRole = {
  ADMIN: 'ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
  VIEWER: 'VIEWER',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/**
 * Audit action enum - defines types of auditable actions
 */
export const AuditAction = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  APPROVE: 'APPROVE',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
