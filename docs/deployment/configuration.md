# デプロイメント設定ガイド

## 📋 概要

Vercelのプロジェクト設定管理方法について説明します。

## 🔧 設定方法

### Vercel

#### 方法1: CLIでリンク（推奨）

```bash
vercel link
```

これにより `.vercel/project.json` が自動生成されます。
**注意**: `.vercel` ディレクトリは gitignore されます（公式推奨）。

#### 方法2: 環境変数（CI/CD用）

```bash
export VERCEL_ORG_ID=team_xxxxxxxxxxxxx
export VERCEL_PROJECT_ID=prj_xxxxxxxxxxxxx
```

## 📁 ファイル構造

```
.vercel/
├── project.json     # Vercel CLIが自動生成（gitignore対象）
└── README.txt       # Vercel CLIの説明
```

## 🤝 チーム開発

### 初回セットアップ

1. **リポジトリをクローン**

   ```bash
   git clone https://github.com/user/simple-bookkeeping.git
   cd simple-bookkeeping
   ```

2. **Vercelをリンク**

   ```bash
   vercel link
   # プロンプトに従ってプロジェクトを選択
   ```

### CI/CD環境

GitHub ActionsやCI環境では環境変数を使用：

```yaml
env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

## 🔐 セキュリティ

### gitignore対象

```gitignore
# Vercel（公式推奨）
.vercel
```

### 機密性レベル

- **サービスID**: 低（機密情報ではない）
- **APIトークン**: 高（絶対にコミットしない）
- **データベース接続文字列**: 高（環境変数で管理）

## 📝 設定の優先順位

スクリプトは以下の順序で設定を読み込みます：

1. **環境変数**（最優先）
2. **設定ファイル**（`.vercel/project.json`）
3. **エラー**（どちらも見つからない場合）

## 💡 推奨事項

### ローカル開発

- `.vercel/project.json` を使用（Vercel）

### CI/CD

- 環境変数を使用

### オープンソース

- READMEにセットアップ手順を記載
- `.example` ファイルを提供
- 環境変数の使用を推奨

## 🚀 スクリプトの使い方

すべてのスクリプトは環境変数と設定ファイルの両方をサポート：

```bash
# 設定ファイルを使用（デフォルト）
pnpm vercel:status

# 混在も可能
export VERCEL_TOKEN=xxxxx  # 認証は環境変数
# プロジェクトIDは .vercel/project.json から
pnpm vercel:status
```
