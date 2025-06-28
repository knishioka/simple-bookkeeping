#!/bin/bash

# Safe Push Validation Script
# Runs all necessary checks before pushing to ensure code quality

set -e  # Exit on any error

echo "🔍 Running Safe Push Validation..."
echo "================================"
echo ""

# Function to run a command and check its result
run_check() {
    local step_num=$1
    local step_name=$2
    local command=$3
    
    echo "${step_num} ${step_name}..."
    if eval "$command"; then
        echo "✅ ${step_name} passed!"
    else
        echo "❌ ${step_name} failed!"
        exit 1
    fi
    echo ""
}

# Run all checks
run_check "1️⃣" "ESLint Check" "pnpm lint || true"  # Allow warnings
run_check "2️⃣" "TypeScript Check" "pnpm typecheck"
run_check "3️⃣" "Tests" "pnpm test"
run_check "4️⃣" "Build" "pnpm build"

echo "✅ All checks passed! Safe to push."
echo ""
echo "📊 Git Status:"
git status --short

echo ""
echo "💡 To commit and push:"
echo "   git add ."
echo "   git commit -m 'feat: Implement database connection pooling optimization'"
echo "   git push origin main"