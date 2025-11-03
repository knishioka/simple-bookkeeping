# AGENTS ガイド — `packages/test-utils`

> **適用範囲**: `packages/test-utils` 以下（`src/`, `dist/`, `credentials/` など）。近接する `AGENTS.md` があればそちらを優先し、最終的にはルートのルールに従ってください。

## 1. Overview

- Playwright / Jest 共通のテスト支援ライブラリ。
- テストユーザーの資格情報生成や Supabase セッションのモック機能を提供。

## 2. Setup

- ルートでの `pnpm install` と `pnpm test` で自動的に利用されるため個別セットアップは不要。
- JWT などシークレット値は環境変数から取得する設計に統一。`packages/database` のシードと同期が必要。

## 3. コマンド

| Purpose   | Command                                                  | 備考           |
| --------- | -------------------------------------------------------- | -------------- |
| Build     | `pnpm --filter @simple-bookkeeping/test-utils build`     | `tsc`          |
| Typecheck | `pnpm --filter @simple-bookkeeping/test-utils typecheck` | `tsc --noEmit` |
| Clean     | `pnpm --filter @simple-bookkeeping/test-utils clean`     | `dist` 削除    |

## 4. Runbook

- **資格情報の変更**: `src/credentials/` と `packages/database` のシード値を同時に更新。Playwright テスト (`apps/web/e2e`) で利用する `.env` テンプレートも確認。
- **JWT 署名**: `jsonwebtoken` を使用。`JWT_SECRET` は direnv から供給。テスト専用値 (`TEST_JWT_SECRET`) を利用。
- **Playwright 連携**: `apps/web/test-utils` との重複を避け、共通ロジックはこのパッケージへ集約。

## 5. Safety

- 実在ユーザー情報を入れない。ランダム生成値のみ使用。
- 秘密情報をサンプル値としてもコミットしない。テスト専用値は `docs/testing/test-accounts.md` など参照。

## 6. Do / Don't

- **Do**: テストユーティリティは純粋関数として実装。状態共有が必要な場合はフィクスチャ生成関数を提供。
- **Don't**: アプリケーション本体から直接 import されるようなロジック (ビジネスロジック) を配置しない。

## 7. テスト

- 自身のユーティリティにテストを追加する場合は Jest を利用する想定。必要に応じ `test` スクリプト追加を検討。

## 8. 参考

- `docs/testing/` — テスト戦略。
- `apps/web/playwright.config.ts` — Playwright 側の設定。
