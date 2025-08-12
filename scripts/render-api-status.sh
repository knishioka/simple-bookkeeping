#!/bin/bash

# ============================================================================
# render-api-status.sh - Render Deployment Status Monitor
# ============================================================================
# Purpose: Monitors Render deployment status via API, displays service info,
#          recent deployments, health checks, and deployment statistics
# Usage: pnpm render:status (or direct execution)
# Requirements: RENDER_API_KEY environment variable, .render/services.json
# ============================================================================

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Get Render API key
if [ -z "$RENDER_API_KEY" ]; then
    echo -e "${RED}Error: RENDER_API_KEY environment variable not set${NC}"
    echo "Please set your Render API key:"
    echo "  export RENDER_API_KEY=your-api-key"
    echo "Get your API key from: https://dashboard.render.com/u/settings"
    exit 1
fi

echo -e "${GREEN}Checking Render deployment status via API${NC}"
echo "================================================"
echo -e "${YELLOW}Service ID:${NC} $SERVICE_ID"
echo ""

# Function to call Render API
render_api() {
    local endpoint=$1
    curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
         -H "Accept: application/json" \
         "https://api.render.com/v1/${endpoint}"
}

# Get service details
echo -e "${YELLOW}Service Information:${NC}"
SERVICE_INFO=$(render_api "services/$SERVICE_ID")
if [ $? -ne 0 ] || [ -z "$SERVICE_INFO" ]; then
    echo -e "${RED}Error: Failed to fetch service information${NC}"
    exit 1
fi

# Parse service info
SERVICE_NAME=$(echo "$SERVICE_INFO" | jq -r '.name // "N/A"')
SERVICE_TYPE=$(echo "$SERVICE_INFO" | jq -r '.type // "N/A"')
SERVICE_REGION=$(echo "$SERVICE_INFO" | jq -r '.region // "N/A"')
SERVICE_URL=$(echo "$SERVICE_INFO" | jq -r '.url // empty')

echo "  Name: $SERVICE_NAME"
echo "  Type: $SERVICE_TYPE"
echo "  Region: $SERVICE_REGION"
if [ -n "$SERVICE_URL" ]; then
    echo "  URL: $SERVICE_URL"
fi

# Get latest deployments
echo -e "\n${YELLOW}Recent Deployments:${NC}"
DEPLOYMENTS=$(render_api "services/$SERVICE_ID/deploys?limit=10")
if [ $? -ne 0 ] || [ -z "$DEPLOYMENTS" ]; then
    echo -e "${RED}Error: Failed to fetch deployments${NC}"
    exit 1
fi

# Display deployment status
echo "$DEPLOYMENTS" | jq -r '.[] | 
    "\(.createdAt) - \(.status)" + 
    if .commit.id then " (commit: \(.commit.id[0:7]))" else "" end' | head -10

# Get current live deployment
echo -e "\n${YELLOW}Current Live Deployment:${NC}"
LIVE_DEPLOY=$(echo "$DEPLOYMENTS" | jq -r '.[] | select(.status == "live") | 
    "\(.createdAt) (commit: \(.commit.id[0:7] // "N/A"))"' | head -1)

if [ -n "$LIVE_DEPLOY" ]; then
    echo -e "${GREEN}$LIVE_DEPLOY${NC}"
else
    echo -e "${RED}No live deployment found${NC}"
fi

# Get latest deployment status
LATEST_STATUS=$(echo "$DEPLOYMENTS" | jq -r '.[0].status // "unknown"')
LATEST_CREATED=$(echo "$DEPLOYMENTS" | jq -r '.[0].createdAt // "N/A"')
LATEST_COMMIT=$(echo "$DEPLOYMENTS" | jq -r '.[0].commit.id[0:7] // "N/A"')

echo -e "\n${YELLOW}Latest Deployment:${NC}"
echo "  Status: $LATEST_STATUS"
echo "  Created: $LATEST_CREATED"
echo "  Commit: $LATEST_COMMIT"

# Health check
echo -e "\n${YELLOW}Health Check:${NC}"
if [ -n "$SERVICE_URL" ]; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/api/v1/" 2>/dev/null)
    if [ "$HTTP_STATUS" = "200" ]; then
        echo -e "${GREEN}✓ API is responding (HTTP $HTTP_STATUS)${NC}"
    else
        echo -e "${RED}✗ API returned HTTP $HTTP_STATUS${NC}"
    fi
else
    echo -e "${YELLOW}No public URL available${NC}"
fi

# Deployment statistics
echo -e "\n${YELLOW}Deployment Statistics:${NC}"
TOTAL=$(echo "$DEPLOYMENTS" | jq -r '. | length')
LIVE=$(echo "$DEPLOYMENTS" | jq -r '[.[] | select(.status == "live")] | length')
BUILD_FAILED=$(echo "$DEPLOYMENTS" | jq -r '[.[] | select(.status == "build_failed")] | length')
DEPLOY_FAILED=$(echo "$DEPLOYMENTS" | jq -r '[.[] | select(.status == "deploy_failed")] | length')

echo "  Total shown: $TOTAL"
echo "  Live: $LIVE"
echo "  Build failed: $BUILD_FAILED"
echo "  Deploy failed: $DEPLOY_FAILED"

echo -e "\n================================================"