#!/bin/bash

# Script to check if required ports are available
# Used by CI/CD and local development to prevent port conflicts

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default port (can be overridden by environment variables)
WEB_PORT=${WEB_PORT:-3000}

# Function to check if a port is in use
check_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}❌ Port $port ($service) is already in use${NC}"
        
        # Try to identify what's using the port
        echo "  Process using port $port:"
        lsof -i :$port | grep LISTEN | head -1
        
        return 1
    else
        echo -e "${GREEN}✅ Port $port ($service) is available${NC}"
        return 0
    fi
}

# Function to find an available port starting from a given port
find_available_port() {
    local start_port=$1
    local max_port=$((start_port + 10))
    
    for port in $(seq $start_port $max_port); do
        if ! lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo $port
            return 0
        fi
    done
    
    return 1
}

echo "🔍 Checking port availability..."
echo ""

# Check port
web_available=0

check_port $WEB_PORT "Web Server" || web_available=1

echo ""

# If port is not available, suggest alternatives
if [ $web_available -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Port is not available${NC}"
    echo ""
    
    if [ "$CI" = "true" ]; then
        # In CI, try to find alternative port automatically
        echo "CI environment detected. Finding alternative port..."
        
        new_web_port=$(find_available_port $((WEB_PORT + 1)))
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}Found alternative web port: $new_web_port${NC}"
            export WEB_PORT=$new_web_port
        fi
        
        # Update environment for subsequent processes
        echo "WEB_PORT=$WEB_PORT" >> $GITHUB_ENV 2>/dev/null || true
    else
        # In local environment, provide instructions
        echo "To use alternative port, run:"
        echo ""
        
        new_web_port=$(find_available_port $((WEB_PORT + 1)))
        echo "  export WEB_PORT=$new_web_port"
        
        echo ""
        echo "Or stop the process using the port:"
        echo ""
        
        pid=$(lsof -t -i:$WEB_PORT -sTCP:LISTEN)
        echo "  kill $pid  # Stop process on port $WEB_PORT"
    fi
    
    exit 1
else
    echo -e "${GREEN}✅ Required port is available${NC}"
    exit 0
fi
