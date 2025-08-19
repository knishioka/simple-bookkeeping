FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/database/package.json ./packages/database/
COPY packages/types/package.json ./packages/types/
COPY packages/errors/package.json ./packages/errors/
COPY packages/shared/package.json ./packages/shared/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
# Generate Prisma client before building
RUN cd packages/database && npx prisma generate
# Build shared packages first
RUN pnpm -F @simple-bookkeeping/database build || true
RUN pnpm -F @simple-bookkeeping/types build || true
RUN pnpm -F @simple-bookkeeping/errors build || true
RUN pnpm -F @simple-bookkeeping/shared build || true
# Build web app with standalone output for Docker
ENV DOCKER_BUILD=true
RUN pnpm -F @simple-bookkeeping/web build

# Runner
FROM base AS runner
ENV NODE_ENV production
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy the standalone build output (Next.js creates this with output: 'standalone')
COPY --from=build --chown=nodejs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nodejs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nodejs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "apps/web/server.js"]
