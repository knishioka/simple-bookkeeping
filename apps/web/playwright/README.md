# Playwright Configuration Documentation

This directory contains the modular Playwright configuration implemented as part of Issue #416 Priority 2 improvements.

## Directory Structure

```
playwright/
├── constants.ts         # All magic numbers, strings, and configuration constants
├── config/
│   ├── index.ts        # Central export point for all modules
│   ├── modes.ts        # Test mode configurations (fast, ci, comprehensive, local, prod)
│   ├── projects.ts     # Browser project definitions
│   ├── reporters.ts    # Test reporter configurations
│   ├── credentials.ts  # Test credential management
│   ├── timeouts.ts     # Timeout configurations
│   └── validation.ts   # Environment variable validation
└── README.md          # This file
```

## Key Features

### 1. Extracted Configuration Constants (Priority 2.1)

All magic numbers, timeouts, URLs, and hardcoded strings have been extracted to `constants.ts`:

- Timeout values for different modes
- Retry configurations
- Worker settings
- Chrome browser arguments
- Test file patterns
- Reporter output paths
- Environment variable keys

### 2. Modular Configuration Structure (Priority 2.2)

The configuration has been split into focused modules:

- **modes.ts**: Manages test execution modes and their specific settings
- **projects.ts**: Defines browser projects and device configurations
- **reporters.ts**: Configures test result reporting
- **credentials.ts**: Manages test credentials securely
- **timeouts.ts**: Centralizes timeout management
- **validation.ts**: Validates environment variables

### 3. Enhanced Security (Priority 2.3)

- Test credentials can be overridden via environment variables
- `.env.test.example` provides a template for secure credential management
- Credential masking functions for safe logging
- Validation of required environment variables

## Usage

### Test Modes

The configuration supports five test modes controlled by the `TEST_MODE` environment variable:

```bash
# Fast mode - Quick feedback (3-5 minutes)
TEST_MODE=fast pnpm test:e2e

# CI mode - Comprehensive CI testing (default in CI)
TEST_MODE=ci pnpm test:e2e

# Comprehensive mode - Full test suite with all browsers
TEST_MODE=comprehensive pnpm test:e2e

# Local mode - Local development (default locally)
TEST_MODE=local pnpm test:e2e

# Production mode - Test against deployed app
TEST_MODE=prod PROD_URL=https://your-app.com pnpm test:e2e
```

### Environment Variables

Copy `.env.test.example` to `.env.test` and configure as needed:

```bash
# Test credentials (optional - defaults provided)
TEST_ADMIN_EMAIL=admin@example.com
TEST_ADMIN_PASSWORD=admin123

# Supabase configuration (optional - dummy values provided)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Test execution control
DEBUG=true              # Enable debug output
EXTENDED_TIMEOUTS=true  # Use extended timeouts for slow environments
```

## Extending the Configuration

### Adding New Constants

Add new constants to `playwright/constants.ts`:

```typescript
export const MY_NEW_CONSTANTS = {
  VALUE_1: 'example',
  VALUE_2: 42,
} as const;
```

### Adding New Test Modes

1. Add the mode to `constants.ts`:

   ```typescript
   export const TEST_MODES = {
     // ... existing modes
     CUSTOM: 'custom',
   } as const;
   ```

2. Add configuration to `modes.ts`:
   ```typescript
   export const modeConfigs: Record<TestMode, ModeConfig> = {
     // ... existing configs
     [TEST_MODES.CUSTOM]: {
       timeout: 30000,
       // ... other settings
     },
   };
   ```

### Adding New Projects

Add project definitions to `projects.ts`:

```typescript
const createCustomProject = (): Project => ({
  name: 'custom-project',
  use: {
    ...devices['Desktop Chrome'],
    // Custom settings
  },
});
```

## Backward Compatibility

The refactored configuration maintains full backward compatibility:

- All existing test scripts continue to work unchanged
- CI/CD pipelines require no modifications
- Environment variable names remain the same
- Test execution behavior is identical

## Benefits

1. **Maintainability**: Configuration is organized into logical modules
2. **Type Safety**: Full TypeScript typing throughout
3. **Security**: Credentials managed through environment variables
4. **Flexibility**: Easy to add new modes, projects, or configurations
5. **Documentation**: Self-documenting through TypeScript interfaces

## Migration Notes

No migration is required. The new modular structure is a drop-in replacement for the previous monolithic configuration. All existing tests and CI/CD pipelines will continue to work without changes.
