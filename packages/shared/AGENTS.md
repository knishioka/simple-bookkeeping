# AGENTS ガイド — `packages/shared`

> **適用範囲**: このファイルは `packages/shared`（`src/`, `dist/`, `__tests__/` など）に適用されます。より深い階層に追加の `AGENTS.md` ができた場合はそちらを優先し、ルートガイドの一般ルールも遵守してください。

## 1. Overview

- 共通ユーティリティ、ロガー、監視 (Prometheus)、スキーマ (Zod) を提供するパッケージ。
- 出力は `dist/`。`packages/config`・`apps/web` 等から利用されるため、破壊的変更は十分に検討。
- Jest を利用したユニットテスト (`jest.config` はルート共有設定を参照)。

## 2. Setup

- ルートでの `pnpm install` で依存が揃います。
- Redis 連携ユーティリティ使用時は `REDIS_URL` などが必要。ローカル検証は Docker Redis を起動 (`docker run -p 6379:6379 redis:7`)。

## 3. コマンド

| Purpose   | Command                                                  | 備考                                    |
| --------- | -------------------------------------------------------- | --------------------------------------- |
| Build     | `pnpm --filter @simple-bookkeeping/shared build`         | `rm -rf dist && tsc`                    |
| Lint      | `pnpm --filter @simple-bookkeeping/shared lint`          | `eslint . --ext .ts`                    |
| Test      | `pnpm --filter @simple-bookkeeping/shared test`          | Jest (`--passWithNoTests`)              |
| Coverage  | `pnpm --filter @simple-bookkeeping/shared test:coverage` | Jest coverage                           |
| Typecheck | `pnpm --filter @simple-bookkeeping/shared typecheck`     | `tsc --noEmit`                          |
| Clean     | `pnpm --filter @simple-bookkeeping/shared clean`         | `dist`, `node_modules`, `.turbo` を削除 |

## 4. Runbook

- **Zod スキーマ更新**: API や Supabase と整合するよう `packages/database` の Prisma モデルと併せて確認。型の破壊的変更はメジャー更新扱い。
- **Logger**: `src/logger` は Winston ベース。新規トランスポート追加時は `docs/logging.md` (存在すれば) に追記。
- **Monitoring**: `prom-client` を利用。メトリクス名は `simple_bookkeeping_*` prefix を付ける。
- **テストでの Redis Mock**: `redis-mock` は導入していないため、`vi.spyOn` や抽象化された `createRedisClient` をモック化。

## 5. Safety

- 外部サービス接続情報をハードコードしない。環境変数またはパラメータで受け取る。
- 共有モジュールでの breaking change は各利用先に通知し、PR 説明に `BREAKING CHANGE:` を記載。

## 6. Do / Don't

- **Do**: ファイルは機能ごとに分割し、`index.ts` で公開 API を整理。
- **Don't**: `console.log` の直接使用。Winston ラッパー経由でログを出力。

## 7. テスト基準

- 新規ユーティリティ追加時は成功/失敗ケースを Jest でカバー。
- 監視関連はラベルやメトリクス名を固定値で検証。

## 8. 参考

- `docs/shared-modules.md` (存在すれば) — 共通モジュール一覧。
- ルート `AGENTS.md` の Do/Don't を再確認。
