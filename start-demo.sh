#!/bin/sh

# Start API server in background
cd /app
NODE_ENV=production \
DATABASE_URL=${DATABASE_URL} \
JWT_SECRET=${JWT_SECRET} \
JWT_EXPIRES_IN=${JWT_EXPIRES_IN} \
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET} \
JWT_REFRESH_EXPIRES_IN=${JWT_REFRESH_EXPIRES_IN} \
pnpm --filter @simple-bookkeeping/api start &

# Start Web server
NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
NODE_ENV=production \
pnpm --filter @simple-bookkeeping/web start