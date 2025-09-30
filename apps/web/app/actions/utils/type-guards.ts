/**
 * Type Guards for Server Actions
 *
 * These type guards ensure type safety and replace unsafe type assertions
 */

/**
 * Type guard to check if a value has a specific property
 */
export function hasProperty<K extends PropertyKey>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return obj !== null && typeof obj === 'object' && key in obj;
}

/**
 * Type guard for user role from database join result
 */
export interface UserOrgWithRole {
  user_organizations: Array<{ role: string }>;
}

export function hasUserOrgRole(obj: unknown): obj is UserOrgWithRole {
  if (!hasProperty(obj, 'user_organizations')) {
    return false;
  }

  const userOrgs = obj.user_organizations;
  if (!Array.isArray(userOrgs) || userOrgs.length === 0) {
    return false;
  }

  return typeof userOrgs[0]?.role === 'string';
}

/**
 * Type guard for Supabase error objects
 */
export interface SupabaseError {
  code?: string;
  message?: string;
  details?: string;
}

export function isSupabaseError(error: unknown): error is SupabaseError {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as Record<string, unknown>;

  // Check if it has expected error properties
  return (
    (typeof err.code === 'string' || err.code === undefined) &&
    (typeof err.message === 'string' || err.message === undefined) &&
    (typeof err.details === 'string' || err.details === undefined)
  );
}

/**
 * Type guard for checking if a value is a valid UUID
 */
export function isValidUUID(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Type guard for checking if a value is a valid date string (YYYY-MM-DD)
 */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) {
    return false;
  }

  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Type guard for checking if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Type guard for checking if a value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && value > 0 && !isNaN(value);
}

/**
 * Type guard for checking array of specific type
 */
export function isArrayOf<T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(itemGuard);
}

/**
 * Extract user role safely from database result
 */
export function extractUserRole(data: unknown): string | null {
  if (!hasUserOrgRole(data)) {
    return null;
  }

  return data.user_organizations[0]?.role || null;
}
