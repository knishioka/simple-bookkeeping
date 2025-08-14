#!/bin/bash

# Script to check if required ports are available
# Used by CI/CD and local development to prevent port conflicts

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default ports (can be overridden by environment variables)
WEB_PORT=${WEB_PORT:-3000}
API_PORT=${API_PORT:-3001}

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

# Check ports
web_available=0
api_available=0

check_port $WEB_PORT "Web Server" || web_available=1
check_port $API_PORT "API Server" || api_available=1

echo ""

# If ports are not available, suggest alternatives
if [ $web_available -ne 0 ] || [ $api_available -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Some ports are not available${NC}"
    echo ""
    
    if [ "$CI" = "true" ]; then
        # In CI, try to find alternative ports automatically
        echo "CI environment detected. Finding alternative ports..."
        
        if [ $web_available -ne 0 ]; then
            new_web_port=$(find_available_port $((WEB_PORT + 1)))
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}Found alternative web port: $new_web_port${NC}"
                export WEB_PORT=$new_web_port
            fi
        fi
        
        if [ $api_available -ne 0 ]; then
            new_api_port=$(find_available_port $((API_PORT + 1)))
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}Found alternative API port: $new_api_port${NC}"
                export API_PORT=$new_api_port
            fi
        fi
        
        # Update environment for subsequent processes
        echo "WEB_PORT=$WEB_PORT" >> $GITHUB_ENV 2>/dev/null || true
        echo "API_PORT=$API_PORT" >> $GITHUB_ENV 2>/dev/null || true
    else
        # In local environment, provide instructions
        echo "To use alternative ports, run:"
        echo ""
        
        if [ $web_available -ne 0 ]; then
            new_web_port=$(find_available_port $((WEB_PORT + 1)))
            echo "  export WEB_PORT=$new_web_port"
        fi
        
        if [ $api_available -ne 0 ]; then
            new_api_port=$(find_available_port $((API_PORT + 1)))
            echo "  export API_PORT=$new_api_port"
        fi
        
        echo ""
        echo "Or stop the processes using the ports:"
        echo ""
        
        if [ $web_available -ne 0 ]; then
            pid=$(lsof -t -i:$WEB_PORT -sTCP:LISTEN)
            echo "  kill $pid  # Stop process on port $WEB_PORT"
        fi
        
        if [ $api_available -ne 0 ]; then
            pid=$(lsof -t -i:$API_PORT -sTCP:LISTEN)
            echo "  kill $pid  # Stop process on port $API_PORT"
        fi
    fi
    
    exit 1
else
    echo -e "${GREEN}✅ All required ports are available${NC}"
    exit 0
fi
