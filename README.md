# Simple Bookkeeping - 日本の確定申告対応複式簿記システム

## 概要

Simple Bookkeepingは、日本の確定申告（青色申告）に対応した複式簿記システムです。個人事業主や小規模事業者が簡単に帳簿管理と確定申告書類の作成ができることを目的としています。

## 主な機能

- 複式簿記による仕訳入力
- 貸借対照表（BS）・損益計算書（PL）の自動生成
- 青色申告決算書の作成
- e-Tax形式でのデータ出力
- 消費税計算（10%、軽減税率8%対応）
- 各種帳簿の管理（仕訳帳、総勘定元帳、現金出納帳など）

## 技術スタック

- Frontend: Next.js 14+ (App Router) + TypeScript
- Backend: Express.js + TypeScript
- Database: PostgreSQL 15+
- ORM: Prisma
- Styling: Tailwind CSS + shadcn/ui
- Testing: Jest + Playwright
- Container: Docker & Docker Compose
- Package Manager: pnpm (Monorepo)

## プロジェクト構成

```
simple-bookkeeping/
├── apps/
│   ├── web/              # Next.js フロントエンド
│   └── api/              # Express.js バックエンド
├── packages/
│   ├── database/         # Prismaスキーマとマイグレーション
│   ├── types/            # 共通型定義
│   ├── errors/           # エラーハンドリング
│   ├── shared/           # 共有ユーティリティ
│   └── typescript-config/# 共通TypeScript設定
└── docs/                 # ドキュメント
```

## セットアップ

### Docker環境（推奨）

```bash
# リポジトリのクローン
git clone https://github.com/knishioka/simple-bookkeeping.git
cd simple-bookkeeping

# 環境変数の設定
cp .env.docker .env

# Dockerコンテナの起動
pnpm docker:up

# データベースの初期化
docker-compose exec api pnpm -F @simple-bookkeeping/database db:migrate
docker-compose exec api pnpm -F @simple-bookkeeping/database db:seed
```

アプリケーションは以下のURLでアクセス可能です：

- Web: http://localhost:3000
- API: http://localhost:3001

### ローカル環境

```bash
# リポジトリのクローン
git clone https://github.com/knishioka/simple-bookkeeping.git
cd simple-bookkeeping

# 依存関係のインストール
pnpm install

# 環境変数の設定
cp .env.example .env

# PostgreSQLの起動（別途インストールが必要）
# データベースのセットアップ
pnpm db:migrate
pnpm db:seed

# 開発サーバーの起動
pnpm dev
```

### ポート設定

デフォルトのポートが使用中の場合、`.env`ファイルで変更できます：

```bash
# .env
WEB_PORT=3010  # デフォルト: 3000
API_PORT=3011  # デフォルト: 3001
```

## ドキュメント

- [システム仕様書](./docs/specifications/system-requirements.md)
- [データモデル仕様書](./docs/specifications/data-model.md)
- [API設計仕様書](./docs/specifications/api-design.md)
- [実装計画](./docs/implementation-plan/roadmap.md)
- [技術スタック選定書](./docs/implementation-plan/tech-stack.md)
- [パッケージ構成](./docs/architecture/package-structure.md)
- [システム構成](./SYSTEM-ARCHITECTURE.md)
- [リファクタリング概要](./REFACTORING-SUMMARY.md)
- [AIコーディングガイドライン](./CLAUDE.md)

## 現在の開発状況

### Phase 1 (基本機能) - 完了 ✅
- ✅ 技術スタック選定とプロジェクトセットアップ
- ✅ データベース設計と実装
- ✅ 認証・認可システムの実装
- ✅ 基本的なUIコンポーネントの作成
- ✅ 勘定科目マスタ管理機能
- ✅ 仕訳入力機能
- ✅ 仕訳帳・総勘定元帳の実装
- ✅ 基本的な財務諸表の作成

### Phase 2 (拡張機能) - 開発中 🚧
- ✅ 複数組織対応（マルチテナント機能）
- ✅ 補助簿機能の実装
  - 現金出納帳
  - 預金出納帳
  - 売掛金・買掛金台帳
- ✅ 財務諸表のフロントエンド実装
  - 貸借対照表（B/S）
  - 損益計算書（P/L）
  - 試算表
- ✅ 包括的リファクタリング実施（2025年1月）
  - 共通コンポーネント・フックの抽出
  - 型定義の一元管理（@simple-bookkeeping/types）
  - エラーハンドリングの統一（@simple-bookkeeping/errors）
- 🚧 ユーザー権限管理の詳細化
- 🚧 会計期間管理
- 🚧 仕訳テンプレート機能
- 🚧 CSVインポート・エクスポート機能

詳細は[実装計画](./docs/implementation-plan/roadmap.md)をご覧ください。

## ライセンス

[MIT License](./LICENSE)

## コントリビューション

プルリクエストを歓迎します。大きな変更を行う場合は、まずissueを作成して変更内容について議論してください。

## お問い合わせ

- Issue: https://github.com/knishioka/simple-bookkeeping/issues