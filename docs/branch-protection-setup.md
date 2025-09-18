# Branch Protection Rules 設定ガイド

## 概要

このドキュメントでは、GitHubリポジトリのBranch Protection Rulesを強化して、
pre-commitチェックの回避を完全に防ぐための設定方法を説明します。

## 設定手順

### 1. GitHub リポジトリ設定へアクセス

1. リポジトリのメインページで「Settings」タブをクリック
2. 左側メニューの「Branches」をクリック
3. 「Add rule」または既存のルールの「Edit」をクリック

### 2. Branch name pattern

- `main` ブランチに適用

### 3. 必須設定項目

#### Protect matching branches

以下のチェックボックスをONにしてください：

- ✅ **Require a pull request before merging**
  - ✅ **Require approvals** (最低1人の承認が必要)
  - ✅ **Dismiss stale pull request approvals when new commits are pushed**
  - ✅ **Require review from CODEOWNERS**

- ✅ **Require status checks to pass before merging**
  - ✅ **Require branches to be up to date before merging**
  - 必須ステータスチェック（以下をすべて追加）：
    - `Secret Detection` (Gitleaks)
    - `Lint Check (Zero Warnings)`
    - `Commit Message Validation`
    - `lint`
    - `typecheck`
    - `test`
    - `e2e-tests`

- ✅ **Require conversation resolution before merging**

- ✅ **Require signed commits** (推奨)

- ✅ **Require linear history**

- ✅ **Include administrators** (管理者も例外なくルールを適用)

#### Rules applied to everyone including administrators

- ✅ **Restrict who can push to matching branches**
  - 特定のユーザー/チームのみプッシュを許可

- ✅ **Restrict who can dismiss pull request reviews**
  - レビューの却下権限を制限

### 4. 追加の推奨設定

#### Bypass pull request requirements を無効化

管理者であってもPRなしでの直接プッシュを禁止します。

#### Force pushes を無効化

履歴の書き換えを防ぎます。

#### Deletions を無効化

ブランチの削除を防ぎます。

## 設定確認コマンド

設定が正しく適用されているか確認：

```bash
# Branch Protection Rulesの確認
gh api repos/:owner/:repo/branches/main/protection

# Required status checksの確認
gh api repos/:owner/:repo/branches/main/protection/required_status_checks
```

## トラブルシューティング

### Q: 設定してもチェックが動作しない

A: 以下を確認してください：

1. GitHub Actionsが有効になっているか
2. ワークフローファイル（`.github/workflows/security-check.yml`）が正しく配置されているか
3. mainブランチへのpushまたはPRでワークフローがトリガーされているか

### Q: 管理者でも回避できないようにしたい

A: 「Include administrators」を必ずONにしてください。これにより管理者もルールの適用対象となります。

## 関連ドキュメント

- [CLAUDE.md](../CLAUDE.md) - AIコーディングガイドライン
- [セキュリティとデプロイメント](./ai-guide/security-deployment.md)
- [GitHub Actions セキュリティチェック](./.github/workflows/security-check.yml)

## 更新履歴

- 2025-09-18: 初版作成 - SKIP環境変数とPRE_COMMIT_ALLOW_NO_CONFIG環境変数の使用を完全禁止するための設定を追加
