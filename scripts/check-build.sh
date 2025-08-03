#!/bin/bash

# ビルドチェックスクリプト
# コミット前に依存関係とビルドの問題を検出

echo "🔍 Running build checks..."

# 変更されたTypeScriptファイルがある場合のみチェック
CHANGED_TS_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E "\.(ts|tsx)$" || true)

if [ -z "$CHANGED_TS_FILES" ]; then
    echo "✅ No TypeScript files changed, skipping build checks"
    exit 0
fi

echo "📋 TypeScript files changed, running checks..."

# 変更されたファイルが含まれるパッケージを特定
CHANGED_PACKAGES=$(echo "$CHANGED_TS_FILES" | grep -E "^(packages|apps)/" | cut -d'/' -f1-2 | sort -u || true)

if [ -n "$CHANGED_PACKAGES" ]; then
    for pkg_dir in $CHANGED_PACKAGES; do
        if [ -f "$pkg_dir/package.json" ]; then
            PKG_NAME=$(node -p "require('./$pkg_dir/package.json').name" 2>/dev/null || echo "$pkg_dir")
            echo "🔎 Checking $PKG_NAME..."
            
            # 型チェックのみ実行（ビルドより高速）
            if grep -q '"typecheck"' "$pkg_dir/package.json" 2>/dev/null; then
                if ! pnpm --filter "$PKG_NAME" typecheck >/dev/null 2>&1; then
                    echo "❌ Type check failed for $PKG_NAME!"
                    echo "💡 Run 'pnpm --filter $PKG_NAME typecheck' to see detailed errors"
                    exit 1
                fi
            fi
        fi
    done
fi

echo "✅ All build checks passed!"