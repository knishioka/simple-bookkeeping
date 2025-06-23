#!/bin/bash

# Vercel deployment status check script

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Checking Vercel deployment status${NC}"
echo "================================================"

# Check if vercel CLI is available
if ! command -v vercel &> /dev/null; then
    echo -e "${RED}Error: Vercel CLI not found${NC}"
    echo "Please install: npm i -g vercel"
    exit 1
fi

# Check if .vercel/project.json exists
if [ ! -f ".vercel/project.json" ]; then
    echo -e "${RED}Error: Not a Vercel project${NC}"
    echo "Please run 'vercel link' to link this project"
    exit 1
fi

# Get project info
PROJECT_ID=$(cat .vercel/project.json | jq -r '.projectId')
ORG_ID=$(cat .vercel/project.json | jq -r '.orgId')

echo -e "${YELLOW}Project ID:${NC} $PROJECT_ID"
echo -e "${YELLOW}Organization ID:${NC} $ORG_ID"
echo ""

# Get latest deployments
echo -e "${YELLOW}Recent Deployments:${NC}"
DEPLOYMENTS=$(vercel list 2>&1)

# Extract deployment info
echo "$DEPLOYMENTS" | grep -E "(Ready|Error|Preview|Production)" | head -10 | while read line; do
    if echo "$line" | grep -q "● Ready.*Production"; then
        echo -e "${GREEN}✓ $line${NC}"
    elif echo "$line" | grep -q "● Error"; then
        echo -e "${RED}✗ $line${NC}"
    else
        echo "$line"
    fi
done

echo ""
echo -e "${YELLOW}Latest Production Deployment:${NC}"
# Extract production URL
PROD_LINE=$(echo "$DEPLOYMENTS" | grep "● Ready.*Production" | head -1)
if [ -n "$PROD_LINE" ]; then
    PROD_URL=$(echo "$PROD_LINE" | awk '{print $2}')
    echo -e "${GREEN}$PROD_URL${NC}"
    
    # Health check
    echo -e "\n${YELLOW}Health Check:${NC}"
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL" 2>/dev/null)
    if [ "$HTTP_STATUS" = "200" ]; then
        echo -e "${GREEN}✓ Website is responding (HTTP $HTTP_STATUS)${NC}"
    else
        echo -e "${RED}✗ Website returned HTTP $HTTP_STATUS${NC}"
    fi
else
    echo -e "${RED}No production deployment found${NC}"
fi

echo -e "\n${YELLOW}To get more details about a specific deployment:${NC}"
echo "vercel inspect <deployment-url>"
echo ""
echo -e "${YELLOW}To view build logs:${NC}"
echo "vercel logs"
echo ""
echo "================================================"