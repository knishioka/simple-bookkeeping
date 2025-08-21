# 🚀 セットアップガイド

Simple Bookkeepingプロジェクトの開発環境セットアップ方法を説明します。

## 📦 必要条件

- **Node.js** 18.0.0以上（推奨: 20.0.0以上）
- **pnpm** 8.0.0以上
- **PostgreSQL** 14以上（Docker使用時は不要）
- **Docker & Docker Compose**（オプション）

## ⚡ クイックスタート

```bash
# 1. リポジトリのクローン
git clone https://github.com/knishioka/simple-bookkeeping.git
cd simple-bookkeeping

# 2. 依存関係のインストール
pnpm install

# 3. 環境変数の設定
cp .env.example .env.local
# .env.localを編集して必要な値を設定

# 4. データベースの初期化
pnpm db:init

# 5. 開発サーバーの起動
pnpm dev
```

アプリケーションは以下のURLでアクセス可能：

- Web: http://localhost:3000
- API: http://localhost:3001

## 📋 詳細ガイド

### セットアップ方法別ガイド

- [🐳 Dockerを使用したセットアップ](./docker-setup.md) - 推奨方法
- [💻 ローカル開発環境](./local-development.md) - Dockerを使用しない場合
- [🎯 asdfを使用した環境構築](./setup-with-asdf.md) - バージョン管理ツール使用

### その他のドキュメント

- [🔧 トラブルシューティング](./troubleshooting.md) - よくある問題と解決策
- [🔑 環境変数ガイド](../ENVIRONMENT_VARIABLES.md) - 環境変数の詳細設定

## 🤔 FAQ

### Q: ポートが競合した場合は？

```bash
# .envファイルで変更
WEB_PORT=3010  # デフォルト: 3000
API_PORT=3011  # デフォルト: 3001
```

### Q: データベースをリセットしたい

```bash
# Docker使用時
docker compose down -v
docker compose up -d
pnpm db:init

# ローカル環境
pnpm db:reset
```

### Q: テストデータはありますか？

開発環境では以下のアカウントが利用可能です：

```
Email: admin@example.com
Password: password123
```

## 📧 サポート

問題が解決しない場合は、[GitHub Issues](https://github.com/knishioka/simple-bookkeeping/issues)で報告してください。
