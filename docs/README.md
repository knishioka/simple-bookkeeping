# Simple Bookkeeping - 日本の確定申告対応複式簿記システム

## 📋 プロジェクト概要

**Simple Bookkeeping** は、日本の確定申告（青色申告）に対応した複式簿記システムです。65万円の青色申告特別控除を受けるために必要な正確な複式簿記での記帳を、誰でも簡単に行えるよう設計されています。

### 🎯 主な特徴

- **複式簿記完全対応**: 借方・貸方の自動バランス検証
- **青色申告対応**: 65万円特別控除に必要な帳簿作成
- **マルチテナント**: 複数の事業者・組織での利用可能
- **現代的技術**: Next.js、TypeScript、Prismaを使用
- **直感的UI**: 日本の会計慣行に準拠したインターフェース

## 🏗️ システム構成

```
Frontend (Next.js 14)  ←→  Backend API (Express.js)  ←→  Database (PostgreSQL)
     Port 3000              Port 3001                    Port 5432 (内部)
```

## 🚀 クイックスタート

### 前提条件
- Node.js 18+
- pnpm
- PostgreSQL 15+

### デモページアクセス（最速）
```bash
# リポジトリクローン
git clone https://github.com/your-username/simple-bookkeeping.git
cd simple-bookkeeping

# 依存関係インストール
pnpm install

# フロントエンド起動（デモページのみ）
pnpm --filter @simple-bookkeeping/web dev
# → http://localhost:3000/demo
```

### 本格セットアップ
```bash
# 環境変数設定
cp .env.example .env
# .envファイルを編集してデータベース接続情報等を設定

# データベースマイグレーション
pnpm --filter @simple-bookkeeping/database db:migrate

# シードデータ投入（オプション）
pnpm --filter @simple-bookkeeping/database db:seed

# 全サービス起動
docker-compose up -d
```

## 📚 主要機能

### 1. 勘定科目管理
- 日本の標準的な勘定科目をプリセット
- カスタム勘定科目の追加・編集
- 勘定科目の階層管理（親子関係）
- コード・名称による検索とフィルタリング

### 2. 仕訳入力
- 複式簿記による正確な仕訳入力
- 借方・貸方の自動バランス検証
- 複数行仕訳対応
- 消費税率の設定と計算
- 証憑番号管理

### 3. 帳票・レポート
- 貸借対照表（BS）の自動生成
- 損益計算書（PL）の自動生成
- 試算表の出力
- 各種帳簿の出力

### 4. 青色申告サポート
- 青色申告決算書対応
- 65万円特別控除要件対応
- 電子帳簿保存法対応準備

## 🎮 デモページ

認証不要でシステムの機能をお試しいただけます：

| ページ | URL | 機能 |
|--------|-----|------|
| デモ概要 | `/demo` | 全機能の概要 |
| 勘定科目管理 | `/demo/accounts` | 勘定科目のCRUD操作 |
| 仕訳入力 | `/demo/journal-entries` | 複式簿記入力体験 |

## 🔧 開発者向け情報

### プロジェクト構造
```
simple-bookkeeping/
├── apps/
│   ├── web/          # Next.js フロントエンド
│   └── api/          # Express.js バックエンド
├── packages/
│   ├── database/     # Prisma スキーマ・マイグレーション
│   ├── shared/       # 共通型定義・バリデーション
│   └── typescript-config/  # TypeScript設定
├── docs/            # ドキュメント
└── scripts/         # ユーティリティスクリプト
```

### 技術スタック

#### フロントエンド
- **Next.js 14**: App Router、Server Components
- **TypeScript**: 完全な型安全性
- **shadcn/ui**: モダンなUIコンポーネント
- **React Hook Form**: フォーム管理
- **Zod**: バリデーション

#### バックエンド
- **Express.js**: RESTful API
- **Prisma**: TypeScript ORM
- **JWT**: 認証・認可
- **bcrypt**: パスワードハッシュ化

#### データベース
- **PostgreSQL 15**: メインデータベース
- **Redis**: セッション管理（オプション）

#### インフラ
- **Docker**: コンテナ化
- **GitHub Actions**: CI/CD
- **pnpm**: モノレポ管理

### 開発コマンド
```bash
# 開発サーバー起動
pnpm dev                    # 全サービス
pnpm --filter web dev       # フロントエンドのみ
pnpm --filter api dev       # バックエンドのみ

# テスト実行
pnpm test                   # 全テスト
pnpm --filter api test      # APIテスト
pnpm --filter web test      # フロントエンドテスト

# ビルド
pnpm build                  # 全ビルド
pnpm --filter web build     # フロントエンドビルド

# 品質チェック
pnpm lint                   # ESLint
pnpm typecheck              # TypeScript型チェック
```

## 📖 ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [実装計画書](./implementation-plan/) | 開発ロードマップ・進捗管理 |
| [システム仕様書](./specifications/) | 詳細な機能仕様 |
| [API仕様書](./api/) | REST API エンドポイント |
| [CLAUDE.md](../CLAUDE.md) | AI開発ガイドライン |
| [SYSTEM-ARCHITECTURE.md](../SYSTEM-ARCHITECTURE.md) | システム構成図 |

## 🔐 セキュリティ

- **JWT認証**: アクセストークン・リフレッシュトークン
- **マルチテナント**: 組織レベルでのデータ分離
- **入力検証**: フロントエンド・バックエンド双方で実施
- **SQLインジェクション対策**: Prisma ORM使用
- **XSS対策**: React自動エスケープ + CSP

## 🌍 国際化・ローカライゼーション

- **日本語UI**: 会計専門用語の正確な翻訳
- **日本の会計基準**: 企業会計原則準拠
- **税法対応**: 消費税、法人税、所得税
- **日付形式**: 和暦・西暦対応

## 📊 パフォーマンス

- **SSR/SSG**: Next.js最適化
- **データベース最適化**: インデックス設計
- **キャッシュ戦略**: Redis + React Query
- **バンドル最適化**: Code Splitting

## 🧪 テスト戦略

- **単体テスト**: Jest + Testing Library
- **統合テスト**: Supertest (API)
- **E2Eテスト**: 主要フロー対応
- **型安全性**: TypeScript 100%カバレッジ

## 🚀 デプロイ

### 開発環境
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 本番環境
```bash
# 環境変数設定
export NODE_ENV=production
export DATABASE_URL=your-production-db-url

# ビルド・デプロイ
pnpm build
docker-compose -f docker-compose.prod.yml up -d
```

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

### 開発ルール
- [CLAUDE.md](../CLAUDE.md) の開発ガイドラインに従う
- TypeScript strict mode使用
- ESLint・Prettierルール遵守
- テストカバレッジ80%以上維持

## 📜 ライセンス

このプロジェクトは MIT ライセンス の下で公開されています。詳細は [LICENSE](../LICENSE) ファイルを参照してください。

## 💡 サポート・お問い合わせ

- **Issue報告**: [GitHub Issues](https://github.com/your-username/simple-bookkeeping/issues)
- **機能要望**: [GitHub Discussions](https://github.com/your-username/simple-bookkeeping/discussions)
- **セキュリティ報告**: security@simple-bookkeeping.com

## 🙏 謝辞

このプロジェクトは以下のオープンソースプロジェクトの恩恵を受けています：
- Next.js
- Prisma
- shadcn/ui
- React Hook Form
- その他すべての依存関係

---

**Simple Bookkeeping** - 日本の中小企業・個人事業主の会計業務を簡単に 📊✨