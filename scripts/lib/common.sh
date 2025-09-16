#!/bin/bash

# ============================================================================
# common.sh - Shared Utilities for Shell Scripts
# ============================================================================
# Purpose: Provides common functions, color definitions, and error handling
#          utilities for all shell scripts in the project
# Usage: source scripts/lib/common.sh
# ============================================================================

# Color definitions
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export CYAN='\033[0;36m'
export MAGENTA='\033[0;35m'
export BOLD='\033[1m'
export NC='\033[0m' # No Color

# Status indicators
export CHECK_MARK="✅"
export CROSS_MARK="❌"
export WARNING_SIGN="⚠️"
export INFO_SIGN="ℹ️"
export ROCKET="🚀"
export GEAR="⚙️"
export SEARCH="🔍"
export PACKAGE="📦"
export CLIPBOARD="📋"
export BROOM="🧹"
export CHART="📊"
export CLOCK="⏱️"
export SHIELD="🛡️"

# ============================================================================
# Output Functions
# ============================================================================

# Print colored status messages
print_status() {
    echo -e "${BLUE}[STATUS]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

print_debug() {
    if [ "${DEBUG:-0}" = "1" ]; then
        echo -e "${MAGENTA}[DEBUG]${NC} $1" >&2
    fi
}

# Print section headers
print_header() {
    local title="$1"
    local width=${2:-60}
    # shellcheck disable=SC2046
    local line=$(printf '=%.0s' $(seq 1 "$width"))
    echo ""
    echo -e "${BOLD}${line}${NC}"
    echo -e "${BOLD}${title}${NC}"
    echo -e "${BOLD}${line}${NC}"
}

print_subheader() {
    local title="$1"
    echo ""
    echo -e "${BOLD}--- ${title} ---${NC}"
}

# ============================================================================
# Error Handling
# ============================================================================

# Exit with error message
die() {
    print_error "$1"
    exit "${2:-1}"
}

# Check if command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Require command to be available
require_command() {
    local cmd="$1"
    local install_msg="${2:-Please install $cmd}"

    if ! command_exists "$cmd"; then
        die "Required command '$cmd' not found. $install_msg"
    fi
}

# Run command with error handling
run_command() {
    local error_msg="${2:-Command failed: $1}"
    shift 1  # Remove error_msg from arguments

    print_debug "Running: $*"

    # Use "$@" to safely pass arguments without eval
    if ! "$@"; then
        die "$error_msg"
    fi
}

# Run command silently (only show on error)
run_silent() {
    local error_msg="${2:-Command failed: $1}"
    shift 1  # Remove error_msg from arguments
    local output
    local status

    print_debug "Running silently: $*"

    # Use command substitution with "$@" to safely execute without eval
    output=$("$@" 2>&1)
    status=$?

    if [ "$status" -ne 0 ]; then
        echo "$output" >&2
        die "$error_msg"
    fi

    return 0
}

# ============================================================================
# Environment and Configuration
# ============================================================================

# Load environment variables from .env file
load_env() {
    local env_file="${1:-.env}"

    if [ -f "$env_file" ]; then
        print_debug "Loading environment from $env_file"
        # Export variables while ignoring comments and empty lines
        set -a
        # shellcheck disable=SC1090
        source <(grep -v '^\s*#' "$env_file" | grep -v '^\s*$')
        set +a
    else
        print_debug "Environment file $env_file not found"
    fi
}

# Check if running in CI environment
is_ci() {
    [ "${CI:-false}" = "true" ] || [ -n "${GITHUB_ACTIONS:-}" ] || [ -n "${VERCEL:-}" ]
}

# Get project root directory
get_project_root() {
    local current_dir="$PWD"

    while [ "$current_dir" != "/" ]; do
        if [ -f "$current_dir/package.json" ] && [ -d "$current_dir/.git" ]; then
            echo "$current_dir"
            return 0
        fi
        current_dir=$(dirname "$current_dir")
    done

    # Fallback to git root
    git rev-parse --show-toplevel 2>/dev/null || pwd
}

# ============================================================================
# Process Management
# ============================================================================

# Kill process on port
kill_port() {
    local port="$1"
    local pid

    if [[ "$OSTYPE" == "darwin"* ]]; then
        pid=$(lsof -ti:"$port" 2>/dev/null)
    else
        pid=$(lsof -t -i:"$port" 2>/dev/null)
    fi

    if [ -n "$pid" ]; then
        print_warning "Killing process $pid on port $port"
        kill -9 "$pid" 2>/dev/null || true
        sleep 1
    fi
}

# Check if port is in use
is_port_in_use() {
    local port="$1"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        lsof -ti:"$port" &>/dev/null
    else
        lsof -t -i:"$port" &>/dev/null
    fi
}

# Wait for port to be available
wait_for_port() {
    local port="$1"
    local timeout="${2:-30}"
    local elapsed=0

    print_info "Waiting for port $port to be available..."

    while is_port_in_use "$port"; do
        if [ "$elapsed" -ge "$timeout" ]; then
            return 1
        fi
        sleep 1
        ((elapsed++))
    done

    return 0
}

# Wait for service to be ready
wait_for_service() {
    local url="$1"
    local timeout="${2:-30}"
    local elapsed=0

    print_info "Waiting for service at $url..."

    while ! curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "^[23]"; do
        if [ "$elapsed" -ge "$timeout" ]; then
            return 1
        fi
        sleep 1
        ((elapsed++))
        echo -n "."
    done
    echo ""

    return 0
}

# ============================================================================
# Cleanup and Signal Handling
# ============================================================================

# Setup cleanup trap
setup_cleanup() {
    local cleanup_function="$1"

    trap "$cleanup_function" EXIT INT TERM
}

# Default cleanup function
default_cleanup() {
    local exit_code="$?"

    if [ "$exit_code" -ne 0 ]; then
        print_error "Script exited with code $exit_code"
    fi

    # Kill any background jobs
    jobs -p | xargs -r kill 2>/dev/null || true
}

# ============================================================================
# Utility Functions
# ============================================================================

# Get timestamp
get_timestamp() {
    date "+%Y-%m-%d %H:%M:%S"
}

# Get elapsed time in seconds
get_elapsed_time() {
    local start_time="$1"
    local end_time="${2:-$(date +%s)}"

    echo $((end_time - start_time))
}

# Format duration from seconds
format_duration() {
    local seconds="$1"
    local hours=$((seconds / 3600))
    local minutes=$(((seconds % 3600) / 60))
    local secs=$((seconds % 60))

    if [ "$hours" -gt 0 ]; then
        printf "%dh %dm %ds" "$hours" "$minutes" "$secs"
    elif [ "$minutes" -gt 0 ]; then
        printf "%dm %ds" "$minutes" "$secs"
    else
        printf "%ds" "$secs"
    fi
}

# Confirm action with user
confirm() {
    local prompt="${1:-Are you sure?}"
    local default="${2:-n}"

    if is_ci; then
        # Auto-confirm in CI
        return 0
    fi

    local answer
    if [ "$default" = "y" ]; then
        read -p "$prompt [Y/n]: " answer
        answer=${answer:-y}
    else
        read -p "$prompt [y/N]: " answer
        answer=${answer:-n}
    fi

    [[ "$answer" =~ ^[Yy]$ ]]
}

# Parse command line arguments for common flags
parse_common_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                SHOW_HELP=true
                shift
                ;;
            -v|--verbose)
                DEBUG=1
                shift
                ;;
            -q|--quiet)
                QUIET=1
                shift
                ;;
            --no-color)
                # Disable colors
                RED=""
                GREEN=""
                YELLOW=""
                BLUE=""
                CYAN=""
                MAGENTA=""
                BOLD=""
                NC=""
                shift
                ;;
            *)
                # Store unrecognized args
                REMAINING_ARGS+=("$1")
                shift
                ;;
        esac
    done
}

# ============================================================================
# Vercel Utilities
# ============================================================================

# Source Vercel configuration
source_vercel_config() {
    local config_file="${SCRIPT_DIR:-$(dirname "${BASH_SOURCE[0]}")}/config.sh"

    if [ -f "$config_file" ]; then
        # shellcheck disable=SC1090
        source "$config_file"
        get_vercel_config || return 1
    else
        print_warning "Vercel config file not found: $config_file"
        return 1
    fi
}

# Get Vercel token
get_vercel_token() {
    if [ -n "$VERCEL_TOKEN" ]; then
        echo "$VERCEL_TOKEN"
    else
        # Try to get token from vercel CLI auth
        local auth_file="$HOME/Library/Application Support/com.vercel.cli/auth.json"
        if [ -f "$auth_file" ]; then
            jq -r '.token' "$auth_file" 2>/dev/null || echo ""
        else
            echo ""
        fi
    fi
}

# ============================================================================
# Git Utilities
# ============================================================================

# Check if current directory is a git repository
is_git_repo() {
    git rev-parse --git-dir &>/dev/null
}

# Get current git branch
get_git_branch() {
    git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown"
}

# Check for uncommitted changes
has_uncommitted_changes() {
    ! git diff-index --quiet HEAD -- 2>/dev/null
}

# Get list of changed files
get_changed_files() {
    local filter="${1:-}"

    if [ -n "$filter" ]; then
        git diff --name-only --diff-filter=ACM | grep -E "$filter" || true
    else
        git diff --name-only --diff-filter=ACM
    fi
}

# ============================================================================
# Package Management
# ============================================================================

# Check if package.json exists
has_package_json() {
    [ -f "package.json" ]
}

# Get package name from package.json
get_package_name() {
    local package_file="${1:-package.json}"

    if [ -f "$package_file" ]; then
        node -p "require('./$package_file').name" 2>/dev/null || echo "unknown"
    else
        echo "unknown"
    fi
}

# Run pnpm command with error handling
run_pnpm() {
    if ! command_exists pnpm; then
        die "pnpm is not installed. Please install it first: npm install -g pnpm"
    fi

    # Pass all arguments directly to pnpm
    run_command "pnpm command failed: $*" pnpm "$@"
}

# ============================================================================
# Export common variables
# ============================================================================

# Script directory and project root
export SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PROJECT_ROOT="$(get_project_root)"

# Common ports
export WEB_PORT="${WEB_PORT:-3000}"
export API_PORT="${API_PORT:-3001}"  # Deprecated but kept for compatibility
export DB_PORT="${DB_PORT:-5432}"

# Timeouts
export DEFAULT_TIMEOUT="${DEFAULT_TIMEOUT:-30}"
export BUILD_TIMEOUT="${BUILD_TIMEOUT:-300}"
export TEST_TIMEOUT="${TEST_TIMEOUT:-180}"

# ============================================================================
# Initialization
# ============================================================================

# Load environment on source
if [ "${AUTO_LOAD_ENV:-true}" = "true" ]; then
    load_env
fi

# Setup default signal handling
if [ "${AUTO_SETUP_CLEANUP:-true}" = "true" ]; then
    setup_cleanup default_cleanup
fi

# Show debug info if enabled
if [ "${DEBUG:-0}" = "1" ]; then
    print_debug "Common utilities loaded"
    print_debug "Script dir: $SCRIPT_DIR"
    print_debug "Project root: $PROJECT_ROOT"
    print_debug "Git branch: $(get_git_branch)"
fi
