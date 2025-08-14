# Configuration Structure

This document describes the configuration file structure for the Simple Bookkeeping monorepo after the consolidation effort in Issue #130.

## Overview

The project uses a hierarchical configuration approach where:

- Common settings are defined at the root level
- Application-specific overrides are defined in their respective directories
- All configuration follows the principle of DRY (Don't Repeat Yourself)

## Configuration Files

### ESLint

- **Root Configuration**: `eslint.config.js`
  - Uses the new flat config format
  - Contains all base rules and settings
  - Handles TypeScript, React, and import ordering
- **Application Overrides**: `apps/web/eslint.config.js`
  - Extends the root configuration
  - Adds Next.js specific rules
  - Handles @/ path alias resolution

### TypeScript

- **Base Configuration**: `tsconfig.base.json`
  - Common compiler options for all packages
  - Strict mode enabled
  - Module resolution settings

- **Root Configuration**: `tsconfig.json`
  - Project references for monorepo
  - No actual compilation at root level

- **Application Configurations**:
  - `apps/web/tsconfig.json` - Next.js specific settings
  - `apps/api/tsconfig.json` - Node.js backend settings
  - `packages/*/tsconfig.json` - Individual package settings

### Prettier

- **Single Configuration**: `.prettierrc`
  - Unified formatting rules for entire codebase
  - No application-specific overrides needed

### Jest

- **API Tests**: `apps/api/jest.config.js`
  - Node environment
  - ts-jest preset
  - 80% coverage threshold

- **Web Tests**: `apps/web/jest.config.js`
  - JSDOM environment
  - Next.js integration
  - 50% coverage threshold

### Playwright

- **E2E Tests**: `apps/web/playwright.config.ts`
  - Single configuration file
  - Environment-aware settings (CI vs local)
  - Multiple browser projects

### VSCode

- **Workspace Settings**: `.vscode/settings.json`
  - ESLint flat config support
  - TypeScript workspace version
  - Prettier as default formatter
  - Format on save enabled

## Directory Structure

```
.
├── eslint.config.js              # Root ESLint configuration
├── .prettierrc                   # Prettier configuration
├── tsconfig.base.json            # Base TypeScript configuration
├── tsconfig.json                 # Root TypeScript references
├── .vscode/
│   └── settings.json            # VSCode workspace settings
├── apps/
│   ├── web/
│   │   ├── eslint.config.js    # Next.js ESLint overrides
│   │   ├── tsconfig.json       # Next.js TypeScript config
│   │   ├── jest.config.js      # Web unit tests config
│   │   └── playwright.config.ts # E2E tests config
│   └── api/
│       ├── tsconfig.json       # API TypeScript config
│       └── jest.config.js      # API unit tests config
└── packages/
    └── */
        └── tsconfig.json       # Package-specific TypeScript config
```

## Migration Notes

### Removed Files

The following duplicate/obsolete configuration files have been removed:

- `.eslintrc.js` (replaced by `eslint.config.js`)
- `eslint.config.mjs` (duplicate of `eslint.config.js`)
- `apps/web/.eslintrc.js` (replaced by `apps/web/eslint.config.js`)
- `apps/web/eslint.config.mjs` (duplicate)
- `apps/web/playwright.config.optimized.ts` (duplicate with minimal differences)
- All `.eslintrc.js.backup` files (backup files)

### Benefits

1. **Reduced Duplication**: Configuration is now properly hierarchical
2. **Clearer Override Structure**: Easy to see what's different per app
3. **Easier Maintenance**: Changes to common rules only need one update
4. **Better IDE Support**: VSCode settings properly configured
5. **Consistent Formatting**: Single Prettier config ensures consistency

## Best Practices

1. **Always extend base configs** rather than duplicating rules
2. **Document overrides** with comments explaining why they're needed
3. **Keep application-specific settings minimal**
4. **Test configuration changes** with lint/build/test commands
5. **Update this document** when making configuration changes
