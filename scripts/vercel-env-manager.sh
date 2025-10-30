#!/bin/bash

# ============================================================================
# vercel-env-manager.sh - Vercel Environment Variables Manager
# ============================================================================
# Purpose: Safely manage Vercel environment variables across environments
#          Provides read-only operations and controlled write operations
# Usage: scripts/vercel-env-manager.sh <command> [options]
# Commands: list, get, add, rm, pull, sync
# Requirements: Vercel CLI
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

# Supabase project reference
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-eksgzskroipxdwtbmkxm}"

# ============================================================================
# Functions
# ============================================================================

# Show usage information
show_usage() {
    cat << EOF
${BOLD}Vercel Environment Manager - Manage Vercel Environment Variables${NC}

${BOLD}Usage:${NC}
  $0 <command> [options] [arguments]

${BOLD}Commands:${NC}
  list           List all environment variables
  get            Get specific environment variable value
  add            Add new environment variable
  rm             Remove environment variable
  pull           Pull environment variables to .env file
  sync           Sync Supabase configuration to Vercel
  validate       Validate Vercel environment configuration
  help           Show this help message

${BOLD}Options:${NC}
  --env ENV      Target environment (production, preview, development)
  --dry-run      Show what would be done without executing
  --yes, -y      Skip confirmation prompts
  --verbose, -v  Enable verbose output

${BOLD}Examples:${NC}
  # Read-only operations (always safe)
  $0 list                                      # List all variables
  $0 list --env production                     # List production variables
  $0 get NEXT_PUBLIC_SUPABASE_URL              # Get specific variable

  # Write operations (require confirmation)
  $0 add MY_VAR value --env production         # Add variable
  $0 rm MY_VAR --env production                # Remove variable
  $0 sync                                      # Sync Supabase config

  # Development workflow
  $0 pull --env preview .env.vercel.preview    # Pull preview env to file
  $0 validate                                  # Validate configuration

${BOLD}Supabase Configuration Sync:${NC}
  The 'sync' command automatically configures these variables:
    - NEXT_PUBLIC_SUPABASE_URL
    - NEXT_PUBLIC_SUPABASE_ANON_KEY
    - SUPABASE_SERVICE_ROLE_KEY (requires manual input)

${BOLD}Safety Notes:${NC}
  ${WARNING_SIGN} Production environment: Changes affect live application
  ${WARNING_SIGN} Always test in preview environment first
  ${WARNING_SIGN} Use --dry-run to preview changes
  ${CHECK_MARK} List and get operations are always safe

${BOLD}Environment Scopes:${NC}
  production    Production deployments only
  preview       Preview deployments (PRs)
  development   Local development (vercel dev)

EOF
}

# Check Vercel CLI
check_vercel_cli() {
    require_command vercel "Install Vercel CLI: npm install -g vercel"

    # Check if logged in
    if ! vercel whoami &>/dev/null; then
        print_error "Not logged in to Vercel"
        print_info "Run: ${BOLD}vercel login${NC}"
        return 1
    fi

    # Check if linked to project
    if [ ! -f ".vercel/project.json" ]; then
        print_warning "Project not linked to Vercel"
        print_info "Run: ${BOLD}vercel link${NC}"
        return 1
    fi

    return 0
}

# List environment variables
list_env_vars() {
    local env="${1:-production}"

    if ! check_vercel_cli; then
        return 1
    fi

    print_header "Vercel Environment Variables"
    print_info "Environment: ${BOLD}$env${NC}"
    echo ""

    vercel env ls "$env"
}

# Get specific environment variable
get_env_var() {
    local var_name="$1"
    local env="${2:-production}"

    if [ -z "$var_name" ]; then
        print_error "Variable name required"
        print_info "Usage: $0 get VARIABLE_NAME [environment]"
        return 1
    fi

    if ! check_vercel_cli; then
        return 1
    fi

    print_header "Get Environment Variable"
    print_info "Variable: ${BOLD}$var_name${NC}"
    print_info "Environment: ${BOLD}$env${NC}"
    echo ""

    # Note: vercel env pull can be used to get all variables
    # For individual variables, we use vercel env ls and parse
    vercel env ls "$env" | grep -i "^$var_name" || print_warning "Variable not found"
}

# Add environment variable
add_env_var() {
    local var_name="$1"
    local var_value="$2"
    local env="${3:-production}"
    local yes="${4:-false}"

    if [ -z "$var_name" ]; then
        print_error "Variable name required"
        print_info "Usage: $0 add VARIABLE_NAME value [environment]"
        return 1
    fi

    if ! check_vercel_cli; then
        return 1
    fi

    print_header "Add Environment Variable"
    print_info "Variable: ${BOLD}$var_name${NC}"
    print_info "Environment: ${BOLD}$env${NC}"

    if [ "$env" = "production" ]; then
        echo ""
        print_warning "${WARNING_SIGN} Adding variable to PRODUCTION environment"
        print_warning "This will affect live application after next deployment"
    fi

    if [ "$yes" != "true" ]; then
        echo ""
        if ! confirm "Add this environment variable?" "n"; then
            print_info "Operation cancelled"
            return 0
        fi
    fi

    if [ -n "$var_value" ]; then
        # Non-interactive mode with value
        echo "$var_value" | vercel env add "$var_name" "$env"
    else
        # Interactive mode
        vercel env add "$var_name" "$env"
    fi

    if [ $? -eq 0 ]; then
        print_success "Variable added successfully"
        print_info "Deploy to apply changes: ${BOLD}vercel --prod${NC}"
    else
        print_error "Failed to add variable"
        return 1
    fi
}

# Remove environment variable
remove_env_var() {
    local var_name="$1"
    local env="${2:-production}"
    local yes="${3:-false}"

    if [ -z "$var_name" ]; then
        print_error "Variable name required"
        print_info "Usage: $0 rm VARIABLE_NAME [environment]"
        return 1
    fi

    if ! check_vercel_cli; then
        return 1
    fi

    print_header "Remove Environment Variable"
    print_info "Variable: ${BOLD}$var_name${NC}"
    print_info "Environment: ${BOLD}$env${NC}"

    if [ "$env" = "production" ]; then
        echo ""
        print_warning "${WARNING_SIGN} Removing variable from PRODUCTION environment"
        print_warning "This will affect live application after next deployment"
    fi

    if [ "$yes" != "true" ]; then
        echo ""
        if ! confirm "Remove this environment variable?" "n"; then
            print_info "Operation cancelled"
            return 0
        fi
    fi

    vercel env rm "$var_name" "$env" --yes

    if [ $? -eq 0 ]; then
        print_success "Variable removed successfully"
    else
        print_error "Failed to remove variable"
        return 1
    fi
}

# Pull environment variables
pull_env_vars() {
    local env="${1:-production}"
    local output_file="${2:-.env.vercel.$env}"

    if ! check_vercel_cli; then
        return 1
    fi

    print_header "Pull Environment Variables"
    print_info "Environment: ${BOLD}$env${NC}"
    print_info "Output file: ${BOLD}$output_file${NC}"

    if [ "$env" = "production" ]; then
        print_warning "${WARNING_SIGN} Pulling PRODUCTION environment variables"
        print_warning "File will contain sensitive data"

        if ! confirm "Pull production environment variables?" "n"; then
            print_info "Operation cancelled"
            return 0
        fi
    fi

    vercel env pull "$output_file" --environment="$env"

    if [ $? -eq 0 ]; then
        print_success "Environment variables pulled successfully"
        print_warning "File contains sensitive data: $output_file"
        print_info "Make sure it's in .gitignore"
    else
        print_error "Failed to pull environment variables"
        return 1
    fi
}

# Sync Supabase configuration
sync_supabase_config() {
    local env="${1:-production}"
    local yes="${2:-false}"

    if ! check_vercel_cli; then
        return 1
    fi

    print_header "Sync Supabase Configuration to Vercel"
    print_info "Environment: ${BOLD}$env${NC}"
    print_info "Project Ref: ${BOLD}$SUPABASE_PROJECT_REF${NC}"

    local supabase_url="https://${SUPABASE_PROJECT_REF}.supabase.co"

    echo ""
    print_subheader "Configuration to Sync"
    print_info "NEXT_PUBLIC_SUPABASE_URL: $supabase_url"
    print_info "NEXT_PUBLIC_SUPABASE_ANON_KEY: (from Supabase Dashboard)"
    print_info "SUPABASE_SERVICE_ROLE_KEY: (from Supabase Dashboard)"

    echo ""
    print_warning "Before proceeding, get keys from Supabase Dashboard:"
    print_info "https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/settings/api"

    if [ "$yes" != "true" ]; then
        echo ""
        if ! confirm "Proceed with Supabase configuration sync?" "n"; then
            print_info "Sync cancelled"
            return 0
        fi
    fi

    # Remove existing variables
    print_subheader "Removing Existing Variables"
    vercel env rm NEXT_PUBLIC_SUPABASE_URL "$env" --yes 2>/dev/null || true
    vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY "$env" --yes 2>/dev/null || true
    vercel env rm SUPABASE_SERVICE_ROLE_KEY "$env" --yes 2>/dev/null || true
    print_success "Old variables removed"

    # Add new variables
    print_subheader "Adding New Variables"

    echo ""
    print_info "1. Setting NEXT_PUBLIC_SUPABASE_URL"
    echo "$supabase_url" | vercel env add NEXT_PUBLIC_SUPABASE_URL "$env"

    echo ""
    print_info "2. Setting NEXT_PUBLIC_SUPABASE_ANON_KEY"
    print_warning "Paste the anon public key from Supabase Dashboard:"
    vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY "$env"

    echo ""
    print_info "3. Setting SUPABASE_SERVICE_ROLE_KEY"
    print_warning "Paste the service_role secret key from Supabase Dashboard:"
    vercel env add SUPABASE_SERVICE_ROLE_KEY "$env"

    echo ""
    print_success "${CHECK_MARK} Supabase configuration synced successfully"
    print_info ""
    print_info "Next steps:"
    print_info "  1. Redeploy to production: ${BOLD}vercel --prod${NC}"
    print_info "  2. Verify deployment at your production URL"
}

# Validate Vercel environment
validate_vercel_env() {
    if ! check_vercel_cli; then
        return 1
    fi

    print_header "Validating Vercel Environment Configuration"

    local errors=0

    # Check project link
    print_subheader "Project Configuration"
    if [ -f ".vercel/project.json" ]; then
        local project_id
        project_id=$(jq -r '.projectId' .vercel/project.json 2>/dev/null)

        if [ -n "$project_id" ] && [ "$project_id" != "null" ]; then
            print_success "Project linked: $project_id"
        else
            print_error "Invalid project configuration"
            ((errors++))
        fi
    else
        print_error "Project not linked"
        ((errors++))
    fi

    # Check required environment variables
    print_subheader "Required Environment Variables"

    local required_vars=(
        "NEXT_PUBLIC_SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )

    for var in "${required_vars[@]}"; do
        if vercel env ls production 2>/dev/null | grep -q "^$var"; then
            print_success "$var is configured"
        else
            print_error "$var is missing"
            ((errors++))
        fi
    done

    # Check optional variables
    print_subheader "Optional Environment Variables"

    if vercel env ls production 2>/dev/null | grep -q "^SUPABASE_SERVICE_ROLE_KEY"; then
        print_success "SUPABASE_SERVICE_ROLE_KEY is configured"
    else
        print_warning "SUPABASE_SERVICE_ROLE_KEY is not configured"
    fi

    echo ""
    if [ $errors -eq 0 ]; then
        print_success "${CHECK_MARK} Vercel environment validation passed"
        return 0
    else
        print_error "${CROSS_MARK} Vercel environment validation failed with $errors error(s)"
        return 1
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
    local env="production"
    local yes=false
    local dry_run=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --env)
                env="$2"
                shift 2
                ;;
            -y|--yes)
                yes=true
                shift
                ;;
            --dry-run)
                dry_run=true
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

    # Dry run mode
    if [ "$dry_run" = "true" ]; then
        print_warning "${INFO_SIGN} DRY RUN MODE - No changes will be made"
        echo ""
    fi

    # Execute command
    case "$command" in
        list|ls)
            list_env_vars "$env"
            ;;
        get)
            get_env_var "$1" "$env"
            ;;
        add|set)
            if [ "$dry_run" = "true" ]; then
                print_info "Would add: $1 to $env environment"
            else
                add_env_var "$1" "$2" "$env" "$yes"
            fi
            ;;
        rm|remove|delete)
            if [ "$dry_run" = "true" ]; then
                print_info "Would remove: $1 from $env environment"
            else
                remove_env_var "$1" "$env" "$yes"
            fi
            ;;
        pull)
            if [ "$dry_run" = "true" ]; then
                print_info "Would pull $env environment to file"
            else
                pull_env_vars "$env" "$1"
            fi
            ;;
        sync)
            if [ "$dry_run" = "true" ]; then
                print_info "Would sync Supabase configuration to $env environment"
            else
                sync_supabase_config "$env" "$yes"
            fi
            ;;
        validate|check)
            validate_vercel_env
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
