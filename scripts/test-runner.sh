#!/bin/bash

# ============================================================================
# test-runner.sh - Consolidated Test Execution Tool
# ============================================================================
# Purpose: Unified tool for running unit, integration, and E2E tests
#          Consolidates docker-e2e-test.sh, e2e-test.sh, and test-e2e-configs.sh
# Usage: scripts/test-runner.sh <command> [options]
# Commands: unit, e2e, e2e-docker, config, all
# Requirements: pnpm, Docker (for E2E), Playwright
# ============================================================================

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common utilities
source "$SCRIPT_DIR/lib/common.sh"

# ============================================================================
# Configuration
# ============================================================================

# Test environments
TEST_ENV_LOCAL="local"
TEST_ENV_DOCKER="docker"
TEST_ENV_CI="ci"

# Default values
DEFAULT_BROWSER="chromium"
DEFAULT_TIMEOUT=30
DEFAULT_WORKERS=1

# Test modes
HEADLESS=true
BUILD=true
CLEANUP=true
VERBOSE=false

# Docker compose file
DOCKER_COMPOSE_FILE="docker-compose.test.yml"

# ============================================================================
# Functions
# ============================================================================

# Show usage information
show_usage() {
    cat << EOF
${BOLD}Test Runner - Consolidated Test Execution Tool${NC}

${BOLD}Usage:${NC}
  $0 <command> [options]

${BOLD}Commands:${NC}
  unit           Run unit tests
  integration    Run integration tests
  e2e            Run E2E tests (local environment)
  e2e-docker     Run E2E tests in Docker environment
  config         Test E2E configurations
  coverage       Run tests with coverage report
  watch          Run tests in watch mode
  all            Run all test suites
  help           Show this help message

${BOLD}Options:${NC}
  --headless     Run browser tests in headless mode (default)
  --headed       Run browser tests with visible browser
  --browser      Browser to use (chromium|firefox|webkit)
  --test         Specific test file or pattern
  --timeout      Test timeout in seconds (default: 30)
  --workers      Number of parallel workers
  --no-build     Skip building before tests
  --no-cleanup   Don't cleanup after tests
  --debug        Enable debug output
  --verbose, -v  Enable verbose output
  --update       Update test snapshots

${BOLD}E2E Docker Options:${NC}
  --build-fresh  Force rebuild Docker images
  --keep-alive   Keep containers running after tests

${BOLD}Examples:${NC}
  $0 unit                          # Run unit tests
  $0 e2e --headed                  # Run E2E tests with visible browser
  $0 e2e --test auth               # Run only auth E2E tests
  $0 e2e-docker --build-fresh      # Run E2E in Docker with fresh build
  $0 coverage                      # Run tests with coverage report
  $0 all                           # Run all test suites

${BOLD}Environment Variables:${NC}
  TEST_ENV          Test environment (local|docker|ci)
  HEADLESS          Run browser tests headless (true|false)
  TEST_TIMEOUT      Global test timeout in seconds
  PARALLEL_WORKERS  Number of parallel test workers

${BOLD}Test Files:${NC}
  Unit tests:        **/*.test.ts, **/*.spec.ts
  E2E tests:         apps/web/tests/e2e/**/*.spec.ts
  Integration tests: **/*.integration.test.ts

EOF
}

# Parse test options
parse_test_options() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --headless)
                HEADLESS=true
                shift
                ;;
            --headed)
                HEADLESS=false
                shift
                ;;
            --browser)
                DEFAULT_BROWSER="$2"
                shift 2
                ;;
            --test)
                TEST_PATTERN="$2"
                shift 2
                ;;
            --timeout)
                DEFAULT_TIMEOUT="$2"
                shift 2
                ;;
            --workers)
                DEFAULT_WORKERS="$2"
                shift 2
                ;;
            --no-build)
                BUILD=false
                shift
                ;;
            --no-cleanup)
                CLEANUP=false
                shift
                ;;
            --debug|--verbose|-v)
                VERBOSE=true
                DEBUG=1
                shift
                ;;
            --update)
                UPDATE_SNAPSHOTS=true
                shift
                ;;
            --build-fresh)
                BUILD_FRESH=true
                shift
                ;;
            --keep-alive)
                KEEP_ALIVE=true
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
}

# Setup test environment
setup_test_env() {
    print_status "Setting up test environment..."

    # Load environment variables
    load_env ".env.test"
    load_env ".env.local"

    # Set test-specific environment
    export NODE_ENV="test"
    export NEXT_PUBLIC_APP_ENV="test"

    # Database URL for tests
    if [ -z "$DATABASE_URL" ]; then
        export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/test_db"
    fi

    print_debug "Test environment configured"
}

# Cleanup test environment
cleanup_test_env() {
    if [ "$CLEANUP" = "false" ]; then
        print_info "Skipping cleanup (--no-cleanup specified)"
        return
    fi

    print_status "Cleaning up test environment..."

    # Stop any running services
    if is_port_in_use 3000; then
        kill_port 3000
    fi

    # Clean test artifacts
    rm -rf coverage/ .nyc_output/ test-results/ playwright-report/ 2>/dev/null || true

    print_debug "Test environment cleaned"
}

# Run unit tests
cmd_unit() {
    print_header "Unit Tests"

    setup_test_env

    print_status "Running unit tests..."

    local test_cmd="pnpm test:unit"

    # Add test pattern if specified
    if [ -n "${TEST_PATTERN:-}" ]; then
        test_cmd="$test_cmd -- --testPathPattern='$TEST_PATTERN'"
    fi

    # Add update snapshots flag
    if [ "${UPDATE_SNAPSHOTS:-false}" = "true" ]; then
        test_cmd="$test_cmd -- --updateSnapshot"
    fi

    # Run tests
    if [ "$VERBOSE" = "true" ]; then
        run_command "$test_cmd" "Unit tests failed"
    else
        run_command "$test_cmd --silent" "Unit tests failed"
    fi

    print_success "$CHECK_MARK Unit tests passed!"
}

# Run integration tests
cmd_integration() {
    print_header "Integration Tests"

    setup_test_env

    print_status "Setting up database for integration tests..."

    # Ensure database is ready
    if ! wait_for_port 5432 10; then
        print_warning "Database not available, starting Docker container..."
        docker-compose -f docker-compose.test.yml up -d postgres
        wait_for_port 5432 30 || die "Database failed to start"
    fi

    # Run migrations
    print_status "Running database migrations..."
    run_silent "pnpm db:migrate:test" "Migration failed"

    print_status "Running integration tests..."

    local test_cmd="pnpm test:integration"

    if [ -n "${TEST_PATTERN:-}" ]; then
        test_cmd="$test_cmd -- --testPathPattern='$TEST_PATTERN'"
    fi

    # Run tests
    run_command "$test_cmd" "Integration tests failed"

    print_success "$CHECK_MARK Integration tests passed!"

    # Cleanup
    if [ "$CLEANUP" = "true" ]; then
        docker-compose -f docker-compose.test.yml down
    fi
}

# Run E2E tests (local)
cmd_e2e() {
    print_header "E2E Tests (Local Environment)"

    setup_test_env

    # Check if services are running
    print_status "Checking services..."

    local services_running=true
    if ! curl -s "http://localhost:3000" > /dev/null 2>&1; then
        services_running=false
        print_warning "Web service not running at port 3000"
    fi

    # Start services if needed
    if [ "$services_running" = "false" ]; then
        if [ "$BUILD" = "true" ]; then
            print_status "Building application..."
            run_command "pnpm build:web" "Build failed"
        fi

        print_status "Starting web service..."
        pnpm --filter @simple-bookkeeping/web start &
        WEB_PID=$!

        # Wait for service to be ready
        if ! wait_for_service "http://localhost:3000" 60; then
            kill $WEB_PID 2>/dev/null || true
            die "Web service failed to start"
        fi
    fi

    # Prepare Playwright
    print_status "Preparing Playwright..."
    run_silent "pnpm --filter @simple-bookkeeping/web playwright install" "Playwright installation failed"

    # Configure Playwright options
    local playwright_args=""

    if [ "$HEADLESS" = "true" ]; then
        export HEADLESS=1
    else
        export HEADED=1
        playwright_args="$playwright_args --headed"
    fi

    if [ -n "${DEFAULT_BROWSER:-}" ]; then
        playwright_args="$playwright_args --browser=$DEFAULT_BROWSER"
    fi

    if [ -n "${TEST_PATTERN:-}" ]; then
        playwright_args="$playwright_args $TEST_PATTERN"
    fi

    if [ -n "${DEFAULT_WORKERS:-}" ]; then
        playwright_args="$playwright_args --workers=$DEFAULT_WORKERS"
    fi

    # Run E2E tests
    print_status "Running E2E tests..."
    print_info "Browser: ${DEFAULT_BROWSER:-chromium}"
    print_info "Mode: $([ "$HEADLESS" = "true" ] && echo "headless" || echo "headed")"

    local test_cmd="pnpm --filter @simple-bookkeeping/web test:e2e $playwright_args"

    if run_command "$test_cmd" "E2E tests failed"; then
        print_success "$CHECK_MARK E2E tests passed!"
        local exit_code=0
    else
        print_error "$CROSS_MARK E2E tests failed!"
        local exit_code=1

        # Show report if available
        if [ -f "apps/web/playwright-report/index.html" ]; then
            print_info "Test report available at: apps/web/playwright-report/index.html"
            print_info "Run 'pnpm --filter web playwright:report' to view"
        fi
    fi

    # Cleanup
    if [ "$services_running" = "false" ] && [ -n "${WEB_PID:-}" ]; then
        print_status "Stopping services..."
        kill $WEB_PID 2>/dev/null || true
    fi

    cleanup_test_env

    exit $exit_code
}

# Run E2E tests in Docker
cmd_e2e_docker() {
    print_header "E2E Tests (Docker Environment)"

    setup_test_env

    # Check Docker
    require_command docker "Please install Docker from https://docker.com"
    require_command docker-compose "Please install docker-compose"

    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        die "Docker is not running. Please start Docker Desktop."
    fi

    print_status "Preparing Docker environment..."

    # Build images if needed
    if [ "${BUILD_FRESH:-false}" = "true" ] || [ "$BUILD" = "true" ]; then
        print_status "Building Docker images..."
        run_command "docker-compose -f $DOCKER_COMPOSE_FILE build --no-cache" "Docker build failed"
    fi

    # Start containers
    print_status "Starting Docker containers..."
    docker-compose -f $DOCKER_COMPOSE_FILE up -d

    # Wait for services
    print_status "Waiting for services to be ready..."

    local services=(
        "postgres:5432"
        "web:3000"
    )

    for service in "${services[@]}"; do
        local name="${service%:*}"
        local port="${service#*:}"

        print_info "Waiting for $name on port $port..."
        if ! wait_for_port $port 60; then
            print_error "Service $name failed to start"
            docker-compose -f $DOCKER_COMPOSE_FILE logs $name
            docker-compose -f $DOCKER_COMPOSE_FILE down
            exit 1
        fi
    done

    # Wait for web service to be fully ready
    if ! wait_for_service "http://localhost:3000" 60; then
        print_error "Web service not responding"
        docker-compose -f $DOCKER_COMPOSE_FILE logs web
        docker-compose -f $DOCKER_COMPOSE_FILE down
        exit 1
    fi

    print_success "All services are ready!"

    # Run database setup
    print_status "Setting up test database..."
    docker-compose -f $DOCKER_COMPOSE_FILE exec -T web pnpm db:migrate
    docker-compose -f $DOCKER_COMPOSE_FILE exec -T web pnpm db:seed

    # Configure test options
    local playwright_args=""

    if [ "$HEADLESS" = "false" ]; then
        playwright_args="$playwright_args --headed"
    fi

    if [ -n "${DEFAULT_BROWSER:-}" ]; then
        playwright_args="$playwright_args --browser=$DEFAULT_BROWSER"
    fi

    if [ -n "${TEST_PATTERN:-}" ]; then
        playwright_args="$playwright_args $TEST_PATTERN"
    fi

    # Run E2E tests
    print_status "Running E2E tests in Docker..."

    if docker-compose -f $DOCKER_COMPOSE_FILE exec -T web \
        pnpm test:e2e $playwright_args; then
        print_success "$CHECK_MARK E2E tests passed!"
        local exit_code=0
    else
        print_error "$CROSS_MARK E2E tests failed!"
        local exit_code=1

        # Get logs for debugging
        print_subheader "Container Logs"
        docker-compose -f $DOCKER_COMPOSE_FILE logs --tail=50
    fi

    # Copy test results if they exist
    if docker-compose -f $DOCKER_COMPOSE_FILE exec -T web test -d playwright-report; then
        print_status "Copying test results..."
        docker cp "$(docker-compose -f $DOCKER_COMPOSE_FILE ps -q web):/app/playwright-report" .
        print_info "Test report available at: ./playwright-report/index.html"
    fi

    # Cleanup
    if [ "${KEEP_ALIVE:-false}" = "false" ]; then
        print_status "Stopping Docker containers..."
        docker-compose -f $DOCKER_COMPOSE_FILE down
    else
        print_info "Containers are still running. Stop with:"
        print_info "  docker-compose -f $DOCKER_COMPOSE_FILE down"
    fi

    exit $exit_code
}

# Test E2E configurations
cmd_config() {
    print_header "E2E Configuration Tests"

    setup_test_env

    print_status "Testing E2E configurations..."

    # Test 1: Playwright config validation
    print_subheader "Playwright Configuration"

    if [ -f "apps/web/playwright.config.ts" ]; then
        print_success "$CHECK_MARK Playwright config found"

        # Validate config
        if pnpm --filter @simple-bookkeeping/web exec playwright test --list > /dev/null 2>&1; then
            print_success "$CHECK_MARK Playwright config is valid"
        else
            print_error "$CROSS_MARK Playwright config is invalid"
        fi
    else
        print_error "$CROSS_MARK Playwright config not found"
    fi

    # Test 2: Environment setup
    print_subheader "Environment Configuration"

    local required_vars=(
        "DATABASE_URL"
        "NEXT_PUBLIC_APP_URL"
    )

    local missing_vars=0
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            print_warning "$WARNING_SIGN Missing: $var"
            ((missing_vars++))
        else
            print_success "$CHECK_MARK Found: $var"
        fi
    done

    if [ $missing_vars -gt 0 ]; then
        print_warning "Some environment variables are missing"
    fi

    # Test 3: Browser availability
    print_subheader "Browser Availability"

    local browsers=("chromium" "firefox" "webkit")
    for browser in "${browsers[@]}"; do
        if pnpm --filter @simple-bookkeeping/web exec playwright install --dry-run $browser > /dev/null 2>&1; then
            print_success "$CHECK_MARK $browser available"
        else
            print_warning "$WARNING_SIGN $browser not installed"
        fi
    done

    # Test 4: Port availability
    print_subheader "Port Availability"

    local ports=(3000 5432)
    for port in "${ports[@]}"; do
        if is_port_in_use $port; then
            print_warning "$WARNING_SIGN Port $port is in use"
        else
            print_success "$CHECK_MARK Port $port is available"
        fi
    done

    print_success "$CHECK_MARK Configuration tests complete!"
}

# Run tests with coverage
cmd_coverage() {
    print_header "Test Coverage Report"

    setup_test_env

    print_status "Running tests with coverage..."

    # Clean previous coverage
    rm -rf coverage/ .nyc_output/ 2>/dev/null || true

    # Run tests with coverage
    if run_command "pnpm test:coverage" "Coverage tests failed"; then
        print_success "$CHECK_MARK Coverage report generated!"

        # Show summary if available
        if [ -f "coverage/coverage-summary.json" ]; then
            print_subheader "Coverage Summary"
            node -p "
                const coverage = require('./coverage/coverage-summary.json');
                const total = coverage.total;
                console.log('Lines:      ' + total.lines.pct + '%');
                console.log('Statements: ' + total.statements.pct + '%');
                console.log('Functions:  ' + total.functions.pct + '%');
                console.log('Branches:   ' + total.branches.pct + '%');
            " 2>/dev/null || true
        fi

        print_info "Full report available at: coverage/lcov-report/index.html"
    fi
}

# Run tests in watch mode
cmd_watch() {
    print_header "Test Watch Mode"

    setup_test_env

    print_info "Starting test watch mode..."
    print_info "Press 'q' to quit"

    pnpm test:watch
}

# Run all test suites
cmd_all() {
    print_header "Running All Test Suites"

    local failed_suites=()
    local start_time=$(date +%s)

    # Run unit tests
    print_subheader "1/3 Unit Tests"
    if ! cmd_unit; then
        failed_suites+=("unit")
    fi

    # Run integration tests
    print_subheader "2/3 Integration Tests"
    if ! cmd_integration; then
        failed_suites+=("integration")
    fi

    # Run E2E tests
    print_subheader "3/3 E2E Tests"
    if ! cmd_e2e; then
        failed_suites+=("e2e")
    fi

    # Summary
    local end_time=$(date +%s)
    local duration=$(format_duration $((end_time - start_time)))

    print_header "Test Summary"
    print_info "$CLOCK Total duration: $duration"

    if [ ${#failed_suites[@]} -eq 0 ]; then
        print_success "$ROCKET All test suites passed!"
        exit 0
    else
        print_error "$CROSS_MARK Failed suites: ${failed_suites[*]}"
        exit 1
    fi
}

# ============================================================================
# Main Script
# ============================================================================

main() {
    # Parse common arguments
    parse_common_args "$@"

    # Get command
    local command="${REMAINING_ARGS[0]:-}"

    # Remove command from remaining args
    REMAINING_ARGS=("${REMAINING_ARGS[@]:1}")

    # Parse test-specific options
    parse_test_options "${REMAINING_ARGS[@]}"

    # Show help if requested
    if [ "$SHOW_HELP" = "true" ] || [ -z "$command" ]; then
        show_usage
        exit 0
    fi

    # Setup cleanup trap
    trap cleanup_test_env EXIT INT TERM

    # Change to project root
    cd "$PROJECT_ROOT" || die "Failed to change to project root"

    # Execute command
    case "$command" in
        unit)
            cmd_unit
            ;;
        integration|int)
            cmd_integration
            ;;
        e2e)
            cmd_e2e
            ;;
        e2e-docker|docker)
            cmd_e2e_docker
            ;;
        config|cfg)
            cmd_config
            ;;
        coverage|cov)
            cmd_coverage
            ;;
        watch)
            cmd_watch
            ;;
        all)
            cmd_all
            ;;
        help|-h|--help)
            show_usage
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
