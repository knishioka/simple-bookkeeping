# Cleanup: Remove backup files and unused code

## 🎯 概要

プロジェクト内に複数のバックアップファイルや未使用のコードが残っており、コードベースの見通しを悪くしています。これらのファイルは混乱を招き、誤って古いコードを参照するリスクがあります。

## 🔍 現状の問題点

### 削除対象ファイル一覧

#### 1. バックアップファイル

| ファイルパス                                                 | 理由                         | サイズ |
| ------------------------------------------------------------ | ---------------------------- | ------ |
| apps/api/src/controllers/journalEntries.controller.ts.backup | 古いバージョンのバックアップ | ~15KB  |

#### 2. 未使用のスクリプト

| ファイルパス                  | 理由                               | 最終使用 |
| ----------------------------- | ---------------------------------- | -------- |
| scripts/render-deploy.sh      | デプロイメントはGitHub Actions経由 | 未使用   |
| scripts/render-post-deploy.sh | post-deployフックは使用していない  | 未使用   |
| scripts/safe-push.sh          | git pushの単純なラッパー（不要）   | 未使用   |
| scripts/update-vercel-env.sh  | Vercel CLIで代替可能               | 未使用   |

#### 3. 重複SQLファイル

| ファイルパス                | 理由             |
| --------------------------- | ---------------- |
| scripts/check-render-db.sql | init-db.shで代替 |
| scripts/init-render-db.sql  | init-db.shで代替 |
| scripts/reset-render-db.sql | init-db.shで代替 |

#### 4. 古い設定ファイル

| ファイルパス                   | 理由                         |
| ------------------------------ | ---------------------------- |
| playwright.config.optimized.ts | playwright.config.tsと重複   |
| .eslintrc.old.js               | 存在する場合、古いESLint設定 |

#### 5. 不要なパッケージディレクトリ

| ディレクトリ     | 理由                                |
| ---------------- | ----------------------------------- |
| packages/errors/ | packages/coreと機能重複（統合予定） |

## 💡 推奨される解決策

### 1. 即座に削除可能なファイル

```bash
# バックアップファイルの削除
rm apps/api/src/controllers/journalEntries.controller.ts.backup

# 未使用スクリプトの削除
rm scripts/render-deploy.sh
rm scripts/render-post-deploy.sh
rm scripts/safe-push.sh
rm scripts/update-vercel-env.sh

# 重複SQLファイルの削除
rm scripts/check-render-db.sql
rm scripts/init-render-db.sql
rm scripts/reset-render-db.sql

# 古い設定ファイルの削除
rm playwright.config.optimized.ts
```

### 2. 段階的な削除（依存関係確認後）

- `packages/errors/` - Issue #1（パッケージ統合）と連携して削除

### 3. Gitignoreの更新

```gitignore
# Backup files
*.backup
*.bak
*.old
*~

# Temporary files
*.tmp
*.temp
.DS_Store
Thumbs.db
```

## 📋 アクセプタンスクライテリア

- [ ] 全てのバックアップファイルが削除されている
- [ ] 未使用のスクリプトが削除されている
- [ ] 重複した設定ファイルが削除されている
- [ ] .gitignoreに適切なパターンが追加されている
- [ ] package.jsonから削除したスクリプトへの参照が削除されている
- [ ] CI/CDパイプラインが正常に動作する
- [ ] ドキュメントから削除したファイルへの参照が更新されている

## 🏗️ 実装ステップ

1. **影響調査**（0.5日）
   - 削除対象ファイルへの参照を検索
   - CI/CDでの使用確認
   - ドキュメントでの言及確認

2. **削除実行**（0.5日）
   - ファイルの削除
   - Git履歴からの削除（必要に応じて）

3. **参照の更新**（1日）
   - package.jsonの更新
   - README.mdの更新
   - その他ドキュメントの更新

4. **検証**（0.5日）
   - ビルドプロセスの確認
   - テストの実行
   - CI/CDパイプラインの確認

## ⏱️ 見積もり工数

- **総工数**: 2.5人日
- **優先度**: High 🔴
- **影響度**: コードベースの整理整頓

## 🏷️ ラベル

- `cleanup`
- `technical-debt`
- `high-priority`
- `quick-win`

## 📊 成功指標

- 不要ファイル数: 0
- プロジェクトサイズの削減: ~5%
- 開発者の混乱リスク: 削減
- コードベースの見通し: 改善

## ⚠️ リスクと考慮事項

- **誤削除のリスク**: 削除前に必ずバックアップを作成
- **隠れた依存**: 一見未使用でも、特定の状況で必要な可能性
- **履歴の保持**: 重要な変更履歴がある場合は、別途記録

## 🔍 削除前チェックリスト

```bash
# 各ファイルが参照されていないか確認
for file in "journalEntries.controller.ts.backup" "render-deploy.sh" "safe-push.sh"; do
  echo "Checking references to $file:"
  grep -r "$file" . --exclude-dir=.git --exclude-dir=node_modules
done

# package.jsonでの参照確認
grep -E "(render-deploy|safe-push|update-vercel-env)" package.json

# CI/CDでの使用確認
grep -r "render-deploy\|safe-push\|update-vercel-env" .github/
```

## 📝 削除後の確認事項

1. `pnpm install` が正常に動作
2. `pnpm build` が成功
3. `pnpm test` が全て通過
4. CI/CDパイプラインが正常動作
5. デプロイメントプロセスに影響なし

## 🗂️ アーカイブ戦略

削除前に以下の方法でアーカイブを検討：

1. 別ブランチに保存（archive/backup-files）
2. タグを付けて履歴を保持
3. 重要なコードスニペットはドキュメント化

## 📚 参考資料

- [Keep a Changelog](https://keepachangelog.com/)
- [Git Clean Command](https://git-scm.com/docs/git-clean)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
