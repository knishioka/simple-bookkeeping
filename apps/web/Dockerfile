FROM node:20-alpine AS base
RUN corepack enable
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Prune workspace to only include necessary packages
FROM base AS pruner
RUN pnpm add -g turbo
COPY . .
RUN turbo prune @simple-bookkeeping/web --docker

# Dependencies
FROM base AS deps
# First copy lockfile and workspace config for better caching
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile --prefer-offline

# Build
FROM base AS build
RUN pnpm add -g turbo
COPY --from=deps /app/ .
COPY --from=pruner /app/out/full/ .
# Copy Prisma schema for generation
COPY packages/database/prisma ./packages/database/prisma
# Use turbo to build with proper caching and dependency resolution
ENV DOCKER_BUILD=true
RUN turbo run build --filter=@simple-bookkeeping/web

# Runner
FROM base AS runner
ENV NODE_ENV production
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy the standalone build output (Next.js creates this with output: 'standalone')
COPY --from=build --chown=nodejs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nodejs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nodejs:nodejs /app/apps/web/public ./apps/web/public
# Copy Prisma client with engine binaries (using glob pattern for version independence)
COPY --from=build --chown=nodejs:nodejs /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma ./node_modules/.prisma

USER nodejs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "apps/web/server.js"]
