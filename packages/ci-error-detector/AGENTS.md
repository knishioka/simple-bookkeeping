# AGENTS ガイド — `packages/ci-error-detector`

> **適用範囲**: `packages/ci-error-detector` 内（`src/`, `scripts/`, `dist/` など）。他階層に `AGENTS.md` がある場合は近接ルールを優先し、ルートの一般規約も守ってください。

## 1. Overview

- GitHub Actions / CI ログを解析し、失敗原因の分類とサマリを生成するツール群。
- `scripts/github-ci-analyzer.ts` など `tsx` ベースの CLI を同梱。外部 API キーは不要ですが、GitHub Token (`GITHUB_TOKEN`) を利用可能。

## 2. Setup

- ルートで `pnpm install` 済みであれば追加セットアップは不要。
- GitHub API を叩く場合は `GITHUB_TOKEN` を環境変数で設定 (read-only scope で十分)。

## 3. コマンド

| Purpose        | Command                                                              | 備考                                 |
| -------------- | -------------------------------------------------------------------- | ------------------------------------ |
| Build          | `pnpm --filter @simple-bookkeeping/ci-error-detector build`          | `tsc` により `dist/` 生成            |
| Lint           | `pnpm --filter @simple-bookkeeping/ci-error-detector lint`           | ESLint (`src/**/*.{ts,tsx}`)         |
| Test           | `pnpm --filter @simple-bookkeeping/ci-error-detector test`           | Jest                                 |
| Coverage       | `pnpm --filter @simple-bookkeeping/ci-error-detector test:coverage`  | Jest coverage                        |
| Watch          | `pnpm --filter @simple-bookkeeping/ci-error-detector test:watch`     | テスト監視                           |
| Analyze GitHub | `pnpm --filter @simple-bookkeeping/ci-error-detector analyze:github` | `tsx scripts/github-ci-analyzer.ts`  |
| Analyze Logs   | `pnpm --filter @simple-bookkeeping/ci-error-detector analyze:logs`   | `tsx scripts/analyze-github-logs.ts` |
| Clean          | `pnpm --filter @simple-bookkeeping/ci-error-detector clean`          | `rimraf dist`                        |

## 4. Runbook

- **GitHub API Rate Limit**: `GITHUB_TOKEN` を設定しないと 60 リクエスト/時で制限される。PAT を使う際も `repo:read` 権限に留める。
- **tsc 出力先**: `dist/` 配下に CJS を生成。CLI から直接 `src/` を参照しない。
- **ログフォーマット**: CI ログ解析は `.github/workflows/ci.yml` のジョブ名に依存。ジョブ名変更時はスクリプトのマッピングを更新。

## 5. Safety

- GitHub Token をログに出力しない。CLI 実行時は `set +x` (Bash) を活用。
- 外部送信は GitHub API のみ。その他サービスにアップロードする機能は追加しない。

## 6. Do / Don't

- **Do**: 分析ルールはモジュール化 (`src/rules/`) し、ユニットテストでカバレッジを確保。
- **Don't**: `process.exit` を濫用しない。エラーは例外を投げ CLI レイヤーで処理。

## 7. テスト

- 新規ルール追加時は Jest のスナップショットではなく具象データを用いたユニットテストを作成。
- GitHub API モックには `nock` など外部依存を追加しない。HTTP 呼び出しは抽象化し、スタブでテスト。

## 8. 参考

- `.github/workflows/ci.yml` — 対象となるジョブ名。
- `docs/ci/` (存在すれば) — CI 運用ルール。
