FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/types/package.json ./packages/types/
COPY packages/errors/package.json ./packages/errors/
COPY packages/shared/package.json ./packages/shared/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/errors/node_modules ./packages/errors/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
# Generate Prisma client using prisma from database package node_modules
RUN cd packages/database && \
    ./node_modules/.bin/prisma generate
# Build shared packages first
RUN pnpm -F @simple-bookkeeping/database build
RUN pnpm -F @simple-bookkeeping/types build
RUN pnpm -F @simple-bookkeeping/errors build
RUN pnpm -F @simple-bookkeeping/shared build
# Build API
RUN pnpm -F @simple-bookkeeping/api build

# Runner
FROM base AS runner
ENV NODE_ENV production
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

COPY --from=build --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=build --chown=nodejs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
# Copy entire node_modules with resolved symlinks
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=nodejs:nodejs /app/apps/api/package.json ./apps/api/package.json
# Copy all package node_modules for proper resolution
COPY --from=build --chown=nodejs:nodejs /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=build --chown=nodejs:nodejs /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=build --chown=nodejs:nodejs /app/packages/errors/node_modules ./packages/errors/node_modules
COPY --from=build --chown=nodejs:nodejs /app/packages/shared/node_modules ./packages/shared/node_modules
# Copy built packages with their dist directories
COPY --from=build --chown=nodejs:nodejs /app/packages/database/dist ./packages/database/dist
COPY --from=build --chown=nodejs:nodejs /app/packages/database/package.json ./packages/database/package.json
COPY --from=build --chown=nodejs:nodejs /app/packages/types/dist ./packages/types/dist
COPY --from=build --chown=nodejs:nodejs /app/packages/types/package.json ./packages/types/package.json
COPY --from=build --chown=nodejs:nodejs /app/packages/errors/dist ./packages/errors/dist
COPY --from=build --chown=nodejs:nodejs /app/packages/errors/package.json ./packages/errors/package.json
COPY --from=build --chown=nodejs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=nodejs:nodejs /app/packages/shared/package.json ./packages/shared/package.json
# Copy Prisma schema files
COPY --from=build --chown=nodejs:nodejs /app/packages/database/prisma ./packages/database/prisma

USER nodejs
WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/index.js"]
