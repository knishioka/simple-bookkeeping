# Supabase Setup Guide

## Project Information

- **Project Ref**: gmhbtrqstttwlspwvpwm
- **API URL**: https://gmhbtrqstttwlspwvpwm.supabase.co
- **Region**: ap-northeast-1 (Tokyo)

## Setup Instructions

### 1. Link to Remote Project

First, get your access token from: https://supabase.com/dashboard/account/tokens

```bash
# Set access token
export SUPABASE_ACCESS_TOKEN="your-access-token"

# Link project
supabase link --project-ref gmhbtrqstttwlspwvpwm
```

### 2. Push Database Schema

```bash
# Push the schema to remote database
supabase db push

# If you need to reset the database first (WARNING: This will delete all data)
# supabase db reset --linked
```

### 3. Configure Authentication URLs

Add these URLs in Supabase Dashboard > Authentication > URL Configuration:

**Site URL**:

- `https://simple-bookkeeping-kens-projects-924cd1a9.vercel.app`

**Redirect URLs**:

- `https://simple-bookkeeping-kens-projects-924cd1a9.vercel.app/auth/callback`
- `http://localhost:3020/auth/callback` (for local development)

### 4. Enable Email Authentication

In Supabase Dashboard > Authentication > Providers:

- Ensure Email provider is enabled
- Configure email templates if needed

## Local Development

### Start local Supabase

```bash
supabase start
```

### Stop local Supabase

```bash
supabase stop
```

### Reset local database

```bash
supabase db reset
```

## Environment Variables

The following environment variables are already configured in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

For local development, use `.env.local` file (already created).

## Database Schema

The database includes:

- Multi-tenant support with organizations
- User management integrated with Supabase Auth
- Japanese chart of accounts (勘定科目)
- Journal entries (仕訳)
- Partners (取引先)
- Audit logs
- Row Level Security (RLS) policies

## Troubleshooting

### Migration Issues

If you encounter migration errors:

```bash
# Check migration status
supabase migration list

# Create a new migration
supabase migration new migration_name
```

### Connection Issues

Ensure your database password is set correctly in the Supabase dashboard.
