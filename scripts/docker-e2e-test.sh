#!/bin/bash

# ============================================================================
# docker-e2e-test.sh - Legacy Wrapper Script
# ============================================================================
# Purpose: Backward compatibility wrapper that redirects to test-runner.sh
# Note: This script is maintained for compatibility with existing workflows
# ============================================================================

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Redirect to the consolidated test-runner.sh
exec "$SCRIPT_DIR/test-runner.sh" e2e-docker "$@"
