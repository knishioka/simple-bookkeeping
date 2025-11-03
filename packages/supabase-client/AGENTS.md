# AGENTS ガイド — `packages/supabase-client`

> **適用範囲**: `packages/supabase-client` 以下（`src/`, `scripts/`, `dist/`）。他ディレクトリに移動する際は近接する `AGENTS.md` を優先し、ルートルールも遵守してください。

## 1. Overview

- Next.js / React 用の Supabase クライアントラッパーと型定義を提供。
- `tsup` でバンドルし、CJS/ESM/Types を `dist/` に出力。
- Supabase プロジェクト ID / サービスキーなどは direnv 管理。ハードコード禁止。

## 2. Setup

1. ルートで依存インストール後、`pnpm --filter @simple-bookkeeping/database prisma:generate` を行い Prisma 型と整合を取る。
2. Supabase CLI が必要 (`pnpm dlx supabase --version` で確認)。ローカルに未インストールなら `pnpm exec supabase` が実行されるよう PATH を整備。
3. 型生成コマンドを実行する場合は `SUPABASE_PROJECT_ID` と `SUPABASE_ACCESS_TOKEN` を環境変数経由で注入。

## 3. コマンド

| Purpose           | Command                                                               | Notes                                                    |
| ----------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| Build             | `pnpm --filter @simple-bookkeeping/supabase-client build`             | `tsup` により `dist/` を生成                             |
| Dev (watch)       | `pnpm --filter @simple-bookkeeping/supabase-client dev`               | `tsup --watch`                                           |
| Typecheck         | `pnpm --filter @simple-bookkeeping/supabase-client typecheck`         | `tsc --noEmit`                                           |
| Lint              | `pnpm --filter @simple-bookkeeping/supabase-client lint`              | ESLint                                                   |
| DB migrate helper | `pnpm --filter @simple-bookkeeping/supabase-client db:migrate`        | `tsx scripts/migrate.ts`。Supabase DB へ直接適用、要承認 |
| Generate Types    | `pnpm --filter @simple-bookkeeping/supabase-client db:generate-types` | `supabase gen types`。`SUPABASE_PROJECT_ID` 必須         |
| Clean             | `pnpm --filter @simple-bookkeeping/supabase-client clean`             | `dist` を削除                                            |

## 4. Runbook

- **型生成が失敗 (`Missing SUPABASE_PROJECT_ID`)**: direnv で `SUPABASE_PROJECT_ID` をエクスポート。`.env.local` を確認。
- **`supabase` CLI 権限不足**: `supabase login` でアクセストークンを設定。ただしトークンは `env/secrets/supabase.*.env` から読み込む。
- **tsup のバンドル差異**: `tsup.config.ts` がないため `package.json` の `tsup` デフォルトに依存。CommonJS/ESM 両対応を維持するため `export` 文を調整し、Node.js API を直接参照しない。

## 5. Safety

- Supabase プロジェクトへ直接書き込む操作 (`db:migrate`, `db:generate-types`) は本番環境での実行前に承認を得る。
- サービスロールキー等をコードやログに出さない。`.gitignore` で守られているか常に確認。

## 6. Do / Don't

- **Do**: HTTP/Supabase 呼び出しを `src/client.ts` 等に集約し、Apps からは高水準 API のみ利用。
- **Don't**: `fetch` などブラウザ API に依存するロジックをサーバー側モジュールに混在させない。`isServer` チェックを活用。

## 7. テスト

- 現状ユニットテストは未定義。重要なロジック追加時は `vitest` ではなく Jest を想定。必要に応じ `pnpm --filter @simple-bookkeeping/supabase-client test` スクリプトを追加 (事前に相談)。

## 8. 参考

- `docs/supabase/README.md` — Supabase プロジェクト運用。
- `apps/web/supabase/` — 実際の利用例。
