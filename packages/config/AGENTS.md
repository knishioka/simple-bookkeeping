# AGENTS ガイド — `packages/config`

> **適用範囲**: `packages/config` ディレクトリ内の作業全般。より深い階層で別 `AGENTS.md` が追加された場合はその指示を優先し、ルートガイドラインと整合させてください。

## 1. Overview

- シンプルな TypeScript ベースの設定集 (`src/` → `dist/`)。ビルド成果物を他ワークスペースが import。
- 依存はほぼゼロ。TypeScript のみを利用。

## 2. Setup

- ルートで `pnpm install` 済みであれば追加依存は不要。
- 設定値はコードにハードコードされるが、秘密情報は含めない。

## 3. コマンド

| Purpose | Command                                          | 備考                                  |
| ------- | ------------------------------------------------ | ------------------------------------- |
| Build   | `pnpm --filter @simple-bookkeeping/config build` | `tsc` 実行                            |
| Clean   | `pnpm --filter @simple-bookkeeping/config clean` | `dist`, `tsconfig.tsbuildinfo` を削除 |

## 4. Runbook

- **新規設定の追加**: 名前空間ごとにファイルを分割 (`src/env.ts`, `src/feature-flags.ts` 等)。
- **破壊的変更**: 依存先 (`apps/web`, `packages/shared`) の import パスを検索し、PR 説明で変更点を列挙。

## 5. Safety

- 秘密情報を追加しない。API キー等は `env/secrets` に留め、ここにはデフォルト値やキー名のみ記載。
- モジュールの公開 API (`package.json` の `exports`) を勝手に変更しない。必要時はレビュアと相談。

## 6. Do / Don't

- **Do**: `src/index.ts` から公開する値を再輸出し、型定義を付与。
- **Don't**: アプリケーションロジックを追加しない。純粋な定数/設定のみに限定。

## 7. テスト

- 現状テストは不要。将来的に複雑化する場合は Jest 追加を検討。

## 8. 参考

- ルート `AGENTS.md` の Safety & Permissions を参照。
