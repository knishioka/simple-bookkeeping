#!/bin/bash

# Test script for E2E configuration validation
# Issue #336: E2E workflow optimization

set -e

echo "🧪 Testing E2E Configuration Files"
echo "=================================="

cd "$(dirname "$0")/.."

# Check if we're in the right directory
if [ ! -f "apps/web/playwright.config.ts" ]; then
    echo "❌ Error: Not in the correct project directory"
    exit 1
fi

echo "📁 Current directory: $(pwd)"

# Test 1: Validate all Playwright configurations can be loaded
echo ""
echo "1️⃣ Testing Playwright configuration files..."

configs=(
    "playwright.config.ts"
    "playwright.config.ci.ts"
    "playwright.config.fast.ts"
    "playwright.config.comprehensive.ts"
)

cd apps/web

for config in "${configs[@]}"; do
    echo "   Checking $config..."
    if [ -f "$config" ]; then
        # Try to load the config (this will catch syntax errors)
        if node -e "require('./$config'); console.log('✅ $config is valid')"; then
            echo "   ✅ $config - Valid"
        else
            echo "   ❌ $config - Invalid syntax"
            exit 1
        fi
    else
        echo "   ❌ $config - File not found"
        exit 1
    fi
done

# Test 2: Validate workflow files
echo ""
echo "2️⃣ Testing workflow files..."

workflows=(
    ".github/workflows/e2e-tests.yml"
    ".github/workflows/e2e-docker.yml"
)

cd ../..

for workflow in "${workflows[@]}"; do
    echo "   Checking $workflow..."
    if [ -f "$workflow" ]; then
        # Basic YAML validation
        if python3 -c "import yaml; yaml.safe_load(open('$workflow'))" 2>/dev/null; then
            echo "   ✅ $workflow - Valid YAML"
        else
            echo "   ❌ $workflow - Invalid YAML"
            exit 1
        fi
    else
        echo "   ❌ $workflow - File not found"
        exit 1
    fi
done

# Test 3: Check if essential test files exist
echo ""
echo "3️⃣ Testing essential test files exist..."

test_files=(
    "apps/web/e2e/basic.spec.ts"
    "apps/web/e2e/journal-entries.spec.ts"
    "apps/web/e2e/simple-entry.spec.ts"
)

for test_file in "${test_files[@]}"; do
    echo "   Checking $test_file..."
    if [ -f "$test_file" ]; then
        echo "   ✅ $test_file - Found"
    else
        echo "   ❌ $test_file - Not found"
        exit 1
    fi
done

# Test 4: Validate configuration differences
echo ""
echo "4️⃣ Validating configuration optimizations..."

cd apps/web

# Check that fast config excludes slow tests
if grep -q "testIgnore.*slow" playwright.config.fast.ts; then
    echo "   ✅ Fast config excludes slow tests"
else
    echo "   ❌ Fast config should exclude slow tests"
    exit 1
fi

# Check that comprehensive config includes all tests
if grep -q "testMatch.*\*\*\/\*\.spec\.ts" playwright.config.comprehensive.ts; then
    echo "   ✅ Comprehensive config includes all tests"
else
    echo "   ❌ Comprehensive config should include all tests"
    exit 1
fi

cd ../..

echo ""
echo "🎉 All E2E configuration tests passed!"
echo ""
echo "📊 Configuration Summary:"
echo "  • Fast E2E: Optimized for 3-5 minute execution with test sharding"
echo "  • Comprehensive E2E: Full test suite for main branch validation"
echo "  • Workflow separation: Fast tests on PRs, comprehensive on main"
echo "  • Performance optimizations: Parallel execution, smart caching, optimized timeouts"
echo ""
echo "✅ Ready for deployment!"
