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

### フロントエンド

- **Framework**: Next.js 14+ (App Router) + TypeScript
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **State Management**: Zustand + React Query
- **Form Handling**: React Hook Form + Zod
- **Testing**: Jest + React Testing Library + Playwright

### バックエンド

- **Framework**: Express.js + TypeScript
- **Database**: PostgreSQL 15+
- **ORM**: Prisma
- **Authentication**: Passport.js + JWT
- **Testing**: Jest + Supertest

### インフラ・開発環境

- **Container**: Docker & Docker Compose
- **Package Manager**: pnpm (Monorepo)
- **CI/CD**: GitHub Actions
- **Code Quality**: ESLint + Prettier + Husky

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

## 前提条件

- Node.js 20.0.0以上
- pnpm 8.0.0以上
- PostgreSQL 15以上（オプション：Dockerを使用する場合は不要）
- Docker & Docker Compose（オプション）

### 推奨：asdfを使った環境構築

プロジェクトではasdfを使用したバージョン管理を推奨しています。
詳細は[asdfセットアップガイド](./docs/setup-with-asdf.md)を参照してください。

```bash
# asdfがインストール済みの場合
asdf install  # .tool-versionsに基づいて自動でNode.jsとpnpmをインストール
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

### 🏗️ アーキテクチャ・設計

- [システム構成](./SYSTEM-ARCHITECTURE.md) - システム全体のアーキテクチャ
- [システム仕様書](./docs/specifications/system-requirements.md) - 機能要件・非機能要件
- [データモデル仕様書](./docs/specifications/data-model.md) - データベース設計
- [API設計仕様書](./docs/specifications/api-design.md) - RESTful API仕様
- [パッケージ構成](./docs/architecture/package-structure.md) - Monorepo構成

### 🧪 テスト・品質管理

- [E2Eテスト実装ガイド](./docs/e2e-test-implementation.md) - Playwrightテストの詳細
- [ユーザーストーリーテスティング](./docs/user-story-testing-guide.md) - ストーリー駆動テスト
- [フロントエンドテストガイド](./docs/testing/frontend-testing-guide.md) - React Testing Library
- [テストアンチパターン](./docs/testing/testing-antipatterns-and-solutions.md) - よくある問題と解決策

### 📋 開発・運用

- [実装計画](./docs/implementation-plan/roadmap.md) - フェーズ別開発計画
- [技術スタック選定書](./docs/implementation-plan/tech-stack.md) - 技術選定の理由
- [Docker環境構築](./docs/docker-setup.md) - Docker開発環境
- [AIコーディングガイドライン](./CLAUDE.md) - AIアシスタント向けガイド
- [リファクタリング概要](./REFACTORING-SUMMARY.md) - 最新のリファクタリング内容

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
- ✅ 包括的テスト実装（2025年1月）
  - フロントエンドユニットテスト（React Testing Library）
  - E2Eテスト基盤構築（Playwright）
  - ユーザーストーリーベースのテスト
  - パフォーマンス・セキュリティテスト
- 🚧 ユーザー権限管理の詳細化
- 🚧 会計期間管理
- 🚧 仕訳テンプレート機能
- 🚧 CSVインポート・エクスポート機能

詳細は[実装計画](./docs/implementation-plan/roadmap.md)をご覧ください。

## 開発コマンド

### 基本コマンド

```bash
# 開発サーバー起動
pnpm dev

# ビルド
pnpm build

# テスト実行
pnpm test

# Lint実行
pnpm lint

# 型チェック
pnpm typecheck
```

### テストコマンド

```bash
# ユニットテスト
pnpm test:unit

# E2Eテスト（Playwright）
pnpm --filter @simple-bookkeeping/web test:e2e

# E2Eテスト（UIモード）
pnpm --filter @simple-bookkeeping/web test:e2e:ui

# ユーザーストーリーテスト
pnpm --filter @simple-bookkeeping/web test:e2e:stories

# カバレッジレポート
pnpm test:coverage
```

### データベースコマンド

```bash
# マイグレーション実行
pnpm db:migrate

# シード実行
pnpm db:seed

# Prisma Studio起動
pnpm db:studio
```

## テスト戦略

本プロジェクトでは、以下の3層のテスト戦略を採用しています：

1. **ユニットテスト**

   - コンポーネント単体の動作確認
   - React Testing Library使用
   - カバレッジ目標: 80%以上

2. **統合テスト**

   - API連携を含む機能テスト
   - 認証フロー、データ整合性
   - Playwright使用

3. **E2Eテスト**
   - ユーザーストーリーベース
   - 実際の使用シナリオを再現
   - パフォーマンス・アクセシビリティ検証

## ライセンス

[MIT License](./LICENSE)

## コントリビューション

プルリクエストを歓迎します。大きな変更を行う場合は、まずissueを作成して変更内容について議論してください。

## お問い合わせ

- Issue: https://github.com/knishioka/simple-bookkeeping/issues
