# Deployment Guide - Simple Bookkeeping

This guide documents the deployment process for the Simple Bookkeeping monorepo application, including lessons learned from deploying to Vercel (full-stack Next.js with Server Actions) and Supabase (database and authentication).

## Overview

- **Frontend + Backend (Next.js)**: Deployed to Vercel with Server Actions
- **Database & Auth**: Supabase (PostgreSQL + Auth Service)
- **Architecture**: pnpm workspace monorepo
- **API Pattern**: Server Actions (no separate API server)

## Table of Contents

1. [Monorepo Deployment Challenges](#monorepo-deployment-challenges)
2. [Vercel Deployment (Full Stack)](#vercel-deployment-full-stack)
3. [Supabase Configuration](#supabase-configuration)
4. [Environment Variable Management](#environment-variable-management)
5. [TypeScript Build Issues and Solutions](#typescript-build-issues-and-solutions)
6. [Platform-Specific Configurations](#platform-specific-configurations)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [Best Practices](#best-practices)

## Monorepo Deployment Challenges

### 1. Shared Dependencies

**Challenge**: The Next.js app depends on shared packages (`@simple-bookkeeping/database`, `@simple-bookkeeping/shared`, etc.)

**Solution**:

- Ensure all shared packages are built before the main application
- Use proper build commands that respect dependency order
- Include workspace root in deployment context

### 2. Build Context

**Challenge**: Deployment platforms need access to the entire monorepo structure

**Solution**:

```json
// vercel.json
{
  "buildCommand": "cd ../.. && pnpm build --filter=@simple-bookkeeping/web",
  "outputDirectory": "apps/web/.next",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile"
}
```

### 3. Package Manager Compatibility

**Challenge**: pnpm's unique node_modules structure can cause issues

**Solution**:

- Always use `pnpm install --frozen-lockfile` in production
- Ensure pnpm version consistency across environments
- Some platforms may require `--shamefully-hoist` flag

## Vercel Deployment (Full Stack)

### Setup Process

1. **Initial Configuration**:

   ```bash
   cd apps/web
   vercel link
   ```

2. **vercel.json Configuration**:

   ```json
   {
     "buildCommand": "cd ../.. && pnpm build --filter=@simple-bookkeeping/web",
     "outputDirectory": "apps/web/.next",
     "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
     "framework": "nextjs",
     "devCommand": "pnpm dev --filter=@simple-bookkeeping/web"
   }
   ```

3. **Root Directory Setting**:
   - Set to `apps/web` in Vercel dashboard
   - This ensures correct context for Next.js

### Key Learnings

1. **Build Commands Must Reference Root**:
   - Always `cd ../..` to workspace root before running pnpm commands
   - This ensures access to all workspace packages

2. **Environment Variables**:

   ```bash
   # Required for Vercel
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   DATABASE_URL=your-supabase-db-url
   ```

3. **TypeScript Path Resolution**:
   - Vercel automatically handles Next.js path aliases
   - No additional configuration needed for `@/` imports

## Supabase Configuration

### Setup Process

1. **Create Supabase Project**:
   - Sign up at [supabase.com](https://supabase.com)
   - Create new project with region close to users
   - Note the project URL and API keys

2. **Database Schema Setup**:

   ```bash
   # Run migrations
   pnpm db:migrate:deploy

   # Set up Row Level Security
   pnpm supabase:rls
   ```

3. **Environment Variables**:

   ```bash
   # Public (client-side)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

   # Private (server-side)
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
   ```

### Key Learnings

1. **Row Level Security (RLS)**:
   - Enable RLS on all tables
   - Create policies for user access control
   - Test policies thoroughly

2. **Auth Configuration**:
   - Configure auth providers in Supabase dashboard
   - Set up redirect URLs for OAuth providers
   - Configure email templates

3. **Connection Pooling**:
   - Use Supabase's built-in connection pooler
   - Configure appropriate pool size for serverless

## Environment Variable Management

### Best Practices

1. **Use Platform-Specific Tools**:

   ```bash
   # Vercel
   vercel env add DATABASE_URL
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env pull .env.local

   # Local development
   cp .env.local.example .env.local
   # Edit .env.local with your values
   ```

2. **Environment-Specific Variables**:

   ```bash
   # Development (.env.local)
   DATABASE_URL=postgresql://postgres:postgres@localhost:54323/postgres
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321

   # Production (Vercel Dashboard)
   DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   ```

3. **Variable Naming Conventions**:
   - Client-side: Use `NEXT_PUBLIC_` prefix for browser-accessible variables
   - Server-side: Standard naming for Server Actions and API routes
   - Never commit `.env` files

### Security Considerations

1. **Separate Secrets by Environment**:
   - Different JWT secrets for dev/staging/prod
   - Rotate keys regularly

2. **Use Platform Secret Management**:
   - Vercel: Environment Variables in dashboard
   - Supabase: API keys in project settings
   - Use Vercel's encrypted secrets for sensitive data

## TypeScript Build Issues and Solutions

### Common Issues

1. **Module Resolution Errors**:

   ```
   Error: Cannot find module '@simple-bookkeeping/types'
   ```

   **Solution**:
   - Ensure shared packages are built first
   - Check `tsconfig.json` references configuration
   - Verify package.json exports

2. **Type Import Errors**:

   ```
   Error: Module '"@simple-bookkeeping/types"' has no exported member 'User'
   ```

   **Solution**:

   ```json
   // packages/types/package.json
   {
     "main": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "exports": {
       ".": {
         "require": "./dist/index.js",
         "import": "./dist/index.js",
         "types": "./dist/index.d.ts"
       }
     }
   }
   ```

3. **Build Order Dependencies**:
   ```json
   // Root package.json
   {
     "scripts": {
       "build": "pnpm run -r build",
       "build:deps": "pnpm --filter='./packages/*' build",
       "build:apps": "pnpm --filter='./apps/*' build"
     }
   }
   ```

### TypeScript Configuration

1. **Workspace References**:

   ```json
   // apps/api/tsconfig.json
   {
     "references": [{ "path": "../../packages/types" }, { "path": "../../packages/database" }]
   }
   ```

2. **Composite Projects**:
   ```json
   // packages/types/tsconfig.json
   {
     "compilerOptions": {
       "composite": true,
       "declaration": true,
       "declarationMap": true
     }
   }
   ```

## Platform-Specific Configurations

### Vercel

1. **vercel.json**:

   ```json
   {
     "buildCommand": "cd ../.. && pnpm build --filter=@simple-bookkeeping/web",
     "outputDirectory": "apps/web/.next",
     "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
     "framework": "nextjs"
   }
   ```

2. **Headers and Redirects**:
   ```json
   {
     "headers": [
       {
         "source": "/api/(.*)",
         "headers": [{ "key": "Access-Control-Allow-Origin", "value": "*" }]
       }
     ]
   }
   ```

### Supabase

1. **supabase/config.toml** (Local Development):

   ```toml
   [api]
   port = 54321
   schemas = ["public", "storage", "graphql_public"]

   [db]
   port = 54322
   pool_size = 10

   [auth]
   site_url = "http://localhost:3000"
   redirect_uri = "http://localhost:3000/auth/callback"
   ```

2. **Row Level Security Policies**:
   ```sql
   -- Example RLS policy
   CREATE POLICY "Users can view own data"
   ON public.transactions
   FOR SELECT
   USING (auth.uid() = user_id);
   ```

## Troubleshooting Guide

### Vercel Issues

1. **Build Fails with "Module not found"**:
   - Check if build command includes `cd ../..`
   - Verify all workspace packages are included
   - Check Node.js version compatibility

2. **Environment Variables Not Working**:
   - Frontend variables must have `NEXT_PUBLIC_` prefix
   - Redeploy after adding new variables
   - Use `vercel env pull` to sync locally

3. **404 Errors on Routes**:
   - Check Next.js dynamic routes configuration
   - Verify `getStaticPaths` for static generation
   - Ensure API routes are properly exported

### Server Actions Issues

1. **Authentication Errors**:
   - Verify Supabase service role key is set
   - Check cookie configuration for auth
   - Ensure proper session handling

2. **Database Connection Issues**:
   - Check DATABASE_URL format
   - Verify Supabase project is active
   - Check connection pool settings

3. **Server Action Failures**:
   - Check server-side logs in Vercel
   - Verify all required env variables
   - Test actions locally first

### Database Connection Issues

1. **Connection Timeout**:

   ```bash
   # Add connection parameters
   DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require&connect_timeout=10"
   ```

2. **SSL Certificate Errors**:
   ```javascript
   // For Supabase connections
   const databaseUrl = process.env.DATABASE_URL + '?sslmode=require';
   ```

## Best Practices

### 1. Deployment Checklist

- [ ] All tests passing locally
- [ ] Environment variables documented
- [ ] Build tested with production settings
- [ ] Database migrations prepared
- [ ] Health endpoints implemented
- [ ] CORS configured correctly
- [ ] Error monitoring setup

### 2. CI/CD Recommendations

1. **Automated Testing**:

   ```yaml
   # .github/workflows/test.yml
   - name: Run tests
     run: |
       pnpm install --frozen-lockfile
       pnpm test
       pnpm build
   ```

2. **Preview Deployments**:
   - Use Vercel preview deployments for PRs
   - Automatically deployed for every pull request

### 3. Monitoring and Logging

1. **Application Monitoring**:
   - Implement structured logging
   - Use services like Sentry or LogRocket
   - Monitor API response times

2. **Health Checks**:

   ```typescript
   // app/api/health/route.ts
   import { NextResponse } from 'next/server';
   import { createClient } from '@/lib/supabase/server';

   export async function GET() {
     const supabase = createClient();
     const { error } = await supabase.from('_health_check').select('*').limit(1);

     return NextResponse.json({
       status: error ? 'unhealthy' : 'healthy',
       timestamp: new Date().toISOString(),
       database: !error,
     });
   }
   ```

### 4. Security Best Practices

1. **Environment Variables**:
   - Never commit secrets to repository
   - Use different secrets per environment
   - Rotate secrets regularly

2. **Server Actions Security**:
   - Validate all inputs with Zod
   - Use Supabase RLS for data access control
   - Implement rate limiting with Vercel Edge Config
   - Always verify user authentication

### 5. Performance Optimization

1. **Frontend (Vercel)**:
   - Enable ISR for dynamic content
   - Optimize images with Next.js Image
   - Use Edge Functions for geo-distributed logic

2. **Server Actions (Vercel)**:
   - Use React Server Components for static data
   - Implement data caching with unstable_cache
   - Use Supabase's connection pooler
   - Monitor function execution time

## Specific Challenges and Solutions

### 1. Monorepo Build Context Issues

**Challenge**: Vercel couldn't find workspace packages when root directory was set to `apps/web`

**Solution**: Use `cd ../..` in build commands to access workspace root:

```json
{
  "buildCommand": "cd ../.. && pnpm build --filter=@simple-bookkeeping/web"
}
```

### 2. TypeScript Declaration Files

**Challenge**: Type imports failed in production builds despite working locally

**Solution**: Ensure all shared packages have proper TypeScript configuration:

- Set `"composite": true` in shared package tsconfig
- Export types in package.json
- Build shared packages before apps

### 3. Database Connection Pool Exhaustion

**Challenge**: Too many connections to Supabase from serverless functions

**Solution**:

```javascript
// Use connection pooling
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### 4. Server Action Authentication

**Challenge**: Ensuring Server Actions are properly authenticated

**Solution**:

```typescript
// app/actions/protected-action.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function protectedAction() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  // Action logic here
}
```

## Migration Guide

### From Express.js to Server Actions

1. **Move API logic to Server Actions**:
   - Create actions in `app/actions/`
   - Replace API calls with Server Action invocations
   - Update authentication to use Supabase

2. **Update Database Access**:
   - Replace direct Prisma calls with Supabase client
   - Implement Row Level Security policies
   - Update connection strings

3. **Remove API Dependencies**:
   - Remove Express.js and middleware packages
   - Update build scripts
   - Clean up unused environment variables

## Conclusion

Deploying a monorepo application requires careful attention to build processes, dependency management, and platform-specific configurations. The key to success is understanding how each platform handles the build context and ensuring all shared dependencies are properly resolved.

Remember to:

- Always test builds locally first
- Document all environment variables
- Monitor deployments closely after changes
- Keep platform configurations in version control
- Maintain separate environments for development and production

For additional help, consult the platform documentation:

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions)
- [Supabase Documentation](https://supabase.com/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
