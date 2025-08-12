#!/bin/bash

# ============================================================================
# e2e-test.sh - Docker-based E2E Testing Framework
# ============================================================================
# Purpose: Provides isolated Docker environment for comprehensive E2E testing
#          with database, API, and web server setup plus Playwright test execution
# Usage: pnpm test:e2e [options] (supports --headless, --browser, --test pattern)
# Requirements: Docker, docker-compose.test.yml, Playwright test configuration
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[E2E TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Default values
CLEANUP=true
BUILD=true
HEADLESS=true
BROWSER="chromium"
TEST_PATTERN=""
TIMEOUT=30

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-cleanup)
            CLEANUP=false
            shift
            ;;
        --no-build)
            BUILD=false
            shift
            ;;
        --headed)
            HEADLESS=false
            shift
            ;;
        --browser)
            BROWSER="$2"
            shift 2
            ;;
        --test)
            TEST_PATTERN="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --no-cleanup     Keep containers running after tests"
            echo "  --no-build       Skip building containers"
            echo "  --headed         Run tests in headed mode (visible browser)"
            echo "  --browser NAME   Specify browser (chromium, firefox, webkit)"
            echo "  --test PATTERN   Run specific test pattern"
            echo "  --timeout SEC    Test timeout in seconds (default: 30)"
            echo "  --help           Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Function to cleanup containers
cleanup() {
    if [ "$CLEANUP" = true ]; then
        print_status "Cleaning up containers..."
        docker compose -f docker-compose.test.yml down --volumes --remove-orphans 2>/dev/null || true
    else
        print_warning "Skipping cleanup (--no-cleanup specified)"
        print_status "To manually cleanup: docker compose -f docker-compose.test.yml down --volumes"
    fi
}

# Trap to ensure cleanup on script exit
trap cleanup EXIT

print_status "Starting E2E test environment..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Cleanup any existing containers
print_status "Cleaning up existing test containers..."
docker compose -f docker-compose.test.yml down --volumes --remove-orphans 2>/dev/null || true

# Build containers if requested
if [ "$BUILD" = true ]; then
    print_status "Building test containers..."
    docker compose -f docker-compose.test.yml build --no-cache
else
    print_warning "Skipping container build (--no-build specified)"
fi

# Start database and wait for it to be ready
print_status "Starting test database..."
docker compose -f docker-compose.test.yml up -d postgres-test

print_status "Waiting for database to be ready..."
timeout 60s bash -c 'until docker compose -f docker-compose.test.yml exec postgres-test pg_isready -U test; do sleep 1; done'

# Start API server
print_status "Starting API server..."
docker compose -f docker-compose.test.yml up -d api-test

print_status "Waiting for API server to be ready..."
timeout 60s bash -c 'until curl -f http://localhost:3011/api/v1/ >/dev/null 2>&1; do sleep 1; done'

# Start web server
print_status "Starting web server..."
docker compose -f docker-compose.test.yml up -d web-test

print_status "Waiting for web server to be ready..."
timeout 60s bash -c 'until curl -f http://localhost:3010 >/dev/null 2>&1; do sleep 1; done'

# Run database migrations and seed data
print_status "Setting up test database..."
docker compose -f docker-compose.test.yml exec -T postgres-test psql -U test -d bookkeeping_test -c "SELECT 1;" >/dev/null

# Build Playwright container
print_status "Preparing Playwright test runner..."
docker compose -f docker-compose.test.yml build playwright

# Prepare Playwright command
PLAYWRIGHT_CMD="npx playwright test"

if [ "$HEADLESS" = false ]; then
    PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --headed"
fi

if [ -n "$TEST_PATTERN" ]; then
    PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD $TEST_PATTERN"
fi

PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --project=$BROWSER --timeout=${TIMEOUT}000"

# Run E2E tests
print_status "Running E2E tests..."
print_status "Command: $PLAYWRIGHT_CMD"
print_status "Browser: $BROWSER"
print_status "Headless: $HEADLESS"
if [ -n "$TEST_PATTERN" ]; then
    print_status "Test pattern: $TEST_PATTERN"
fi

# Run tests and capture exit code
if docker compose -f docker-compose.test.yml run --rm \
    -e BASE_URL=http://web-test:3000 \
    -e API_URL=http://api-test:3001 \
    -e CI=true \
    playwright sh -c "cd apps/web && $PLAYWRIGHT_CMD"; then
    print_success "E2E tests completed successfully!"
    EXIT_CODE=0
else
    print_error "E2E tests failed!"
    EXIT_CODE=1
fi

# Show test results location
if [ -d "./apps/web/playwright-report" ]; then
    print_status "Test report available at: ./apps/web/playwright-report/index.html"
fi

if [ -d "./apps/web/test-results" ]; then
    print_status "Test artifacts available at: ./apps/web/test-results/"
fi

# Show container logs on failure
if [ $EXIT_CODE -ne 0 ]; then
    print_status "Showing recent container logs..."
    echo ""
    print_status "API Server logs:"
    docker compose -f docker-compose.test.yml logs --tail=20 api-test
    echo ""
    print_status "Web Server logs:"
    docker compose -f docker-compose.test.yml logs --tail=20 web-test
fi

exit $EXIT_CODE