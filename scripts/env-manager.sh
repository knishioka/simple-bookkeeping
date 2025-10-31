#!/bin/bash

# ============================================================================
# env-manager.sh - Environment Configuration Manager
# ============================================================================
# Purpose: Manage environment profiles for local development
#          Switch between Supabase Local and Production environments
# Usage: scripts/env-manager.sh <command> [options]
# Commands: list, current, switch, validate, diff, bootstrap
# ============================================================================

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common utilities
source "$SCRIPT_DIR/lib/common.sh"

# ============================================================================
# Configuration
# ============================================================================

# Environment profile files
ENV_LOCAL=".env.local"
ENV_SECRETS_DIR="env/secrets"
ENV_TEMPLATES_DIR="env/templates"
ENV_SUPABASE_LOCAL="$ENV_SECRETS_DIR/supabase.local.env"
ENV_SUPABASE_PROD="$ENV_SECRETS_DIR/supabase.prod.env"

# Project root
PROJECT_ROOT="$(get_project_root)"
cd "$PROJECT_ROOT" || die "Cannot change to project root: $PROJECT_ROOT"

# Ensure secrets directory exists (ignored by git)
mkdir -p "$ENV_SECRETS_DIR"

# ============================================================================
# Functions
# ============================================================================

# Show usage information
show_usage() {
    cat << EOF
${BOLD}Environment Manager - Manage Development Environment Profiles${NC}

${BOLD}Usage:${NC}
  $0 <command> [options]

${BOLD}Commands:${NC}
  list       List available environment profiles
  current    Show current active environment
  switch     Switch to a different environment profile
  validate   Validate current environment configuration
  diff       Show differences between profiles
  bootstrap  Copy template env files into env/secrets (non-destructive)
  help       Show this help message

${BOLD}Environment Profiles:${NC}
  local      Local development with Supabase Local (localhost:54321)
  prod       Local development with Supabase Production (cloud)

${BOLD}Options:${NC}
  --force, -f    Force switch without confirmation
  --verbose, -v  Enable verbose output

${BOLD}Examples:${NC}
  $0 list                    # List available profiles
  $0 current                 # Show current environment
  $0 switch local            # Switch to local Supabase
  $0 switch prod             # Switch to production Supabase
  $0 validate                # Validate current configuration
  $0 diff local prod         # Compare two profiles
  $0 bootstrap               # Copy template files into env/secrets

${BOLD}Safety Notes:${NC}
  ${WARNING_SIGN} Switching to 'prod' connects to production database
  ${WARNING_SIGN} All data changes will affect live production data
  ${WARNING_SIGN} Always backup before making schema changes

${BOLD}Environment Identifiers:${NC}
  ENV_PROFILE     Current profile name (local, local-with-production-supabase)
  ENV_SUPABASE    Supabase environment (local, production)

EOF
}

# List available environment profiles
list_profiles() {
    print_header "Available Environment Profiles"

    print_subheader "${CHECK_MARK} Local Supabase Development"
    print_info "Profile: local"
    print_info "File: $ENV_SUPABASE_LOCAL"
    print_info "Template: $ENV_TEMPLATES_DIR/supabase.local.env.example"
    print_info "Description: Local development with Supabase CLI (port 54321)"
    print_info "Database: postgresql://postgres:postgres@localhost:54322/postgres"

    if [ -f "$ENV_SUPABASE_LOCAL" ]; then
        print_success "Available"
    else
        print_error "File not found: $ENV_SUPABASE_LOCAL"
    fi

    echo ""

    print_subheader "${WARNING_SIGN} Production Supabase Development"
    print_info "Profile: prod"
    print_info "File: $ENV_SUPABASE_PROD"
    print_info "Template: $ENV_TEMPLATES_DIR/supabase.prod.env.example"
    print_info "Description: Local development with Production Supabase"
    print_warning "Connects to LIVE production database!"

    if [ -f "$ENV_SUPABASE_PROD" ]; then
        print_success "Available"

        # Check if SERVICE_ROLE_KEY is configured
        if grep -q "your-production-service-role-key" "$ENV_SUPABASE_PROD" 2>/dev/null; then
            print_warning "Service Role Key not configured yet"
        fi
    else
        print_error "File not found: $ENV_SUPABASE_PROD"
    fi

    echo ""
}

# Bootstrap env/secrets directory with template copies
bootstrap_env() {
    print_header "Bootstrapping environment secrets"

    local templates=(
        "common.env:$ENV_TEMPLATES_DIR/common.env.example"
        "supabase.local.env:$ENV_TEMPLATES_DIR/supabase.local.env.example"
        "supabase.prod.env:$ENV_TEMPLATES_DIR/supabase.prod.env.example"
        "vercel.env:$ENV_TEMPLATES_DIR/vercel.env.example"
        "ai.env:$ENV_TEMPLATES_DIR/ai.env.example"
    )

    local created=0

    for entry in "${templates[@]}"; do
        local filename template target
        filename="${entry%%:*}"
        template="${entry#*:}"
        target="$ENV_SECRETS_DIR/$filename"

        if [ ! -f "$template" ]; then
            print_warning "Template missing: $template"
            continue
        fi

        if [ -f "$target" ]; then
            print_info "Exists: $target (skipped)"
            continue
        fi

        cp "$template" "$target"
        if [ $? -eq 0 ]; then
            print_success "Created: $target"
            ((created++))
        else
            print_error "Failed to copy $template -> $target"
        fi
    done

    if [ $created -eq 0 ]; then
        print_info "No new files were created."
    else
        print_success "Bootstrap complete ($created file(s) created)."
    fi

    echo ""
    print_info "Next steps:"
    print_info "  1. Edit files under $ENV_SECRETS_DIR with real credentials"
    print_info "  2. Run scripts/env-manager.sh switch local"
}

# Show current environment
show_current() {
    print_header "Current Environment Configuration"

    if [ ! -L "$ENV_LOCAL" ] && [ ! -f "$ENV_LOCAL" ]; then
        print_error "No active environment found (.env.local does not exist)"
        return 1
    fi

    # Check if it's a symlink
    if [ -L "$ENV_LOCAL" ]; then
        local target
        target=$(readlink "$ENV_LOCAL")
        print_info "Configuration: Symlink to $target"
    else
        print_info "Configuration: Regular file (manual setup)"
    fi

    # Load and display environment identifiers
    if [ -f "$ENV_LOCAL" ]; then
        print_subheader "Environment Identifiers"

        local env_profile
        local env_supabase
        env_profile=$(grep "^ENV_PROFILE=" "$ENV_LOCAL" 2>/dev/null | cut -d= -f2)
        env_supabase=$(grep "^ENV_SUPABASE=" "$ENV_LOCAL" 2>/dev/null | cut -d= -f2)

        if [ -n "$env_profile" ]; then
            print_success "ENV_PROFILE: $env_profile"
        else
            print_warning "ENV_PROFILE: Not set"
        fi

        if [ -n "$env_supabase" ]; then
            if [ "$env_supabase" = "production" ]; then
                print_warning "ENV_SUPABASE: $env_supabase ${WARNING_SIGN} PRODUCTION"
            else
                print_success "ENV_SUPABASE: $env_supabase"
            fi
        else
            print_warning "ENV_SUPABASE: Not set"
        fi

        print_subheader "Supabase Configuration"

        local supabase_url
        local has_anon_key
        local has_service_key

        supabase_url=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" "$ENV_LOCAL" 2>/dev/null | cut -d= -f2)
        has_anon_key=$(grep -c "^NEXT_PUBLIC_SUPABASE_ANON_KEY=.\\+" "$ENV_LOCAL" 2>/dev/null)
        has_service_key=$(grep -c "^SUPABASE_SERVICE_ROLE_KEY=.\\+" "$ENV_LOCAL" 2>/dev/null)

        # Handle empty results
        has_anon_key=${has_anon_key:-0}
        has_service_key=${has_service_key:-0}

        if [ -n "$supabase_url" ]; then
            print_info "Supabase URL: $supabase_url"
        else
            print_error "Supabase URL: Not configured"
        fi

        if [ "$has_anon_key" -gt 0 ]; then
            print_success "Anon Key: Configured"
        else
            print_error "Anon Key: Not configured"
        fi

        if [ "$has_service_key" -gt 0 ]; then
            print_success "Service Role Key: Configured"
        else
            print_warning "Service Role Key: Not configured"
        fi
    fi

    echo ""
}

# Validate environment configuration
validate_env() {
    print_header "Validating Environment Configuration"

    local errors=0

    # Check if .env.local exists
    if [ ! -f "$ENV_LOCAL" ]; then
        print_error ".env.local not found"
        ((errors++))
        return $errors
    fi

    print_success ".env.local exists"

    # Load environment variables
    set -a
    # shellcheck disable=SC1090
    source <(grep -v '^\s*#' "$ENV_LOCAL" | grep -v '^\s*$') 2>/dev/null
    set +a

    # Required variables
    local required_vars=(
        "NODE_ENV"
        "NEXT_PUBLIC_APP_URL"
        "NEXT_PUBLIC_SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )

    print_subheader "Required Variables"
    for var in "${required_vars[@]}"; do
        if [ -n "${!var}" ]; then
            print_success "$var is set"
        else
            print_error "$var is missing"
            ((errors++))
        fi
    done

    # Optional but recommended variables
    local optional_vars=(
        "SUPABASE_SERVICE_ROLE_KEY"
        "ENV_PROFILE"
        "ENV_SUPABASE"
    )

    print_subheader "Optional Variables"
    for var in "${optional_vars[@]}"; do
        if [ -n "${!var}" ]; then
            print_success "$var is set"
        else
            print_warning "$var is not set"
        fi
    done

    # Check for placeholder values
    print_subheader "Configuration Check"

    if grep -q "your-production-service-role-key-here" "$ENV_LOCAL" 2>/dev/null; then
        print_warning "SUPABASE_SERVICE_ROLE_KEY contains placeholder value"
    fi

    if grep -q "your-.*-here" "$ENV_LOCAL" 2>/dev/null; then
        print_warning "Some values contain placeholders (your-*-here)"
        ((errors++))
    fi

    # Supabase connection check
    if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
        print_subheader "Connectivity Check"
        if curl -sf "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/" >/dev/null 2>&1; then
            print_success "Supabase endpoint is reachable"
        else
            print_warning "Cannot reach Supabase endpoint (may not be started)"
        fi
    fi

    echo ""
    if [ $errors -eq 0 ]; then
        print_success "${CHECK_MARK} Environment validation passed"
        return 0
    else
        print_error "${CROSS_MARK} Environment validation failed with $errors error(s)"
        return 1
    fi
}

# Switch environment profile
switch_env() {
    local profile="$1"
    local force="${2:-false}"

    if [ -z "$profile" ]; then
        print_error "Profile name required. Use: local or prod"
        show_usage
        return 1
    fi

    # Determine target file
    local target_file
    case "$profile" in
        local)
            target_file="$ENV_SUPABASE_LOCAL"
            ;;
        prod|production)
            target_file="$ENV_SUPABASE_PROD"
            ;;
        *)
            print_error "Unknown profile: $profile"
            print_info "Available profiles: local, prod"
            return 1
            ;;
    esac

    # Check if target file exists
    if [ ! -f "$target_file" ]; then
        print_error "Profile file not found: $target_file"
        print_info "Please create the environment profile file first"
        return 1
    fi

    # Show current environment
    print_header "Switching Environment Profile"
    print_info "Target profile: $profile"
    print_info "Target file: $target_file"

    # Warning for production
    if [[ "$profile" == "prod" ]] || [[ "$profile" == "production" ]]; then
        echo ""
        print_warning "═══════════════════════════════════════════════════════"
        print_warning "  ${WARNING_SIGN}  PRODUCTION ENVIRONMENT WARNING  ${WARNING_SIGN}"
        print_warning "═══════════════════════════════════════════════════════"
        print_warning ""
        print_warning "You are about to connect to PRODUCTION Supabase"
        print_warning "All database operations will affect LIVE data"
        print_warning ""
        print_warning "Before proceeding:"
        print_warning "  1. Ensure you have proper backups"
        print_warning "  2. Test all changes on local first"
        print_warning "  3. Understand the impact of your changes"
        print_warning ""
        print_warning "═══════════════════════════════════════════════════════"
        echo ""

        if [ "$force" != "true" ] && ! confirm "Switch to production environment?" "n"; then
            print_info "Environment switch cancelled"
            return 0
        fi
    fi

    # Backup existing .env.local if it exists and is not a symlink
    if [ -f "$ENV_LOCAL" ] && [ ! -L "$ENV_LOCAL" ]; then
        local backup_file="${ENV_LOCAL}.backup.$(date +%Y%m%d_%H%M%S)"
        print_info "Backing up current .env.local to $backup_file"
        cp "$ENV_LOCAL" "$backup_file"
    fi

    # Remove existing .env.local (whether file or symlink)
    if [ -e "$ENV_LOCAL" ] || [ -L "$ENV_LOCAL" ]; then
        rm -f "$ENV_LOCAL"
    fi

    # Create symlink
    ln -sf "$target_file" "$ENV_LOCAL"

    if [ $? -eq 0 ]; then
        print_success "${CHECK_MARK} Environment switched successfully"
        print_info "Active profile: $profile"

        # Show new environment
        echo ""
        show_current

        # Reminder to restart services
        echo ""
        print_warning "${GEAR} Remember to restart your development server:"
        print_info "  ${BOLD}pnpm dev${NC}"

        if [[ "$profile" == "local" ]]; then
            print_info "  ${BOLD}pnpm supabase:start${NC}  # Start local Supabase if not running"
        fi
    else
        print_error "Failed to switch environment"
        return 1
    fi
}

# Compare two environment profiles
diff_profiles() {
    local profile1="$1"
    local profile2="$2"

    if [ -z "$profile1" ] || [ -z "$profile2" ]; then
        print_error "Two profile names required"
        print_info "Usage: $0 diff local prod"
        return 1
    fi

    # Determine file paths
    local file1
    local file2

    case "$profile1" in
        local) file1="$ENV_SUPABASE_LOCAL" ;;
        prod|production) file1="$ENV_SUPABASE_PROD" ;;
        *) print_error "Unknown profile: $profile1"; return 1 ;;
    esac

    case "$profile2" in
        local) file2="$ENV_SUPABASE_LOCAL" ;;
        prod|production) file2="$ENV_SUPABASE_PROD" ;;
        *) print_error "Unknown profile: $profile2"; return 1 ;;
    esac

    if [ ! -f "$file1" ]; then
        print_error "Profile file not found: $file1"
        return 1
    fi

    if [ ! -f "$file2" ]; then
        print_error "Profile file not found: $file2"
        return 1
    fi

    print_header "Comparing Environment Profiles"
    print_info "Profile 1: $profile1 ($file1)"
    print_info "Profile 2: $profile2 ($file2)"
    echo ""

    # Use diff with color if available
    if command_exists colordiff; then
        colordiff -u "$file1" "$file2" || true
    else
        diff -u "$file1" "$file2" || true
    fi
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

    # Parse options
    local force=false
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--force)
                force=true
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
        list|ls)
            list_profiles
            ;;
        current|show)
            show_current
            ;;
        switch|use)
            switch_env "$1" "$force"
            ;;
        validate|check)
            validate_env
            ;;
        diff|compare)
            diff_profiles "$1" "$2"
            ;;
        bootstrap)
            bootstrap_env
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
