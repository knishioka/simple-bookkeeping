#!/usr/bin/env bash

# Build performance benchmark script
# Measures build times before and after optimizations

set -e

echo "🚀 Build Performance Benchmark"
echo "================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
pnpm clean
rm -rf .turbo

# Measure cold build (no cache)
echo -e "\n${BLUE}Cold Build Test (no cache)${NC}"
echo "--------------------------------"
START_TIME=$(date +%s)
pnpm build:web
END_TIME=$(date +%s)
COLD_BUILD_TIME=$((END_TIME - START_TIME))
echo -e "${GREEN}Cold build completed in ${COLD_BUILD_TIME} seconds${NC}"

# Measure warm build (with cache)
echo -e "\n${BLUE}Warm Build Test (with turbo cache)${NC}"
echo "--------------------------------"
# Make a small change to trigger rebuild
touch apps/web/app/layout.tsx
START_TIME=$(date +%s)
pnpm build:web
END_TIME=$(date +%s)
WARM_BUILD_TIME=$((END_TIME - START_TIME))
echo -e "${GREEN}Warm build completed in ${WARM_BUILD_TIME} seconds${NC}"

# Measure Docker build
if command -v docker &> /dev/null; then
    echo -e "\n${BLUE}Docker Build Test${NC}"
    echo "--------------------------------"
    START_TIME=$(date +%s)
    docker build -f apps/web/Dockerfile . -t simple-bookkeeping:benchmark
    END_TIME=$(date +%s)
    DOCKER_BUILD_TIME=$((END_TIME - START_TIME))
    echo -e "${GREEN}Docker build completed in ${DOCKER_BUILD_TIME} seconds${NC}"
else
    echo -e "\n${YELLOW}Docker not available, skipping Docker build test${NC}"
    DOCKER_BUILD_TIME="N/A"
fi

# Summary
echo -e "\n${BLUE}📊 Build Performance Summary${NC}"
echo "================================"
echo -e "Cold Build:   ${GREEN}${COLD_BUILD_TIME}s${NC}"
echo -e "Warm Build:   ${GREEN}${WARM_BUILD_TIME}s${NC}"
if [ "$DOCKER_BUILD_TIME" != "N/A" ]; then
    echo -e "Docker Build: ${GREEN}${DOCKER_BUILD_TIME}s${NC}"

    # Calculate cache effectiveness
    CACHE_IMPROVEMENT=$((100 - (WARM_BUILD_TIME * 100 / COLD_BUILD_TIME)))
    echo -e "\n${BLUE}Cache Effectiveness: ${GREEN}${CACHE_IMPROVEMENT}% improvement${NC}"
fi

# Performance target check
TARGET_IMPROVEMENT=30
if [ "$WARM_BUILD_TIME" != "N/A" ] && [ "$COLD_BUILD_TIME" -gt 0 ]; then
    if [ "$CACHE_IMPROVEMENT" -ge "$TARGET_IMPROVEMENT" ]; then
        echo -e "\n✅ ${GREEN}Target of ${TARGET_IMPROVEMENT}% improvement achieved!${NC}"
    else
        echo -e "\n⚠️  ${YELLOW}Target of ${TARGET_IMPROVEMENT}% improvement not yet achieved (currently ${CACHE_IMPROVEMENT}%)${NC}"
    fi
fi
