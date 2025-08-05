# Simple Bookkeeping - Cleanup Report

Generated on: 2025-07-05

## Executive Summary

This report identifies various cleanup opportunities in the simple-bookkeeping codebase. The issues are categorized by type and priority.

## 1. Code Issues

### 1.1 Console Statements (31 files affected)

**High Priority - Debug/Development Logs:**

- `/apps/web/src/lib/api-client.ts` - Lines 92, 127, 187 (debug logs)
- `/apps/web/src/app/login/page.tsx` - Debug authentication logs
- `/apps/web/src/contexts/auth-context.tsx` - Error logging (lines 97, 118)
- `/apps/api/src/routes/seed.routes.ts` - Seed operation logs
- `/packages/database/prisma/seed.ts` - Database seeding logs

**Recommendation:** Replace console.log with proper logging library (already have logger in shared package)

### 1.2 TODO Comments (4 files)

**Potentially Old TODOs:**

- `/apps/web/src/contexts/auth-context.tsx`:
  - Line 59: "TODO: Validate token and get user info"
  - Line 83: "TODO: Get user's organizations"
- `/packages/database/prisma/seed.ts` - Implementation TODOs
- `/apps/web/src/components/error-boundary/error-boundary.tsx` - Error handling TODOs
- `/apps/api/src/controllers/auth.controller.ts` - Auth-related TODOs

**Recommendation:** Review and either implement or remove these TODOs

### 1.3 Hardcoded Values

- `/apps/web/src/lib/api-client.ts` - Line 186: Hardcoded API URL `http://localhost:3001/api/v1`
  - Comment indicates "Temporarily hardcode the URL while debugging env variable issue"

**Recommendation:** Fix environment variable loading issue and remove hardcoded URL

## 2. File/Directory Issues

### 2.1 Build Artifacts (Should be git-ignored)

**Already in .gitignore but present in filesystem:**

- `/apps/web/.next/` - 27MB Next.js build output
- `/apps/api/dist/` - 812KB compiled TypeScript
- `/packages/*/dist/` - Various package build outputs
- `/.turbo/` directories - Turbo cache files

**Recommendation:** These are correctly git-ignored, safe to delete locally with `pnpm clean`

### 2.2 Log Files

- `./dev.log` - Development log file
- Various `.turbo/turbo-*.log` files

**Recommendation:** Add `dev.log` to .gitignore if not already tracked

### 2.3 Empty/Unnecessary Directory

- `/packages/core/packages/database/dist` - Empty nested directory (likely created by mistake)

**Recommendation:** Remove this directory

## 3. Dependency Issues

### 3.1 Potential Unused Dependencies

**Web App (`/apps/web/package.json`):**

- `@radix-ui/react-dropdown-menu` - Check if used (have Select component)
- `@radix-ui/react-toast` - Check if used (using react-hot-toast)
- `cmdk` - Command menu library, verify usage
- `@size-limit/*` - Bundle size checking, verify if actively used
- `@axe-core/playwright` - Accessibility testing, verify usage

**Recommendation:** Run dependency analysis to confirm usage

### 3.2 DevDependencies in Dependencies

All packages appear to have correct dependency categorization.

### 3.3 Duplicate Functionality

- Toast notifications: Both `@radix-ui/react-toast` and `react-hot-toast` are installed
- Testing: Multiple testing libraries that might overlap

**Recommendation:** Standardize on one solution per functionality

## 4. Git/Version Control Issues

### 4.1 Modified Files (from git status)

Multiple files show modifications:

- Database schema changes
- Migration files deleted
- New migration directories added

**Recommendation:** Review changes and commit or revert as appropriate

### 4.2 Untracked Migration Directories

- `packages/database/prisma/migrations/20250628_add_is_system/`
- `packages/database/prisma/migrations/20250628_fix_schema_sync/`

**Recommendation:** These appear to be new migrations that need to be committed

## 5. Configuration Issues

### 5.1 TypeScript Build Info

Multiple `*.tsbuildinfo` files in dist directories - these should be git-ignored and cleaned up.

### 5.2 Test Coverage Reports

No coverage reports found (good - they're properly ignored).

## 6. Security Concerns

### 6.1 Hardcoded Sensitive Information

None found in source files (good).

### 6.2 Environment Files

All `.env` files are properly git-ignored.

## Priority Actions

### Immediate (High Priority):

1. Remove hardcoded API URL in `/apps/web/src/lib/api-client.ts`
2. Replace console.log statements with proper logging
3. Clean build artifacts: `pnpm clean`
4. Remove empty directory: `/packages/core/packages/database/dist`

### Short-term (Medium Priority):

1. Review and resolve TODO comments
2. Analyze and remove unused dependencies
3. Standardize toast notification library
4. Add `dev.log` to .gitignore

### Long-term (Low Priority):

1. Set up automated dependency analysis
2. Implement proper logging strategy
3. Add pre-commit hooks for console.log detection

## Commands for Cleanup

```bash
# Clean all build artifacts
pnpm clean

# Remove specific empty directory
rm -rf packages/core/packages/database/dist

# Find and review all console statements
grep -r "console\." --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next

# Find all TODO comments
grep -r "TODO" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next

# Check for unused dependencies (requires depcheck)
npx depcheck

# Update dependencies
pnpm update --interactive
```

## Summary

The codebase is generally well-maintained with proper git-ignore patterns and dependency management. The main cleanup opportunities are:

- Removing debug console.log statements
- Fixing the hardcoded API URL
- Reviewing old TODO comments
- Cleaning build artifacts (already ignored by git)
- Potentially removing some unused dependencies

Most issues are minor and can be addressed incrementally without disrupting development.
