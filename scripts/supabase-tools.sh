#!/bin/bash

# ============================================================================
# supabase-tools.sh - Supabase Operations Toolkit
# ============================================================================
# Purpose: Consolidated tool for Supabase operations via CLI and psql
#          Provides unified interface for database queries, migrations,
#          and environment-aware operations
# Usage: scripts/supabase-tools.sh <command> [options]
# Commands: status, psql, query, migrate, reset, logs, types
# Requirements: Supabase CLI, psql (PostgreSQL client)
# ============================================================================

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common utilities
source "$SCRIPT_DIR/lib/common.sh"

# ============================================================================
# Configuration
# ============================================================================

# Project root
PROJECT_ROOT="$(get_project_root)"
cd "$PROJECT_ROOT" || die "Cannot change to project root: $PROJECT_ROOT"

# Load environment
load_env ".env.local"

# Detect Supabase environment
detect_supabase_env() {
    local supabase_url="${NEXT_PUBLIC_SUPABASE_URL:-}"

    if [[ "$supabase_url" == *"localhost"* ]] || [[ "$supabase_url" == *"127.0.0.1"* ]]; then
        echo "local"
    elif [[ "$supabase_url" == *"supabase.co"* ]]; then
        echo "production"
    else
        echo "unknown"
    fi
}

SUPABASE_ENV=$(detect_supabase_env)

# ============================================================================
# Functions
# ============================================================================

# Show usage information
show_usage() {
    cat << EOF
${BOLD}Supabase Tools - Unified Supabase Operations${NC}

${BOLD}Usage:${NC}
  $0 <command> [options] [arguments]

${BOLD}Commands:${NC}
  status         Show Supabase service status
  psql           Open psql interactive shell
  query          Execute SQL query from command line
  file           Execute SQL file
  migrate        Run migrations (new, up, down, reset)
  reset          Reset local database
  logs           View Supabase logs
  types          Generate TypeScript types
  link           Link to Supabase project
  functions      Manage Edge Functions
  help           Show this help message

${BOLD}Environment Detection:${NC}
  Current: ${BOLD}$SUPABASE_ENV${NC}
  URL: ${NEXT_PUBLIC_SUPABASE_URL:-Not configured}

${BOLD}Options:${NC}
  --local, -l       Force local Supabase operations
  --remote, -r      Force remote Supabase operations
  --dry-run         Show what would be done without executing
  --verbose, -v     Enable verbose output

${BOLD}Examples:${NC}
  # Status and information
  $0 status                                    # Show service status
  $0 psql                                      # Open interactive SQL shell

  # Execute queries
  $0 query "SELECT * FROM users LIMIT 5"       # Run single query
  $0 file supabase/seed.sql                    # Execute SQL file

  # Migrations
  $0 migrate new add_users_table               # Create new migration
  $0 migrate up                                # Apply pending migrations
  $0 migrate status                            # Show migration status

  # Development
  $0 reset                                     # Reset local database
  $0 types                                     # Generate TypeScript types
  $0 logs --level error                        # View error logs

  # Edge Functions
  $0 functions list                            # List functions
  $0 functions deploy function-name            # Deploy function

${BOLD}Safety Warnings:${NC}
  ${WARNING_SIGN} Local environment: Safe for experimentation
  ${WARNING_SIGN} Production environment: Use with extreme caution!
      - All operations affect LIVE data
      - Always test locally first
      - Use --dry-run when available

${BOLD}Database Connection:${NC}
  Local:      postgresql://postgres:postgres@localhost:54322/postgres
  Production: Configured via NEXT_PUBLIC_SUPABASE_URL

EOF
}

# Show Supabase status
show_status() {
    print_header "Supabase Service Status"

    print_info "Environment: ${BOLD}$SUPABASE_ENV${NC}"
    print_info "Supabase URL: ${NEXT_PUBLIC_SUPABASE_URL:-Not configured}"

    if [ "$SUPABASE_ENV" = "local" ]; then
        print_subheader "Local Services"

        if command_exists supabase; then
            supabase status 2>/dev/null || print_warning "Supabase services not running"
        else
            print_error "Supabase CLI not installed"
        fi

        # Check if Supabase is running
        if curl -sf "http://localhost:54321/rest/v1/" >/dev/null 2>&1; then
            print_success "Supabase API: ${GREEN}Online${NC} (http://localhost:54321)"
        else
            print_warning "Supabase API: ${YELLOW}Offline${NC}"
            print_info "Start with: ${BOLD}pnpm supabase:start${NC}"
        fi

        if is_port_in_use 54322; then
            print_success "PostgreSQL: ${GREEN}Running${NC} (port 54322)"
        else
            print_warning "PostgreSQL: ${YELLOW}Not running${NC}"
        fi

        if is_port_in_use 54323; then
            print_success "Studio: ${GREEN}Available${NC} (http://localhost:54323)"
        else
            print_warning "Studio: ${YELLOW}Not available${NC}"
        fi
    else
        print_subheader "Remote Connection"

        if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
            if curl -sf "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/" >/dev/null 2>&1; then
                print_success "Supabase API: ${GREEN}Online${NC}"
            else
                print_error "Supabase API: ${RED}Unreachable${NC}"
            fi
        else
            print_error "Supabase URL not configured"
        fi
    fi

    echo ""
}

# Open psql interactive shell
open_psql() {
    require_command psql "Install PostgreSQL: brew install postgresql"

    print_header "Opening PostgreSQL Shell"

    if [ "$SUPABASE_ENV" = "local" ]; then
        print_info "Connecting to local Supabase database..."
        print_info "Connection: postgresql://postgres:postgres@localhost:54322/postgres"

        # Check if local Supabase is running
        if ! is_port_in_use 54322; then
            print_error "Local Supabase not running"
            print_info "Start with: ${BOLD}pnpm supabase:start${NC}"
            return 1
        fi

        export PGPASSWORD=postgres
        psql -h localhost -p 54322 -U postgres -d postgres "$@"
    else
        print_warning "${WARNING_SIGN} Connecting to PRODUCTION database"

        if [ -z "$SUPABASE_DB_URL" ]; then
            print_error "SUPABASE_DB_URL not configured"
            print_info "Add database URL to .env.local"
            return 1
        fi

        if ! confirm "Connect to production database?" "n"; then
            print_info "Connection cancelled"
            return 0
        fi

        psql "$SUPABASE_DB_URL" "$@"
    fi
}

# Execute SQL query
execute_query() {
    local query="$1"

    if [ -z "$query" ]; then
        print_error "Query required"
        print_info "Usage: $0 query \"SELECT * FROM users\""
        return 1
    fi

    require_command psql "Install PostgreSQL: brew install postgresql"

    print_header "Executing SQL Query"

    if [ "$SUPABASE_ENV" = "production" ]; then
        print_warning "${WARNING_SIGN} Running query on PRODUCTION database"
        print_info "Query: $query"

        if ! confirm "Execute this query on production?" "n"; then
            print_info "Query cancelled"
            return 0
        fi
    else
        print_info "Query: $query"
    fi

    if [ "$SUPABASE_ENV" = "local" ]; then
        if ! is_port_in_use 54322; then
            print_error "Local Supabase not running"
            return 1
        fi

        export PGPASSWORD=postgres
        psql -h localhost -p 54322 -U postgres -d postgres -c "$query"
    else
        if [ -z "$SUPABASE_DB_URL" ]; then
            print_error "SUPABASE_DB_URL not configured"
            return 1
        fi

        psql "$SUPABASE_DB_URL" -c "$query"
    fi
}

# Execute SQL file
execute_file() {
    local file="$1"

    if [ -z "$file" ]; then
        print_error "File path required"
        print_info "Usage: $0 file path/to/query.sql"
        return 1
    fi

    if [ ! -f "$file" ]; then
        print_error "File not found: $file"
        return 1
    fi

    require_command psql "Install PostgreSQL: brew install postgresql"

    print_header "Executing SQL File"
    print_info "File: $file"

    if [ "$SUPABASE_ENV" = "production" ]; then
        print_warning "${WARNING_SIGN} Running SQL file on PRODUCTION database"

        if ! confirm "Execute this file on production?" "n"; then
            print_info "Execution cancelled"
            return 0
        fi
    fi

    if [ "$SUPABASE_ENV" = "local" ]; then
        if ! is_port_in_use 54322; then
            print_error "Local Supabase not running"
            return 1
        fi

        export PGPASSWORD=postgres
        psql -h localhost -p 54322 -U postgres -d postgres -f "$file"
    else
        if [ -z "$SUPABASE_DB_URL" ]; then
            print_error "SUPABASE_DB_URL not configured"
            return 1
        fi

        psql "$SUPABASE_DB_URL" -f "$file"
    fi
}

# Manage migrations
manage_migrations() {
    local action="$1"
    shift || true

    require_command supabase "Install Supabase CLI: brew install supabase/tap/supabase"

    case "$action" in
        new|create)
            local name="$1"
            if [ -z "$name" ]; then
                print_error "Migration name required"
                print_info "Usage: $0 migrate new migration_name"
                return 1
            fi

            print_info "Creating new migration: $name"
            supabase migration new "$name"
            ;;

        up|apply)
            print_header "Applying Migrations"

            if [ "$SUPABASE_ENV" = "production" ]; then
                print_warning "${WARNING_SIGN} Applying migrations to PRODUCTION"

                if ! confirm "Apply migrations to production?" "n"; then
                    print_info "Migration cancelled"
                    return 0
                fi

                supabase db push
            else
                print_info "Applying migrations to local database"
                supabase migration up
            fi
            ;;

        status|list)
            print_header "Migration Status"
            supabase migration list
            ;;

        repair)
            print_header "Repairing Migration History"
            supabase migration repair --status applied "$@"
            ;;

        *)
            print_error "Unknown migration action: $action"
            print_info "Available actions: new, up, status, repair"
            return 1
            ;;
    esac
}

# Reset local database
reset_database() {
    if [ "$SUPABASE_ENV" != "local" ]; then
        print_error "Reset is only available for local environment"
        print_warning "Current environment: $SUPABASE_ENV"
        return 1
    fi

    print_header "Reset Local Database"
    print_warning "This will delete ALL local data"

    if ! confirm "Reset local database?" "n"; then
        print_info "Reset cancelled"
        return 0
    fi

    require_command supabase "Install Supabase CLI: brew install supabase/tap/supabase"

    print_info "Resetting local database..."
    supabase db reset
    print_success "Database reset complete"
}

# View logs
view_logs() {
    require_command supabase "Install Supabase CLI: brew install supabase/tap/supabase"

    print_header "Supabase Logs"

    if [ "$SUPABASE_ENV" = "local" ]; then
        supabase logs "$@"
    else
        print_warning "Remote logs require project linking"
        supabase logs --project-ref "${SUPABASE_PROJECT_REF:-}" "$@"
    fi
}

# Generate TypeScript types
generate_types() {
    require_command supabase "Install Supabase CLI: brew install supabase/tap/supabase"

    print_header "Generating TypeScript Types"

    local output_file="apps/web/lib/supabase/database.types.ts"

    if [ "$SUPABASE_ENV" = "local" ]; then
        print_info "Generating types from local database..."
        supabase gen types typescript --local > "$output_file"
    else
        print_info "Generating types from remote database..."

        if [ -z "$SUPABASE_PROJECT_REF" ]; then
            print_error "SUPABASE_PROJECT_REF not configured"
            print_info "Set project ref or link project first"
            return 1
        fi

        supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" > "$output_file"
    fi

    if [ -f "$output_file" ]; then
        print_success "Types generated: $output_file"
    else
        print_error "Failed to generate types"
        return 1
    fi
}

# Manage Edge Functions
manage_functions() {
    local action="$1"
    shift || true

    require_command supabase "Install Supabase CLI: brew install supabase/tap/supabase"

    case "$action" in
        list)
            print_header "Edge Functions"
            supabase functions list
            ;;

        new|create)
            local name="$1"
            if [ -z "$name" ]; then
                print_error "Function name required"
                return 1
            fi

            print_info "Creating function: $name"
            supabase functions new "$name"
            ;;

        deploy)
            local name="$1"

            if [ "$SUPABASE_ENV" = "production" ]; then
                print_warning "${WARNING_SIGN} Deploying to PRODUCTION"

                if ! confirm "Deploy function to production?" "n"; then
                    return 0
                fi
            fi

            if [ -n "$name" ]; then
                supabase functions deploy "$name"
            else
                supabase functions deploy
            fi
            ;;

        serve)
            print_info "Starting local Edge Functions..."
            supabase functions serve "$@"
            ;;

        *)
            print_error "Unknown function action: $action"
            print_info "Available actions: list, new, deploy, serve"
            return 1
            ;;
    esac
}

# ============================================================================
# Main
# ============================================================================

main() {
    local command="${1:-}"

    if [ -z "$command" ]; then
        show_usage
        exit 0
    fi

    shift || true

    # Parse global options
    while [[ $# -gt 0 ]]; do
        case $1 in
            -l|--local)
                SUPABASE_ENV="local"
                shift
                ;;
            -r|--remote)
                SUPABASE_ENV="production"
                shift
                ;;
            -v|--verbose)
                DEBUG=1
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                break
                ;;
        esac
    done

    # Execute command
    case "$command" in
        status|info)
            show_status
            ;;
        psql|shell|sql)
            open_psql "$@"
            ;;
        query|exec)
            execute_query "$@"
            ;;
        file|run)
            execute_file "$@"
            ;;
        migrate|migration)
            manage_migrations "$@"
            ;;
        reset)
            reset_database
            ;;
        logs|log)
            view_logs "$@"
            ;;
        types|gen-types)
            generate_types
            ;;
        functions|fn)
            manage_functions "$@"
            ;;
        link)
            require_command supabase
            supabase link "$@"
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            print_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
