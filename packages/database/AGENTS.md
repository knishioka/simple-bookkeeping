# AGENTS ガイド — `packages/database`

> **適用範囲**: `packages/database` 配下（`prisma/`, `src/`, `scripts/` 等）。他フォルダーに移動する場合は、該当ディレクトリの `AGENTS.md` を優先し、最終的にはルートガイドに従ってください。

## 1. Overview

- Prisma Schema (`prisma/schema.prisma`) とマイグレーション、シードロジック (`prisma/seed.ts`) を管理するワークスペース。
- 生成物は `dist/` と `.prisma`。`pnpm build:packages` や CI の Prisma generate ステップから利用されます。
- DB 接続文字列は `DATABASE_URL`。ローカルは `postgres://postgres:postgres@localhost:5432/simple_bookkeeping_dev` (direnv 管理) を想定。

## 2. Setup

1. ルートで `pnpm install --frozen-lockfile` を実施。Prisma CLI や TypeScript がワークスペースにインストールされます。
2. PostgreSQL/Supabase を起動 (`pnpm supabase:start` または `docker compose -f docker-compose.supabase-test.yml up -d`).
3. schema 変更後は `pnpm --filter @simple-bookkeeping/database prisma:generate` を必ず実行。

## 3. コマンド

| Purpose          | Command                                                      | 備考                                                 |
| ---------------- | ------------------------------------------------------------ | ---------------------------------------------------- |
| Build            | `pnpm --filter @simple-bookkeeping/database build`           | `rm -rf dist && tsc`                                 |
| Generate Client  | `pnpm --filter @simple-bookkeeping/database prisma:generate` | `node_modules/.bin/prisma generate`                  |
| Migrate (dev)    | `pnpm --filter @simple-bookkeeping/database db:migrate`      | `prisma migrate dev`。新規マイグレーション作成       |
| Migrate (deploy) | `pnpm --filter @simple-bookkeeping/database db:migrate:prod` | 本番適用用。ローカルでは `DATABASE_URL` を慎重に設定 |
| Seed             | `pnpm --filter @simple-bookkeeping/database db:seed`         | `tsx prisma/seed.ts`                                 |
| Prisma Studio    | `pnpm --filter @simple-bookkeeping/database db:studio`       | `prisma studio`                                      |
| Typecheck        | `pnpm --filter @simple-bookkeeping/database typecheck`       | `tsc --noEmit`                                       |
| Lint             | `pnpm --filter @simple-bookkeeping/database lint`            | ESLint。`lint:fix` で修正                            |
| Clean            | `pnpm --filter @simple-bookkeeping/database clean`           | 成果物と `node_modules` を削除                       |

## 4. Runbook

- **Migration naming**: `pnpm --filter @simple-bookkeeping/database prisma migrate dev --name add-ledger-table` のようにケバブケースで命名。
- **Schema drift 警告**: 既存マイグレーションを編集せず、新しいマイグレーションを作成。
- **`P3005` エラー (マイグレーション失敗)**: DB をリセット (`pnpm supabase:docker:down && pnpm supabase:docker`) または `prisma migrate reset`。リセットは **ローカルのみ** 許可。
- **Seed 更新**: シードデータは本番と同期させない。テスト用 ID は `packages/test-utils` に合わせて定義。
- **型生成**: Prisma Client 型は `.prisma/client` に出力される。`packages/supabase-client` の型と競合しないようエクスポート整理。

## 5. Safety

- マイグレーションファイルの削除・改変は要承認。リネームも禁止。
- `DATABASE_URL` を `.env` にベタ書きしない。direnv と `env/secrets/*.env` を利用。
- Seed 内で秘密情報を生成しない。テスト用途の固定値のみ使用。

## 6. Do / Don't

- **Do**: Prisma `@@index` / `@@unique` を適切に設定し、`prisma format` (VSCode Prisma 拡張) を併用。
- **Don't**: マイグレーションを手動で SQL 編集しない (必要な場合は `supabase/` プロジェクト側で管理)。

## 7. テスト

- Prisma schema 変更時は `pnpm test` (ルート) で関連 Jest テストが通ることを確認。
- 重要なデータアクセス関数にはユニットテストを追加 (`src/__tests__`)。必要なら `pnpm --filter @simple-bookkeeping/database test` を作成検討。

## 8. 参考

- `docs/database/migrations.md` — 運用ガイド。
- `supabase/README.md` — Supabase CLI プロジェクトの利用法。
- ルート `AGENTS.md` の Safety ルールを遵守。
