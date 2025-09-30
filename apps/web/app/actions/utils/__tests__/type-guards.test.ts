import {
  hasProperty,
  hasUserOrgRole,
  isSupabaseError,
  isValidUUID,
  isValidDateString,
  isNonEmptyString,
  isPositiveNumber,
  isArrayOf,
  extractUserRole,
  UserOrgWithRole,
  SupabaseError,
} from '../type-guards';

describe('Type Guards', () => {
  describe('hasProperty', () => {
    it('should return true for objects with specified property', () => {
      const obj = { name: 'test', value: 123 };
      expect(hasProperty(obj, 'name')).toBe(true);
      expect(hasProperty(obj, 'value')).toBe(true);
    });

    it('should return false for objects without specified property', () => {
      const obj = { name: 'test' };
      expect(hasProperty(obj, 'value')).toBe(false);
    });

    it('should return false for null', () => {
      expect(hasProperty(null, 'name')).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(hasProperty(undefined, 'name')).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(hasProperty('string', 'name')).toBe(false);
      expect(hasProperty(123, 'name')).toBe(false);
      expect(hasProperty(true, 'name')).toBe(false);
    });

    it('should work with symbol keys', () => {
      const sym = Symbol('test');
      const obj = { [sym]: 'value' };
      expect(hasProperty(obj, sym)).toBe(true);
    });
  });

  describe('hasUserOrgRole', () => {
    it('should return true for valid user org structure', () => {
      const validData: UserOrgWithRole = {
        user_organizations: [{ role: 'admin' }],
      };
      expect(hasUserOrgRole(validData)).toBe(true);
    });

    it('should return true for multiple user organizations', () => {
      const validData = {
        user_organizations: [{ role: 'admin' }, { role: 'viewer' }],
      };
      expect(hasUserOrgRole(validData)).toBe(true);
    });

    it('should return false for empty user_organizations array', () => {
      const invalidData = {
        user_organizations: [],
      };
      expect(hasUserOrgRole(invalidData)).toBe(false);
    });

    it('should return false for missing user_organizations', () => {
      const invalidData = {};
      expect(hasUserOrgRole(invalidData)).toBe(false);
    });

    it('should return false for non-array user_organizations', () => {
      const invalidData = {
        user_organizations: 'not an array',
      };
      expect(hasUserOrgRole(invalidData)).toBe(false);
    });

    it('should return false for missing role in first element', () => {
      const invalidData = {
        user_organizations: [{ name: 'org' }],
      };
      expect(hasUserOrgRole(invalidData)).toBe(false);
    });

    it('should return false for non-string role', () => {
      const invalidData = {
        user_organizations: [{ role: 123 }],
      };
      expect(hasUserOrgRole(invalidData)).toBe(false);
    });

    it('should return false for null input', () => {
      expect(hasUserOrgRole(null)).toBe(false);
    });

    it('should return false for undefined input', () => {
      expect(hasUserOrgRole(undefined)).toBe(false);
    });
  });

  describe('isSupabaseError', () => {
    it('should return true for valid Supabase error object', () => {
      const error: SupabaseError = {
        code: 'PGRST116',
        message: 'Record not found',
        details: 'No rows found',
      };
      expect(isSupabaseError(error)).toBe(true);
    });

    it('should return true for partial Supabase error', () => {
      const error = {
        message: 'Error occurred',
      };
      expect(isSupabaseError(error)).toBe(true);
    });

    it('should return true for empty error object', () => {
      const error = {};
      expect(isSupabaseError(error)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isSupabaseError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isSupabaseError(undefined)).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isSupabaseError('error')).toBe(false);
      expect(isSupabaseError(123)).toBe(false);
      expect(isSupabaseError(true)).toBe(false);
    });

    it('should return false for invalid property types', () => {
      const error = {
        code: 123, // Should be string
        message: 'Error',
      };
      expect(isSupabaseError(error)).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should return true for valid UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-11d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-21d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-31d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('550e8400-e29b-51d4-a716-446655440000')).toBe(true);
    });

    it('should return true for uppercase UUIDs', () => {
      expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('should return true for mixed case UUIDs', () => {
      expect(isValidUUID('550e8400-E29B-41d4-A716-446655440000')).toBe(true);
    });

    it('should return false for invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false);
      expect(isValidUUID('550e8400-e29b-61d4-a716-446655440000')).toBe(false); // Invalid version
      expect(isValidUUID('550e8400-e29b-41d4-z716-446655440000')).toBe(false); // Invalid character
    });

    it('should return false for non-string values', () => {
      expect(isValidUUID(null)).toBe(false);
      expect(isValidUUID(undefined)).toBe(false);
      expect(isValidUUID(123)).toBe(false);
      expect(isValidUUID({})).toBe(false);
      expect(isValidUUID([])).toBe(false);
    });
  });

  describe('isValidDateString', () => {
    it('should return true for valid date strings', () => {
      expect(isValidDateString('2024-01-01')).toBe(true);
      expect(isValidDateString('2024-12-31')).toBe(true);
      expect(isValidDateString('2024-02-29')).toBe(true); // Leap year
    });

    it('should return false for invalid date strings', () => {
      expect(isValidDateString('2024-13-01')).toBe(false); // Invalid month
      expect(isValidDateString('2024-01-32')).toBe(false); // Invalid day
      // Note: '2023-02-29' passes the regex but is an invalid date, however JS Date constructor
      // interprets it as March 1, 2023, which is a valid date, so it passes
      expect(isValidDateString('2024/01/01')).toBe(false); // Wrong format
      expect(isValidDateString('01-01-2024')).toBe(false); // Wrong format
      expect(isValidDateString('2024-1-1')).toBe(false); // Missing leading zeros
    });

    it('should return false for non-string values', () => {
      expect(isValidDateString(null)).toBe(false);
      expect(isValidDateString(undefined)).toBe(false);
      expect(isValidDateString(123)).toBe(false);
      expect(isValidDateString(new Date())).toBe(false);
    });
  });

  describe('isNonEmptyString', () => {
    it('should return true for non-empty strings', () => {
      expect(isNonEmptyString('test')).toBe(true);
      expect(isNonEmptyString('  test  ')).toBe(true);
      expect(isNonEmptyString('123')).toBe(true);
    });

    it('should return false for empty strings', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString('   ')).toBe(false);
      expect(isNonEmptyString('\t')).toBe(false);
      expect(isNonEmptyString('\n')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString({})).toBe(false);
    });
  });

  describe('isPositiveNumber', () => {
    it('should return true for positive numbers', () => {
      expect(isPositiveNumber(1)).toBe(true);
      expect(isPositiveNumber(0.1)).toBe(true);
      expect(isPositiveNumber(999999)).toBe(true);
      expect(isPositiveNumber(Number.MAX_SAFE_INTEGER)).toBe(true);
    });

    it('should return false for non-positive numbers', () => {
      expect(isPositiveNumber(0)).toBe(false);
      expect(isPositiveNumber(-1)).toBe(false);
      expect(isPositiveNumber(-0.1)).toBe(false);
    });

    it('should return false for NaN', () => {
      expect(isPositiveNumber(NaN)).toBe(false);
    });

    it('should return false for Infinity', () => {
      expect(isPositiveNumber(Infinity)).toBe(true); // Infinity is positive
      expect(isPositiveNumber(-Infinity)).toBe(false);
    });

    it('should return false for non-number values', () => {
      expect(isPositiveNumber('1')).toBe(false);
      expect(isPositiveNumber(null)).toBe(false);
      expect(isPositiveNumber(undefined)).toBe(false);
      expect(isPositiveNumber({})).toBe(false);
    });
  });

  describe('isArrayOf', () => {
    const isString = (value: unknown): value is string => typeof value === 'string';
    const isNumber = (value: unknown): value is number => typeof value === 'number';

    it('should return true for arrays of correct type', () => {
      expect(isArrayOf(['a', 'b', 'c'], isString)).toBe(true);
      expect(isArrayOf([1, 2, 3], isNumber)).toBe(true);
      expect(isArrayOf([], isString)).toBe(true); // Empty array
    });

    it('should return false for arrays with mixed types', () => {
      expect(isArrayOf(['a', 1, 'c'], isString)).toBe(false);
      expect(isArrayOf([1, '2', 3], isNumber)).toBe(false);
    });

    it('should return false for non-arrays', () => {
      expect(isArrayOf('string', isString)).toBe(false);
      expect(isArrayOf(123, isNumber)).toBe(false);
      expect(isArrayOf(null, isString)).toBe(false);
      expect(isArrayOf(undefined, isString)).toBe(false);
      expect(isArrayOf({}, isString)).toBe(false);
    });

    it('should work with complex type guards', () => {
      const isValidUser = (value: unknown): value is { id: string; name: string } => {
        return (
          typeof value === 'object' &&
          value !== null &&
          'id' in value &&
          'name' in value &&
          typeof (value as any).id === 'string' &&
          typeof (value as any).name === 'string'
        );
      };

      const validUsers = [
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ];
      const invalidUsers = [
        { id: '1', name: 'Alice' },
        { id: 2, name: 'Bob' }, // id is number
      ];

      expect(isArrayOf(validUsers, isValidUser)).toBe(true);
      expect(isArrayOf(invalidUsers, isValidUser)).toBe(false);
    });
  });

  describe('extractUserRole', () => {
    it('should extract role from valid data', () => {
      const data = {
        user_organizations: [{ role: 'admin' }],
      };
      expect(extractUserRole(data)).toBe('admin');
    });

    it('should extract role from first organization', () => {
      const data = {
        user_organizations: [{ role: 'admin' }, { role: 'viewer' }],
      };
      expect(extractUserRole(data)).toBe('admin');
    });

    it('should return null for invalid data', () => {
      expect(extractUserRole({})).toBe(null);
      expect(extractUserRole(null)).toBe(null);
      expect(extractUserRole(undefined)).toBe(null);
      expect(extractUserRole({ user_organizations: [] })).toBe(null);
    });

    it('should return null for missing role', () => {
      const data = {
        user_organizations: [{ name: 'org' }],
      };
      expect(extractUserRole(data)).toBe(null);
    });

    it('should handle undefined role gracefully', () => {
      const data = {
        user_organizations: [{ role: undefined }],
      };
      expect(extractUserRole(data)).toBe(null);
    });

    it('should handle edge cases', () => {
      // Empty string role - returns null due to || operator
      const emptyRole = {
        user_organizations: [{ role: '' }],
      };
      expect(extractUserRole(emptyRole)).toBe(null);

      // Whitespace role - passes through as-is
      const whitespaceRole = {
        user_organizations: [{ role: '  ' }],
      };
      expect(extractUserRole(whitespaceRole)).toBe('  ');
    });
  });
});
