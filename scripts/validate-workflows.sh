#!/bin/bash

# ============================================================================
# validate-workflows.sh - GitHub Actions Workflow Validation
# ============================================================================
# Purpose: Validates GitHub Actions workflows, shell scripts, and YAML files
#          using actionlint, shellcheck, and yamllint
# Usage: ./scripts/validate-workflows.sh [options]
# ============================================================================

set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

# ============================================================================
# Configuration
# ============================================================================

# Paths
WORKFLOWS_DIR="${PROJECT_ROOT}/.github/workflows"
SCRIPTS_DIR="${PROJECT_ROOT}/scripts"
ACTIONLINT_CONFIG="${PROJECT_ROOT}/.github/actionlint.yaml"

# Tool versions (for installation)
ACTIONLINT_VERSION="1.6.26"
SHELLCHECK_VERSION="0.9.0"
YAMLLINT_VERSION="1.33.0"

# Counters
TOTAL_ERRORS=0
TOTAL_WARNINGS=0
WORKFLOWS_CHECKED=0
SCRIPTS_CHECKED=0
YAML_FILES_CHECKED=0

# ============================================================================
# Helper Functions
# ============================================================================

# Check if a tool is available
check_tool() {
    local tool="$1"
    local install_msg="$2"

    if command_exists "$tool"; then
        return 0
    else
        print_warning "${WARNING_SIGN} $tool is not installed. $install_msg"
        return 1
    fi
}

# Install actionlint if needed
install_actionlint() {
    print_info "${INFO_SIGN} Installing actionlint..."

    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command_exists brew; then
            brew install actionlint
        else
            print_error "Please install Homebrew first or download actionlint manually"
            return 1
        fi
    else
        # Linux installation
        curl -s https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.sh | bash
        sudo mv actionlint /usr/local/bin/
    fi

    return $?
}

# Install shellcheck if needed
install_shellcheck() {
    print_info "${INFO_SIGN} Installing shellcheck..."

    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command_exists brew; then
            brew install shellcheck
        else
            print_error "Please install Homebrew first or download shellcheck manually"
            return 1
        fi
    else
        # Linux installation
        sudo apt-get update && sudo apt-get install -y shellcheck
    fi

    return $?
}

# Install yamllint if needed
install_yamllint() {
    print_info "${INFO_SIGN} Installing yamllint..."

    if command_exists pip3; then
        pip3 install --user yamllint
    elif command_exists pip; then
        pip install --user yamllint
    else
        print_error "Python pip is required to install yamllint"
        return 1
    fi

    return $?
}

# Validate a single workflow file
validate_workflow() {
    local workflow_file="$1"
    local filename=$(basename "$workflow_file")
    local errors_found=0

    print_info "${GEAR} Checking workflow: $filename"

    # Run actionlint
    if command_exists actionlint; then
        local actionlint_output
        local actionlint_args=""

        if [ -f "$ACTIONLINT_CONFIG" ]; then
            actionlint_args="-config-file $ACTIONLINT_CONFIG"
        fi

        if actionlint_output=$(actionlint $actionlint_args "$workflow_file" 2>&1); then
            print_success "  ${CHECK_MARK} actionlint: No issues found"
        else
            print_error "  ${CROSS_MARK} actionlint: Issues found"
            echo "$actionlint_output" | sed 's/^/    /'
            ((errors_found++)) || true
            ((TOTAL_ERRORS++)) || true
        fi
    fi

    # Run yamllint
    if command_exists yamllint; then
        local yamllint_output
        if yamllint_output=$(yamllint -d relaxed "$workflow_file" 2>&1); then
            print_success "  ${CHECK_MARK} yamllint: No issues found"
        else
            print_warning "  ${WARNING_SIGN} yamllint: Issues found"
            echo "$yamllint_output" | sed 's/^/    /'
            ((TOTAL_WARNINGS++)) || true
        fi
    fi

    return $errors_found
}

# Validate a shell script
validate_script() {
    local script_file="$1"
    local filename=$(basename "$script_file")
    local errors_found=0

    print_info "${GEAR} Checking script: $filename"

    if command_exists shellcheck; then
        local shellcheck_output
        # Exclude SC1090 (can't follow source) and SC1091 (not following source)
        if shellcheck_output=$(shellcheck -x -e SC1090,SC1091 "$script_file" 2>&1); then
            print_success "  ${CHECK_MARK} shellcheck: No issues found"
        else
            print_error "  ${CROSS_MARK} shellcheck: Issues found"
            echo "$shellcheck_output" | sed 's/^/    /'
            ((errors_found++)) || true
            ((TOTAL_ERRORS++)) || true
        fi
    fi

    return $errors_found
}

# Validate YAML files
validate_yaml() {
    local yaml_file="$1"
    local filename=$(basename "$yaml_file")
    local errors_found=0

    print_info "${GEAR} Checking YAML: $filename"

    if command_exists yamllint; then
        local yamllint_output
        if yamllint_output=$(yamllint -d relaxed "$yaml_file" 2>&1); then
            print_success "  ${CHECK_MARK} yamllint: No issues found"
        else
            print_warning "  ${WARNING_SIGN} yamllint: Issues found"
            echo "$yamllint_output" | sed 's/^/    /'
            ((TOTAL_WARNINGS++)) || true
        fi
    fi

    return 0
}

# ============================================================================
# Main Validation Functions
# ============================================================================

# Validate all GitHub Actions workflows
validate_all_workflows() {
    print_header "${SHIELD} Validating GitHub Actions Workflows" 60

    if [ ! -d "$WORKFLOWS_DIR" ]; then
        print_warning "No workflows directory found at $WORKFLOWS_DIR"
        return 0
    fi

    local has_actionlint=false
    local has_yamllint=false

    if command_exists actionlint; then
        has_actionlint=true
        print_success "${CHECK_MARK} actionlint is available ($(actionlint -version 2>&1 | head -1))"
    else
        print_warning "${WARNING_SIGN} actionlint is not installed"
    fi

    if command_exists yamllint; then
        has_yamllint=true
        print_success "${CHECK_MARK} yamllint is available ($(yamllint --version 2>&1))"
    else
        print_warning "${WARNING_SIGN} yamllint is not installed"
    fi

    if [ "$has_actionlint" = false ] && [ "$has_yamllint" = false ]; then
        print_warning "No validation tools available. Install actionlint and/or yamllint for validation."
        return 0
    fi

    echo ""

    # Check for workflow files
    shopt -s nullglob  # Make glob patterns return empty if no matches
    workflow_files=($WORKFLOWS_DIR/*.yml $WORKFLOWS_DIR/*.yaml)
    shopt -u nullglob

    if [ ${#workflow_files[@]} -eq 0 ]; then
        print_warning "No workflow files found in $WORKFLOWS_DIR"
        return 0
    fi

    for workflow in "${workflow_files[@]}"; do
        if [ -f "$workflow" ]; then
            validate_workflow "$workflow" || true
            ((WORKFLOWS_CHECKED++)) || true
            echo ""
        fi
    done

    if [ $WORKFLOWS_CHECKED -eq 0 ]; then
        print_warning "No workflow files found to validate"
    fi
}

# Validate all shell scripts
validate_all_scripts() {
    print_header "${SHIELD} Validating Shell Scripts" 60

    if ! command_exists shellcheck; then
        print_warning "${WARNING_SIGN} shellcheck is not installed"
        return 0
    fi

    print_success "${CHECK_MARK} shellcheck is available ($(shellcheck --version | grep version: | cut -d' ' -f2))"
    echo ""

    # Find all shell scripts
    local script_files=()

    # Add scripts from scripts directory
    if [ -d "$SCRIPTS_DIR" ]; then
        while IFS= read -r -d '' file; do
            script_files+=("$file")
        done < <(find "$SCRIPTS_DIR" -type f \( -name "*.sh" -o -name "*.bash" \) -print0)
    fi

    # Add Husky hooks
    if [ -d "${PROJECT_ROOT}/.husky" ]; then
        for hook in "${PROJECT_ROOT}/.husky"/*; do
            if [ -f "$hook" ] && [ -x "$hook" ] && [[ ! "$hook" =~ \. ]]; then
                # Check if it's a shell script
                if head -n 1 "$hook" | grep -qE '^#!/(usr/)?bin/(ba)?sh'; then
                    script_files+=("$hook")
                fi
            fi
        done
    fi

    if [ ${#script_files[@]} -eq 0 ]; then
        print_warning "No shell scripts found to validate"
        return 0
    fi

    for script in "${script_files[@]}"; do
        validate_script "$script" || true
        ((SCRIPTS_CHECKED++)) || true
        echo ""
    done
}

# Validate additional YAML files
validate_all_yaml() {
    print_header "${SHIELD} Validating Additional YAML Files" 60

    if ! command_exists yamllint; then
        print_warning "${WARNING_SIGN} yamllint is not installed"
        return 0
    fi

    print_success "${CHECK_MARK} yamllint is available ($(yamllint --version 2>&1))"
    echo ""

    # Find YAML files (excluding workflows already checked)
    local yaml_files=()

    # Check for docker-compose files
    for compose_file in "${PROJECT_ROOT}"/docker-compose*.yml "${PROJECT_ROOT}"/docker-compose*.yaml; do
        if [ -f "$compose_file" ]; then
            yaml_files+=("$compose_file")
        fi
    done

    # Check for other YAML config files
    for config in "${PROJECT_ROOT}"/.*.yml "${PROJECT_ROOT}"/.*.yaml; do
        if [ -f "$config" ] && [[ ! "$config" =~ \.github/workflows ]]; then
            yaml_files+=("$config")
        fi
    done

    if [ ${#yaml_files[@]} -eq 0 ]; then
        print_info "No additional YAML files found to validate"
        return 0
    fi

    for yaml_file in "${yaml_files[@]}"; do
        validate_yaml "$yaml_file" || true
        ((YAML_FILES_CHECKED++)) || true
        echo ""
    done
}

# Show validation summary
show_summary() {
    print_header "${CHART} Validation Summary" 60

    echo "Files checked:"
    echo "  - Workflows: $WORKFLOWS_CHECKED"
    echo "  - Shell scripts: $SCRIPTS_CHECKED"
    echo "  - YAML files: $YAML_FILES_CHECKED"
    echo ""
    echo "Results:"

    if [ $TOTAL_ERRORS -gt 0 ]; then
        print_error "  ${CROSS_MARK} Errors found: $TOTAL_ERRORS"
    else
        print_success "  ${CHECK_MARK} No errors found"
    fi

    if [ $TOTAL_WARNINGS -gt 0 ]; then
        print_warning "  ${WARNING_SIGN} Warnings found: $TOTAL_WARNINGS"
    else
        print_success "  ${CHECK_MARK} No warnings found"
    fi

    echo ""

    # Show tool installation hints if needed
    if ! command_exists actionlint || ! command_exists shellcheck || ! command_exists yamllint; then
        print_subheader "Missing Tools"

        if ! command_exists actionlint; then
            echo "  Install actionlint:"
            if [[ "$OSTYPE" == "darwin"* ]]; then
                echo "    brew install actionlint"
            else
                echo "    curl -s https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.sh | bash"
            fi
        fi

        if ! command_exists shellcheck; then
            echo "  Install shellcheck:"
            if [[ "$OSTYPE" == "darwin"* ]]; then
                echo "    brew install shellcheck"
            else
                echo "    apt-get install shellcheck"
            fi
        fi

        if ! command_exists yamllint; then
            echo "  Install yamllint:"
            echo "    pip install yamllint"
        fi

        echo ""
    fi
}

# ============================================================================
# Command Line Options
# ============================================================================

show_help() {
    cat << EOF
Usage: $(basename "$0") [options]

Validates GitHub Actions workflows, shell scripts, and YAML files.

Options:
    -h, --help          Show this help message
    -w, --workflows     Validate only workflows
    -s, --scripts       Validate only shell scripts
    -y, --yaml          Validate only YAML files
    -i, --install       Install missing validation tools
    -f, --fix           Attempt to fix issues (not implemented yet)
    -v, --verbose       Enable verbose output
    -q, --quiet         Suppress informational output

Examples:
    $(basename "$0")            # Validate everything
    $(basename "$0") -w         # Validate only workflows
    $(basename "$0") -s         # Validate only scripts
    $(basename "$0") -i         # Install missing tools

Tools used:
    - actionlint: GitHub Actions workflow linter
    - shellcheck: Shell script static analyzer
    - yamllint: YAML linter

EOF
    exit 0
}

# Parse command line arguments
VALIDATE_WORKFLOWS=true
VALIDATE_SCRIPTS=true
VALIDATE_YAML=true
INSTALL_TOOLS=false
FIX_ISSUES=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            ;;
        -w|--workflows)
            VALIDATE_WORKFLOWS=true
            VALIDATE_SCRIPTS=false
            VALIDATE_YAML=false
            shift
            ;;
        -s|--scripts)
            VALIDATE_WORKFLOWS=false
            VALIDATE_SCRIPTS=true
            VALIDATE_YAML=false
            shift
            ;;
        -y|--yaml)
            VALIDATE_WORKFLOWS=false
            VALIDATE_SCRIPTS=false
            VALIDATE_YAML=true
            shift
            ;;
        -i|--install)
            INSTALL_TOOLS=true
            shift
            ;;
        -f|--fix)
            FIX_ISSUES=true
            shift
            ;;
        -v|--verbose)
            DEBUG=1
            shift
            ;;
        -q|--quiet)
            QUIET=1
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            ;;
    esac
done

# ============================================================================
# Main Execution
# ============================================================================

main() {
    print_header "${ROCKET} GitHub Actions Workflow Validation" 60
    print_info "Project root: $PROJECT_ROOT"
    echo ""

    # Install tools if requested
    if [ "$INSTALL_TOOLS" = true ]; then
        print_header "${PACKAGE} Installing Validation Tools" 60

        if ! command_exists actionlint; then
            install_actionlint || print_warning "Failed to install actionlint"
        fi

        if ! command_exists shellcheck; then
            install_shellcheck || print_warning "Failed to install shellcheck"
        fi

        if ! command_exists yamllint; then
            install_yamllint || print_warning "Failed to install yamllint"
        fi

        echo ""
    fi

    # Run validations
    if [ "$VALIDATE_WORKFLOWS" = true ]; then
        validate_all_workflows
    fi

    if [ "$VALIDATE_SCRIPTS" = true ]; then
        validate_all_scripts
    fi

    if [ "$VALIDATE_YAML" = true ]; then
        validate_all_yaml
    fi

    # Show summary
    show_summary

    # Exit with error if any errors were found
    if [ $TOTAL_ERRORS -gt 0 ]; then
        exit 1
    fi

    exit 0
}

# Run main function
main
