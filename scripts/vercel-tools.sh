#!/bin/bash

# ============================================================================
# vercel-tools.sh - Consolidated Vercel Management Tool
# ============================================================================
# Purpose: Unified tool for Vercel deployments, logs, and status monitoring
#          Consolidates vercel-api-status.sh, vercel-logs.sh, and check-deployments.sh
# Usage: scripts/vercel-tools.sh <command> [options]
# Commands: status, logs, deployments, api-status, inspect
# Requirements: Vercel CLI, optional VERCEL_TOKEN for enhanced features
# ============================================================================

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common utilities
source "$SCRIPT_DIR/lib/common.sh"

# ============================================================================
# Configuration
# ============================================================================

# Vercel API endpoint
VERCEL_API="https://api.vercel.com"

# Default values
DEFAULT_LOG_LINES=100
DEFAULT_DEPLOYMENT_LIMIT=5

# Get Vercel configuration
setup_vercel() {
    # Try to source Vercel config
    if ! source_vercel_config; then
        # Fallback to manual configuration
        if [ -f ".vercel/project.json" ]; then
            PROJECT_ID=$(jq -r '.projectId' .vercel/project.json 2>/dev/null)
            ORG_ID=$(jq -r '.orgId' .vercel/project.json 2>/dev/null)
        else
            print_error "Not a Vercel project. Run 'vercel link' first."
            exit 2
        fi
    fi

    # Get Vercel token
    TOKEN=$(get_vercel_token)
    if [ -z "$TOKEN" ]; then
        print_warning "No Vercel token found. Some features may be limited."
        print_info "Set VERCEL_TOKEN or run 'vercel login'"
    fi

    # Export for use in functions
    export PROJECT_ID
    export ORG_ID
    export TOKEN
}

# ============================================================================
# Functions
# ============================================================================

# Show usage information
show_usage() {
    cat << EOF
${BOLD}Vercel Tools - Consolidated Vercel Management${NC}

${BOLD}Usage:${NC}
  $0 <command> [options]

${BOLD}Commands:${NC}
  status         Show current deployment status
  logs           View deployment logs (runtime, build, errors)
  deployments    List recent deployments
  api-status     Check Vercel API connectivity and health
  inspect        Detailed inspection of a deployment
  promote        Promote deployment to production
  rollback       Rollback to previous deployment
  help           Show this help message

${BOLD}Options:${NC}
  --prod         Show production deployment only
  --preview      Show preview deployments only
  --limit N      Number of items to show (default: 5)
  --follow, -f   Follow logs in real-time
  --json         Output in JSON format
  --verbose, -v  Enable verbose output

${BOLD}Log Types (for 'logs' command):${NC}
  runtime        Runtime/function logs (default)
  build          Build process logs
  error          Error logs only
  static         Static file access logs
  edge           Edge function logs
  all            All available logs

${BOLD}Examples:${NC}
  $0 status                        # Show current deployment status
  $0 logs runtime --follow         # Follow runtime logs
  $0 logs build --limit 200        # Show last 200 build log lines
  $0 deployments --prod            # List production deployments
  $0 api-status                    # Check API connectivity
  $0 inspect <deployment-id>       # Inspect specific deployment

${BOLD}Environment Variables:${NC}
  VERCEL_TOKEN       Vercel API token for authentication
  VERCEL_PROJECT_ID  Override project ID
  VERCEL_ORG_ID      Override organization ID

${BOLD}Requirements:${NC}
  - Vercel CLI installed (npm i -g vercel)
  - Project linked with 'vercel link'
  - Optional: VERCEL_TOKEN for API features

EOF
}

# Get latest deployment
get_latest_deployment() {
    local env_filter="${1:-}"  # production, preview, or empty for all

    if [ -z "$TOKEN" ]; then
        # Use Vercel CLI
        vercel list --json 2>/dev/null | jq -r '.[0].uid' 2>/dev/null
    else
        # Use API
        local query="projectId=$PROJECT_ID&limit=1"
        [ -n "$ORG_ID" ] && [ "$ORG_ID" != "null" ] && query="$query&teamId=$ORG_ID"
        [ -n "$env_filter" ] && query="$query&target=$env_filter"

        curl -s -H "Authorization: Bearer $TOKEN" \
            "$VERCEL_API/v6/deployments?$query" | \
            jq -r '.deployments[0].uid' 2>/dev/null
    fi
}

# Show deployment status
cmd_status() {
    print_header "Vercel Deployment Status"

    setup_vercel

    # Check if we have API access
    if [ -z "$TOKEN" ]; then
        # Use Vercel CLI
        print_info "Using Vercel CLI (limited features)"
        vercel list --json 2>/dev/null | jq -r '
            .[0] |
            "Deployment: \(.name)
URL: \(.url)
State: \(.state)
Created: \(.created)
Environment: \(.target)"
        ' || print_error "Failed to get deployment status"
    else
        # Get production deployment
        print_subheader "Production Deployment"
        local prod_id=$(get_latest_deployment "production")
        if [ -n "$prod_id" ] && [ "$prod_id" != "null" ]; then
            show_deployment_details "$prod_id"
        else
            print_warning "No production deployment found"
        fi

        echo ""

        # Get latest preview
        print_subheader "Latest Preview Deployment"
        local preview_id=$(get_latest_deployment "preview")
        if [ -n "$preview_id" ] && [ "$preview_id" != "null" ]; then
            show_deployment_details "$preview_id"
        else
            print_warning "No preview deployment found"
        fi
    fi

    # Show project info
    echo ""
    print_subheader "Project Information"
    echo "Project ID: ${PROJECT_ID:-unknown}"
    echo "Organization ID: ${ORG_ID:-none}"
    echo "Git Branch: $(get_git_branch)"
}

# Show deployment details
show_deployment_details() {
    local deployment_id="$1"

    if [ -z "$TOKEN" ]; then
        print_warning "Deployment details require VERCEL_TOKEN"
        return
    fi

    local response=$(curl -s -H "Authorization: Bearer $TOKEN" \
        "$VERCEL_API/v13/deployments/$deployment_id")

    if [ "$(echo "$response" | jq -r '.error' 2>/dev/null)" = "null" ]; then
        echo "$response" | jq -r '
            "ID: \(.uid)
URL: \(.url)
State: \(.readyState)
Environment: \(.target)
Created: \(.createdAt | todate)
Build Duration: \(.buildingAt // 0 | tonumber / 1000)s
Functions: \(.functions | length)
Routes: \(.routes | length)"
        '

        # Check for errors
        local error_count=$(echo "$response" | jq '.errorCount // 0')
        if [ "$error_count" -gt 0 ]; then
            print_warning "$WARNING_SIGN Deployment has $error_count error(s)"
        fi
    else
        print_error "Failed to get deployment details"
    fi
}

# View logs
cmd_logs() {
    local log_type="${1:-runtime}"
    shift

    print_header "Vercel Logs - $log_type"

    setup_vercel

    local deployment_id=$(get_latest_deployment)
    if [ -z "$deployment_id" ] || [ "$deployment_id" = "null" ]; then
        die "No deployment found"
    fi

    print_info "Deployment: $deployment_id"

    # Parse options
    local follow=false
    local limit=$DEFAULT_LOG_LINES

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -f|--follow)
                follow=true
                shift
                ;;
            --limit)
                limit="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done

    case "$log_type" in
        runtime|function)
            fetch_runtime_logs "$deployment_id" "$follow" "$limit"
            ;;
        build)
            fetch_build_logs "$deployment_id" "$limit"
            ;;
        error)
            fetch_error_logs "$deployment_id" "$limit"
            ;;
        static)
            fetch_static_logs "$deployment_id" "$limit"
            ;;
        edge)
            fetch_edge_logs "$deployment_id" "$follow" "$limit"
            ;;
        all)
            print_subheader "Build Logs"
            fetch_build_logs "$deployment_id" 50
            echo ""
            print_subheader "Runtime Logs"
            fetch_runtime_logs "$deployment_id" false 50
            echo ""
            print_subheader "Error Logs"
            fetch_error_logs "$deployment_id" 50
            ;;
        *)
            print_error "Unknown log type: $log_type"
            echo "Valid types: runtime, build, error, static, edge, all"
            exit 1
            ;;
    esac
}

# Fetch runtime logs
fetch_runtime_logs() {
    local deployment_id="$1"
    local follow="$2"
    local limit="$3"

    if [ -z "$TOKEN" ]; then
        # Use Vercel CLI
        if [ "$follow" = "true" ]; then
            vercel logs --follow
        else
            vercel logs --limit "$limit"
        fi
    else
        # Use API
        local query="deploymentId=$deployment_id&limit=$limit"
        [ -n "$ORG_ID" ] && [ "$ORG_ID" != "null" ] && query="$query&teamId=$ORG_ID"

        if [ "$follow" = "true" ]; then
            print_info "Following logs (Ctrl+C to stop)..."
            while true; do
                curl -s -H "Authorization: Bearer $TOKEN" \
                    "$VERCEL_API/v2/projects/$PROJECT_ID/logs?$query&follow=1" | \
                    jq -r '.logs[] | "\(.timestamp | todate) [\(.level)] \(.message)"'
                sleep 2
            done
        else
            curl -s -H "Authorization: Bearer $TOKEN" \
                "$VERCEL_API/v2/projects/$PROJECT_ID/logs?$query" | \
                jq -r '.logs[] | "\(.timestamp | todate) [\(.level)] \(.message)"' || \
                print_error "Failed to fetch runtime logs"
        fi
    fi
}

# Fetch build logs
fetch_build_logs() {
    local deployment_id="$1"
    local limit="$2"

    if [ -z "$TOKEN" ]; then
        print_warning "Build logs require VERCEL_TOKEN"
        echo "Using Vercel CLI as fallback..."
        vercel inspect "$deployment_id" --logs
    else
        local response=$(curl -s -H "Authorization: Bearer $TOKEN" \
            "$VERCEL_API/v6/deployments/$deployment_id/events?limit=$limit&builds=1")

        echo "$response" | jq -r '
            .events[] |
            select(.type == "build-log") |
            "\(.created | todate) \(.payload.text)"
        ' 2>/dev/null || print_error "Failed to fetch build logs"
    fi
}

# Fetch error logs
fetch_error_logs() {
    local deployment_id="$1"
    local limit="$2"

    if [ -z "$TOKEN" ]; then
        print_warning "Error logs require VERCEL_TOKEN"
        return
    fi

    local query="deploymentId=$deployment_id&limit=$limit&level=error,warning"
    [ -n "$ORG_ID" ] && [ "$ORG_ID" != "null" ] && query="$query&teamId=$ORG_ID"

    curl -s -H "Authorization: Bearer $TOKEN" \
        "$VERCEL_API/v2/projects/$PROJECT_ID/logs?$query" | \
        jq -r '.logs[] | "\(.timestamp | todate) [\(.level)] \(.message)"' || \
        print_error "Failed to fetch error logs"
}

# Fetch static logs
fetch_static_logs() {
    local deployment_id="$1"
    local limit="$2"

    if [ -z "$TOKEN" ]; then
        print_warning "Static logs require VERCEL_TOKEN"
        return
    fi

    local query="deploymentId=$deployment_id&limit=$limit&type=static"
    [ -n "$ORG_ID" ] && [ "$ORG_ID" != "null" ] && query="$query&teamId=$ORG_ID"

    curl -s -H "Authorization: Bearer $TOKEN" \
        "$VERCEL_API/v2/projects/$PROJECT_ID/logs?$query" | \
        jq -r '.logs[] | "\(.timestamp | todate) \(.path) \(.statusCode)"' || \
        print_error "Failed to fetch static logs"
}

# Fetch edge logs
fetch_edge_logs() {
    local deployment_id="$1"
    local follow="$2"
    local limit="$3"

    if [ -z "$TOKEN" ]; then
        print_warning "Edge logs require VERCEL_TOKEN"
        return
    fi

    local query="deploymentId=$deployment_id&limit=$limit&type=edge"
    [ -n "$ORG_ID" ] && [ "$ORG_ID" != "null" ] && query="$query&teamId=$ORG_ID"

    if [ "$follow" = "true" ]; then
        print_info "Following edge logs (Ctrl+C to stop)..."
        while true; do
            curl -s -H "Authorization: Bearer $TOKEN" \
                "$VERCEL_API/v2/projects/$PROJECT_ID/logs?$query&follow=1" | \
                jq -r '.logs[] | "\(.timestamp | todate) [\(.edge.region)] \(.message)"'
            sleep 2
        done
    else
        curl -s -H "Authorization: Bearer $TOKEN" \
            "$VERCEL_API/v2/projects/$PROJECT_ID/logs?$query" | \
            jq -r '.logs[] | "\(.timestamp | todate) [\(.edge.region)] \(.message)"' || \
            print_error "Failed to fetch edge logs"
    fi
}

# List deployments
cmd_deployments() {
    print_header "Recent Deployments"

    setup_vercel

    local limit="${1:-$DEFAULT_DEPLOYMENT_LIMIT}"
    local target=""

    # Parse options
    for arg in "${REMAINING_ARGS[@]}"; do
        case "$arg" in
            --prod|--production)
                target="production"
                ;;
            --preview)
                target="preview"
                ;;
            --limit)
                # Already handled
                ;;
            [0-9]*)
                limit="$arg"
                ;;
        esac
    done

    if [ -z "$TOKEN" ]; then
        # Use Vercel CLI
        vercel list --json | jq -r --arg limit "$limit" '
            .[:($limit | tonumber)] |
            .[] |
            "[\(.state)] \(.name) - \(.url) (Created: \(.created))"
        '
    else
        # Use API
        local query="projectId=$PROJECT_ID&limit=$limit"
        [ -n "$ORG_ID" ] && [ "$ORG_ID" != "null" ] && query="$query&teamId=$ORG_ID"
        [ -n "$target" ] && query="$query&target=$target"

        local response=$(curl -s -H "Authorization: Bearer $TOKEN" \
            "$VERCEL_API/v6/deployments?$query")

        echo "$response" | jq -r '
            .deployments[] |
            "[\(.readyState)] \(.name)
  URL: \(.url)
  Target: \(.target)
  Created: \(.createdAt | todate)
  Duration: \((.buildingAt // 0) / 1000)s
  ID: \(.uid)
"
        ' || print_error "Failed to list deployments"
    fi
}

# Check API status
cmd_api_status() {
    print_header "Vercel API Status Check"

    setup_vercel

    print_status "Checking Vercel API connectivity..."

    # Check basic connectivity
    print_info "Testing API endpoint: $VERCEL_API"
    if ! curl -s -o /dev/null -w "%{http_code}" "$VERCEL_API" | grep -q "^[23]"; then
        print_error "Cannot reach Vercel API"
        exit 1
    fi
    print_success "$CHECK_MARK API endpoint reachable"

    # Check authentication
    if [ -n "$TOKEN" ]; then
        print_info "Testing authentication..."
        local user_response=$(curl -s -H "Authorization: Bearer $TOKEN" "$VERCEL_API/v2/user")

        if echo "$user_response" | jq -e '.user' > /dev/null 2>&1; then
            local username=$(echo "$user_response" | jq -r '.user.username')
            print_success "$CHECK_MARK Authenticated as: $username"
        else
            print_error "Authentication failed"
            print_debug "Response: $user_response"
        fi
    else
        print_warning "No authentication token available"
    fi

    # Check project access
    if [ -n "$PROJECT_ID" ] && [ -n "$TOKEN" ]; then
        print_info "Testing project access..."
        local project_query=""
        [ -n "$ORG_ID" ] && [ "$ORG_ID" != "null" ] && project_query="?teamId=$ORG_ID"

        local project_response=$(curl -s -H "Authorization: Bearer $TOKEN" \
            "$VERCEL_API/v9/projects/$PROJECT_ID$project_query")

        if echo "$project_response" | jq -e '.name' > /dev/null 2>&1; then
            local project_name=$(echo "$project_response" | jq -r '.name')
            print_success "$CHECK_MARK Project accessible: $project_name"

            # Show project framework
            local framework=$(echo "$project_response" | jq -r '.framework // "none"')
            print_info "Framework: $framework"
        else
            print_error "Cannot access project"
            print_debug "Response: $project_response"
        fi
    fi

    # Check Vercel platform status
    print_subheader "Platform Status"
    print_info "Checking Vercel platform status..."

    local status_response=$(curl -s "https://www.vercel-status.com/api/v2/status.json")
    if echo "$status_response" | jq -e '.status' > /dev/null 2>&1; then
        local platform_status=$(echo "$status_response" | jq -r '.status.description')
        local indicator=$(echo "$status_response" | jq -r '.status.indicator')

        case "$indicator" in
            none)
                print_success "$CHECK_MARK Platform Status: $platform_status"
                ;;
            minor)
                print_warning "$WARNING_SIGN Platform Status: $platform_status (minor issues)"
                ;;
            major)
                print_error "$CROSS_MARK Platform Status: $platform_status (major issues)"
                ;;
            critical)
                print_error "$CROSS_MARK Platform Status: $platform_status (CRITICAL)"
                ;;
            *)
                print_info "Platform Status: $platform_status"
                ;;
        esac
    fi

    print_success "$ROCKET API status check complete!"
}

# Inspect deployment
cmd_inspect() {
    local deployment_id="${1:-$(get_latest_deployment)}"

    if [ -z "$deployment_id" ] || [ "$deployment_id" = "null" ]; then
        die "No deployment ID provided and no recent deployment found"
    fi

    print_header "Deployment Inspection: $deployment_id"

    setup_vercel

    if command_exists vercel; then
        # Use Vercel CLI for detailed inspection
        vercel inspect "$deployment_id"
    else
        # Fallback to API
        if [ -z "$TOKEN" ]; then
            die "Vercel CLI not found and no API token available"
        fi

        show_deployment_details "$deployment_id"
    fi
}

# Promote deployment
cmd_promote() {
    local deployment_id="${1:-}"

    if [ -z "$deployment_id" ]; then
        die "Deployment ID required for promotion"
    fi

    print_header "Promote Deployment"

    setup_vercel

    if ! confirm "Promote deployment $deployment_id to production?" "n"; then
        print_info "Promotion cancelled"
        exit 0
    fi

    if command_exists vercel; then
        vercel promote "$deployment_id" --yes
    else
        die "Vercel CLI required for deployment promotion"
    fi
}

# Rollback deployment
cmd_rollback() {
    print_header "Rollback Deployment"

    setup_vercel

    print_info "Fetching previous production deployment..."

    if [ -z "$TOKEN" ]; then
        die "Rollback requires VERCEL_TOKEN"
    fi

    # Get last 2 production deployments
    local query="projectId=$PROJECT_ID&limit=2&target=production"
    [ -n "$ORG_ID" ] && [ "$ORG_ID" != "null" ] && query="$query&teamId=$ORG_ID"

    local deployments=$(curl -s -H "Authorization: Bearer $TOKEN" \
        "$VERCEL_API/v6/deployments?$query" | \
        jq -r '.deployments[1].uid' 2>/dev/null)

    if [ -z "$deployments" ] || [ "$deployments" = "null" ]; then
        die "No previous production deployment found"
    fi

    print_info "Previous deployment: $deployments"

    if confirm "Rollback to deployment $deployments?" "n"; then
        cmd_promote "$deployments"
    else
        print_info "Rollback cancelled"
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

    # Show help if requested
    if [ "$SHOW_HELP" = "true" ] || [ -z "$command" ]; then
        show_usage
        exit 0
    fi

    # Check for Vercel CLI
    if ! command_exists vercel; then
        print_warning "Vercel CLI not installed. Some features will be limited."
        print_info "Install with: npm i -g vercel"
    fi

    # Execute command
    case "$command" in
        status|stat)
            cmd_status
            ;;
        logs|log)
            cmd_logs "${REMAINING_ARGS[@]}"
            ;;
        deployments|deploys|list)
            cmd_deployments "${REMAINING_ARGS[@]}"
            ;;
        api-status|api)
            cmd_api_status
            ;;
        inspect|info)
            cmd_inspect "${REMAINING_ARGS[0]}"
            ;;
        promote|prod)
            cmd_promote "${REMAINING_ARGS[0]}"
            ;;
        rollback|roll)
            cmd_rollback
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
