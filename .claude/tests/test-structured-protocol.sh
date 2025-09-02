#!/bin/bash

# Test script for structured subagent communication protocol
# SuperClaude式の構造化出力プロトコルのテスト

set -e

echo "=== Structured Protocol Test Suite ==="
echo "Testing multi-layer validation system..."

# カラー出力用
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# テスト結果カウンタ
PASSED=0
FAILED=0

# ========================================
# Helper Functions
# ========================================

print_test_header() {
    echo ""
    echo "----------------------------------------"
    echo "Test: $1"
    echo "----------------------------------------"
}

print_pass() {
    echo -e "${GREEN}✅ PASSED${NC}: $1"
    ((PASSED++))
}

print_fail() {
    echo -e "${RED}❌ FAILED${NC}: $1"
    ((FAILED++))
}

# ========================================
# Validation Functions (from resolve-gh-issue.md)
# ========================================

validate_protocol_format() {
  local response=$1
  
  # プロトコルマーカーの確認
  if ! echo "$response" | grep -q "===PROTOCOL_START==="; then
    echo "ERROR: Invalid protocol format from subagent"
    return 1
  fi
  
  # ステータス抽出と検証
  local status=$(echo "$response" | sed -n '/^STATUS:/p' | awk '{print $2}')
  if [ "$status" != "SUCCESS" ]; then
    echo "WARNING: Subagent returned status: $status"
    [ "$status" = "FAIL" ] && return 1
  fi
  
  return 0
}

validate_data_integrity() {
  local response=$1
  
  # DATAセクション抽出
  local data=$(echo "$response" | sed -n '/===DATA_START===/,/===DATA_END===/p' | grep -v "===")
  
  # JSON妥当性チェック
  echo "$data" | jq empty 2>/dev/null
  if [ $? -ne 0 ]; then
    echo "ERROR: Invalid JSON in DATA section"
    return 1
  fi
  
  # チェックサム検証（可能な場合）
  local checksum=$(echo "$response" | grep "^CHECKSUM:" | awk '{print $2}')
  if [ -n "$checksum" ]; then
    local calculated=$(echo "$data" | sha256sum | awk '{print $1}')
    if [ "${calculated:0:64}" != "$checksum" ]; then
      echo "ERROR: Checksum mismatch"
      return 1
    fi
  fi
  
  return 0
}

# ========================================
# Test Cases
# ========================================

# Test 1: Valid Protocol Format
test_valid_protocol() {
    print_test_header "Valid Protocol Format"
    
    local test_response="===PROTOCOL_START===
STATUS: SUCCESS
TIMESTAMP: 2025-01-02T10:00:00Z
COMMAND: gh issue view 317
CHECKSUM: abc123

===DATA_START===
{
  \"issue_number\": \"317\",
  \"title\": \"Test Issue\"
}
===DATA_END===

===EVIDENCE_START===
RAW_RESPONSE: {\"number\": 317}
===EVIDENCE_END===

===PROTOCOL_END==="

    if validate_protocol_format "$test_response"; then
        print_pass "Protocol format validation"
    else
        print_fail "Protocol format validation"
    fi
}

# Test 2: Invalid Protocol Format
test_invalid_protocol() {
    print_test_header "Invalid Protocol Format"
    
    local test_response="This is not a valid protocol response"

    if ! validate_protocol_format "$test_response" 2>/dev/null; then
        print_pass "Correctly rejected invalid protocol"
    else
        print_fail "Failed to reject invalid protocol"
    fi
}

# Test 3: Data Integrity Check
test_data_integrity() {
    print_test_header "Data Integrity Check"
    
    local test_data='{"test": "data", "number": 123}'
    local checksum=$(echo "$test_data" | sha256sum | awk '{print $1}')
    
    local test_response="===PROTOCOL_START===
STATUS: SUCCESS
CHECKSUM: $checksum

===DATA_START===
$test_data
===DATA_END===

===PROTOCOL_END==="

    if validate_data_integrity "$test_response"; then
        print_pass "Data integrity validation"
    else
        print_fail "Data integrity validation"
    fi
}

# Test 4: Invalid JSON Detection
test_invalid_json() {
    print_test_header "Invalid JSON Detection"
    
    local test_response="===PROTOCOL_START===
STATUS: SUCCESS

===DATA_START===
This is not valid JSON {broken
===DATA_END===

===PROTOCOL_END==="

    if ! validate_data_integrity "$test_response" 2>/dev/null; then
        print_pass "Correctly detected invalid JSON"
    else
        print_fail "Failed to detect invalid JSON"
    fi
}

# Test 5: FAIL Status Handling
test_fail_status() {
    print_test_header "FAIL Status Handling"
    
    local test_response="===PROTOCOL_START===
STATUS: FAIL
ERROR: Test error message
TIMESTAMP: 2025-01-02T10:00:00Z
===PROTOCOL_END==="

    if ! validate_protocol_format "$test_response" 2>/dev/null; then
        print_pass "Correctly handled FAIL status"
    else
        print_fail "Failed to handle FAIL status properly"
    fi
}

# Test 6: WARNING Status Handling
test_warning_status() {
    print_test_header "WARNING Status Handling"
    
    local test_response="===PROTOCOL_START===
STATUS: WARNING
TIMESTAMP: 2025-01-02T10:00:00Z

===DATA_START===
{\"warning\": \"Some data with warnings\"}
===DATA_END===

===PROTOCOL_END==="

    # WARNING should not fail validation
    if validate_protocol_format "$test_response" 2>/dev/null; then
        print_pass "Correctly handled WARNING status"
    else
        print_fail "Failed to handle WARNING status properly"
    fi
}

# Test 7: Real GitHub API Integration (if available)
test_real_api() {
    print_test_header "Real GitHub API Test"
    
    # Check if gh is available
    if ! command -v gh &> /dev/null; then
        echo -e "${YELLOW}⚠️  SKIPPED${NC}: GitHub CLI not available"
        return
    fi
    
    # Try to fetch a real issue
    local issue_data=$(gh issue view 317 --repo knishioka/simple-bookkeeping --json title,number 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        local title=$(echo "$issue_data" | jq -r '.title')
        if [ -n "$title" ]; then
            print_pass "Real GitHub API access"
        else
            print_fail "GitHub API returned empty title"
        fi
    else
        echo -e "${YELLOW}⚠️  SKIPPED${NC}: Could not access GitHub repository"
    fi
}

# ========================================
# Main Test Execution
# ========================================

main() {
    echo "Starting test suite at $(date)"
    echo ""
    
    # Run all tests
    test_valid_protocol
    test_invalid_protocol
    test_data_integrity
    test_invalid_json
    test_fail_status
    test_warning_status
    test_real_api
    
    # Print summary
    echo ""
    echo "========================================"
    echo "Test Summary"
    echo "========================================"
    echo -e "${GREEN}Passed: $PASSED${NC}"
    echo -e "${RED}Failed: $FAILED${NC}"
    
    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}Some tests failed.${NC}"
        exit 1
    fi
}

# Run tests
main
