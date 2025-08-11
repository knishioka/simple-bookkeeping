#!/bin/bash

# GitHub Labels Setup Script for Simple Bookkeeping
# This script creates a comprehensive set of labels for issue management

echo "🏷️  Simple Bookkeeping - GitHubラベルセットアップ"
echo "================================================"

# カラーコード定義
COLOR_BUG="d73a4a"           # Red
COLOR_ENHANCEMENT="a2eeef"   # Light Blue
COLOR_FEATURE="0e8a16"       # Green
COLOR_DOC="0075ca"          # Blue
COLOR_TEST="bfd4f2"         # Light Purple
COLOR_REFACTOR="d4c5f9"     # Purple
COLOR_PERFORMANCE="f9d0c4"   # Light Pink
COLOR_SECURITY="b60205"      # Dark Red
COLOR_PRIORITY_CRITICAL="b60205"  # Dark Red
COLOR_PRIORITY_HIGH="d73a4a"      # Red
COLOR_PRIORITY_MEDIUM="fbca04"    # Yellow
COLOR_PRIORITY_LOW="0e8a16"       # Green
COLOR_STATUS="c5def5"        # Light Purple
COLOR_BLOCKED="d73a4a"       # Red
COLOR_REVIEW="fbca04"        # Yellow
COLOR_READY="0e8a16"         # Green
COLOR_AREA="1d76db"          # Blue variants
COLOR_PLATFORM="5319e7"      # Purple
COLOR_DEPS="0366d6"          # Dark Blue

# ラベル作成関数
create_label() {
  local name=$1
  local color=$2
  local description=$3
  
  # ラベルの存在確認
  if gh label list --json name | jq -r '.[].name' | grep -q "^${name}$"; then
    echo "  ✓ $name (既存)"
  else
    if gh label create "$name" --color "$color" --description "$description" 2>/dev/null; then
      echo "  ✅ $name - $description (作成完了)"
    else
      echo "  ❌ $name - 作成失敗"
    fi
  fi
}

# 確認プロンプト
echo ""
echo "このスクリプトは以下を実行します："
echo "1. プロジェクトに必要なGitHubラベルを作成"
echo "2. 既存のラベルはスキップ"
echo ""
echo "続行しますか？ (y/N): "
read -r response

if [[ ! "$response" =~ ^[Yy]$ ]]; then
  echo "キャンセルしました"
  exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📌 基本カテゴリラベル"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
create_label "bug" "$COLOR_BUG" "不具合・バグ"
create_label "enhancement" "$COLOR_ENHANCEMENT" "機能改善・既存機能の向上"
create_label "feature" "$COLOR_FEATURE" "新機能の追加"
create_label "documentation" "$COLOR_DOC" "ドキュメントの追加・更新"
create_label "test" "$COLOR_TEST" "テスト関連（追加・修正）"
create_label "refactor" "$COLOR_REFACTOR" "コードのリファクタリング"
create_label "performance" "$COLOR_PERFORMANCE" "パフォーマンス改善"
create_label "security" "$COLOR_SECURITY" "セキュリティ関連"
create_label "chore" "fef2c0" "雑務・メンテナンス作業"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚡ 優先度ラベル"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
create_label "priority: critical" "$COLOR_PRIORITY_CRITICAL" "緊急対応が必要"
create_label "priority: high" "$COLOR_PRIORITY_HIGH" "優先度高（1週間以内）"
create_label "priority: medium" "$COLOR_PRIORITY_MEDIUM" "優先度中（1ヶ月以内）"
create_label "priority: low" "$COLOR_PRIORITY_LOW" "優先度低（急がない）"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 ワークフローステータス"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
create_label "follow-up" "$COLOR_STATUS" "フォローアップが必要"
create_label "blocked" "$COLOR_BLOCKED" "他のタスクやリソースでブロック中"
create_label "needs review" "$COLOR_REVIEW" "レビュー待ち"
create_label "ready to merge" "$COLOR_READY" "マージ準備完了"
create_label "in progress" "1d76db" "作業中"
create_label "needs discussion" "cc317c" "議論が必要"
create_label "wip" "ffffff" "Work In Progress"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏗️ 技術領域"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
create_label "frontend" "7057ff" "フロントエンド（Next.js/React）"
create_label "backend" "006b75" "バックエンド（Express/API）"
create_label "database" "b60205" "データベース（PostgreSQL/Prisma）"
create_label "ci/cd" "$COLOR_PLATFORM" "CI/CD・自動化"
create_label "deps" "$COLOR_DEPS" "依存関係の更新"
create_label "infrastructure" "0052cc" "インフラストラクチャ"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 機能エリア（Simple Bookkeeping固有）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
create_label "area: auth" "$COLOR_AREA" "認証・認可機能"
create_label "area: accounting" "0052cc" "会計・簿記機能"
create_label "area: journal" "2188b6" "仕訳入力機能"
create_label "area: reports" "24a0b6" "レポート・帳票機能"
create_label "area: ui/ux" "7057ff" "UI/UXデザイン"
create_label "area: api" "006b75" "API設計・実装"
create_label "area: e2e" "17a2b8" "E2Eテスト"
create_label "area: audit" "5319e7" "監査ログ機能"
create_label "area: settings" "795548" "設定・管理機能"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "☁️ プラットフォーム"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
create_label "platform: vercel" "000000" "Vercel関連"
create_label "platform: render" "46E3B7" "Render関連"
create_label "platform: github" "24292e" "GitHub Actions関連"
create_label "platform: local" "666666" "ローカル開発環境"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "👥 コミュニティ・サポート"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
create_label "good first issue" "7057ff" "初心者向けの課題"
create_label "help wanted" "008672" "助けを求めています"
create_label "question" "d876e3" "質問"
create_label "duplicate" "cfd3d7" "重複"
create_label "invalid" "e4e669" "無効"
create_label "wontfix" "ffffff" "修正しない"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 プロジェクト管理"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
create_label "epic" "3E4B9E" "エピック（大規模機能）"
create_label "milestone" "FEF2C0" "マイルストーン"
create_label "breaking change" "d73a4a" "破壊的変更"
create_label "release" "00FF00" "リリース関連"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ 完了！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "作成されたラベルは以下のコマンドで確認できます："
echo "  gh label list"
echo ""
echo "特定のラベルでIssueを検索："
echo "  gh issue list --label \"bug\""
echo "  gh issue list --label \"priority: high\""
echo ""