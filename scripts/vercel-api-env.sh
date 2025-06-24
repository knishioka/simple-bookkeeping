#!/bin/bash

# Vercel API environment variables management script

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
    # Try to get token from vercel CLI auth (macOS location)
    TOKEN=$(cat ~/Library/Application\ Support/com.vercel.cli/auth.json 2>/dev/null | jq -r '.token' 2>/dev/null || echo "")
fi

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Error: Vercel token not found${NC}"
    echo "Please set VERCEL_TOKEN or login with 'vercel login'"
    exit 1
fi

# Get project info
if [ ! -f ".vercel/project.json" ]; then
    echo -e "${RED}Error: Not a Vercel project${NC}"
    echo "Please run 'vercel link' to link this project"
    exit 1
fi

PROJECT_ID=$(cat .vercel/project.json | jq -r '.projectId')
TEAM_ID=$(cat .vercel/project.json | jq -r '.orgId')

# Function to call Vercel API
vercel_api() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    local url="https://api.vercel.com${endpoint}"
    
    if [ -n "$TEAM_ID" ] && [ "$TEAM_ID" != "null" ]; then
        # Add teamId to URL if it exists
        if [[ "$url" == *"?"* ]]; then
            url="${url}&teamId=${TEAM_ID}"
        else
            url="${url}?teamId=${TEAM_ID}"
        fi
    fi
    
    if [ -n "$data" ]; then
        curl -s -X "$method" \
             -H "Authorization: Bearer $TOKEN" \
             -H "Content-Type: application/json" \
             -d "$data" \
             "$url"
    else
        curl -s -X "$method" \
             -H "Authorization: Bearer $TOKEN" \
             "$url"
    fi
}

# Main command handling
case "$1" in
    "list")
        echo -e "${GREEN}Environment Variables for project: $PROJECT_ID${NC}"
        echo "================================================"
        
        ENV_VARS=$(vercel_api GET "/v9/projects/$PROJECT_ID/env")
        if [ $? -ne 0 ] || [ -z "$ENV_VARS" ]; then
            echo -e "${RED}Error: Failed to fetch environment variables${NC}"
            exit 1
        fi
        
        # Parse and display env vars
        echo "$ENV_VARS" | jq -r '.envs[] | 
            "  \(.key)" + 
            " [" + (.target | join(", ")) + "]" + 
            if .type == "secret" then " 🔒" else "" end'
        
        TOTAL=$(echo "$ENV_VARS" | jq -r '.envs | length')
        echo -e "\n${YELLOW}Total: $TOTAL variables${NC}"
        echo -e "${BLUE}Targets: production, preview, development${NC}"
        ;;
        
    "get")
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Please specify a variable name${NC}"
            echo "Usage: $0 get VARIABLE_NAME"
            exit 1
        fi
        
        VAR_NAME=$2
        echo -e "${GREEN}Getting $VAR_NAME:${NC}"
        
        ENV_VARS=$(vercel_api GET "/v9/projects/$PROJECT_ID/env")
        VAR_INFO=$(echo "$ENV_VARS" | jq -r --arg key "$VAR_NAME" \
            '.envs[] | select(.key == $key)')
        
        if [ -z "$VAR_INFO" ] || [ "$VAR_INFO" = "null" ]; then
            echo -e "${RED}Variable not found${NC}"
            exit 1
        fi
        
        echo "$VAR_INFO" | jq -r '
            "Key: \(.key)\n" +
            "Type: \(.type)\n" +
            "Targets: \(.target | join(", "))\n" +
            "Value: [REDACTED]"'
        ;;
        
    "set")
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo -e "${RED}Error: Please specify variable name and value${NC}"
            echo "Usage: $0 set VARIABLE_NAME VALUE [targets]"
            echo "       targets: production,preview,development (default: all)"
            exit 1
        fi
        
        VAR_NAME=$2
        VAR_VALUE=$3
        TARGETS=${4:-"production,preview,development"}
        
        echo -e "${GREEN}Setting $VAR_NAME...${NC}"
        echo -e "${BLUE}Targets: $TARGETS${NC}"
        
        # Convert comma-separated targets to JSON array
        TARGET_ARRAY=$(echo "$TARGETS" | jq -R 'split(",")')
        
        # Create JSON payload
        DATA=$(jq -n \
            --arg key "$VAR_NAME" \
            --arg value "$VAR_VALUE" \
            --argjson target "$TARGET_ARRAY" \
            '{
                key: $key,
                value: $value,
                type: "encrypted",
                target: $target
            }')
        
        RESULT=$(vercel_api POST "/v10/projects/$PROJECT_ID/env?upsert=true" "$DATA")
        if [ $? -ne 0 ]; then
            echo -e "${RED}Error: Failed to set environment variable${NC}"
            echo "$RESULT" | jq .
            exit 1
        fi
        
        echo -e "${GREEN}✓ Environment variable set successfully${NC}"
        ;;
        
    "delete")
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Please specify a variable name${NC}"
            echo "Usage: $0 delete VARIABLE_NAME"
            exit 1
        fi
        
        VAR_NAME=$2
        echo -e "${YELLOW}Deleting $VAR_NAME...${NC}"
        
        # First, get the variable ID
        ENV_VARS=$(vercel_api GET "/v9/projects/$PROJECT_ID/env")
        VAR_ID=$(echo "$ENV_VARS" | jq -r --arg key "$VAR_NAME" \
            '.envs[] | select(.key == $key) | .id')
        
        if [ -z "$VAR_ID" ] || [ "$VAR_ID" = "null" ]; then
            echo -e "${RED}Variable not found${NC}"
            exit 1
        fi
        
        RESULT=$(vercel_api DELETE "/v9/projects/$PROJECT_ID/env/$VAR_ID")
        if [ $? -ne 0 ]; then
            echo -e "${RED}Error: Failed to delete environment variable${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✓ Environment variable deleted successfully${NC}"
        ;;
        
    *)
        echo -e "${BLUE}Vercel API Environment Variables Manager${NC}"
        echo "======================================="
        echo ""
        echo "Usage: $0 <command> [args]"
        echo ""
        echo "Commands:"
        echo "  list                              List all environment variables"
        echo "  get <name>                        Get a specific variable"
        echo "  set <name> <value> [targets]      Set or update a variable"
        echo "  delete <name>                     Delete a variable"
        echo ""
        echo "Targets (comma-separated):"
        echo "  production  - Production deployments"
        echo "  preview     - Preview deployments"
        echo "  development - Local development"
        echo ""
        echo "Examples:"
        echo "  $0 list"
        echo "  $0 set API_KEY abc123"
        echo "  $0 set DATABASE_URL postgres://... production"
        echo "  $0 delete OLD_VAR"
        ;;
esac