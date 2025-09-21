# Simple Bookkeeping API Reference (Deprecated)

## ⚠️ IMPORTANT: This document is deprecated

The Express.js API has been completely replaced with Next.js Server Actions and Supabase.

### Current Architecture

- **Server Actions**: Business logic is now implemented in `/app/actions/`
- **Authentication**: Supabase Auth replaces JWT authentication
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Real-time**: Supabase real-time subscriptions

### Migration Guide

For information on the new architecture, see:

- [Supabase Integration Guide](./supabase/README.md)
- [Server Actions Migration](./migration/express-to-server-actions.md)
- [Authentication Migration](./migration/auth-migration.md)

### New API Pattern Examples

Instead of REST endpoints, use Server Actions:

```typescript
// Old (Express.js)
// POST /api/v1/accounts
await fetch('/api/v1/accounts', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify(accountData),
});

// New (Server Actions)
import { createAccount } from '@/app/actions/accounts';
const result = await createAccount(accountData);
```

### Authentication with Supabase

```typescript
// Old (JWT)
const token = localStorage.getItem('token');

// New (Supabase)
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
const {
  data: { user },
} = await supabase.auth.getUser();
```

### Real-time Updates

```typescript
// Subscribe to changes
const supabase = createClient();
const subscription = supabase
  .channel('accounts')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'accounts',
    },
    (payload) => {
      console.log('Change received!', payload);
    }
  )
  .subscribe();
```

For complete documentation on the new architecture, please refer to the guides linked above.
