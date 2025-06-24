#!/bin/bash

# Render API environment variables management script

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check requirements
if [ ! -f ".render/services.json" ]; then
    echo -e "${RED}Error: .render/services.json not found${NC}"
    exit 1
fi

if [ -z "$RENDER_API_KEY" ]; then
    echo -e "${RED}Error: RENDER_API_KEY environment variable not set${NC}"
    echo "Get your API key from: https://dashboard.render.com/u/settings"
    exit 1
fi

SERVICE_ID=$(cat .render/services.json | jq -r '.services.api.id')

# Function to call Render API
render_api() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -n "$data" ]; then
        curl -s -X "$method" \
             -H "Authorization: Bearer $RENDER_API_KEY" \
             -H "Accept: application/json" \
             -H "Content-Type: application/json" \
             -d "$data" \
             "https://api.render.com/v1/${endpoint}"
    else
        curl -s -X "$method" \
             -H "Authorization: Bearer $RENDER_API_KEY" \
             -H "Accept: application/json" \
             "https://api.render.com/v1/${endpoint}"
    fi
}

# Main command handling
case "$1" in
    "list")
        echo -e "${GREEN}Environment Variables for $SERVICE_ID:${NC}"
        echo "================================================"
        
        ENV_VARS=$(render_api GET "services/$SERVICE_ID/env-vars")
        if [ $? -ne 0 ] || [ -z "$ENV_VARS" ]; then
            echo -e "${RED}Error: Failed to fetch environment variables${NC}"
            exit 1
        fi
        
        echo "$ENV_VARS" | jq -r '.[] | "  \(.key)"' | sort
        
        TOTAL=$(echo "$ENV_VARS" | jq -r '. | length')
        echo -e "\n${YELLOW}Total: $TOTAL variables${NC}"
        ;;
        
    "get")
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Please specify a variable name${NC}"
            echo "Usage: $0 get VARIABLE_NAME"
            exit 1
        fi
        
        VAR_NAME=$2
        echo -e "${GREEN}Getting $VAR_NAME:${NC}"
        
        ENV_VAR=$(render_api GET "services/$SERVICE_ID/env-vars/$VAR_NAME")
        if [ $? -ne 0 ] || [ -z "$ENV_VAR" ]; then
            echo -e "${RED}Error: Variable not found or API error${NC}"
            exit 1
        fi
        
        echo "$ENV_VAR" | jq -r '"Key: \(.key)\nValue: [REDACTED]\nGenerated: \(.generateValue // false)"'
        ;;
        
    "set")
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo -e "${RED}Error: Please specify variable name and value${NC}"
            echo "Usage: $0 set VARIABLE_NAME VALUE"
            exit 1
        fi
        
        VAR_NAME=$2
        VAR_VALUE=$3
        
        echo -e "${GREEN}Setting $VAR_NAME...${NC}"
        
        # Create JSON payload
        DATA=$(jq -n --arg key "$VAR_NAME" --arg value "$VAR_VALUE" \
            '[{key: $key, value: $value}]')
        
        RESULT=$(render_api PUT "services/$SERVICE_ID/env-vars" "$DATA")
        if [ $? -ne 0 ]; then
            echo -e "${RED}Error: Failed to set environment variable${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✓ Environment variable set successfully${NC}"
        echo -e "${YELLOW}Note: You need to trigger a new deployment for changes to take effect${NC}"
        ;;
        
    "delete")
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Please specify a variable name${NC}"
            echo "Usage: $0 delete VARIABLE_NAME"
            exit 1
        fi
        
        VAR_NAME=$2
        echo -e "${YELLOW}Deleting $VAR_NAME...${NC}"
        
        # Get current vars, filter out the one to delete
        ENV_VARS=$(render_api GET "services/$SERVICE_ID/env-vars")
        NEW_VARS=$(echo "$ENV_VARS" | jq --arg key "$VAR_NAME" \
            'map(select(.key != $key))')
        
        RESULT=$(render_api PUT "services/$SERVICE_ID/env-vars" "$NEW_VARS")
        if [ $? -ne 0 ]; then
            echo -e "${RED}Error: Failed to delete environment variable${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✓ Environment variable deleted successfully${NC}"
        echo -e "${YELLOW}Note: You need to trigger a new deployment for changes to take effect${NC}"
        ;;
        
    *)
        echo -e "${BLUE}Render API Environment Variables Manager${NC}"
        echo "========================================"
        echo ""
        echo "Usage: $0 <command> [args]"
        echo ""
        echo "Commands:"
        echo "  list                    List all environment variables"
        echo "  get <name>             Get a specific variable (value is redacted)"
        echo "  set <name> <value>     Set or update a variable"
        echo "  delete <name>          Delete a variable"
        echo ""
        echo "Example:"
        echo "  $0 list"
        echo "  $0 set DATABASE_URL postgresql://..."
        echo "  $0 delete OLD_VAR"
        ;;
esac