#!/bin/bash
set -euo pipefail

# Session Start Hook for simple-bookkeeping
# This hook sets up the development environment for Claude Code on the web

# Only run in remote environment (Claude Code on the web)
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  echo "Skipping session start hook (not in remote environment)"
  exit 0
fi

echo "🚀 Starting simple-bookkeeping setup..."

# Navigate to project root
cd "$CLAUDE_PROJECT_DIR" || exit 1

# Step 1: Install dependencies
echo "📦 Installing dependencies with pnpm..."
if ! pnpm install --frozen-lockfile; then
  echo "⚠️  frozen-lockfile failed, trying without..."
  pnpm install
fi

# Step 2: Install Playwright browsers for E2E tests
echo "🎭 Installing Playwright browsers..."
if command -v playwright &> /dev/null; then
  npx playwright install chromium --with-deps
else
  echo "⚠️  Playwright not found, skipping browser installation"
fi

# Step 3: Generate Prisma client
echo "🔧 Generating Prisma client..."
if [ -d "packages/database" ]; then
  pnpm --filter @simple-bookkeeping/database prisma:generate || echo "⚠️  Prisma generate failed (non-critical)"
fi

# Step 4: Build workspace packages
echo "🏗️  Building workspace packages..."
pnpm build:packages || echo "⚠️  Package build failed (non-critical)"

# Step 5: Set up environment variables for development
echo "🔑 Setting up environment variables..."
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  # Set NODE_ENV for development
  echo 'export NODE_ENV="development"' >> "$CLAUDE_ENV_FILE"

  # Skip Supabase in web environment (not available)
  echo 'export SKIP_SUPABASE="true"' >> "$CLAUDE_ENV_FILE"

  # Set test mode to allow tests to run without Supabase
  echo 'export TEST_MODE="ci"' >> "$CLAUDE_ENV_FILE"
fi

echo "✅ Setup complete! Environment is ready for development."
echo ""
echo "Available commands:"
echo "  pnpm lint       - Run ESLint"
echo "  pnpm test       - Run Jest tests"
echo "  pnpm typecheck  - Run TypeScript checks"
echo "  pnpm build      - Build all packages"
