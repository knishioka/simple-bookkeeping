#!/bin/bash

# ============================================================================
# build-tools.sh - Consolidated Build Management Tool
# ============================================================================
# Purpose: Unified tool for build checking, validation, and type checking
#          Consolidates check-build.sh and check-full-build.sh functionality
# Usage: scripts/build-tools.sh <command> [options]
# Commands: check, check-full, typecheck, validate
# ============================================================================

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common utilities
source "$SCRIPT_DIR/lib/common.sh"

# ============================================================================
# Configuration
# ============================================================================

# Build modes
MODE_QUICK="quick"        # Pre-commit: Changed files only
MODE_FULL="full"          # Pre-push: All packages
MODE_TYPECHECK="typecheck" # Type checking only
MODE_VALIDATE="validate"  # Full validation with tests

# Default mode
BUILD_MODE="${BUILD_MODE:-$MODE_QUICK}"

# ============================================================================
# Functions
# ============================================================================

# Show usage information
show_usage() {
    cat << EOF
${BOLD}Build Tools - Consolidated Build Management${NC}

${BOLD}Usage:${NC}
  $0 <command> [options]

${BOLD}Commands:${NC}
  check          Quick build check (changed files only) - for pre-commit
  check-full     Full build check (all packages) - for pre-push
  typecheck      Run TypeScript type checking only
  validate       Full validation including tests
  help           Show this help message

${BOLD}Options:${NC}
  --verbose, -v  Enable verbose output
  --quiet, -q    Suppress non-error output
  --no-cache     Clear build cache before checking
  --fix          Attempt to auto-fix issues (where possible)

${BOLD}Examples:${NC}
  $0 check                    # Quick check for pre-commit
  $0 check-full               # Full check for pre-push
  $0 typecheck --verbose      # Type check with verbose output
  $0 validate --no-cache      # Full validation with clean cache

${BOLD}Environment Variables:${NC}
  BUILD_MODE      Build mode (quick|full|typecheck|validate)
  DEBUG           Enable debug output (0|1)
  NO_COLOR        Disable colored output

${BOLD}Exit Codes:${NC}
  0  Success
  1  Build/type errors found
  2  Configuration error
  3  Missing dependencies

EOF
}

# Check for changed TypeScript files
check_changed_files() {
    print_status "Checking for changed TypeScript files..."

    local changed_files
    if is_git_repo; then
        # In git repo, check staged files
        changed_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E "\.(ts|tsx)$" || true)
    else
        # Not in git repo, check all TypeScript files
        changed_files=$(find . -name "*.ts" -o -name "*.tsx" 2>/dev/null | head -20)
    fi

    if [ -z "$changed_files" ]; then
        print_success "No TypeScript files changed"
        return 1  # No files to check
    fi

    echo "$changed_files"
    return 0  # Files found
}

# Get packages with changes
get_changed_packages() {
    local changed_files="$1"

    echo "$changed_files" | grep -E "^(packages|apps)/" | cut -d'/' -f1-2 | sort -u || true
}

# Run type check for a package
run_package_typecheck() {
    local pkg_dir="$1"
    local pkg_name

    if [ ! -f "$pkg_dir/package.json" ]; then
        print_warning "No package.json in $pkg_dir, skipping..."
        return 0
    fi

    pkg_name=$(get_package_name "$pkg_dir/package.json")
    print_status "Type checking $pkg_name..."

    # Check if typecheck script exists
    if grep -q '"typecheck"' "$pkg_dir/package.json" 2>/dev/null; then
        if run_silent "pnpm --filter '$pkg_name' typecheck" "Type check failed for $pkg_name"; then
            print_success "$CHECK_MARK Type check passed: $pkg_name"
            return 0
        else
            print_error "$CROSS_MARK Type check failed: $pkg_name"
            print_info "Run 'pnpm --filter $pkg_name typecheck' for details"
            return 1
        fi
    else
        print_debug "No typecheck script for $pkg_name"
        return 0
    fi
}

# Quick build check (pre-commit)
cmd_check() {
    print_header "Quick Build Check (Pre-commit)"

    local changed_files
    if ! changed_files=$(check_changed_files); then
        # No changed files
        exit 0
    fi

    print_info "$CLIPBOARD Changed TypeScript files detected:"
    echo "$changed_files" | sed 's/^/  - /'

    # Get affected packages
    local packages=$(get_changed_packages "$changed_files")
    if [ -z "$packages" ]; then
        print_success "No package changes to check"
        exit 0
    fi

    print_info "$PACKAGE Checking affected packages..."

    local failed=0
    for pkg_dir in $packages; do
        if ! run_package_typecheck "$pkg_dir"; then
            ((failed++))
        fi
    done

    if [ $failed -gt 0 ]; then
        print_error "$CROSS_MARK Build check failed! ($failed packages with errors)"
        exit 1
    fi

    print_success "$CHECK_MARK All build checks passed!"
}

# Full build check (pre-push)
cmd_check_full() {
    print_header "Full Build Check (Pre-push)"

    print_status "Ensuring clean working directory..."

    # Check for uncommitted changes
    if has_uncommitted_changes; then
        print_warning "$WARNING_SIGN You have uncommitted changes"
        if ! confirm "Continue with full build check?" "n"; then
            exit 0
        fi
    fi

    # Run full build
    print_status "$GEAR Running full project build..."

    local start_time=$(date +%s)

    if ! run_command "pnpm build" "Build failed!"; then
        print_error "$CROSS_MARK Full build failed!"
        print_info "Check the error messages above and fix any issues"
        exit 1
    fi

    local end_time=$(date +%s)
    local duration=$(format_duration $((end_time - start_time)))

    print_success "$CHECK_MARK Full build completed successfully! (Duration: $duration)"

    # Additional validation
    print_subheader "Running additional validations"

    # Check for build outputs
    local expected_outputs=(
        "apps/web/.next"
        "packages/database/dist"
        "packages/shared/dist"
    )

    local missing=0
    for output in "${expected_outputs[@]}"; do
        if [ ! -d "$PROJECT_ROOT/$output" ]; then
            print_warning "Expected build output missing: $output"
            ((missing++))
        fi
    done

    if [ $missing -gt 0 ]; then
        print_warning "$WARNING_SIGN Some build outputs are missing"
    fi

    print_success "$CHECK_MARK Full build check completed!"
}

# Type check only
cmd_typecheck() {
    print_header "TypeScript Type Checking"

    print_status "Running type checks for all packages..."

    local packages=(
        "apps/web"
        "packages/database"
        "packages/shared"
    )

    local failed=0
    for pkg_dir in "${packages[@]}"; do
        if [ -d "$PROJECT_ROOT/$pkg_dir" ]; then
            if ! run_package_typecheck "$pkg_dir"; then
                ((failed++))
            fi
        fi
    done

    if [ $failed -gt 0 ]; then
        print_error "$CROSS_MARK Type checking failed! ($failed packages with errors)"
        exit 1
    fi

    print_success "$CHECK_MARK All type checks passed!"
}

# Full validation including tests
cmd_validate() {
    print_header "Full Build Validation"

    local start_time=$(date +%s)

    # Step 1: Clean cache if requested
    if [[ " ${REMAINING_ARGS[@]} " =~ " --no-cache " ]]; then
        print_status "$BROOM Cleaning build cache..."
        run_command "pnpm clean" "Failed to clean cache"
    fi

    # Step 2: Install dependencies
    print_status "$PACKAGE Installing dependencies..."
    run_command "pnpm install --frozen-lockfile" "Failed to install dependencies"

    # Step 3: Run linting
    print_status "$SEARCH Running ESLint..."
    if ! run_command "pnpm lint" "Linting failed"; then
        if [[ " ${REMAINING_ARGS[@]} " =~ " --fix " ]]; then
            print_info "Attempting to auto-fix lint issues..."
            run_command "pnpm lint:fix" "Auto-fix failed"
        else
            exit 1
        fi
    fi

    # Step 4: Type checking
    print_status "$CLIPBOARD Running type checks..."
    cmd_typecheck

    # Step 5: Build
    print_status "$GEAR Building project..."
    run_command "pnpm build" "Build failed"

    # Step 6: Run tests
    print_status "$SHIELD Running tests..."
    run_command "pnpm test" "Tests failed"

    local end_time=$(date +%s)
    local duration=$(format_duration $((end_time - start_time)))

    print_success "$ROCKET Full validation completed successfully!"
    print_info "$CLOCK Total duration: $duration"
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

    # Show help if requested
    if [ "$SHOW_HELP" = "true" ] || [ -z "$command" ]; then
        show_usage
        exit 0
    fi

    # Change to project root
    cd "$PROJECT_ROOT" || die "Failed to change to project root"

    # Execute command
    case "$command" in
        check)
            cmd_check
            ;;
        check-full|full)
            cmd_check_full
            ;;
        typecheck|type)
            cmd_typecheck
            ;;
        validate|val)
            cmd_validate
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
