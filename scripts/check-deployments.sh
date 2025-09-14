#!/bin/bash

# ============================================================================
# check-deployments.sh - Legacy Wrapper Script
# ============================================================================
# Purpose: Backward compatibility wrapper that redirects to vercel-tools.sh
# Note: This script is maintained for compatibility with existing workflows
# ============================================================================

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Redirect to the consolidated vercel-tools.sh
exec "$SCRIPT_DIR/vercel-tools.sh" deployments "$@"
