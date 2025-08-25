#!/bin/bash

# Optimized start script for production with faster migration handling
# Designed to avoid Render deployment timeouts

set -e  # Exit on error

echo "🚀 Fast production startup..."

# Quick environment check
if [ -z "$DATABASE_URL" ]; then
    echo "[ERROR] DATABASE_URL not set"
    exit 1
fi

echo "[INFO] Starting application..."

# Skip migration on startup if SKIP_MIGRATION is set
if [ "$SKIP_MIGRATION" = "true" ]; then
    echo "[INFO] Skipping migration (SKIP_MIGRATION=true)"
else
    # Try migration with timeout
    echo "[INFO] Running quick migration check..."
    
    # Use timeout command if available
    if command -v timeout >/dev/null 2>&1; then
        # 30 second timeout for migration
        timeout 30 bash -c "cd packages/database && npx prisma migrate deploy --skip-generate" || {
            echo "[WARNING] Migration timed out or failed, continuing..."
        }
    else
        # Run without timeout
        cd packages/database
        npx prisma migrate deploy --skip-generate || {
            echo "[WARNING] Migration failed, continuing..."
        }
        cd ../..
    fi
fi

# Start the application immediately
cd apps/api
echo "[INFO] Starting Node.js app on port ${PORT:-3001}..."
exec node dist/index.js
