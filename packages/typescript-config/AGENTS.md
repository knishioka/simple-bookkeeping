# AGENTS ガイド — `packages/typescript-config`

> **適用範囲**: `packages/typescript-config` に含まれる TypeScript 設定ファイル (`base.json`, `nextjs.json`, `node.json`, `react-library.json` 等)。

## 1. Overview

- 各ワークスペースが継承する共通 TSConfig テンプレートを提供。
- 実行時のビルドやテストはなく、JSON 設定のみを管理。

## 2. Setup

- ルートで `pnpm install` を実施済みなら追加操作は不要。
- 設定変更時は該当パッケージで `pnpm typecheck` を再実行して影響を確認。

## 3. 編集ガイド

- `base.json` は全体のデフォルト。破壊的変更は慎重に検討し、PR で影響ワークスペースを列挙。
- `nextjs.json` / `react-library.json` / `node.json` は個別環境向けの拡張。不要な設定は削除せずコメントで理由を説明。
- ESLint や Jest と互換が必要な場合は `compilerOptions.types` を更新し、依存するワークスペースの `tsconfig.json` を確認。

## 4. Safety

- `extends` の相互参照に注意。循環参照を作らない。
- `skipLibCheck` を無効化する場合は全ワークスペースで型エラーが発生しないか事前に `pnpm typecheck` を実行。

## 5. Do / Don't

- **Do**: 変更理由をコメントまたは PR 説明に明記し、必要なら `docs/typescript-guidelines.md` に追記。
- **Don't**: `resolveJsonModule` や `moduleResolution` をプロジェクト間で矛盾させない。既定値を尊重。

## 6. テスト

- 設定変更後はルートで `pnpm lint` と `pnpm typecheck` を実行し、全ワークスペースが通ることを確認。

## 7. 参考

- ルート `tsconfig.base.json` — 基本設定。
- ルート `AGENTS.md` — 共通ポリシー。
