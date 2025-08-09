#!/bin/bash

# Render API environment variable management script

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Usage function
usage() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  list                    List all environment variables"
    echo "  set <key> <value>       Set an environment variable"
    echo "  delete <key>            Delete an environment variable"
    echo "  fix-timeout             Set optimized DB connection settings for Render"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 set DB_POOL_SIZE 2"
    echo "  $0 delete OLD_VAR"
    echo "  $0 fix-timeout"
    exit 1
}

# Check if .render/services.json exists
if [ ! -f ".render/services.json" ]; then
    echo -e "${RED}Error: .render/services.json not found${NC}"
    echo "Please copy .render/services.json.example to .render/services.json and update with your service ID"
    exit 1
fi

# Get service ID
SERVICE_ID=$(cat .render/services.json | jq -r '.services.api.id')

if [ -z "$SERVICE_ID" ] || [ "$SERVICE_ID" = "null" ]; then
    echo -e "${RED}Error: Could not find service ID${NC}"
    exit 1
fi

# Get Render API key
if [ -z "$RENDER_API_KEY" ]; then
    echo -e "${RED}Error: RENDER_API_KEY environment variable not set${NC}"
    echo "Please set your Render API key:"
    echo "  export RENDER_API_KEY=your-api-key"
    echo "Get your API key from: https://dashboard.render.com/u/settings"
    exit 1
fi

# Function to call Render API
render_api() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$data" ]; then
        curl -s -X "$method" \
             -H "Authorization: Bearer $RENDER_API_KEY" \
             -H "Accept: application/json" \
             "https://api.render.com/v1/${endpoint}"
    else
        curl -s -X "$method" \
             -H "Authorization: Bearer $RENDER_API_KEY" \
             -H "Accept: application/json" \
             -H "Content-Type: application/json" \
             -d "$data" \
             "https://api.render.com/v1/${endpoint}"
    fi
}

# List environment variables
list_env_vars() {
    echo -e "${YELLOW}Fetching environment variables for service...${NC}"
    
    RESPONSE=$(render_api "GET" "services/$SERVICE_ID/env-vars")
    
    if [ $? -ne 0 ] || [ -z "$RESPONSE" ]; then
        echo -e "${RED}Error: Failed to fetch environment variables${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Environment Variables:${NC}"
    echo "$RESPONSE" | jq -r '.[] | "\(.envVar.key) = \(.envVar.value // "(generated)")"' | sort
}

# Set environment variable
set_env_var() {
    local key=$1
    local value=$2
    
    if [ -z "$key" ] || [ -z "$value" ]; then
        echo -e "${RED}Error: Both key and value are required${NC}"
        usage
    fi
    
    echo -e "${YELLOW}Setting environment variable: $key${NC}"
    
    # Create JSON payload
    local json_data=$(jq -n \
        --arg k "$key" \
        --arg v "$value" \
        '[{key: $k, value: $v}]')
    
    RESPONSE=$(render_api "PUT" "services/$SERVICE_ID/env-vars" "$json_data")
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Successfully set $key${NC}"
        echo -e "${YELLOW}Note: The service will be redeployed automatically${NC}"
    else
        echo -e "${RED}✗ Failed to set environment variable${NC}"
        echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
        exit 1
    fi
}

# Delete environment variable
delete_env_var() {
    local key=$1
    
    if [ -z "$key" ]; then
        echo -e "${RED}Error: Key is required${NC}"
        usage
    fi
    
    echo -e "${YELLOW}Deleting environment variable: $key${NC}"
    
    # First, get all env vars
    CURRENT_VARS=$(render_api "GET" "services/$SERVICE_ID/env-vars")
    
    # Filter out the variable to delete
    NEW_VARS=$(echo "$CURRENT_VARS" | jq --arg k "$key" '[.[] | select(.envVar.key != $k) | .envVar | {key: .key, value: .value}]')
    
    RESPONSE=$(render_api "PUT" "services/$SERVICE_ID/env-vars" "$NEW_VARS")
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Successfully deleted $key${NC}"
        echo -e "${YELLOW}Note: The service will be redeployed automatically${NC}"
    else
        echo -e "${RED}✗ Failed to delete environment variable${NC}"
        echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
        exit 1
    fi
}

# Fix timeout settings for Render
fix_timeout() {
    echo -e "${YELLOW}Setting optimized database connection settings for Render...${NC}"
    echo ""
    
    # Set multiple environment variables for optimal Render performance
    declare -A vars=(
        ["DB_POOL_SIZE"]="2"
        ["DB_CONNECT_TIMEOUT"]="10"
        ["DB_POOL_TIMEOUT"]="5"
        ["NODE_OPTIONS"]="--max-old-space-size=512"
    )
    
    # Get current vars
    CURRENT_VARS=$(render_api "GET" "services/$SERVICE_ID/env-vars")
    
    # Build new vars array
    NEW_VARS="["
    FIRST=true
    
    # Keep existing vars that we're not updating
    while IFS= read -r line; do
        KEY=$(echo "$line" | jq -r '.envVar.key')
        VALUE=$(echo "$line" | jq -r '.envVar.value // empty')
        
        # Skip if this is one we're updating or if it's generated
        if [[ ! " ${!vars[@]} " =~ " ${KEY} " ]] && [ -n "$VALUE" ]; then
            if [ "$FIRST" = false ]; then
                NEW_VARS+=","
            fi
            NEW_VARS+="{\"key\":\"$KEY\",\"value\":\"$VALUE\"}"
            FIRST=false
        fi
    done < <(echo "$CURRENT_VARS" | jq -c '.[]')
    
    # Add our optimized vars
    for key in "${!vars[@]}"; do
        if [ "$FIRST" = false ]; then
            NEW_VARS+=","
        fi
        NEW_VARS+="{\"key\":\"$key\",\"value\":\"${vars[$key]}\"}"
        FIRST=false
        echo "  Setting $key = ${vars[$key]}"
    done
    
    NEW_VARS+="]"
    
    echo ""
    echo -e "${YELLOW}Applying settings...${NC}"
    
    RESPONSE=$(render_api "PUT" "services/$SERVICE_ID/env-vars" "$NEW_VARS")
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Successfully applied optimized settings${NC}"
        echo ""
        echo "Settings applied:"
        for key in "${!vars[@]}"; do
            echo "  - $key = ${vars[$key]}"
        done
        echo ""
        echo -e "${YELLOW}The service will be redeployed automatically with these settings.${NC}"
        echo -e "${YELLOW}This should resolve the deployment timeout issues.${NC}"
    else
        echo -e "${RED}✗ Failed to apply settings${NC}"
        echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
        exit 1
    fi
}

# Main script logic
if [ $# -eq 0 ]; then
    usage
fi

COMMAND=$1

case $COMMAND in
    list)
        list_env_vars
        ;;
    set)
        set_env_var "$2" "$3"
        ;;
    delete)
        delete_env_var "$2"
        ;;
    fix-timeout)
        fix_timeout
        ;;
    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        usage
        ;;
esac