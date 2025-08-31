#!/bin/bash
set -e

# Docker Compose E2E Test Runner Script
# This script runs E2E tests in an isolated Docker environment

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.test.yml"
MAX_WAIT_TIME=60
DEBUG=${DEBUG:-false}
KEEP_RUNNING=${KEEP_RUNNING:-false}
BROWSERS=${BROWSERS:-chromium}

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

cleanup() {
    if [ "$KEEP_RUNNING" = "false" ]; then
        log_info "Cleaning up Docker containers..."
        docker compose -f $COMPOSE_FILE down -v --remove-orphans || true
    else
        log_warning "Keeping containers running (KEEP_RUNNING=true)"
    fi
}

wait_for_service() {
    local service=$1
    local health_check=$2
    local max_wait=$3
    local elapsed=0
    
    log_info "Waiting for $service to be healthy..."
    
    while [ $elapsed -lt $max_wait ]; do
        if eval "$health_check" 2>/dev/null; then
            log_success "$service is healthy!"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
        echo -n "."
    done
    
    log_error "$service failed to become healthy within ${max_wait}s"
    return 1
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Run E2E tests in Docker environment

Options:
    -h, --help          Show this help message
    -d, --debug         Enable debug mode
    -k, --keep-running  Keep containers running after tests
    -b, --browsers      Browsers to test (default: chromium)
    -w, --watch         Run tests in watch mode
    -g, --grep          Run tests matching pattern
    -p, --project       Playwright project to run
    --build-only        Only build Docker images
    --no-build          Skip building Docker images
    --clean             Clean up all test artifacts before running

Examples:
    $0                          # Run all tests
    $0 --debug                  # Run with debug output
    $0 --grep "login"           # Run tests matching "login"
    $0 --keep-running           # Keep containers running after tests
    $0 --browsers "chromium firefox"  # Test multiple browsers

EOF
}

# Parse arguments
PLAYWRIGHT_ARGS=""
BUILD_IMAGES=true
BUILD_ONLY=false
CLEAN_FIRST=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -d|--debug)
            DEBUG=true
            export DEBUG=true
            shift
            ;;
        -k|--keep-running)
            KEEP_RUNNING=true
            shift
            ;;
        -b|--browsers)
            BROWSERS="$2"
            shift 2
            ;;
        -w|--watch)
            PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS --ui"
            KEEP_RUNNING=true
            shift
            ;;
        -g|--grep)
            PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS --grep \"$2\""
            shift 2
            ;;
        -p|--project)
            PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS --project=$2"
            shift 2
            ;;
        --build-only)
            BUILD_ONLY=true
            shift
            ;;
        --no-build)
            BUILD_IMAGES=false
            shift
            ;;
        --clean)
            CLEAN_FIRST=true
            shift
            ;;
        *)
            PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS $1"
            shift
            ;;
    esac
done

# Trap for cleanup
trap cleanup EXIT

# Main execution
log_info "🐳 Docker E2E Test Runner"
log_info "================================"

# Clean artifacts if requested
if [ "$CLEAN_FIRST" = "true" ]; then
    log_info "Cleaning up old artifacts..."
    rm -rf playwright-report test-results artifacts coverage
fi

# Create necessary directories
log_info "Creating test directories..."
mkdir -p playwright-report test-results artifacts coverage
chmod 777 playwright-report test-results artifacts coverage

# Build Docker images if needed
if [ "$BUILD_IMAGES" = "true" ]; then
    log_info "Building Docker images..."
    docker compose -f $COMPOSE_FILE build \
        --build-arg BROWSERS="$BROWSERS" \
        --progress=plain
    log_success "Docker images built successfully!"
    
    if [ "$BUILD_ONLY" = "true" ]; then
        log_success "Build complete (--build-only specified)"
        exit 0
    fi
fi

# Start services
log_info "Starting services..."
docker compose -f $COMPOSE_FILE up -d postgres-test api-test web-test

# Wait for services to be healthy
wait_for_service "PostgreSQL" \
    "docker compose -f $COMPOSE_FILE exec -T postgres-test pg_isready -U test" \
    $MAX_WAIT_TIME

wait_for_service "API" \
    $MAX_WAIT_TIME

wait_for_service "Web" \
    "docker compose -f $COMPOSE_FILE exec -T web-test wget --spider -q http://localhost:3000" \
    $MAX_WAIT_TIME

# Show service status
if [ "$DEBUG" = "true" ]; then
    log_info "Service status:"
    docker compose -f $COMPOSE_FILE ps
fi

# Run E2E tests
log_info "Running E2E tests..."
echo "Test arguments: $PLAYWRIGHT_ARGS"

TEST_EXIT_CODE=0
docker compose -f $COMPOSE_FILE run \
    --rm \
    -e CI=true \
    -e DEBUG=$DEBUG \
    -e PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS" \
    playwright || TEST_EXIT_CODE=$?

# Show results
echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    log_success "All tests passed! 🎉"
else
    log_error "Some tests failed (exit code: $TEST_EXIT_CODE)"
    
    if [ "$DEBUG" = "true" ]; then
        log_info "Container logs:"
        docker compose -f $COMPOSE_FILE logs --tail=100
    fi
fi

# Display report location
if [ -f "playwright-report/index.html" ]; then
    log_info "HTML report available at: playwright-report/index.html"
    
    # Offer to open the report
    if command -v open &> /dev/null && [ "$KEEP_RUNNING" = "false" ]; then
        read -p "Open HTML report? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            open playwright-report/index.html
        fi
    fi
fi

# Exit with test exit code
exit $TEST_EXIT_CODE
