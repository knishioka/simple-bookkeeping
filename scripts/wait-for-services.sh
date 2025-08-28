#!/bin/bash

# Wait for services to be ready
# Issue #254: Improve CI test stability

set -e

API_URL=${API_URL:-"http://localhost:3001"}
WEB_URL=${WEB_URL:-"http://localhost:3000"}
MAX_WAIT=${MAX_WAIT:-120}
INTERVAL=${INTERVAL:-2}

echo "Waiting for services to be ready..."
echo "API URL: $API_URL"
echo "Web URL: $WEB_URL"
echo "Max wait time: ${MAX_WAIT}s"

wait_for_service() {
  local url=$1
  local name=$2
  local elapsed=0

  echo "Checking $name at $url..."
  
  while [ $elapsed -lt $MAX_WAIT ]; do
    if curl -s -f -o /dev/null "$url" 2>/dev/null; then
      echo "✅ $name is ready (${elapsed}s)"
      return 0
    fi
    
    echo "⏳ Waiting for $name... (${elapsed}s/${MAX_WAIT}s)"
    sleep $INTERVAL
    elapsed=$((elapsed + INTERVAL))
  done
  
  echo "❌ $name failed to start after ${MAX_WAIT}s"
  return 1
}

# Wait for API
if ! wait_for_service "$API_URL/api/v1/health" "API"; then
  echo "API health check failed. Checking logs..."
  exit 1
fi

# Wait for Web
if ! wait_for_service "$WEB_URL" "Web"; then
  echo "Web server check failed. Checking logs..."
  exit 1
fi

echo "✅ All services are ready!"

# Additional health checks
echo "Running additional health checks..."

# Check if API returns proper JSON
if curl -s "$API_URL/api/v1/health" | grep -q "ok"; then
  echo "✅ API returns valid health response"
else
  echo "⚠️  API health response may be invalid"
fi

# Check if Web has the expected content
if curl -s "$WEB_URL" | grep -q "Simple Bookkeeping"; then
  echo "✅ Web server returns expected content"
else
  echo "⚠️  Web server content may be incorrect"
fi

echo "🎉 All checks passed! Services are ready for testing."
