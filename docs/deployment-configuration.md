# デプロイメント設定ガイド

## 📋 概要

VercelとRenderのプロジェクト設定管理方法について説明します。

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

### Render

#### 方法1: 設定ファイル（現在の実装）

```bash
# .render/services.json をコピーして編集
cp .render/services.json.example .render/services.json
```

**注意**: これはカスタム実装で、公式サポートではありません。

#### 方法2: 環境変数

```bash
export RENDER_SERVICE_ID=srv-xxxxxxxxxxxxx
export RENDER_DB_ID=dpg-xxxxxxxxxxxxx
```

## 📁 ファイル構造

```
.vercel/
├── project.json     # Vercel CLIが自動生成（gitignore対象）
└── README.txt       # Vercel CLIの説明

.render/
├── services.json         # カスタム設定ファイル（gitignore対象）
└── services.json.example # テンプレート（git管理）
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

3. **Render設定**
   ```bash
   cp .render/services.json.example .render/services.json
   # エディタで実際のサービスIDに更新
   ```

### CI/CD環境

GitHub ActionsやCI環境では環境変数を使用：

```yaml
env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
  RENDER_SERVICE_ID: ${{ secrets.RENDER_SERVICE_ID }}
```

## 🔐 セキュリティ

### gitignore対象

```gitignore
# Vercel（公式推奨）
.vercel

# Render（カスタム）
.render/services.json
```

### 機密性レベル

- **サービスID**: 低（機密情報ではない）
- **APIトークン**: 高（絶対にコミットしない）
- **データベース接続文字列**: 高（環境変数で管理）

## 📝 設定の優先順位

スクリプトは以下の順序で設定を読み込みます：

1. **環境変数**（最優先）
2. **設定ファイル**（`.vercel/project.json`, `.render/services.json`）
3. **エラー**（どちらも見つからない場合）

## 💡 推奨事項

### ローカル開発

- `.vercel/project.json` を使用（Vercel）
- `.render/services.json` を使用（Render）

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
pnpm render:status
pnpm vercel:status

# 環境変数を使用
export RENDER_SERVICE_ID=srv-xxxxx
pnpm render:status

# 混在も可能
export VERCEL_TOKEN=xxxxx  # 認証は環境変数
# プロジェクトIDは .vercel/project.json から
pnpm vercel:status
```
