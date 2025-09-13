# Deployment Guide - Simple Bookkeeping

This guide documents the deployment process for the Simple Bookkeeping monorepo application, including lessons learned from deploying to Vercel (frontend) and Render (backend).

## Overview

- **Frontend (Next.js)**: Deployed to Vercel
- **Backend (Express.js)**: Deployed to Render
- **Database**: Supabase (PostgreSQL)
- **Architecture**: pnpm workspace monorepo

## Table of Contents

1. [Monorepo Deployment Challenges](#monorepo-deployment-challenges)
2. [Vercel Deployment (Frontend)](#vercel-deployment-frontend)
3. [Render Deployment (Backend)](#render-deployment-backend)
4. [Environment Variable Management](#environment-variable-management)
5. [TypeScript Build Issues and Solutions](#typescript-build-issues-and-solutions)
6. [Platform-Specific Configurations](#platform-specific-configurations)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [Best Practices](#best-practices)

## Monorepo Deployment Challenges

### 1. Shared Dependencies

**Challenge**: Both frontend and backend depend on shared packages (`@simple-bookkeeping/database`, `@simple-bookkeeping/types`, etc.)

**Solution**:

- Ensure all shared packages are built before the main applications
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

## Vercel Deployment (Frontend)

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
   NEXT_PUBLIC_API_URL=https://your-api.onrender.com
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **TypeScript Path Resolution**:
   - Vercel automatically handles Next.js path aliases
   - No additional configuration needed for `@/` imports

## Render Deployment (Backend)

### Setup Process

1. **Create Web Service**:
   - Connect GitHub repository
   - Set root directory to repository root (not `apps/api`)

2. **Build Configuration**:

   ```yaml
   # Build Command
   pnpm install --frozen-lockfile && pnpm build --filter=@simple-bookkeeping/api

   # Start Command
   node apps/api/dist/index.js
   ```

3. **Environment Variables**:
   ```bash
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=your-supabase-connection-string
   JWT_SECRET=your-jwt-secret
   CORS_ORIGIN=https://your-frontend.vercel.app
   ```

### Key Learnings

1. **Root Directory Must Be Repository Root**:
   - Unlike Vercel, Render needs the full monorepo context
   - Setting root to `apps/api` will fail due to missing workspace packages

2. **Build Command Complexity**:
   - Must install dependencies AND build in one command
   - Use `&&` to chain commands

3. **TypeScript Compilation**:
   - Ensure `tsconfig.json` outputs to correct directory
   - Check that all type imports are resolved during build

## Environment Variable Management

### Best Practices

1. **Use Platform-Specific Tools**:

   ```bash
   # Vercel
   vercel env add DATABASE_URL
   vercel env pull .env.local

   # Render
   # Use dashboard or render.yaml
   ```

2. **Environment-Specific Variables**:

   ```bash
   # Development (.env.local)
   DATABASE_URL=postgresql://localhost:5432/bookkeeping_dev

   # Production (Platform Dashboard)
   DATABASE_URL=postgresql://production-url
   ```

3. **Variable Naming Conventions**:
   - Frontend: Use `NEXT_PUBLIC_` prefix for client-side variables
   - Backend: Standard naming without prefix
   - Never commit `.env` files

### Security Considerations

1. **Separate Secrets by Environment**:
   - Different JWT secrets for dev/staging/prod
   - Rotate keys regularly

2. **Use Platform Secret Management**:
   - Vercel: Environment Variables in dashboard
   - Render: Environment tab in service settings

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

### Render

1. **render.yaml** (Optional):

   ```yaml
   services:
     - type: web
       name: simple-bookkeeping-api
       env: node
       buildCommand: pnpm install --frozen-lockfile && pnpm build --filter=@simple-bookkeeping/api
       startCommand: node apps/api/dist/index.js
       envVars:
         - key: NODE_ENV
           value: production
         - key: DATABASE_URL
           fromDatabase:
             name: bookkeeping-db
             property: connectionString
   ```

2. **Health Check Configuration**:
   - Path: `/api/v1/health`
   - Add health endpoint to prevent service sleeping

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

### Render Issues

1. **Build Timeout**:
   - Increase build timeout in settings
   - Optimize build process (cache dependencies)
   - Consider pre-building locally and deploying dist

2. **Service Keeps Restarting**:
   - Check logs for uncaught exceptions
   - Verify all environment variables are set
   - Ensure health check endpoint returns 200

3. **CORS Errors**:
   - Verify CORS_ORIGIN environment variable
   - Check Express CORS middleware configuration
   - Ensure preflight requests are handled

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
   - Set up Render preview environments

### 3. Monitoring and Logging

1. **Application Monitoring**:
   - Implement structured logging
   - Use services like Sentry or LogRocket
   - Monitor API response times

2. **Health Checks**:
   ```typescript
   // Health endpoint implementation
   app.get('/api/v1/health', (req, res) => {
     res.json({
       status: 'healthy',
       timestamp: new Date().toISOString(),
       version: process.env.npm_package_version,
     });
   });
   ```

### 4. Security Best Practices

1. **Environment Variables**:
   - Never commit secrets to repository
   - Use different secrets per environment
   - Rotate secrets regularly

2. **API Security**:
   - Implement rate limiting
   - Use HTTPS everywhere
   - Validate all inputs

### 5. Performance Optimization

1. **Frontend (Vercel)**:
   - Enable ISR for dynamic content
   - Optimize images with Next.js Image
   - Use Edge Functions for geo-distributed logic

2. **Backend (Render)**:
   - Implement caching strategies
   - Use connection pooling for database
   - Monitor memory usage

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

### 3. Render Build Timeouts

**Challenge**: Initial builds on Render's free tier would timeout

**Solution**:

- Optimize build process by caching dependencies
- Split build and start commands
- Consider upgrading to paid tier for longer timeouts

### 4. Database Connection Pool Exhaustion

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

### 5. CORS Preflight Failures

**Challenge**: Complex CORS issues with authentication headers

**Solution**:

```javascript
// Comprehensive CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count'],
  })
);
```

## Migration Guide

### From Railway to Render

1. **Export environment variables from Railway**
2. **Update database connection strings**
3. **Modify build commands for Render format**
4. **Update CORS origins**
5. **Test thoroughly before switching DNS**

### From Heroku to Render

1. **Use Render's Heroku migration tool**
2. **Update Procfile to render.yaml**
3. **Migrate add-ons to Render services**
4. **Update environment variables**

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
- [Render Documentation](https://render.com/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Supabase Documentation](https://supabase.com/docs)
