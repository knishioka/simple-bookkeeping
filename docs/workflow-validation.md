# GitHub Actions Workflow Validation System

## Overview

The workflow validation system provides automated checking of GitHub Actions workflows, shell scripts, and YAML configuration files to ensure they follow best practices and are free from common errors.

## Components

### 1. Validation Script (`scripts/validate-workflows.sh`)

The main validation script that performs comprehensive checks using:

- **actionlint**: GitHub Actions workflow linter
- **shellcheck**: Shell script static analyzer
- **yamllint**: YAML linter

### 2. Pre-commit Hook

Automatically validates workflows and scripts before commits when they are modified. The hook:

- Checks modified GitHub Actions workflow files
- Validates changed shell scripts
- Warns about missing tools but doesn't block commits
- Provides installation instructions for missing tools

### 3. GitHub Actions Workflow

The `workflow-validation.yml` workflow runs on pull requests that modify:

- `.github/workflows/**` files
- Shell scripts (`*.sh`, `*.bash`)
- Husky hooks
- Docker Compose files

### 4. NPM Scripts

Convenient commands for running validations:

```bash
# Validate everything
pnpm validate:all

# Validate only workflows
pnpm validate:workflows

# Validate only shell scripts
pnpm validate:scripts

# Validate only YAML files
pnpm validate:yaml
```

## Installation

### macOS

```bash
# Install all validation tools
brew install actionlint shellcheck
pip3 install yamllint

# Or use the script's install option
./scripts/validate-workflows.sh --install
```

### Linux/Ubuntu

```bash
# Install shellcheck
sudo apt-get update && sudo apt-get install -y shellcheck

# Install actionlint
curl -s https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.sh | bash
sudo mv actionlint /usr/local/bin/

# Install yamllint
pip3 install yamllint
```

## Usage

### Command Line Options

```bash
./scripts/validate-workflows.sh [options]

Options:
  -h, --help          Show help message
  -w, --workflows     Validate only workflows
  -s, --scripts       Validate only shell scripts
  -y, --yaml          Validate only YAML files
  -i, --install       Install missing validation tools
  -v, --verbose       Enable verbose output
  -q, --quiet         Suppress informational output
```

### Examples

```bash
# Validate everything
./scripts/validate-workflows.sh

# Validate only workflows
./scripts/validate-workflows.sh -w

# Install missing tools
./scripts/validate-workflows.sh -i

# Verbose mode for debugging
./scripts/validate-workflows.sh -v
```

## Configuration

### actionlint Configuration

The `.github/actionlint.yaml` file configures actionlint behavior:

- Enables shellcheck integration for run steps
- Configures ignored warnings
- Defines custom variables

### shellcheck Exclusions

The validation script excludes these shellcheck warnings by default:

- `SC1090`: Can't follow non-constant source
- `SC1091`: Not following sourced files

## Pre-commit Hook Behavior

When committing changes to workflows or scripts:

1. **If tools are installed**: Validation runs and blocks commit on errors
2. **If tools are missing**: Shows warning but allows commit to proceed
3. **Installation hints**: Provides commands to install missing tools

## CI Integration

The workflow validation runs automatically on pull requests:

1. Installs all validation tools
2. Validates GitHub Actions workflows
3. Checks all shell scripts
4. Validates YAML configuration files
5. Fails the CI check if errors are found

## Common Issues and Solutions

### Issue: actionlint not found

```bash
# macOS
brew install actionlint

# Linux
curl -s https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.sh | bash
```

### Issue: shellcheck not found

```bash
# macOS
brew install shellcheck

# Ubuntu/Debian
sudo apt-get install shellcheck
```

### Issue: yamllint not found

```bash
pip3 install yamllint
# or
pip install yamllint
```

### Issue: Validation fails in CI but passes locally

Ensure you have the same tool versions:

- Check tool versions with: `actionlint -version`, `shellcheck --version`, `yamllint --version`
- Update tools to latest versions

## Best Practices

1. **Run validation before pushing**: Use `pnpm validate:all` before pushing changes
2. **Fix issues promptly**: Address validation errors immediately
3. **Keep tools updated**: Regularly update validation tools
4. **Use the pre-commit hook**: It catches issues early
5. **Configure actionlint**: Customize `.github/actionlint.yaml` for project needs

## Validation Rules

### Workflow Validation

- Correct YAML syntax
- Valid GitHub Actions syntax
- Proper job dependencies
- Correct action versions
- Shell script best practices in run steps

### Shell Script Validation

- Proper quoting
- Variable expansion safety
- Command substitution best practices
- Error handling
- POSIX compliance

### YAML Validation

- Correct indentation
- Proper syntax
- No duplicate keys
- Valid references

## Troubleshooting

### Debug validation issues

```bash
# Run with verbose mode
./scripts/validate-workflows.sh -v

# Check specific file with tools directly
actionlint .github/workflows/my-workflow.yml
shellcheck scripts/my-script.sh
yamllint docker-compose.yml
```

### Skip validation temporarily

If you need to commit despite validation issues:

```bash
# Skip pre-commit hooks (use sparingly)
git commit --no-verify -m "Emergency fix"
```

## Future Improvements

- [ ] Auto-fix capability for common issues
- [ ] Custom validation rules
- [ ] Performance metrics
- [ ] Caching of validation results
- [ ] Integration with other linters
