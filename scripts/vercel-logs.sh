#!/bin/bash

# ============================================================================
# vercel-logs.sh - Vercel Log Retrieval Tool
# ============================================================================
# Purpose: Fetches and displays Vercel logs including runtime, build, error logs,
#          function invocations, streaming, and deployment statistics
# Usage: pnpm vercel:logs <command> [options] (e.g., runtime, build, errors)
# Requirements: Vercel CLI, optional VERCEL_TOKEN for enhanced features
# ============================================================================

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get Vercel token
if [ -n "$VERCEL_TOKEN" ]; then
    TOKEN="$VERCEL_TOKEN"
else
    # Try to get token from vercel CLI auth
    TOKEN=$(cat ~/Library/Application\ Support/com.vercel.cli/auth.json 2>/dev/null | jq -r '.token' 2>/dev/null || echo "")
fi

# Get project info
if [ -f ".vercel/project.json" ]; then
    PROJECT_ID=$(cat .vercel/project.json | jq -r '.projectId')
    TEAM_ID=$(cat .vercel/project.json | jq -r '.orgId')
else
    echo -e "${RED}Error: Not a Vercel project${NC}"
    echo "Please run 'vercel link' to link this project"
    exit 1
fi

# Check if vercel CLI is available
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}Error: Vercel CLI not found${NC}"
    echo "Please install: npm i -g vercel"
    exit 1
fi

# Function to get latest deployment
get_latest_deployment() {
    if [ -n "$TOKEN" ]; then
        QUERY_PARAMS="projectId=$PROJECT_ID&limit=1"
        if [ -n "$TEAM_ID" ] && [ "$TEAM_ID" != "null" ]; then
            QUERY_PARAMS="${QUERY_PARAMS}&teamId=$TEAM_ID"
        fi
        
        curl -s -H "Authorization: Bearer $TOKEN" \
            "https://api.vercel.com/v6/deployments?$QUERY_PARAMS" | \
        jq -r '.deployments[0]'
    else
        vercel list --json 2>/dev/null | jq -r '.[0]'
    fi
}

# Main command handling
case "$1" in
    "runtime"|"run")
        echo -e "${GREEN}Runtime Logs (Function Logs)${NC}"
        echo "================================================"
        
        DEPLOYMENT=$(get_latest_deployment)
        URL=$(echo "$DEPLOYMENT" | jq -r '.url // .name')
        
        if [ -z "$URL" ] || [ "$URL" = "null" ]; then
            echo -e "${RED}Error: Could not find deployment URL${NC}"
            exit 1
        fi
        
        echo -e "${YELLOW}Deployment: https://$URL${NC}"
        echo -e "${YELLOW}Note: Runtime logs are only available for the last hour${NC}\n"
        
        # Stream runtime logs
        vercel logs "https://$URL" --follow=false --output=json 2>/dev/null | \
        jq -r 'select(.type == "stdout" or .type == "stderr") | 
            "\(.timestamp | strftime("%Y-%m-%d %H:%M:%S")) [\(.type | ascii_upcase)] \(.payload.text // .message // .payload)"' | \
        while IFS= read -r line; do
            if [[ "$line" == *"[STDERR]"* ]] || [[ "$line" == *"error"* ]]; then
                echo -e "${RED}$line${NC}"
            elif [[ "$line" == *"warn"* ]]; then
                echo -e "${YELLOW}$line${NC}"
            else
                echo "$line"
            fi
        done
        ;;
        
    "build")
        echo -e "${GREEN}Build Logs${NC}"
        echo "================================================"
        
        if [ -z "$TOKEN" ]; then
            echo -e "${RED}Error: VERCEL_TOKEN required for build logs${NC}"
            echo "Set token or use: vercel logs <deployment-url>"
            exit 1
        fi
        
        DEPLOYMENT=$(get_latest_deployment)
        DEPLOY_ID=$(echo "$DEPLOYMENT" | jq -r '.uid')
        DEPLOY_URL=$(echo "$DEPLOYMENT" | jq -r '.url')
        DEPLOY_STATE=$(echo "$DEPLOYMENT" | jq -r '.state')
        DEPLOY_CREATED=$(echo "$DEPLOYMENT" | jq -r '.created')
        
        echo -e "${YELLOW}Deployment Info:${NC}"
        echo "  ID: $DEPLOY_ID"
        echo "  URL: https://$DEPLOY_URL"
        echo "  State: $DEPLOY_STATE"
        echo "  Created: $(date -r $((DEPLOY_CREATED/1000)) 2>/dev/null || echo $DEPLOY_CREATED)"
        echo ""
        
        echo -e "${BLUE}Fetching build events...${NC}\n"
        
        curl -s -H "Authorization: Bearer $TOKEN" \
            "https://api.vercel.com/v3/deployments/$DEPLOY_ID/events" | \
        jq -r '.[] | select(.type == "stdout" or .type == "stderr" or .type == "command") | 
            "\(.created | . / 1000 | strftime("%H:%M:%S")) [\(.type | ascii_upcase)] \(.payload.text // .text // .payload)"' | \
        while IFS= read -r line; do
            if [[ "$line" == *"[STDERR]"* ]] || [[ "$line" == *"error"* ]] || [[ "$line" == *"Error"* ]]; then
                echo -e "${RED}$line${NC}"
            elif [[ "$line" == *"[COMMAND]"* ]]; then
                echo -e "${BLUE}$line${NC}"
            elif [[ "$line" == *"warn"* ]] || [[ "$line" == *"Warning"* ]]; then
                echo -e "${YELLOW}$line${NC}"
            else
                echo "$line"
            fi
        done
        ;;
        
    "errors"|"error")
        echo -e "${GREEN}Error Logs${NC}"
        echo "================================================"
        
        DEPLOYMENT=$(get_latest_deployment)
        URL=$(echo "$DEPLOYMENT" | jq -r '.url // .name')
        
        echo -e "${YELLOW}Searching for errors in recent logs...${NC}\n"
        
        # Get logs and filter for errors
        vercel logs "https://$URL" --output=json 2>/dev/null | \
        jq -r 'select(
            (.type == "stderr") or 
            (.payload.text // .message // .payload | test("error|Error|ERROR|fail|Failed|FAILED"; "i"))
        ) | "\(.timestamp | strftime("%Y-%m-%d %H:%M:%S")) [\(.type // "LOG")] \(.payload.text // .message // .payload)"' | \
        while IFS= read -r line; do
            echo -e "${RED}$line${NC}"
        done
        ;;
        
    "stream"|"tail")
        echo -e "${GREEN}Streaming Runtime Logs${NC}"
        echo "================================================"
        
        DEPLOYMENT=$(get_latest_deployment)
        URL=$(echo "$DEPLOYMENT" | jq -r '.url // .name')
        
        echo -e "${YELLOW}Streaming logs for: https://$URL${NC}"
        echo -e "${YELLOW}Press Ctrl+C to stop${NC}\n"
        
        vercel logs "https://$URL"
        ;;
        
    "functions"|"fn")
        echo -e "${GREEN}Function Execution Logs${NC}"
        echo "================================================"
        
        DEPLOYMENT=$(get_latest_deployment)
        URL=$(echo "$DEPLOYMENT" | jq -r '.url // .name')
        
        echo -e "${YELLOW}Function invocations for: https://$URL${NC}\n"
        
        vercel logs "https://$URL" --output=json 2>/dev/null | \
        jq -r 'select(.proxy) | 
            "\(.timestamp | strftime("%Y-%m-%d %H:%M:%S")) \(.proxy.method) \(.proxy.path) - \(.proxy.statusCode) (\(.proxy.duration)ms)"' | \
        while IFS= read -r line; do
            if [[ "$line" == *" 5"* ]]; then  # 5xx errors
                echo -e "${RED}$line${NC}"
            elif [[ "$line" == *" 4"* ]]; then  # 4xx errors
                echo -e "${YELLOW}$line${NC}"
            else
                echo -e "${GREEN}$line${NC}"
            fi
        done
        ;;
        
    "stats")
        echo -e "${GREEN}Deployment Statistics${NC}"
        echo "================================================"
        
        if [ -z "$TOKEN" ]; then
            echo -e "${RED}Error: VERCEL_TOKEN required for statistics${NC}"
            exit 1
        fi
        
        # Get recent deployments
        QUERY_PARAMS="projectId=$PROJECT_ID&limit=20"
        if [ -n "$TEAM_ID" ] && [ "$TEAM_ID" != "null" ]; then
            QUERY_PARAMS="${QUERY_PARAMS}&teamId=$TEAM_ID"
        fi
        
        DEPLOYMENTS=$(curl -s -H "Authorization: Bearer $TOKEN" \
            "https://api.vercel.com/v6/deployments?$QUERY_PARAMS")
        
        TOTAL=$(echo "$DEPLOYMENTS" | jq '.deployments | length')
        READY=$(echo "$DEPLOYMENTS" | jq '[.deployments[] | select(.state == "READY")] | length')
        ERROR=$(echo "$DEPLOYMENTS" | jq '[.deployments[] | select(.state == "ERROR")] | length')
        BUILDING=$(echo "$DEPLOYMENTS" | jq '[.deployments[] | select(.state == "BUILDING" or .state == "INITIALIZING")] | length')
        
        echo "Recent deployments analyzed: $TOTAL"
        echo -e "${GREEN}Ready: $READY${NC}"
        echo -e "${RED}Error: $ERROR${NC}"
        echo -e "${YELLOW}Building: $BUILDING${NC}"
        
        # Average build time
        AVG_BUILD_TIME=$(echo "$DEPLOYMENTS" | jq -r '
            [.deployments[] | select(.state == "READY" and .duration) | .duration] | 
            if length > 0 then (add / length / 1000 | round) else 0 end')
        
        echo -e "\nAverage build time: ${AVG_BUILD_TIME}s"
        
        # Recent errors
        if [ "$ERROR" -gt 0 ]; then
            echo -e "\n${RED}Recent failed deployments:${NC}"
            echo "$DEPLOYMENTS" | jq -r '.deployments[] | 
                select(.state == "ERROR") | 
                "\(.created | . / 1000 | strftime("%Y-%m-%d %H:%M")) - \(.url // .name)"' | head -5
        fi
        ;;
        
    *)
        echo -e "${BLUE}Vercel Logs Viewer${NC}"
        echo "=================="
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  runtime             Show runtime logs (Functions)"
        echo "  build               Show build logs for latest deployment"
        echo "  errors              Show error logs only"
        echo "  stream              Stream runtime logs in real-time"
        echo "  functions           Show function invocation logs"
        echo "  stats               Show deployment statistics"
        echo ""
        echo "Aliases:"
        echo "  run    = runtime"
        echo "  tail   = stream"
        echo "  error  = errors"
        echo "  fn     = functions"
        echo ""
        echo "Examples:"
        echo "  $0 runtime              # Show recent runtime logs"
        echo "  $0 build                # Show build output"
        echo "  $0 errors               # Filter for errors only"
        echo "  $0 stream               # Live tail logs"
        echo ""
        echo "Notes:"
        echo "  - Runtime logs are only available for 1 hour"
        echo "  - Build logs are stored indefinitely"
        echo "  - Set VERCEL_TOKEN for API access to build logs"
        echo ""
        echo "Environment Variables:"
        echo "  VERCEL_TOKEN           API token for enhanced features"
        ;;
esac