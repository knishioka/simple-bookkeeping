#!/bin/bash

# Quick script to run migrations on Render
# Usage: ./scripts/render-migrate.sh

set -e

echo "🚀 Render Database Migration Tool"
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

# Check if we have Render CLI
if ! command -v render &> /dev/null; then
    log_error "Render CLI is not installed"
    log_info "Install it with: brew install render"
    exit 1
fi

# Service name (can be overridden via argument)
SERVICE_NAME="${1:-simple-bookkeeping-api}"

log_info "Connecting to service: $SERVICE_NAME"
echo ""

# Create a temporary script to run on Render
cat > /tmp/render_migrate_commands.sh << 'EOF'
echo "Running migrations on Render..."
cd /opt/render/project/src

# Navigate to database package
cd packages/database

# Check current status
echo "Current migration status:"
npx prisma migrate status

# Apply migrations
echo "Applying pending migrations..."
npx prisma migrate deploy

# Generate client
echo "Generating Prisma client..."
npx prisma generate

echo "Migration complete!"
echo ""
echo "Please restart the service from Render dashboard to apply changes."
EOF

log_info "Executing migration on Render shell..."
echo ""

# Execute the commands on Render
render shell $SERVICE_NAME < /tmp/render_migrate_commands.sh

# Clean up
rm -f /tmp/render_migrate_commands.sh

echo ""
log_info "✅ Migration commands sent to Render"
log_warning "Remember to restart the service from Render dashboard!"
log_info "Visit: https://dashboard.render.com/"
