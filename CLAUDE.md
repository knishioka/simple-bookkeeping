# CLAUDE.md - AIコーディングガイドライン

## 🚨🚨🚨 最重要: 作業ディレクトリの確認 🚨🚨🚨

### ⛔️ 必ず正しいプロジェクトで作業すること

**作業開始前に必ず現在地を確認：**

```bash
pwd  # 必ず最初に実行
# 期待される出力: /Users/ken/Developer/private/simple-bookkeeping
```

**重要な注意事項：**

- このプロジェクトは `simple-bookkeeping` です
- 他のプロジェクト（特に仕事用）に誤って移動しないよう注意
- 作業中は定期的に `pwd` で現在地を確認

**正しい作業ディレクトリに戻る：**

```bash
cd /Users/ken/Developer/private/simple-bookkeeping
```

## 概要

このドキュメントは、AIアシスタント（Claude）が**simple-bookkeeping**プロジェクトのコードを記述・修正する際のガイドラインです。

## 🚀 クイックスタート（AI開発用）

### プロジェクト概要

- **目的**: 日本の個人事業主・中小企業向け複式簿記システム
- **技術**: Next.js 14 (App Router) + TypeScript + Supabase + PostgreSQL
- **構成**: pnpm workspaceによるモノレポ
- **アーキテクチャ**: Supabase + Server Actions によるフルスタック Next.js アプリケーション
- **開発環境**: ローカルSupabase (http://localhost:54321) 必須

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

```

## 🔒 環境変数・シークレット運用ポリシー

- **direnv + env/secrets/** を必ず使用すること  
  `env/secrets/` 配下は `.gitignore` 済み。テンプレートは `env/templates/*.env.example` にあり、初回は `scripts/env-manager.sh bootstrap` で複製する。
- `.env.local` は常に `env/secrets/supabase.<profile>.env` へのシンボリックリンク。プロファイル切替は `scripts/env-manager.sh switch local|prod`、状態確認は `scripts/env-manager.sh current`。
- Supabase / Vercel などの資格情報を新たに取得した場合は、対応する `env/secrets/*.env` に追記し、`direnv reload` で反映。**新しい `.env.*` ファイルを作らないこと**。
- CLI 実行時に一時的に資格情報をエクスポートする場合は、次の形式を守る：
  ```bash
  set -a; source env/secrets/vercel.env; set +a
  vercel whoami   # 例
  ```
  実行ログにトークンを出力しない。必要なら `with_escalated_permissions` 付きでコマンドを呼ぶ。
- Vercel CLI (`vercel`) と Supabase CLI (`supabase`) はこの環境で利用可能。direnv を有効にしておけば必要なトークン／URL が自動で読み込まれるため、`vercel env ls` や `supabase status` などのコマンドを直接実行できる。
- テンプレートの更新が必要な場合は、`env/templates/*.env.example` を修正し、該当するドキュメント（`docs/environment-variables.md`, `env/README.md`など）も併せて更新する。
- セキュリティ上、本番プロファイル (`scripts/env-manager.sh switch prod`) を使用した後は必ず `switch local` に戻す。
- 参考資料: `env/README.md`, `docs/ENVIRONMENT_VARIABLES.md`, `docs/direnv-setup.md` に詳細な手順と背景がまとまっているので都度確認すること。

## 📋 AI開発で最もよく使うコマンド（優先度順）

### 1️⃣ 日常的な開発フロー

```bash
# 開発開始時の必須コマンド
pwd                          # 現在地確認（最重要）
pnpm supabase:start         # Supabase起動
pnpm dev                    # 開発サーバー起動

# コード品質チェック（頻繁に実行）
pnpm lint                   # Lintチェック
pnpm lint:fix              # Lint自動修正
pnpm typecheck             # 型チェック
pnpm test                  # テスト実行
```

### 2️⃣ エラー解決コマンド

```bash
# よくあるエラーの即座解決
pnpm lint:fix              # ESLintエラー自動修正
pnpm format                # Prettierフォーマット
pnpm typecheck --verbose   # 型エラーの詳細確認
pnpm test -- --no-cache    # テストキャッシュクリア
```

### 3️⃣ Push前の必須チェック

```bash
# この順番で実行（絶対にスキップしない）
pnpm lint                  # 1. Lintチェック
pnpm test                  # 2. テスト実行
pnpm --filter web test:e2e # 3. E2Eテスト（重要）
pnpm build                 # 4. ビルド確認
```

### 4️⃣ データベース・インフラ操作

```bash
# Supabase/DB操作
pnpm supabase:start        # Supabase起動
pnpm supabase:stop         # Supabase停止
pnpm db:migrate            # マイグレーション実行
pnpm db:studio             # Prisma Studio起動（GUI）
```

詳細は [npm-scripts-guide.md](./docs/npm-scripts-guide.md) を参照。

## 🏗️ 現在のアーキテクチャ（Supabase中心）

### アーキテクチャ構成

**現在の技術スタック:**

- Next.js 14 App Router + Server Actions (Port 3000)
- Supabase (Database + Auth + RLS)
- PostgreSQL 16
- Prisma ORM (Supabaseデータベースへの接続)
- shadcn/ui + Tailwind CSS

### 環境別Supabase設定

| 環境       | Supabase設定           | URL                              |
| ---------- | ---------------------- | -------------------------------- |
| 開発環境   | ローカルSupabase (CLI) | http://localhost:54321           |
| テスト環境 | Docker Compose版       | http://localhost:54321           |
| 本番環境   | Supabase Cloud         | https://[project-id].supabase.co |

### 実装時の必須ルール

1. **すべての新機能はServer Actionsで実装**
   - `/app/actions/` ディレクトリに配置
   - 例: `app/actions/accounts.ts`

2. **認証は必ずSupabaseを使用**
   - `@supabase/ssr` を使用
   - サーバーコンポーネントでの認証チェック
   - RLS (Row Level Security) ポリシーの活用

3. **データベースアクセス**
   - 優先: Supabase Client経由（新規実装）
   - 暫定: Prisma ORM（既存コードのみ）
   - 今後: 段階的にSupabase Clientへ統一

4. **Supabase起動必須**
   - 開発前に必ず `pnpm supabase:start` を実行
   - または `pnpm supabase:docker` でDocker版を起動
   - 起動確認: http://localhost:54321

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
   - Vercelデプロイメント
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

5. **[Supabaseガイドライン](./docs/ai-guide/supabase-guidelines.md)**
   - Supabase環境設定
   - RLSポリシーの実装
   - Edge Functionsの活用
   - トラブルシューティング

### プロジェクト固有のドキュメント

- [システム構成](./docs/architecture/README.md) - システム構成とポート番号
- [E2Eテストドキュメント](./docs/testing/e2e/) - E2Eテストの実装方法
- [ユーザーストーリーテスト](./docs/user-story-testing-guide.md) - ユーザーストーリーテスト
- [npmスクリプト一覧](./docs/npm-scripts-guide.md) - npmスクリプトの一覧と説明
- [direnvセットアップ](./docs/direnv-setup.md) - direnvを使用した環境変数管理

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

## ⚠️ コミット・Push前の必須チェックリスト

### 実行順序と自動修正コマンド

```bash
# Step 1: Lint（多くは自動修正可能）
pnpm lint
# ↓ エラーがある場合
pnpm lint:fix  # 95%のエラーは自動修正される

# Step 2: 型チェック
pnpm typecheck
# ↓ エラーがある場合は手動修正必須

# Step 3: テスト実行
pnpm test
# ↓ 失敗した場合
pnpm test -- --verbose  # 詳細確認

# Step 4: E2Eテスト（絶対スキップ禁止）
pnpm --filter web test:e2e
# ↓ 失敗した場合
pnpm --filter web test:e2e --headed  # ブラウザ表示で確認

# Step 5: ビルド確認（最終チェック）
pnpm build
```

### ⚡ 一括実行コマンド（時間がない時）

```bash
# すべてのチェックを一度に実行
pnpm lint && pnpm test && pnpm --filter web test:e2e && pnpm build
```

詳細は [テストガイド](./docs/ai-guide/testing-guide.md) を参照。

## ⛔️ 絶対禁止事項（チェック回避は完全禁止）

### pre-commitチェックの回避は一切禁止

**以下の行為は絶対に行わない（CIで自動検出され、ビルドが失敗します）：**

- **SKIP環境変数の使用** - `SKIP=gitleaks`, `SKIP=lint-staged` など一切禁止
- **PRE_COMMIT_ALLOW_NO_CONFIG環境変数の使用** - 完全禁止
- **HUSKY環境変数の無効化** - `HUSKY=0` での回避は禁止
- **git commit --no-verify の使用** - pre-commitフックのスキップは厳禁
- **git commit -n の使用** - `--no-verify`の短縮形も禁止
- **core.hooksPathの変更** - `git -c core.hooksPath=/dev/null commit` は禁止
- **強制プッシュによる回避** - `git push --force` での履歴書き換えは禁止

**Claude Codeへの指示:**
上記のエラーが出た場合、絶対に回避策を探さないこと。
必ず正規の方法（エラーを修正する）で対処すること。

**違反した場合の影響：**

- ローカルでのコミットが即座にブロックされます
- GitHub Actionsでセキュリティチェックが失敗します
- PRがマージ不可能になります
- チーム全体の開発効率に悪影響を与えます

### その他の重要な禁止事項

- **ESLintエラーを無視しない** - `// eslint-disable-next-line` の安易な使用は禁止
- **TypeScriptのany型を使用しない** - 型安全性を必ず保つ
- **テストをスキップしない** - `test.skip` や `describe.skip` は使用禁止
- **サーバー管理** - 修正・開発時は必ずサーバーを落とす

### 問題が発生した場合の正しい対処法

1. **Gitleaksエラー**: 機密情報を完全に削除してからコミット
2. **ESLint警告**: すべての警告を修正（`pnpm lint:fix`で自動修正可能）
3. **Prettierエラー**: `pnpm format`でコード整形
4. **型エラー**: `pnpm typecheck`で確認し、適切な型を付与

## 🛡️ Vercel/Supabase CLIの安全な操作ガイド

### 🎯 基本方針

Claude Codeは以下の原則に従ってCLI操作を実行します：

1. **読み取り専用コマンド**: 自動承認で実行可能
2. **書き込みコマンド**: 必ずユーザー確認後に実行
3. **危険な操作**: 実行を提案しない（ユーザーからの明示的な指示がある場合のみ）

### 📊 Vercel CLI操作の分類

| カテゴリ               | コマンド例                                                                       | 説明                   | Claude Code動作  |
| ---------------------- | -------------------------------------------------------------------------------- | ---------------------- | ---------------- |
| 🟢 安全 (読み取り専用) | `vercel list`, `vercel logs`, `vercel env ls`, `vercel whoami`, `vercel inspect` | 情報の取得のみ         | 自動実行可能     |
| 🟡 注意 (書き込み)     | `vercel env add`, `vercel env rm`, `vercel promote`                              | 設定変更・デプロイ昇格 | ユーザー確認必須 |
| 🔴 危険 (破壊的)       | `vercel remove`, `vercel env rm --all`, `vercel domains rm`                      | プロジェクト削除等     | 実行禁止         |

### 🎯 npm-first アプローチ（推奨）

**基本方針**: Vercel CLIを直接使用せず、環境変数対応のnpmスクリプトを使用します。

#### 利用可能なnpmスクリプト

```bash
# 🟢 よく使うコマンド（環境変数自動読み込み）
pnpm logs:prod              # 本番ログ取得（短縮版）
pnpm vercel:logs:prod       # 本番ログ取得（完全版）
pnpm vercel:list            # デプロイメント一覧
pnpm vercel:status          # デプロイ状況詳細
pnpm deploy:check           # 本番デプロイチェック

# 🔧 既存スクリプト（高度な操作）
./scripts/vercel-tools.sh logs runtime   # ランタイムログ
./scripts/vercel-tools.sh api-status     # API接続確認
./scripts/vercel-tools.sh deployments    # デプロイメント一覧
```

#### 環境変数の自動読み込み

npmスクリプトは自動的に `.env.local` から以下の変数を読み込みます：

```bash
VERCEL_PRODUCTION_URL=https://simple-bookkeeping-jp.vercel.app
VERCEL_PROJECT_NAME=simple-bookkeeping
VERCEL_PROJECT_ID=prj_8BmJYPQwrTpY9WJMBZj94kidtdC5
VERCEL_ORG_ID=team_FYwHyCZFiSA7IWL5AsUe9q7G
VERCEL_TOKEN=<自動取得 or 手動設定>
```

**重要**: direnvを使用すると自動的に環境変数が読み込まれます。

#### 実践例

```bash
# ✅ 推奨: npmスクリプト経由
pnpm logs:prod                  # 本番ログ確認
pnpm vercel:list                # デプロイ一覧

# ⚠️ 直接CLI使用（環境変数が必要）
vercel logs "$VERCEL_PRODUCTION_URL"   # 手動で環境変数指定
vercel list "$VERCEL_PROJECT_NAME"     # 手動で環境変数指定

# ❌ 実行してはいけない操作
vercel remove              # プロジェクト削除
vercel env rm --all        # 全環境変数削除
```

### 🗄️ Supabase CLI操作の分類

| カテゴリ               | コマンド例                                                                             | 説明                       | Claude Code動作  |
| ---------------------- | -------------------------------------------------------------------------------------- | -------------------------- | ---------------- |
| 🟢 安全 (読み取り専用) | `supabase status`, `supabase db dump`, `supabase gen types`, `supabase functions list` | 情報取得・型生成           | 自動実行可能     |
| 🟡 注意 (書き込み)     | `supabase db push`, `supabase migration new`, `supabase functions deploy`              | マイグレーション・デプロイ | ユーザー確認必須 |
| 🔴 危険 (破壊的)       | `supabase db reset`, `supabase projects delete`, `supabase db dump --data-only` (本番) | データベースリセット等     | 実行禁止         |

**重要**: `--dry-run`フラグを活用して事前確認

```bash
# ✅ 安全な操作例
pnpm supabase:status       # Supabase状態確認
supabase gen types typescript --local  # 型定義生成

# ⚠️ 確認が必要な操作例（必ず--dry-run先行）
supabase db push --dry-run  # 変更内容の確認
supabase db push            # マイグレーション適用（確認後）

# ❌ 実行してはいけない操作
supabase db reset          # ローカルDBリセット（全データ削除）
supabase link --project-ref xxx  # 本番プロジェクトへのリンク変更
```

### 🤖 Claude Codeへの指示

**情報収集タスク**:

- Vercel/Supabaseの状態確認やログ取得は積極的に実行
- エラー調査時は`vercel logs error`や`supabase db logs`を使用

**変更タスク**:

1. 変更が必要な場合、まず`--dry-run`で影響を確認
2. ユーザーに変更内容を説明し、承認を求める
3. 承認後に実行、結果を報告

**エラー対処**:

- Vercel: `pnpm logs:prod`でログ確認、`pnpm vercel:status`で状態確認
- Supabase: `pnpm supabase:status`でサービス状態確認
- 環境変数: `pnpm env:validate`で検証
- デプロイメント調査: deployment-investigatorサブエージェントを使用

### 📚 関連ドキュメント

詳細は以下を参照：

- [Supabaseガイドライン](./docs/ai-guide/supabase-guidelines.md)
- [セキュリティとデプロイメント](./docs/ai-guide/security-deployment.md)
- [スクリプトドキュメント](./docs/scripts/README.md)

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

#### ci-investigator (CI失敗調査専門)

**自動呼び出しトリガー:**

- PR作成/更新時のCI失敗
- `/merge-and-pull`コマンドのCI失敗
- `resolve-gh-issue`ワークフローのCI失敗
- デプロイメント前のCI失敗検出

**主な機能:**

- GitHub Actionsステータスの自動チェック
- 失敗ログの詳細解析とエラー分類
- WebSearchによるエラー解決策の検索
- 構造化レポートの生成（優先度付き）
- 既知の問題と新規回帰の区別
- フレーキーテストの検出とスコアリング
- 具体的な修正手順の提供

#### issue-creator (Issue作成専門)

**自動呼び出しトリガー:**

- 新機能実装や大規模変更の計画時
- バグ報告やトラブルシューティング後
- 技術的負債や改善提案の記録時
- フォローアップ作業の必要性検出時

**主な機能:**

- GitHub Issueの自動作成と管理
- 適切なラベル付けと優先度設定
- 関連Issueとの紐付けと参照
- 受け入れ条件の自動生成
- テンプレートに基づいた構造化された内容作成
- プロジェクトボードへの自動追加（設定時）
- 重複Issueの検出と防止

#### deployment-investigator (デプロイメント調査専門)

**自動呼び出しトリガー:**

- デプロイメントの失敗検出時
- 本番環境でのエラー報告時
- 「デプロイメントのログを確認して」という依頼時
- 「本番環境でエラーが出ている」という報告時
- 「Vercelでビルドが失敗した」という報告時

**主な機能:**

- npm scripts経由でのVercel操作（環境変数自動読み込み）
- デプロイメントログの詳細解析とエラー分類
- ビルドエラー、ランタイムエラーの根本原因特定
- WebSearchによるVercel/Next.js固有の問題解決
- 環境変数の自動検証と不整合検出
- 構造化されたデプロイメント調査レポート生成
- 修正手順の具体的な提案

**npm-first アプローチ:**

```bash
# このサブエージェントは以下のnpmスクリプトを優先的に使用
pnpm logs:prod              # 本番ログ取得
pnpm vercel:list            # デプロイメント一覧
pnpm vercel:status          # 詳細ステータス
```

### ベストプラクティス

1. **proactive activation**: サブエージェントは必要に応じて自動的に呼び出されますが、明示的に呼び出すこともできます

   ```
   「code-reviewerエージェントでレビューを実行してください」
   ```

2. **チェーン実行**: 複数のサブエージェントを連携させて品質を向上

   ```
   code-implementer → test-runner → code-reviewer → pre-push-validator

   # CI失敗時の自動フロー
   ci-investigator → auto-fixer → test-runner → pre-push-validator

   # デプロイメント失敗時の自動フロー
   deployment-investigator → auto-fixer → code-reviewer → pre-push-validator
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

### ⚠️ サブエージェントの重要な制限事項

**サブエージェントは他のサブエージェントを呼び出すことができません：**

- サブエージェント内から`Task`ツールを使用して別のサブエージェントを呼び出すことは**不可能**
- 各サブエージェントは独立して動作し、必要な処理はすべて自身で完結させる必要があります
- 複数のサブエージェントの連携が必要な場合は、メインのClaude Codeが調整役となります

**例：**

```typescript
// ❌ サブエージェント内では動作しない
const result = await Task('Run tests', 'テストを実行', 'test-runner');

// ✅ メインのClaude Codeから実行
const codeReview = await Task('Review code', 'レビュー実行', 'code-reviewer');
const testResult = await Task('Run tests', 'テスト実行', 'test-runner');
```

## 🎯 AI開発効率化のためのTips

### よくあるエラーの即座解決

| エラー       | 解決コマンド                    | 説明             |
| ------------ | ------------------------------- | ---------------- |
| ESLintエラー | `pnpm lint:fix`                 | 95%自動修正      |
| 型エラー     | `pnpm typecheck --verbose`      | 詳細確認         |
| テスト失敗   | `pnpm test -- --no-cache`       | キャッシュクリア |
| E2E失敗      | `pnpm test:e2e --headed`        | ブラウザで確認   |
| ポート競合   | `lsof -i :3000` → `kill -9 PID` | プロセス終了     |

### サブエージェント並列実行で高速化

```typescript
// 独立したタスクは並列実行（5倍速）
await Promise.all([Task('code-reviewer'), Task('test-runner'), Task('security-auditor')]);
```

### 開発フロー最適化

1. **開始時**: `pwd` → `pnpm supabase:start` → `pnpm dev`
2. **実装中**: `pnpm lint:fix` で自動修正（頻繁に実行）
3. **コミット前**: 必須チェックリスト実行
4. **PR作成**: `pre-push-validator` エージェント使用

---

**Version**: 2.0 | **最適化**: AI開発特化 | **Project**: simple-bookkeeping
