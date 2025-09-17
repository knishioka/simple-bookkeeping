#!/bin/bash

# E2E Test with Docker Supabase
# This script runs E2E tests using a local Supabase instance in Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}E2E Test with Docker Supabase${NC}"
echo -e "${BLUE}============================================================${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}[ERROR] Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Parse command line arguments
CLEANUP_ONLY=false
SKIP_BUILD=false
KEEP_RUNNING=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --cleanup) CLEANUP_ONLY=true ;;
        --skip-build) SKIP_BUILD=true ;;
        --keep-running) KEEP_RUNNING=true ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --cleanup        Only cleanup Docker containers"
            echo "  --skip-build     Skip Docker image build"
            echo "  --keep-running   Keep containers running after tests"
            echo "  --help          Show this help message"
            exit 0
            ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Cleanup function
cleanup() {
    echo -e "${YELLOW}[INFO] Cleaning up Docker containers...${NC}"
    docker-compose -f docker-compose.supabase-test.yml down -v
    echo -e "${GREEN}[SUCCESS] Cleanup completed${NC}"
}

# If cleanup only, run cleanup and exit
if [ "$CLEANUP_ONLY" = true ]; then
    cleanup
    exit 0
fi

# Trap to cleanup on script exit (unless keep-running is set)
if [ "$KEEP_RUNNING" = false ]; then
    trap cleanup EXIT
fi

# Step 1: Stop any existing containers
echo -e "${YELLOW}[INFO] Stopping existing containers...${NC}"
docker-compose -f docker-compose.supabase-test.yml down -v 2>/dev/null || true

# Step 2: Build Docker images (unless skipped)
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${YELLOW}[INFO] Building Docker images...${NC}"
    docker-compose -f docker-compose.supabase-test.yml build
else
    echo -e "${YELLOW}[INFO] Skipping Docker build${NC}"
fi

# Step 3: Start Supabase services
echo -e "${YELLOW}[INFO] Starting Supabase services...${NC}"
docker-compose -f docker-compose.supabase-test.yml up -d \
    supabase-db \
    supabase-kong \
    supabase-auth \
    supabase-rest \
    supabase-realtime \
    supabase-storage \
    supabase-meta \
    supabase-imgproxy \
    supabase-mail

# Step 4: Wait for Supabase to be ready
echo -e "${YELLOW}[INFO] Waiting for Supabase to be ready...${NC}"
MAX_ATTEMPTS=60
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/auth/v1/health | grep -q "200"; then
        echo -e "${GREEN}[SUCCESS] Supabase is ready!${NC}"
        break
    fi

    ATTEMPT=$((ATTEMPT + 1))
    echo -e "${YELLOW}[INFO] Waiting for Supabase... ($ATTEMPT/$MAX_ATTEMPTS)${NC}"
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}[ERROR] Supabase failed to start within timeout${NC}"
    docker-compose -f docker-compose.supabase-test.yml logs supabase-kong
    exit 1
fi

# Step 5: Initialize database schema
echo -e "${YELLOW}[INFO] Initializing database schema...${NC}"

# Create tables using Supabase migrations (if available)
if [ -d "supabase/migrations" ] && [ "$(ls -A supabase/migrations)" ]; then
    echo -e "${YELLOW}[INFO] Running Supabase migrations...${NC}"
    # Apply migrations directly to the database
    for migration in supabase/migrations/*.sql; do
        if [ -f "$migration" ]; then
            echo -e "${BLUE}  Applying $(basename $migration)...${NC}"
            docker exec supabase-postgres-test psql -U postgres -d postgres -f "/$(basename $migration)" 2>/dev/null || true
        fi
    done
else
    echo -e "${YELLOW}[INFO] No migrations found, creating basic schema...${NC}"
    # Create basic schema for testing
    docker exec supabase-postgres-test psql -U postgres -d postgres -c "
        -- Enable RLS
        ALTER DATABASE postgres SET \"app.jwt_secret\" TO 'super-secret-jwt-token-with-at-least-32-characters-for-testing';

        -- Create auth schema if not exists
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE SCHEMA IF NOT EXISTS storage;

        -- Create basic users table
        CREATE TABLE IF NOT EXISTS auth.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT UNIQUE NOT NULL,
            encrypted_password TEXT,
            email_confirmed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Create basic organizations table
        CREATE TABLE IF NOT EXISTS public.organizations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            fiscal_year_end INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Create basic accounts table
        CREATE TABLE IF NOT EXISTS public.accounts (
            id TEXT PRIMARY KEY,
            organization_id TEXT REFERENCES public.organizations(id),
            code TEXT NOT NULL,
            name TEXT NOT NULL,
            account_type TEXT,
            sub_category TEXT,
            tax_type TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Create user_organizations table
        CREATE TABLE IF NOT EXISTS public.user_organizations (
            user_id UUID REFERENCES auth.users(id),
            organization_id TEXT REFERENCES public.organizations(id),
            role TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (user_id, organization_id)
        );

        -- Enable RLS on tables
        ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

        -- Create basic RLS policies (allow all for testing)
        CREATE POLICY \"Allow all for testing\" ON public.organizations FOR ALL USING (true);
        CREATE POLICY \"Allow all for testing\" ON public.accounts FOR ALL USING (true);
        CREATE POLICY \"Allow all for testing\" ON public.user_organizations FOR ALL USING (true);
    " 2>/dev/null || true
fi

# Step 6: Set environment variables for tests
echo -e "${YELLOW}[INFO] Setting environment variables...${NC}"
export E2E_TEST_MODE=docker
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
export NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
export SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Step 7: Run E2E tests
echo -e "${YELLOW}[INFO] Running E2E tests...${NC}"
pnpm --filter web test:e2e

# Check test result
TEST_RESULT=$?

if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN}[SUCCESS] E2E tests passed!${NC}"
    echo -e "${GREEN}============================================================${NC}"
else
    echo -e "${RED}============================================================${NC}"
    echo -e "${RED}[ERROR] E2E tests failed!${NC}"
    echo -e "${RED}============================================================${NC}"

    # Show logs for debugging
    echo -e "${YELLOW}[INFO] Showing Supabase logs for debugging...${NC}"
    docker-compose -f docker-compose.supabase-test.yml logs --tail=50
fi

# Step 8: Keep running if requested
if [ "$KEEP_RUNNING" = true ]; then
    echo -e "${YELLOW}[INFO] Keeping containers running. Access Supabase at:${NC}"
    echo -e "${BLUE}  - API: http://localhost:8000${NC}"
    echo -e "${BLUE}  - Studio: http://localhost:54323${NC}"
    echo -e "${BLUE}  - Inbucket: http://localhost:54324${NC}"
    echo -e "${YELLOW}[INFO] Run '$0 --cleanup' to stop containers${NC}"
fi

exit $TEST_RESULT
