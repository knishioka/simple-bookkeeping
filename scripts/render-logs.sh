#!/bin/bash

# Render logs retrieval script
# Supports build logs, runtime logs, and error filtering

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get configuration
if [ -f ".render/services.json" ]; then
    SERVICE_ID=$(cat .render/services.json | jq -r '.services.api.id')
    SERVICE_NAME=$(cat .render/services.json | jq -r '.services.api.name')
else
    echo -e "${RED}Error: .render/services.json not found${NC}"
    exit 1
fi

# Check if render CLI is available
if ! command -v render &> /dev/null; then
    echo -e "${RED}Error: Render CLI not found${NC}"
    echo "Please install: https://render.com/docs/cli"
    exit 1
fi

# Main command handling
case "$1" in
    "runtime"|"run")
        echo -e "${GREEN}Runtime Logs for ${SERVICE_NAME}${NC}"
        echo "================================================"
        
        LIMIT=${2:-100}
        echo -e "${YELLOW}Fetching last $LIMIT log entries...${NC}\n"
        
        render logs "$SERVICE_ID" --limit "$LIMIT" -o json 2>/dev/null | \
        jq -r '.[] | "\(.timestamp) [\(.level | ascii_upcase)] \(.service.instance // "main") - \(.message)"' | \
        while IFS= read -r line; do
            if [[ "$line" == *"[ERROR]"* ]]; then
                echo -e "${RED}$line${NC}"
            elif [[ "$line" == *"[WARNING]"* ]] || [[ "$line" == *"[WARN]"* ]]; then
                echo -e "${YELLOW}$line${NC}"
            else
                echo "$line"
            fi
        done
        ;;
        
    "build")
        echo -e "${GREEN}Build Logs for ${SERVICE_NAME}${NC}"
        echo "================================================"
        
        # Get latest deployment
        LATEST_DEPLOY=$(render deploys list "$SERVICE_ID" -o json 2>/dev/null | jq -r '.[0]')
        DEPLOY_ID=$(echo "$LATEST_DEPLOY" | jq -r '.id')
        DEPLOY_STATUS=$(echo "$LATEST_DEPLOY" | jq -r '.status')
        DEPLOY_TIME=$(echo "$LATEST_DEPLOY" | jq -r '.createdAt')
        
        echo -e "${YELLOW}Latest deployment:${NC}"
        echo "  ID: $DEPLOY_ID"
        echo "  Status: $DEPLOY_STATUS"
        echo "  Created: $DEPLOY_TIME"
        echo ""
        
        if [ -n "$RENDER_API_KEY" ]; then
            echo -e "${BLUE}Fetching build logs via API...${NC}\n"
            curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
                "https://api.render.com/v1/deploys/$DEPLOY_ID/logs" | \
            jq -r '.logs[]?.message // empty' 2>/dev/null || \
            echo -e "${RED}Failed to fetch build logs. Check your RENDER_API_KEY${NC}"
        else
            echo -e "${YELLOW}Note: Set RENDER_API_KEY to fetch detailed build logs${NC}"
            echo "Get your API key from: https://dashboard.render.com/u/settings"
        fi
        ;;
        
    "errors"|"error")
        echo -e "${GREEN}Error Logs for ${SERVICE_NAME}${NC}"
        echo "================================================"
        
        HOURS=${2:-24}
        echo -e "${YELLOW}Fetching errors from last $HOURS hours...${NC}\n"
        
        render logs "$SERVICE_ID" --level error,warning --limit 500 -o json 2>/dev/null | \
        jq -r '.[] | "\(.timestamp) [\(.level | ascii_upcase)] \(.message)"' | \
        while IFS= read -r line; do
            if [[ "$line" == *"[ERROR]"* ]]; then
                echo -e "${RED}$line${NC}"
            else
                echo -e "${YELLOW}$line${NC}"
            fi
        done
        ;;
        
    "stream"|"tail")
        echo -e "${GREEN}Streaming Logs for ${SERVICE_NAME}${NC}"
        echo "================================================"
        echo -e "${YELLOW}Press Ctrl+C to stop streaming${NC}\n"
        
        render logs "$SERVICE_ID" --tail
        ;;
        
    "search")
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Please provide a search term${NC}"
            echo "Usage: $0 search <term>"
            exit 1
        fi
        
        SEARCH_TERM="$2"
        echo -e "${GREEN}Searching for '$SEARCH_TERM' in ${SERVICE_NAME} logs${NC}"
        echo "================================================"
        
        render logs "$SERVICE_ID" --limit 1000 -o json 2>/dev/null | \
        jq -r --arg term "$SEARCH_TERM" \
        '.[] | select(.message | test($term; "i")) | "\(.timestamp) [\(.level)] \(.message)"' | \
        while IFS= read -r line; do
            # Highlight search term
            highlighted=$(echo "$line" | sed -E "s/($SEARCH_TERM)/${YELLOW}\1${NC}/gi")
            echo -e "$highlighted"
        done
        ;;
        
    "stats")
        echo -e "${GREEN}Log Statistics for ${SERVICE_NAME}${NC}"
        echo "================================================"
        
        LOGS=$(render logs "$SERVICE_ID" --limit 1000 -o json 2>/dev/null)
        
        TOTAL=$(echo "$LOGS" | jq '. | length')
        ERRORS=$(echo "$LOGS" | jq '[.[] | select(.level == "error")] | length')
        WARNINGS=$(echo "$LOGS" | jq '[.[] | select(.level == "warning")] | length')
        INFO=$(echo "$LOGS" | jq '[.[] | select(.level == "info")] | length')
        
        echo "Total logs analyzed: $TOTAL"
        echo -e "${RED}Errors: $ERRORS${NC}"
        echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
        echo -e "${GREEN}Info: $INFO${NC}"
        
        if [ "$ERRORS" -gt 0 ]; then
            echo -e "\n${YELLOW}Most recent errors:${NC}"
            echo "$LOGS" | jq -r '.[] | select(.level == "error") | "\(.timestamp) - \(.message)"' | head -5
        fi
        ;;
        
    *)
        echo -e "${BLUE}Render Logs Viewer${NC}"
        echo "=================="
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  runtime [limit]     Show runtime logs (default: 100)"
        echo "  build               Show build logs for latest deployment"
        echo "  errors [hours]      Show errors and warnings (default: 24h)"
        echo "  stream              Stream logs in real-time"
        echo "  search <term>       Search logs for specific term"
        echo "  stats               Show log statistics"
        echo ""
        echo "Aliases:"
        echo "  run    = runtime"
        echo "  tail   = stream"
        echo "  error  = errors"
        echo ""
        echo "Examples:"
        echo "  $0 runtime 200          # Show last 200 runtime logs"
        echo "  $0 errors 48            # Show errors from last 48 hours"
        echo "  $0 search \"timeout\"     # Search for timeout errors"
        echo "  $0 stream               # Live tail logs"
        echo ""
        echo "Environment Variables:"
        echo "  RENDER_API_KEY         API key for fetching build logs"
        ;;
esac