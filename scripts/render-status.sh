#!/bin/bash

# Render deployment status check script

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

echo -e "${GREEN}Checking Render deployment status for service: $SERVICE_ID${NC}"
echo "================================================"

# Check if render CLI is available
if ! command -v render &> /dev/null; then
    echo -e "${RED}Error: Render CLI not found${NC}"
    echo "Please install: https://render.com/docs/cli"
    exit 1
fi

# Get latest deployment status
echo -e "\n${YELLOW}Latest Deployment:${NC}"
render deploys list $SERVICE_ID -o json 2>/dev/null | jq -r '.[0] | "Date: \(.createdAt)\nStatus: \(.status)\nCommit: \(.commit.id // "N/A")"'

# Show recent deployments
echo -e "\n${YELLOW}Recent Deployments (last 5):${NC}"
render deploys list $SERVICE_ID -o json 2>/dev/null | jq -r '.[:5][] | "\(.createdAt) - \(.status)"'

# Check current live deployment
echo -e "\n${YELLOW}Current Live Deployment:${NC}"
LIVE_DEPLOY=$(render deploys list $SERVICE_ID -o json 2>/dev/null | jq -r '.[] | select(.status == "live") | "\(.createdAt) (Commit: \(.commit.id // "N/A"))"' | head -1)
if [ -n "$LIVE_DEPLOY" ]; then
    echo -e "${GREEN}$LIVE_DEPLOY${NC}"
else
    echo -e "${RED}No live deployment found${NC}"
fi

# Health check
echo -e "\n${YELLOW}Health Check:${NC}"
API_URL=$(cat .render/services.json | jq -r '.services.api.url')
if [ -n "$API_URL" ] && [ "$API_URL" != "null" ]; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/v1/" 2>/dev/null)
    if [ "$HTTP_STATUS" = "200" ]; then
        echo -e "${GREEN}✓ API is responding (HTTP $HTTP_STATUS)${NC}"
    else
        echo -e "${RED}✗ API returned HTTP $HTTP_STATUS${NC}"
    fi
else
    echo "No API URL configured"
fi

echo -e "\n================================================"