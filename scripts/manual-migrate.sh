#!/bin/bash

# Manual migration script for immediate database schema fixes
# This can be run locally or via Render shell to apply pending migrations

set -e  # Exit on error

echo "🔧 Manual Database Migration Tool"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to log messages
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Parse command line arguments
ENVIRONMENT="production"
FORCE_RESET=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --force-reset)
            FORCE_RESET=true
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --env <environment>    Set environment (production/development)"
            echo "  --force-reset         Force database schema reset (DANGEROUS!)"
            echo "  --help               Show this help message"
            echo ""
            echo "Example:"
            echo "  $0                    # Run migrations on production"
            echo "  $0 --env development  # Run migrations on development"
            echo ""
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "Environment: $ENVIRONMENT"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    if [ "$ENVIRONMENT" = "production" ]; then
        log_error "DATABASE_URL environment variable is not set"
        log_info "For Render deployment, run this in the Render shell:"
        log_info "  render shell simple-bookkeeping-api"
        log_info "  cd /opt/render/project/src && ./scripts/manual-migrate.sh"
        exit 1
    else
        log_warning "DATABASE_URL not set, using .env file"
        if [ -f .env ]; then
            source .env
        else
            log_error "No .env file found"
            exit 1
        fi
    fi
fi

# Navigate to database package directory
cd packages/database 2>/dev/null || {
    log_warning "packages/database not found, trying from project root..."
    cd ../packages/database 2>/dev/null || {
        log_error "Cannot find packages/database directory"
        exit 1
    }
}

# Step 1: Check current migration status
log_step "Checking current migration status..."
npx prisma migrate status || {
    log_warning "Could not check migration status"
}

# Step 2: Run pending migrations
if [ "$FORCE_RESET" = true ]; then
    log_warning "⚠️  FORCE RESET REQUESTED - This will DROP and RECREATE all tables!"
    log_warning "All data will be LOST! Are you sure? (yes/no)"
    read -r confirmation
    if [ "$confirmation" != "yes" ]; then
        log_info "Operation cancelled"
        exit 0
    fi
    
    log_step "Resetting database schema..."
    npx prisma migrate reset --force --skip-seed
else
    log_step "Applying pending migrations..."
    npx prisma migrate deploy || {
        EXIT_CODE=$?
        log_error "Migration failed with exit code: $EXIT_CODE"
        
        log_info "Attempting to diagnose the issue..."
        
        # Try to pull current schema
        log_step "Checking current database schema..."
        npx prisma db pull --print 2>&1 | head -30 || true
        
        echo ""
        log_warning "Suggested actions:"
        log_warning "1. Check if the database is accessible"
        log_warning "2. Verify DATABASE_URL is correct"
        log_warning "3. Try running with --force-reset (DANGEROUS - will delete all data)"
        log_warning "4. Check Render logs: pnpm render:logs errors"
        
        exit $EXIT_CODE
    }
fi

# Step 3: Generate Prisma client
log_step "Generating Prisma client..."
npx prisma generate || {
    log_error "Failed to generate Prisma client"
    exit 1
}

# Step 4: Verify the migration
log_step "Verifying migration status..."
npx prisma migrate status

echo ""
log_info "✅ Migration process completed successfully!"
echo ""

# Additional instructions for Render
if [ "$ENVIRONMENT" = "production" ]; then
    echo "Next steps for Render:"
    echo "1. The database schema has been updated"
    echo "2. Restart the service to apply changes:"
    echo "   - Go to Render Dashboard"
    echo "   - Click 'Manual Deploy' > 'Deploy latest commit'"
    echo "   OR"
    echo "   - Use Render CLI: render deploy"
fi
