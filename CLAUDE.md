# CLAUDE.md - AIコーディングガイドライン

## 概要

このドキュメントは、AIアシスタント（Claude）が本プロジェクトのコードを記述・修正する際のガイドラインをまとめたものです。一貫性のある高品質なコードを維持するために、以下のルールに従ってください。

## 🚀 クイックスタート

### プロジェクト概要

- **目的**: 日本の個人事業主・中小企業向け複式簿記システム
- **技術**: Next.js 14 (App Router) + TypeScript + Supabase + PostgreSQL
- **構成**: pnpm workspaceによるモノレポ
- **アーキテクチャ**: Server Actions を使用したフルスタック Next.js アプリケーション

### 重要なディレクトリ構造

```
apps/web/                 # Next.js フルスタックアプリケーション (port: 3000)
├── app/
│   ├── actions/         # Server Actions (ビジネスロジック)
│   │   ├── accounts.ts
│   │   ├── journal-entries.ts
│   │   └── reports.ts
│   ├── (auth)/         # 認証ページ
│   ├── dashboard/      # ダッシュボード
│   └── layout.tsx
├── components/
│   └── ui/            # shadcn/ui コンポーネント
└── lib/
    └── supabase.ts    # Supabase クライアント

packages/
├── database/          # Prisma スキーマ (@simple-bookkeeping/database)
└── shared/           # 共有ユーティリティ (@simple-bookkeeping/shared)

[廃止予定]
apps/api/             # Express.js API (移行中につき使用禁止)
packages/types/       # 型定義 (TypeScript推論で代替)
packages/errors/      # エラー定義 (Server Actions内で定義)
```

### よく使うコマンド

```bash
# 開発サーバー起動
pnpm dev                     # Next.js開発サーバー起動
pnpm --filter web dev        # 同上（互換性のため残存）

# ビルド
pnpm build                   # 全体ビルド
pnpm build:web              # Vercel用Webアプリビルド

# テスト実行
pnpm test                    # 全テスト
pnpm test:e2e               # E2Eテスト
pnpm test:coverage          # カバレッジ付きテスト

# 問題のあるテストの確認
pnpm test:failing           # 失敗した8つのテストのみ実行
pnpm test:accounting        # 会計期間管理のテスト
pnpm test:audit            # 監査ログのテスト
pnpm test:demo             # デモページのテスト

# サービス状態確認
pnpm health                 # Web/APIサービスの状態確認
pnpm health:services       # HTTP応答確認
# pnpm health:api は削除されました（Express.js API廃止済み）

# DB操作
pnpm db:init                # DB初期化（マイグレーション＋シード）
pnpm db:migrate             # マイグレーション
pnpm db:studio              # Prisma Studio

# デプロイメント監視
pnpm deploy:check           # 両プラットフォーム状態確認
pnpm render:logs runtime    # Renderログ確認
pnpm vercel:logs build      # Vercelビルドログ確認
```

詳細は [npm-scripts-guide.md](./docs/npm-scripts-guide.md) を参照してください。

## ⚠️ アーキテクチャ移行中の注意事項

### 現在進行中の移行

**From (現在):**

# Express.js APIサーバーは廃止されました

- Next.js フロントエンド (Port 3000)
- JWT認証
- Prisma ORM

**To (移行先):**

- Next.js Server Actions のみ
- Supabase (Database + Auth)
- Row Level Security (RLS)
- Edge Functions (必要に応じて)

### 実装時の重要な指針

1. **新機能はServer Actionsで実装**
   - `/app/actions/` ディレクトリに配置
   - Express.js APIは使用しない
   - 例: `app/actions/accounts.ts`

2. **認証はSupabaseを使用**
   - JWT認証コードは追加しない
   - `@supabase/ssr` を使用
   - サーバーコンポーネントでの認証チェック

3. **データベースアクセス**
   - 新規: Supabase Client経由
   - 既存: Prisma (移行までの暫定)

## 📚 詳細ガイドライン

プロジェクトの詳細なガイドラインは、以下の専門ドキュメントに分割されています：

### 必読ドキュメント

1. **[コーディング規約](./docs/ai-guide/coding-standards.md)**
   - TypeScript/React のコーディング規約
   - Server Actions設計パターン
   - コード品質の厳格なルール
   - Git コミット規約

2. **[セキュリティとデプロイメント](./docs/ai-guide/security-deployment.md)**
   - 機密情報の取り扱い
   - セキュリティ対策とGitleaks
   - Vercel/Renderデプロイメント
   - ビルドチェックの重要性

3. **[テストガイド](./docs/ai-guide/testing-guide.md)**
   - テスト記述規約
   - E2Eテスト実装の教訓
   - Push前の必須手順
   - サーバー起動時の確認事項

4. **[トラブルシューティングと実装例](./docs/ai-guide/troubleshooting-examples.md)**
   - よくある問題と解決策
   - GitHub Issue/PR管理
   - Server Actions実装例
   - 継続的な改善

### プロジェクト固有のドキュメント

- [システム構成](./docs/architecture/README.md) - システム構成とポート番号
- [E2Eテストドキュメント](./docs/testing/e2e/) - E2Eテストの実装方法
- [ユーザーストーリーテスト](./docs/user-story-testing-guide.md) - ユーザーストーリーテスト
- [npmスクリプト一覧](./docs/npm-scripts-guide.md) - npmスクリプトの一覧と説明
- [direnvセットアップ](./docs/direnv-setup.md) - direnvを使用した環境変数管理
- [デプロイメントガイド](./docs/deployment/) - デプロイメントガイド

### API仕様（廃止予定）

**注意: 以下のExpress.js APIエンドポイントは廃止予定です。新規実装ではServer Actionsを使用してください。**

- ~~認証エンドポイント: `/api/v1/auth/*`~~ → Supabase Auth
- ~~勘定科目: `/api/v1/accounts`~~ → Server Actions
- ~~仕訳: `/api/v1/journal-entries`~~ → Server Actions
- ~~レポート: `/api/v1/reports/*`~~ → Server Actions

### データベーススキーマ

```bash
# スキーマ確認
cat packages/database/prisma/schema.prisma

# ER図生成
pnpm --filter @simple-bookkeeping/database prisma:studio
```

## 🔐 最重要：機密情報の取り扱い

### 絶対にコミットしてはいけないもの

**以下の情報は絶対にGitリポジトリにコミットしない：**

- APIキー、トークン、シークレット
- データベースの接続情報
- JWT秘密鍵
- OAuth クライアントシークレット
- Vercelトークン、AWSアクセスキー
- その他のクレデンシャル情報

**適切な管理方法：**

```bash
# ❌ Bad: ファイルに直接記載
const API_KEY = "sk-1234567890abcdef";

# ✅ Good: 環境変数から読み込み
const API_KEY = process.env.API_KEY;
```

詳細は [セキュリティとデプロイメント](./docs/ai-guide/security-deployment.md) を参照してください。

## ⚠️ Push前の必須確認事項

以下の手順を**必ず順番通りに実行**してからpushすること：

1. **Lint チェック**

   ```bash
   pnpm lint
   # エラーがある場合は修正してから次へ
   ```

2. **Unit Test 実行**

   ```bash
   pnpm test
   # 全てのテストが通ることを確認
   ```

3. **E2E Test 実行（絶対にスキップしない）**

   ```bash
   pnpm --filter web test:e2e
   # ローカルでE2Eテストが全て通ることを確認
   # 失敗した場合は必ず修正してから再実行
   ```

4. **最終ビルド確認**
   ```bash
   pnpm build
   # ビルドエラーがないことを確認
   ```

詳細は [テストガイド](./docs/ai-guide/testing-guide.md) を参照してください。

## 重要な注意事項

- **pre-commitフックを無視しない** - `git commit --no-verify` は厳禁
- **ESLintエラーを無視しない** - `// eslint-disable-next-line` の安易な使用は禁止
- **TypeScriptのany型を使用しない** - 型安全性を必ず保つ
- **テストをスキップしない** - `test.skip` や `describe.skip` は使用禁止
- **サーバー管理** - 修正・開発時は必ずサーバーを落とす

## 🤖 サブエージェント自動呼び出し設定

Claude Codeの専門サブエージェントは、特定の条件下で自動的に呼び出されます。以下のガイドラインに従って効率的な開発を実現してください。

### 利用可能なサブエージェント

#### code-reviewer (コードレビュー専門)

**自動呼び出しトリガー:**

- 50行以上のコード変更後
- Server Actions, APIエンドポイントの実装後
- セキュリティ関連コード（認証、権限、暗号化）の変更後
- データベーススキーマの変更後

**主な機能:**

- WebSearchによる最新のセキュリティベストプラクティスの取得
- OWASP Top 10に基づくセキュリティレビュー
- パフォーマンス最適化の提案
- アクセシビリティ（WCAG 2.1）チェック

#### code-implementer (実装専門)

**自動呼び出しトリガー:**

- GitHub Issueの解決時（`resolve-gh-issue`ワークフロー）
- 新機能の実装依頼時
- 大規模なリファクタリング時

**主な機能:**

- WebSearchによるライブラリドキュメントの参照
- 実装パターンとベストプラクティスの自動適用
- 既存コードベースとの一貫性維持
- エラー解決策の自動検索

#### test-runner (テスト実行専門)

**自動呼び出しトリガー:**

- 新機能実装の完了後
- バグ修正の完了後
- リファクタリング後
- PR作成前

**主な機能:**

- Unit/Integrationテストの作成と実行
- E2Eテストの実行
- カバレッジレポートの生成
- テスト失敗の自動修正提案

#### pre-push-validator (品質保証専門)

**自動呼び出しトリガー:**

- `git commit`前
- PR作成前
- デプロイメント前

**主な機能:**

- ESLint/Prettierチェック
- TypeScript型チェック
- ビルド成功確認
- セキュリティ脆弱性スキャン

#### auto-fixer (自動修正専門)

**自動呼び出しトリガー:**

- Lintエラー検出時
- 軽微なバグ検出時
- コードレビュー指摘の修正時

**主な機能:**

- Lintエラーの自動修正
- 型エラーの修正提案
- インポート文の整理
- コードフォーマットの統一

### ベストプラクティス

1. **proactive activation**: サブエージェントは必要に応じて自動的に呼び出されますが、明示的に呼び出すこともできます

   ```
   「code-reviewerエージェントでレビューを実行してください」
   ```

2. **チェーン実行**: 複数のサブエージェントを連携させて品質を向上

   ```
   code-implementer → test-runner → code-reviewer → pre-push-validator
   ```

3. **WebSearch活用**: サブエージェントは自動的にWebSearchを使用して最新情報を取得
   - フレームワーク固有のベストプラクティス
   - セキュリティ脆弱性情報
   - パフォーマンス最適化技術
   - 非推奨APIの代替案

### 設定のカスタマイズ

プロジェクト固有のニーズに応じて、`.claude/agents/`ディレクトリにカスタムエージェント定義を配置できます：

```yaml
# .claude/agents/custom-reviewer.agent.md
---
name: custom-reviewer
description: プロジェクト固有のレビュー基準でコードを評価
tools: [Read, Grep, WebSearch, TodoWrite]
model: opus
---
```

## important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.
