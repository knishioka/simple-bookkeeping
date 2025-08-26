# Supabase Auth Migration Guide

This guide covers the migration from JWT-based authentication to Supabase Auth.

## Overview

The migration replaces the existing custom JWT authentication with Supabase Auth, providing:

- Built-in email verification and password reset
- Social authentication support (future)
- Better security and session management
- Multi-tenant organization support
- Role-based access control (RBAC)

## Architecture Changes

### Before (JWT Auth)

```
Client → API Server → JWT Validation → Database
```

### After (Supabase Auth)

```
Client → Supabase Auth → API Routes → Database (with RLS)
```

## Migration Steps

### 1. Environment Setup

Add the following environment variables:

```env
# .env.local (for development)
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Database Migration

Run the Supabase migrations:

```bash
# Apply auth schema and functions
supabase db push
```

### 3. User Migration

Migrate existing users from JWT to Supabase Auth:

```bash
# Run the migration script
pnpm migrate:users
```

This script will:

- Export all existing users
- Create Supabase Auth accounts
- Preserve organization associations
- Send password reset emails

### 4. Update Application Code

#### Authentication Flow

```typescript
// Login
import { authUtils } from '@simple-bookkeeping/supabase-client';

const { user, session } = await authUtils.signIn(email, password, supabase);

// Logout
await authUtils.signOut(supabase);

// Get current user
const user = await authUtils.getCurrentUser(supabase);
```

#### React Hooks

```typescript
import { useAuth } from '@simple-bookkeeping/supabase-client';

function MyComponent() {
  const { user, signIn, signOut, hasPermission } = useAuth(supabase);

  if (!hasPermission('accountant')) {
    return <div>権限がありません</div>;
  }

  // Component logic
}
```

#### Organization Switching

```typescript
import { useOrganization } from '@simple-bookkeeping/supabase-client';

function OrganizationSwitcher() {
  const { organizations, currentOrganization, switchToOrganization } = useOrganization(supabase);

  const handleSwitch = async (orgId: string) => {
    await switchToOrganization(orgId);
    // Refresh the page or update state
  };

  return (
    <select onChange={(e) => handleSwitch(e.target.value)}>
      {organizations.map(org => (
        <option key={org.id} value={org.id}>
          {org.name} ({org.role})
        </option>
      ))}
    </select>
  );
}
```

## API Routes

### Authentication Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/reset-password` - Send password reset email
- `POST /api/auth/switch-organization` - Switch active organization
- `GET /api/auth/callback` - OAuth callback handler

### Middleware Protection

The middleware automatically protects routes:

```typescript
// middleware.ts
- Public routes: `/`, `/auth/*`, `/demo/*`
- Protected routes: All other routes require authentication
- Admin routes: `/admin/*`, `/settings/*` require admin role
- Accountant routes: `/accounting/*`, `/reports/*` require accountant role
```

## Database Functions

### Organization Management

```sql
-- Switch user's organization
SELECT switch_user_organization('organization-id');

-- Add user to organization
SELECT add_user_to_organization('user@email.com', 'org-id', 'role');

-- Update user role
SELECT update_user_role('user-id', 'org-id', 'new-role');

-- Remove user from organization
SELECT remove_user_from_organization('user-id', 'org-id');

-- Get user's organizations
SELECT * FROM get_user_organizations();
```

## Row Level Security (RLS)

All tables have RLS policies based on:

1. User's current organization ID
2. User's role in the organization
3. Specific permissions per role

Example policy:

```sql
CREATE POLICY "Users can only see data from their organization"
ON journal_entries
FOR SELECT
USING (organization_id = auth.jwt()->>'current_organization_id');
```

## Testing

### Unit Tests

```bash
pnpm test
```

### E2E Tests

```bash
pnpm test:e2e
```

### Manual Testing Checklist

- [ ] User can sign up with email
- [ ] User receives verification email
- [ ] User can login with email/password
- [ ] User can reset password
- [ ] User can switch organizations
- [ ] Role-based access control works
- [ ] Session persists across page refreshes
- [ ] Logout clears session properly

## Rollback Plan

If issues occur, rollback steps:

1. Revert to previous git commit
2. Restore JWT authentication code
3. Update environment variables
4. Inform users about the rollback

## Security Considerations

1. **Service Role Key**: Never expose in client-side code
2. **RLS Policies**: Always enabled on production
3. **Email Verification**: Required for new accounts
4. **Password Requirements**: Minimum 8 characters
5. **Session Management**: Auto-refresh with secure cookies

## Troubleshooting

### Common Issues

1. **"Not authenticated" error**
   - Check if session cookie is set
   - Verify Supabase URL and anon key
   - Check middleware configuration

2. **"Organization not found" error**
   - Ensure user has organization in metadata
   - Run organization sync function

3. **Password reset not working**
   - Check email configuration in Supabase dashboard
   - Verify redirect URL is correct

4. **RLS policy violations**
   - Check user's organization ID
   - Verify role permissions
   - Review RLS policies

## Support

For issues or questions:

1. Check the [Supabase documentation](https://supabase.com/docs)
2. Review error logs in Supabase dashboard
3. Check application logs for detailed errors
