# API Client Removal Status - Issue #355

## Summary

This document tracks the removal of deprecated API client code and migration to Server Actions as part of Issue #355.

## Completed Tasks

### 1. Deleted Files

- ✅ `/apps/web/src/lib/api-client.ts` - Deleted
- ✅ `/apps/web/src/hooks/useApiCall.ts` - Deleted
- ✅ `/apps/web/src/app/api/` directory - Deleted completely
- ✅ `/apps/web/src/lib/__tests__/api-client.test.ts` - Deleted

### 2. Commented Out Imports and Usage

The following files have had their API client imports and usage commented out with TODO markers:

#### Auth Context

- ✅ `/apps/web/src/contexts/auth-context.tsx`
  - Commented out all apiClient imports and usage
  - Functions affected: login, logout, switchOrganization, refreshUser, checkAuth
  - **Migration needed**: Integrate with Supabase auth Server Actions

#### Components

- ✅ `/apps/web/src/components/reports/ExportDialog.tsx`
  - Commented out export functionality
  - **Migration needed**: Create Server Action for report exports

#### Dashboard Pages

- ✅ `/apps/web/src/app/dashboard/settings/account/page.tsx`
  - Profile update and password change disabled
  - **Migration needed**: Use updatePassword Server Action from auth.ts
- ✅ `/apps/web/src/app/dashboard/settings/organization/page.tsx`
  - Organization settings disabled
- ✅ `/apps/web/src/app/dashboard/settings/organization/members/page.tsx`
  - Member management disabled
- ✅ `/apps/web/src/app/dashboard/ledgers/cash-book/page.tsx`
  - Cash book ledger disabled
  - Also uses deprecated useApiCall hook
- ✅ `/apps/web/src/app/dashboard/ledgers/bank-book/page.tsx`
  - Bank book ledger disabled
- ✅ `/apps/web/src/app/dashboard/ledgers/accounts-receivable/page.tsx`
  - Accounts receivable ledger disabled
- ✅ `/apps/web/src/app/dashboard/ledgers/accounts-payable/page.tsx`
  - Accounts payable ledger disabled

#### Hooks

- ⚠️ `/apps/web/src/hooks/use-file-import.ts`
  - Still exists but marked as deprecated with migration guide in comments
  - Uses apiClient for file upload and validation

#### Test Files

- ✅ `/apps/web/src/hooks/__tests__/use-file-import.test.ts`
  - Tests commented out with skip marker
- ✅ `/apps/web/src/components/journal-entries/__tests__/journal-entry-dialog.test.tsx`
  - API client mocks commented out

## Remaining Migration Tasks

### Critical - Blocking Functionality

1. **Auth Context Migration** (HIGH PRIORITY)
   - Migrate auth-context.tsx to use Supabase auth Server Actions
   - Available Server Actions in `/app/actions/auth.ts`:
     - `signIn` - for login
     - `signOut` - for logout
     - `getCurrentUser` - for refreshUser
     - `updatePassword` - for password changes
   - Need to implement organization switching with Supabase

2. **File Import/Export** (MEDIUM PRIORITY)
   - Migrate use-file-import.ts to use Server Actions
   - Implement export functionality in Server Actions for ExportDialog
   - Consider using `useServerFileImport` hook as mentioned in comments

3. **Ledger Pages** (MEDIUM PRIORITY)
   - All ledger pages need Server Actions implementation
   - Consider creating ledger-specific Server Actions similar to existing patterns

### Non-Critical - Clean Up

4. **Organization Settings**
   - Implement organization management Server Actions
   - Member management functionality

5. **Profile Updates**
   - Implement profile update Server Action
   - Currently only password update exists

## Implementation Priority

1. **Phase 1 - Critical Auth** (Immediate)
   - Fix auth-context.tsx to restore login/logout functionality
   - This is blocking user access to the application

2. **Phase 2 - Core Features** (Next Sprint)
   - Implement ledger Server Actions
   - Migrate file import/export functionality

3. **Phase 3 - Settings** (Future)
   - Organization and profile management
   - Member invitation system

## Notes

- All commented code includes `// TODO: Migrate to Server Actions - Issue #355` markers
- Original code is preserved in comments for reference during migration
- The application may have limited functionality until migration is complete
- Consider implementing a feature flag system to gradually roll out Server Actions

## Testing Considerations

- Many unit tests are currently disabled
- E2E tests may fail due to disabled functionality
- New Server Actions should include comprehensive tests
- Consider adding integration tests for Server Actions

## Related Files

- Server Actions are located in `/apps/web/src/app/actions/`
- Existing Server Actions provide good patterns to follow
- Validation schemas in `/apps/web/src/app/actions/validation/`

## Migration Resources

- [Next.js Server Actions Documentation](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions)
- [Supabase Auth with Next.js](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- Existing Server Actions in the codebase provide implementation patterns
