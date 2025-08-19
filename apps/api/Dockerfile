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
COPY . .
# Install prisma CLI if not present and generate Prisma client
RUN cd packages/database && \
    if ! command -v prisma &> /dev/null; then \
        npm install -g prisma@6.10.1; \
    fi && \
    npx prisma generate
# Build shared packages first
RUN pnpm -F @simple-bookkeeping/database build || true
RUN pnpm -F @simple-bookkeeping/types build || true
RUN pnpm -F @simple-bookkeeping/errors build || true
RUN pnpm -F @simple-bookkeeping/shared build || true
# Build API
RUN pnpm -F @simple-bookkeeping/api build

# Runner
FROM base AS runner
ENV NODE_ENV production
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

COPY --from=build --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=nodejs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=nodejs:nodejs /app/packages ./packages

USER nodejs
WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/index.js"]
