#!/bin/bash

# ============================================================================
# check-full-build.sh - Legacy Wrapper Script
# ============================================================================
# Purpose: Backward compatibility wrapper that redirects to build-tools.sh
# Note: This script is maintained for compatibility with existing workflows
# ============================================================================

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Redirect to the consolidated build-tools.sh
exec "$SCRIPT_DIR/build-tools.sh" check-full "$@"
