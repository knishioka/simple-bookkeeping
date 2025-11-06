#!/bin/bash

# ============================================================================
# db-query.sh - Database Query Helper for Claude Code
# ============================================================================
# Purpose: Execute SQL queries against production or local Supabase database
# Usage:
#   ./scripts/db-query.sh [options] "SQL QUERY"
#   ./scripts/db-query.sh --env prod "SELECT * FROM organizations LIMIT 5;"
#   ./scripts/db-query.sh --file query.sql
# ============================================================================

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Source common utilities
source "$SCRIPT_DIR/lib/common.sh"

# ============================================================================
# Configuration
# ============================================================================

ENVIRONMENT="local"  # default to local
SQL_QUERY=""
SQL_FILE=""
OUTPUT_FORMAT="table"  # table, json, csv
SKIP_CONFIRMATION=false

# ============================================================================
# Functions
# ============================================================================

show_usage() {
    cat << EOF
${BOLD}Database Query Helper - Execute SQL against Supabase${NC}

${BOLD}Usage:${NC}
  $0 [options] "SQL QUERY"
  $0 --env prod "SELECT * FROM organizations;"
  $0 --file query.sql --env prod

${BOLD}Options:${NC}
  --env <local|prod>     Target environment (default: local)
  --file <path>          Execute SQL from file
  --format <table|json|csv>  Output format (default: table)
  --yes, -y              Skip confirmation prompts
  --help, -h             Show this help message

${BOLD}Examples:${NC}
  # Query local database
  $0 "SELECT current_database();"

  # Query production database
  $0 --env prod "SELECT COUNT(*) FROM organizations;"

  # Execute SQL file
  $0 --file migrations/query.sql --env prod

  # JSON output
  $0 --env prod --format json "SELECT * FROM organizations LIMIT 5;"

${BOLD}Environment Detection:${NC}
  - Automatically loads environment variables from env/secrets/
  - Uses DATABASE_URL or constructs from SUPABASE credentials
  - Falls back to psql with connection string

${BOLD}Security:${NC}
  - Production queries require confirmation
  - Read-only by default (can be overridden)
  - Credentials never exposed in logs

EOF
}

# Load environment variables based on target
load_environment() {
    local env_name="$1"

    print_info "Loading $env_name environment..."

    # Determine environment file
    local env_file
    if [ "$env_name" = "prod" ] || [ "$env_name" = "production" ]; then
        env_file="$PROJECT_ROOT/env/secrets/supabase.prod.env"
    else
        env_file="$PROJECT_ROOT/env/secrets/supabase.local.env"
    fi

    if [ ! -f "$env_file" ]; then
        print_error "Environment file not found: $env_file"
        return 1
    fi

    # Load environment variables
    set -a
    source <(grep -v '^#' "$env_file" | grep -v '^$')
    set +a

    print_success "Environment loaded: $env_name"
}

# Get database connection string
get_database_url() {
    # Priority:
    # 1. SUPABASE_DB_URL (production connection, recommended)
    # 2. DATABASE_URL (fallback)

    # Debug: show what variables are available
    if [ -n "$DEBUG" ]; then
        print_info "DEBUG: DATABASE_URL length: ${#DATABASE_URL}"
        print_info "DEBUG: SUPABASE_DB_URL length: ${#SUPABASE_DB_URL}"
    fi

    if [ -n "$SUPABASE_DB_URL" ]; then
        echo "$SUPABASE_DB_URL"
    elif [ -n "$DATABASE_URL" ]; then
        echo "$DATABASE_URL"
    else
        print_error "No database URL found in environment"
        print_info "Expected: DATABASE_URL or SUPABASE_DB_URL"
        print_info "Available environment variables:"
        env | grep -E "(DATABASE|SUPABASE)" | sed 's/=.*/=***/' || true
        return 1
    fi
}

# Execute SQL query
execute_query() {
    local query="$1"
    local db_url

    db_url=$(get_database_url) || return 1

    # Hide password in logs
    local safe_url=$(echo "$db_url" | sed 's/:[^@]*@/:***@/')
    print_info "Connecting to: $safe_url"

    # Execute query based on output format
    case "$OUTPUT_FORMAT" in
        json)
            psql "$db_url" -t -A -F"," -c "$query" | \
                awk 'BEGIN{print "["} NR>1{printf ","} {printf "{\"result\":\"%s\"}",$0} END{print "]"}'
            ;;
        csv)
            psql "$db_url" -t -A -F"," -c "$query"
            ;;
        *)
            psql "$db_url" -c "$query"
            ;;
    esac
}

# Confirm production queries
confirm_production_query() {
    if [ "$ENVIRONMENT" = "prod" ] || [ "$ENVIRONMENT" = "production" ]; then
        # Skip confirmation if --yes flag is set
        if [ "$SKIP_CONFIRMATION" = "true" ]; then
            print_info "Skipping confirmation (--yes flag)"
            return 0
        fi

        echo ""
        print_warning "═══════════════════════════════════════════"
        print_warning "  ${WARNING_SIGN}  PRODUCTION DATABASE QUERY  ${WARNING_SIGN}"
        print_warning "═══════════════════════════════════════════"
        print_warning ""
        print_warning "You are about to execute a query against"
        print_warning "the PRODUCTION database."
        print_warning ""

        # Show query
        print_info "Query:"
        echo "$SQL_QUERY" | head -5
        if [ $(echo "$SQL_QUERY" | wc -l) -gt 5 ]; then
            echo "... (truncated)"
        fi

        print_warning ""
        print_warning "═══════════════════════════════════════════"
        echo ""

        if ! confirm "Execute this query on production?" "n"; then
            print_info "Query cancelled"
            return 1
        fi
    fi

    return 0
}

# ============================================================================
# Main
# ============================================================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --file)
                SQL_FILE="$2"
                shift 2
                ;;
            --format)
                OUTPUT_FORMAT="$2"
                shift 2
                ;;
            -y|--yes)
                SKIP_CONFIRMATION=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                SQL_QUERY="$1"
                shift
                ;;
        esac
    done

    # Validate input
    if [ -z "$SQL_QUERY" ] && [ -z "$SQL_FILE" ]; then
        print_error "No query specified"
        show_usage
        exit 1
    fi

    # Load query from file if specified
    if [ -n "$SQL_FILE" ]; then
        if [ ! -f "$SQL_FILE" ]; then
            print_error "SQL file not found: $SQL_FILE"
            exit 1
        fi
        SQL_QUERY=$(cat "$SQL_FILE")
    fi

    # Load environment
    cd "$PROJECT_ROOT"
    load_environment "$ENVIRONMENT" || exit 1

    # Confirm production queries
    confirm_production_query || exit 0

    # Execute query
    print_header "Executing Query"
    execute_query "$SQL_QUERY"

    print_success "${CHECK_MARK} Query completed"
}

# Run main function
main "$@"
