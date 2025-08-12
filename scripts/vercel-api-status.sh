#!/bin/bash

# ============================================================================
# vercel-api-status.sh - Vercel Deployment Status Monitor
# ============================================================================
# Purpose: Monitors Vercel deployment status via API, displays recent deployments,
#          health checks, and deployment statistics with colored output
# Usage: pnpm vercel:status (or direct execution)
# Requirements: VERCEL_TOKEN environment variable or Vercel CLI authentication
# ============================================================================

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}Checking Vercel deployment status via API${NC}"
echo "================================================"

# Get Vercel token
if [ -n "$VERCEL_TOKEN" ]; then
    TOKEN="$VERCEL_TOKEN"
else
    # Try to get token from vercel CLI auth (macOS location)
    TOKEN=$(cat ~/Library/Application\ Support/com.vercel.cli/auth.json 2>/dev/null | jq -r '.token' 2>/dev/null || echo "")
fi

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Error: Vercel token not found${NC}"
    echo "Please set VERCEL_TOKEN environment variable or login with 'vercel login'"
    exit 1
fi

# Get project info from .vercel/project.json
if [ ! -f ".vercel/project.json" ]; then
    echo -e "${RED}Error: Not a Vercel project${NC}"
    echo "Please run 'vercel link' to link this project"
    exit 1
fi

PROJECT_ID=$(cat .vercel/project.json | jq -r '.projectId')
ORG_ID=$(cat .vercel/project.json | jq -r '.orgId')

echo -e "${YELLOW}Project ID:${NC} $PROJECT_ID"
echo -e "${YELLOW}Organization ID:${NC} $ORG_ID"
echo ""

# Fetch deployments from API
echo -e "${YELLOW}Fetching deployments...${NC}"
API_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
    "https://api.vercel.com/v6/deployments?projectId=$PROJECT_ID&teamId=$ORG_ID&limit=10")

# Check if API request was successful
if [ $? -ne 0 ] || [ -z "$API_RESPONSE" ]; then
    echo -e "${RED}Error: Failed to fetch deployments${NC}"
    exit 1
fi

# Check for error in response
ERROR=$(echo "$API_RESPONSE" | jq -r '.error.message // empty' 2>/dev/null)
if [ -n "$ERROR" ]; then
    echo -e "${RED}API Error: $ERROR${NC}"
    exit 1
fi

# Parse and display deployments
echo -e "${YELLOW}Recent Deployments:${NC}"
echo ""

# Extract deployments
DEPLOYMENTS=$(echo "$API_RESPONSE" | jq -r '.deployments[]' 2>/dev/null)

if [ -z "$DEPLOYMENTS" ]; then
    echo "No deployments found"
    exit 0
fi

# Display deployments with formatting
echo "$API_RESPONSE" | jq -r '.deployments[] | 
    "\(.created | . / 1000 | strftime("%Y-%m-%d %H:%M:%S")) | \(.state) | \(.target // "preview") | \(.url) | \(.creator.username)"' | \
while IFS='|' read -r created state target url creator; do
    # Trim whitespace
    created=$(echo "$created" | xargs)
    state=$(echo "$state" | xargs)
    target=$(echo "$target" | xargs)
    url=$(echo "$url" | xargs)
    creator=$(echo "$creator" | xargs)
    
    # Color based on state
    if [ "$state" = "READY" ] && [ "$target" = "production" ]; then
        echo -e "${GREEN}✓ $created | $state | $target | $url | $creator${NC}"
    elif [ "$state" = "READY" ]; then
        echo -e "${BLUE}✓ $created | $state | $target | $url | $creator${NC}"
    elif [ "$state" = "ERROR" ] || [ "$state" = "FAILED" ]; then
        echo -e "${RED}✗ $created | $state | $target | $url | $creator${NC}"
    elif [ "$state" = "BUILDING" ] || [ "$state" = "DEPLOYING" ]; then
        echo -e "${YELLOW}⏳ $created | $state | $target | $url | $creator${NC}"
    else
        echo "  $created | $state | $target | $url | $creator"
    fi
done

echo ""

# Get latest production deployment
echo -e "${YELLOW}Latest Production Deployment:${NC}"
PROD_DEPLOYMENT=$(echo "$API_RESPONSE" | jq -r '.deployments[] | select(.target == "production" and .state == "READY") | .url' | head -1)

if [ -n "$PROD_DEPLOYMENT" ]; then
    echo -e "${GREEN}https://$PROD_DEPLOYMENT${NC}"
    
    # Health check
    echo -e "\n${YELLOW}Health Check:${NC}"
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$PROD_DEPLOYMENT" 2>/dev/null)
    if [ "$HTTP_STATUS" = "200" ]; then
        echo -e "${GREEN}✓ Website is responding (HTTP $HTTP_STATUS)${NC}"
    else
        echo -e "${RED}✗ Website returned HTTP $HTTP_STATUS${NC}"
    fi
else
    echo -e "${RED}No production deployment found${NC}"
fi

echo ""
echo -e "${YELLOW}Deployment Statistics:${NC}"
TOTAL=$(echo "$API_RESPONSE" | jq '.deployments | length')
READY=$(echo "$API_RESPONSE" | jq '[.deployments[] | select(.state == "READY")] | length')
ERROR=$(echo "$API_RESPONSE" | jq '[.deployments[] | select(.state == "ERROR" or .state == "FAILED")] | length')
BUILDING=$(echo "$API_RESPONSE" | jq '[.deployments[] | select(.state == "BUILDING" or .state == "DEPLOYING")] | length')

echo "Total shown: $TOTAL"
echo -e "${GREEN}Ready: $READY${NC}"
echo -e "${RED}Failed: $ERROR${NC}"
echo -e "${YELLOW}Building: $BUILDING${NC}"

echo ""
echo "================================================"
echo -e "${YELLOW}Tip:${NC} Set VERCEL_TOKEN environment variable to avoid auth issues"
echo "export VERCEL_TOKEN=<your-token>"