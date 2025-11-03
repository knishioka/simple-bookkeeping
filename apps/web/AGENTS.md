# AGENTS ガイド — `apps/web`

> **適用範囲**: `apps/web` ディレクトリ以下（`app/`, `components/`, `lib/`, `e2e/`, `test/`, `supabase/` など）。他ディレクトリに移動する場合は、より近い `AGENTS.md` の指示を優先してください。ルートのガイドラインも併せて遵守します。

## 1. Overview

- Next.js 15 (App Router) + React 19 のフロントエンド。
- UI コンポーネントは `components/`、Server Actions / Route Handlers は `app/(routes)` 直下。
- テスト構成
  - Jest: `__tests__/`, `test/`。
  - Playwright: `e2e/` と `playwright.config.ts`。
  - 共通フィクスチャ: `test-utils/`。
- Supabase クライアント設定は `supabase/` ディレクトリにあり、`packages/supabase-client` と連携。

## 2. Setup

1. ルートで `pnpm install --frozen-lockfile` を実行済みであること。
2. Supabase URL/KEY を `env/.env.local` で解決。最低限 `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が必要。
3. Playwright ブラウザ未導入の場合は `pnpm dlx playwright install --with-deps`。
4. 開発サーバー前に `pnpm supabase:start` でバックエンドを起動するとサインイン周りが安定。

## 3. コマンド

| Purpose        | Command                                                 | 備考                                                        |
| -------------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| Dev server     | `pnpm --filter @simple-bookkeeping/web dev`             | `pnpm dev` でも可 (Turbo)。ポートは `WEB_PORT` で上書き可能 |
| Build          | `pnpm --filter @simple-bookkeeping/web build`           | `NODE_ENV=production next build`                            |
| Start          | `pnpm --filter @simple-bookkeeping/web start`           | 本番モードで起動                                            |
| Lint           | `pnpm --filter @simple-bookkeeping/web lint`            | ESLint `.tsx`/`.ts` 対象。`lint:fix` で自動修正             |
| Typecheck      | `pnpm --filter @simple-bookkeeping/web typecheck`       | `tsc --noEmit`                                              |
| Unit Test      | `pnpm --filter @simple-bookkeeping/web test`            | Jest。`test:watch`, `test:coverage` あり                    |
| E2E (local)    | `pnpm --filter @simple-bookkeeping/web test:e2e`        | Playwright。`TEST_MODE` で挙動変更                          |
| E2E (UI)       | `pnpm --filter @simple-bookkeeping/web test:e2e:ui`     | UI モード                                                   |
| E2E (docker)   | `pnpm --filter @simple-bookkeeping/web test:e2e:docker` | ルート `scripts/test-runner.sh` を使用                      |
| Clean          | `pnpm --filter @simple-bookkeeping/web clean`           | `.next`, `.turbo`, `node_modules` 削除                      |
| Analyze bundle | `pnpm --filter @simple-bookkeeping/web analyze`         | `ANALYZE=true next build`                                   |

## 4. Runbook

- **環境変数不足**: `pnpm env:validate:web` を実行し不足値を特定。Next.js のビルド/Dev で即失敗する。
- **Supabase 接続失敗**: `env/.env.local` の `SUPABASE_SERVICE_ROLE_KEY` などが不要に空の場合は `.env.local.example` を参照し暫定値を設定。
- **Playwright のタイムアウト**: `apps/web/playwright.config.ts` の `timeout` をむやみに変更せず、`TEST_MODE=fast` や対象スペックを限定 (`npx playwright test e2e/auth.spec.ts`) する。
- **Size-Limit チェック**: `pnpm --filter @simple-bookkeeping/web size-limit` (package.json の `size-limit` に従い bundle サイズを検証)。
- **Jest の `next/font` エラー**: `jest.setup.js` にモックを追加する。共通設定更新時は `test/utils` を調整。

## 5. Safety & Permissions

- UI コンポーネントの大幅な再設計は要相談。デザイン体系は `components/ui` の既存パターンを踏襲。
- Supabase Edge Functions や Server Actions のセキュリティ関連変更はレビュアへの ping を必須。
- 新規ページ追加時は Breadcrumb / Navigation を `app/(marketing)` / `app/(dashboard)` の構造に沿って配置。

## 6. Do / Don't

- **Do**: Server Components と Client Components の分離を守り、`'use client'` は必要最小限。Tailwind ではユーティリティクラスを組み合わせ、`cn` ヘルパーを使う。
- **Don't**: ビジネスロジックを `app/` 内にベタ書きせず `lib/` へ切り出す。Playwright で `page.waitForTimeout` を多用しない。

## 7. テスト基準

- UI 変更 → Jest スナップショットを更新し、必要に応じて Playwright シナリオを追加。
- フォーム/バリデーション → `react-hook-form` のユニットテスト (`test/form/`) を更新。
- 認証フロー → `e2e/auth-test.spec.ts` を最低一度ローカルで確認。

## 8. 参考

- `docs/design-system.md` (存在する場合) — UI ガイドライン。
- `docs/testing/playwright.md` — E2E ベストプラクティス。
- 共有型/エラーハンドリングは `packages/shared` を参照。
