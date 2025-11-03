# AGENTS ガイド（ルート）

> **適用範囲 / Scope**  
> この文書はリポジトリ直下と、その配下に個別の `AGENTS.md` が存在しないすべてのディレクトリに適用されます。`apps/` や `packages/` など各ワークスペースにはローカル版 `AGENTS.md` を配置しており、**近接する階層が優先**されます。作業対象ファイルと同じかより深いフォルダーに `AGENTS.md` がある場合は必ずそちらの指示に従ってください。

---

## 1. Overview / プロジェクト概要

- **目的 / Purpose**  
  青色申告に対応した日本向け複式簿記 SaaS。Next.js (App Router) を中心に、Prisma + Supabase/PostgreSQL をバックエンドに採用しています。
- **モノレポ構成 / Monorepo Layout**  
  Turborepo + pnpm ワークスペースでアプリ (`apps/*`) とライブラリ (`packages/*`) を管理します。共通 TypeScript 設定は `tsconfig.base.json` / `packages/typescript-config` に集約。
- **主要ディレクトリ**
  - `apps/web` — Next.js 15 / React 19。UI、API Route、Playwright E2E が含まれる。個別ガイドは `apps/web/AGENTS.md`。
  - `packages/database` — Prisma schema と DB ツール。`schema.prisma`、`prisma/` 配下のシードやマイグレーションを管理。ローカルガイドあり。
  - `packages/shared` — 共通ユーティリティ、監視、バリデーション。
  - `packages/supabase-client` — Supabase クライアントと型生成。
  - `packages/config` — 共有設定。`dist` を生成するだけの軽量パッケージ。
  - `packages/ci-error-detector` — CI ログ解析ツール群。
  - `packages/test-utils` — Playwright/Jest 共通テスト補助。
  - `docs/` — 詳細ドキュメント（環境変数、運用 Runbook、設計ノート等）。
  - `scripts/` — bash/tsx 製のユーティリティ。CI で再利用されるものも含む。
  - `supabase/` — Supabase CLI プロジェクト。SQL マイグレーションや Edge Functions。
  - `env/` — direnv と連携する秘密情報テンプレート。**機密ファイルはコミット禁止**。
- **技術スタック**
  - 言語: TypeScript / Node.js 20+。
  - ビルド: Turborepo、Next.js、tsup、tsc。
  - テスト: Jest、Playwright、Prisma Test DB。
  - CI: GitHub Actions (`CI`, `security-check`, `dependency-check`, `workflow-validation`)。

---

## 2. Setup / セットアップ手順

1. **Node.js & pnpm**
   - Node 20.x (`.nvmrc` は存在しないため `fnm`/`nvm` で 20 系を使用)。
   - pnpm 10 (`packageManager` フィールド参照)。`corepack enable` 後に `corepack prepare pnpm@10.12.3 --activate` を推奨。
2. **依存インストール**
   ```bash
   pnpm install --frozen-lockfile
   ```

   - CI と同じく lockfile 固定。ワークスペース全体で 1 度実行すれば各パッケージにリンクされます。
3. **direnv / 環境変数**
   - `direnv allow` をプロジェクトルートで実行。
   - テンプレート複製: `bash scripts/env-manager.sh bootstrap`。
   - プロファイル切替: `bash scripts/env-manager.sh switch local`。
   - 具体的な変数説明は `docs/ENVIRONMENT_VARIABLES.md` と `env/README.md` を参照。
4. **Supabase (任意)**
   - CLI でローカル起動: `pnpm supabase:start`。停止は `pnpm supabase:stop`。Docker 版は `pnpm supabase:docker`。
   - ブラウザ未インストールの場合は Playwright が失敗するため `pnpm dlx playwright install` を別途実行。
5. **Prisma Client 再生成**
   - スキーマ変更後は `pnpm --filter @simple-bookkeeping/database prisma:generate`。
   - マイグレーション適用: `pnpm db:migrate`（全体）または `pnpm --filter @simple-bookkeeping/database db:migrate`。
6. **Git hooks**
   - `pnpm install` 時に Husky が有効化。個別スキップは禁止（`scripts/build-tools.sh` がプリチェック実行）。
7. **VSCode 推奨設定**
   - 拡張機能: ESLint、Prettier、Prisma、Tailwind CSS IntelliSense。
   - `settings.json` で `editor.formatOnSave` 有効化。

---

## 3. Build / Lint / Typecheck / Test / E2E コマンド一覧

| Category              | Scope          | Command                          | Notes                                                                   |
| --------------------- | -------------- | -------------------------------- | ----------------------------------------------------------------------- |
| Install               | 全体           | `pnpm install --frozen-lockfile` | 変更検知時は常に lockfile 固定で再実行                                  |
| Dev Server            | Web            | `pnpm dev`                       | Turborepo 経由で `apps/web` を起動。ポート競合は `pnpm dev:check-ports` |
| Build (all)           | 全体           | `pnpm build`                     | パッケージ → アプリの順に `turbo run build`                             |
| Build (packages only) | ライブラリ     | `pnpm build:packages`            | CI でも使用。Prisma client 生成が前提                                   |
| Build (web)           | フロントエンド | `pnpm build:web`                 | Next.js 本番ビルド。環境変数 `NEXT_PUBLIC_SUPABASE_*` を要求            |
| Typecheck             | 全体           | `pnpm typecheck`                 | 各ワークスペースの `tsc --noEmit` を集約                                |
| Lint                  | 全体           | `pnpm lint`                      | 既定は緩め。CI は `pnpm lint:strict` を利用                             |
| Lint (strict)         | 全体           | `pnpm lint:strict`               | ESLint `--max-warnings 0`。Prettier チェックは別途                      |
| Format Check          | 全体           | `pnpm format:check`              | 対象: `**/*.{ts,tsx,js,jsx,json,md}`                                    |
| Unit Test             | 全体           | `pnpm test`                      | Turborepo 経由で Jest テストを実行                                      |
| Unit Test (watch)     | 全体           | `pnpm test:watch`                | 開発用                                                                  |
| Coverage              | 全体           | `pnpm test:coverage`             | Jest カバレッジ                                                         |
| E2E (Playwright)      | Web            | `pnpm test:e2e`                  | `apps/web` の `playwright.config.ts` を使用                             |
| E2E (Docker)          | Web+Supabase   | `pnpm test:e2e:docker`           | `scripts/test-runner.sh e2e-docker`。CI と同等                          |
| Smoke DB              | Supabase       | `pnpm db:init`                   | ローカル DB 初期化スクリプト                                            |
| Env Validation        | 全体           | `pnpm env:validate`              | `.env` 漏れを検知                                                       |
| Security Audit        | 全体           | `pnpm security:check`            | `pnpm audit --audit-level high` + `pnpm outdated`                       |

補足:

- 各 `packages/*` や `apps/web` にもローカルコマンド（`pnpm --filter` または `cd`）が定義されています。詳細は該当フォルダーの `AGENTS.md` を参照。
- `pnpm check:all` は依存監査・型チェック・インポート検証を一括実行します。

---

## 4. Runbook / トラブルシューティング

### 4.1 よくあるエラー

1. **`prisma` コマンドが失敗する (`P1001` 接続エラー)**
   - PostgreSQL が起動していない可能性。`docker compose -f docker-compose.supabase-test.yml up -d` または `pnpm supabase:start` で再起動。
   - `DATABASE_URL` が `direnv` から読み込まれているか `direnv status` で確認。
2. **Playwright テストがブラウザ未インストールで失敗**
   - `pnpm dlx playwright install --with-deps` を 1 度実行。CI の `install-playwright` オプションが false なのでローカルでのみ必要。
3. **Next.js ビルド時に環境変数不足 (`NEXT_PUBLIC_SUPABASE_URL` 等)**
   - `env/.env.local` (シンボリックリンク) に値が存在するか確認。テンプレートは `env/templates/.env.local.example`。
   - `pnpm env:validate:web` で不足チェック。
4. **`turbo` がキャッシュミスで古い成果物を参照**
   - `pnpm clean && rm -rf .turbo` でキャッシュクリア。CI では `pnpm build:check` が存在。
5. **`husky` によりコミットが拒否される (`❌ チェック回避は禁止されています`)**
   - `SKIP` や `HUSKY=0` 等の環境変数を使わず `pnpm precommit:check` を通過させること。
   - 必要に応じ `pnpm lint`, `pnpm typecheck`, `pnpm test -- --runTestsByPath <file>` を個別実行。

### 4.2 データベース

- ローカル DB は Docker Compose (`docker-compose.supabase-test.yml`) を利用。CI と同じ postgres:16。
- マイグレーション作成は `cd packages/database && pnpm prisma migrate dev --name <desc>`。生成後は `prisma generate` を忘れずに。
- Supabase Edge Functions 更新時は `supabase functions deploy <name>` だが、本番向け操作は **要承認**（後述）。

### 4.3 ログ / モニタリング

- `pnpm vercel:logs` / `pnpm vercel:logs:prod` で Vercel ログ確認（`.env.local` に API トークンが必要）。
- CI 失敗調査は `packages/ci-error-detector` にある `pnpm --filter @simple-bookkeeping/ci-error-detector analyze:github` を使用。GitHub Token は環境変数 `GITHUB_TOKEN` で注入。

### 4.4 Docker & Supabase

- `pnpm docker:up` / `pnpm docker:down` でローカルスタック制御。コンテナ掃除は `pnpm test:e2e:docker:clean`。
- `pnpm supabase:docker:logs` で Supabase サービスのログ確認。
- `scripts/test-runner.sh` は `apps/web/playwright.config.ts` に依存。変更時はスクリプトへの影響を確認。

---

## 5. Safety & Permissions / 操作ガバナンス

- **許可済み (No approval required)**
  - コード/ドキュメントの閲覧。
  - 単一ファイルのフォーマット、リンティング、型チェック、単体テスト実行。
  - ドキュメント追加・修正、Issue や PR のドラフト作成。
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` 等の標準タスク。
- **要承認 (Approval required)**
  - 依存パッケージの追加・更新、lockfile 改変。
  - 大規模なリネーム、削除、ディレクトリ構造変更。
  - Prisma / Supabase / DB マイグレーションの作成・適用 (本番影響がある場合)。
  - E2E 全量 (`pnpm test:e2e:comprehensive` など) の長時間実行。
  - Vercel / Supabase など外部環境へのデプロイ、スクリプトの本番実行。
- **禁止 (Prohibited)**
  - API キーや秘密情報のコミット、共有、ログ出力。
  - 不要な外部サービスへのデータ送信。
  - 承認なしのロックファイル削除、新規依存の追加。

---

## 6. Do / Don't

- **Do**
  - 小さな差分でのコミット、再現性のあるコマンド (`pnpm` / `turbo`) のみ使用。
  - `docs/` に既存ノウハウがある場合はリンクや引用を行い重複を避ける。
  - TypeScript 型を `@simple-bookkeeping/typescript-config` に合わせて厳格化。`zod` スキーマと DTO を同期。
  - Playwright テストでは共通フィクスチャ (`apps/web/test-utils/fixtures.ts`) を活用。
  - Prisma 変更時は `docs/database/` の運用ルールを確認し、変更理由を PR に明記。
- **Don't**
  - React クラスコンポーネントの追加（Hooks + Server Components を優先）。
  - 既存ユーティリティの再実装。`packages/shared` / `packages/test-utils` を探索する。
  - 直接 `.env` を複製・配置する行為。`env/secrets/*.env` のテンプレート経由で管理。
  - `any` の乱用、ESLint ルールの無効化 (`eslint-disable`) を多用すること。
  - CI 設定 (`.github/workflows`) の変更は合意なしに行わない。

---

## 7. PR / CI Rules

- **ブランチ命名**: `{type}/{slug}` (例: `feat/add-ledger-import`)。ドキュメントのみは `docs/`、バグ修正は `fix/`。  
  Release 向けタスクは `chore/` を使用。
- **コミット規約**: Conventional Commits (`feat: ...`, `fix: ...`, `docs: ...`)。CI は `docs: ...` も許容。
- **PR テンプレート**: 概要、スクリーンショット (UI 変更時)、テスト結果を記載。Supabase/DB 変更は `DATABASE_URL` やマイグレーションについて説明。
- **必須チェック (Branch Protection)**: GitHub Actions `CI` ワークフローの以下ジョブが成功している必要があります。
  - `Lint`
  - `Type Check`
  - `Test`
  - `Build Verification`
  - `CI Status` (上記ジョブの集約)
- **補助チェック**: `security-check`, `security-audit`, `dependency-check`, `workflow-validation`。失敗時は原因調査とリトライ。
- **PR 更新時のローカル前提**: マージ前に `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` を実行し結果を PR へ記載。
- **レビュー要件**: 少なくとも 1 名の承認。DB/セキュリティ影響は担当レビュアに確認。

---

## 8. 受入基準 / Definition of Done

1. 必須 CI (`CI` ワークフロー) がすべて緑。特に `Lint`, `Type Check`, `Test`, `Build Verification`, `CI Status`。
2. 対応する追加チェック (`security-check`, `dependency-check`, etc.) が失敗していない。失敗時は原因と対応策を PR 説明に記載。
3. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` をローカルまたは開発環境で実行し、問題がないことを確認。実行不能な場合は理由 (環境制限) を PR に明示。
4. 環境変数や秘密情報がコミットされていない (`git status --ignored` で確認)。
5. ドキュメントやコードの変更範囲に応じて適切なテスト（Jest/Playwright/Prisma）が追加または更新されている。
6. UI 変更時はスクリーンショットまたは動画を PR に添付。
7. DB 変更時はロールバック方法と影響範囲を PR に記述。

---

## 9. 参考資料 / References

- `README.md` — プロジェクト概要、技術選定。
- `docs/ENVIRONMENT_VARIABLES.md`, `docs/direnv-setup.md` — 環境変数・direnv 手順。
- `docs/DEVELOPMENT.md` — 開発フロー詳細 (存在する場合に参照)。
- `docs/testing/` — テスト戦略。Jest, Playwright のパターン。
- `docs/database/` — Prisma / Supabase の schema 運用。
- `.github/workflows/` — CI 設定とジョブ定義。
- `scripts/` — 自動化スクリプトと CLI。

---

このルートガイドを起点に、該当するサブディレクトリの `AGENTS.md` を併読してください。疑問点は Issue / Discussion に記録し、再発防止につながる Runbook への追記を検討してください。
