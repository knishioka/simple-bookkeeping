# Cleanup: Remove duplicate scripts and consolidate functionality

## 🎯 概要

`/scripts`ディレクトリに多数の重複・類似スクリプトが存在し、保守性の低下とメンテナンスコストの増大を引き起こしています。同じ目的の機能が複数のスクリプトに分散しており、どれを使用すべきか不明確です。

## 🔍 現状の問題点

### 1. ビルドチェック関連の重複

```bash
scripts/
├── check-build.sh           # ビルドチェック
├── check-full-build.sh      # フルビルドチェック（ほぼ同じ機能）
└── prepush-check.sh         # push前チェック（ビルドチェック含む）
```

### 2. デプロイメント監視の重複

```bash
scripts/
├── render-api-status.sh     # Render API状態確認
├── render-status.sh         # Render状態確認（類似機能）
├── render-logs.sh           # Renderログ取得
├── vercel-api-status.sh     # Vercel API状態確認
├── vercel-status.sh         # Vercel状態確認（類似機能）
├── vercel-logs.sh           # Vercelログ取得
└── check-deployments.sh     # 両プラットフォーム確認（統合版）
```

### 3. データベース関連の重複

```bash
scripts/
├── check-render-db.sql      # DB確認用SQL
├── init-render-db.sql       # DB初期化SQL
├── reset-render-db.sql      # DBリセットSQL
└── init-db.sh               # DB初期化スクリプト（SQLと重複）
```

### 4. その他の不要・未使用スクリプト

```bash
scripts/
├── render-deploy.sh         # 使用されていない？
├── render-post-deploy.sh    # 使用されていない？
├── safe-push.sh            # git pushのラッパー（不要？）
└── update-vercel-env.sh    # 環境変数更新（Vercel CLIで代替可能）
```

## 💡 推奨される解決策

### 1. スクリプトの統合と整理

```bash
scripts/
├── build/
│   └── check.sh            # 統合されたビルドチェック
├── deploy/
│   ├── monitor.sh          # 統合されたデプロイメント監視
│   ├── logs.sh            # 統合されたログ取得
│   └── status.sh          # 統合されたステータス確認
├── db/
│   └── manage.sh          # 統合されたDB管理スクリプト
└── git/
    └── hooks/             # Gitフック関連
```

### 2. 削除対象スクリプト

- `check-build.sh` → `check-full-build.sh`に統合
- `render-status.sh` → `render-api-status.sh`に統合
- `vercel-status.sh` → `vercel-api-status.sh`に統合
- `safe-push.sh` → 削除（git pushを直接使用）
- `update-vercel-env.sh` → 削除（Vercel CLIを使用）
- 未使用のデプロイスクリプト → 削除

### 3. package.jsonスクリプトの更新

```json
{
  "scripts": {
    "deploy:check": "scripts/deploy/monitor.sh",
    "deploy:logs": "scripts/deploy/logs.sh",
    "deploy:status": "scripts/deploy/status.sh",
    "build:check": "scripts/build/check.sh",
    "db:manage": "scripts/db/manage.sh"
  }
}
```

## 📋 アクセプタンスクライテリア

- [ ] 重複スクリプトが統合されている
- [ ] 不要なスクリプトが削除されている
- [ ] 残ったスクリプトが適切にディレクトリ分けされている
- [ ] package.jsonのスクリプト定義が更新されている
- [ ] CI/CDパイプラインが正常動作する
- [ ] 各スクリプトにコメントで用途が明記されている
- [ ] README.mdにスクリプト一覧と用途が記載されている

## 🏗️ 実装ステップ

### Phase 1: 分析（0.5日）

1. 各スクリプトの使用状況調査
2. 依存関係の確認
3. CI/CDでの使用箇所確認

### Phase 2: 統合設計（0.5日）

1. 統合後のスクリプト構造設計
2. パラメータ・オプション設計
3. 移行計画作成

### Phase 3: 実装（2日）

1. 新しいディレクトリ構造作成
2. スクリプトの統合・リファクタリング
3. 不要スクリプトの削除
4. package.json更新

### Phase 4: テスト（1日）

1. 各スクリプトの動作確認
2. CI/CDパイプラインのテスト
3. ローカル開発環境での確認

### Phase 5: ドキュメント（0.5日）

1. README.md更新
2. スクリプト使用ガイド作成
3. 移行ガイド作成

## ⏱️ 見積もり工数

- **総工数**: 4.5人日
- **優先度**: High 🔴
- **影響度**: 開発効率とメンテナンス性

## 🏷️ ラベル

- `cleanup`
- `technical-debt`
- `high-priority`
- `developer-experience`

## 📊 成功指標

- スクリプト数が50%以上削減される
- スクリプトの実行時間が改善される
- 新規開発者がスクリプトの用途を理解しやすくなる
- メンテナンスコストが削減される

## ⚠️ リスクと考慮事項

- **CI/CDへの影響**: GitHub ActionsやRender/Vercelの設定更新が必要
- **開発者への周知**: スクリプト変更の周知が必要
- **後方互換性**: 一時的に旧スクリプトへのエイリアスを提供する必要があるかも

## 📝 現在のスクリプト使用状況詳細

### 頻繁に使用されている

- `check-deployments.sh` - デプロイメント確認
- `init-db.sh` - DB初期化
- `render-logs.sh` / `vercel-logs.sh` - ログ確認

### たまに使用される

- `check-full-build.sh` - リリース前の完全ビルドチェック
- `render-api-status.sh` / `vercel-api-status.sh` - API経由の状態確認

### 使用されていない（削除候補）

- `render-deploy.sh`
- `render-post-deploy.sh`
- `safe-push.sh`
- `update-vercel-env.sh`
- SQLファイル（`init-db.sh`で代替）

## 📚 参考資料

- [Shell Script Best Practices](https://google.github.io/styleguide/shellguide.html)
- [Scripts Organization in Monorepos](https://nx.dev/recipes/other/monorepo-automation-scripts)
