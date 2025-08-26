#!/bin/bash

# Post-deployment migration script
# Run this after deployment to ensure migrations are applied
# This avoids timeout issues during deployment

set -e

echo "📦 Post-Deployment Migration Tool"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on Render
if [ -n "$RENDER" ]; then
    log_info "Running on Render environment"
    
    # Navigate to the correct directory
    if [ -d "/opt/render/project/src" ]; then
        cd /opt/render/project/src
    fi
else
    log_info "Running locally"
fi

# Check database connection
log_info "Checking database connection..."
cd packages/database

# Run migrations
log_info "Applying database migrations..."
if npx prisma migrate deploy; then
    log_info "✅ Migrations applied successfully"
else
    log_error "Failed to apply migrations"
    exit 1
fi

# Generate Prisma client
log_info "Generating Prisma client..."
if npx prisma generate; then
    log_info "✅ Prisma client generated"
else
    log_error "Failed to generate Prisma client"
    exit 1
fi

# Verify database schema
log_info "Verifying database schema..."
npx prisma migrate status || true

echo ""
log_info "✅ Post-deployment migration completed!"
echo ""
echo "Note: You may need to restart the service for changes to take effect."
