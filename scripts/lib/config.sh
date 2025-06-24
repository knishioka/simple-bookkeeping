#!/bin/bash

# 設定を環境変数または設定ファイルから読み込むヘルパー関数

# Vercel設定を取得
get_vercel_config() {
    # 環境変数が設定されていればそれを使用
    if [ -n "$VERCEL_PROJECT_ID" ] && [ -n "$VERCEL_ORG_ID" ]; then
        echo "Using Vercel config from environment variables" >&2
        PROJECT_ID="$VERCEL_PROJECT_ID"
        ORG_ID="$VERCEL_ORG_ID"
    # .vercel/project.jsonがあればそれを使用
    elif [ -f ".vercel/project.json" ]; then
        echo "Using Vercel config from .vercel/project.json" >&2
        PROJECT_ID=$(cat .vercel/project.json | jq -r '.projectId')
        ORG_ID=$(cat .vercel/project.json | jq -r '.orgId')
    else
        echo "Error: Vercel project not configured" >&2
        echo "Run 'vercel link' or set VERCEL_PROJECT_ID and VERCEL_ORG_ID" >&2
        return 1
    fi
    
    export PROJECT_ID
    export ORG_ID
}

# Render設定を取得
get_render_config() {
    # 環境変数が設定されていればそれを使用
    if [ -n "$RENDER_SERVICE_ID" ]; then
        echo "Using Render config from environment variables" >&2
        SERVICE_ID="$RENDER_SERVICE_ID"
        DB_ID="${RENDER_DB_ID:-}"
    # .render/services.jsonがあればそれを使用
    elif [ -f ".render/services.json" ]; then
        echo "Using Render config from .render/services.json" >&2
        SERVICE_ID=$(cat .render/services.json | jq -r '.services.api.id')
        DB_ID=$(cat .render/services.json | jq -r '.databases.postgres.id // empty')
    else
        echo "Error: Render service not configured" >&2
        echo "Set RENDER_SERVICE_ID or create .render/services.json" >&2
        return 1
    fi
    
    export SERVICE_ID
    export DB_ID
}

# 使用例を表示
if [ "$1" = "--help" ]; then
    cat << EOF
Configuration Helper Functions

Usage:
  source scripts/lib/config.sh
  get_vercel_config
  get_render_config

Environment Variables (optional):
  VERCEL_PROJECT_ID    - Vercel project ID
  VERCEL_ORG_ID        - Vercel organization/team ID
  RENDER_SERVICE_ID    - Render service ID
  RENDER_DB_ID         - Render database ID

The functions will prefer environment variables if set,
otherwise fall back to configuration files.
EOF
fi