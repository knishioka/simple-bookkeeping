#!/bin/bash

# E2Eテスト実行スクリプト（基本テストのみ）
echo "Starting basic E2E tests..."

# 基本的なページアクセステスト
echo "Running basic page tests..."
pnpm exec playwright test e2e/basic.spec.ts --reporter=list

# Select操作の基本テスト
echo "Running select component tests..."
pnpm exec playwright test e2e/select-test.spec.ts --reporter=list

# 結果サマリー
echo "Basic E2E tests completed!"