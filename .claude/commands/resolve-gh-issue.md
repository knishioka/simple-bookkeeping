---
name: resolve-gh-issue
description: GitHub Issueの解決を自動化し、標準的な開発ワークフローを実行します
allowed-tools:
  - gh
  - Task
  - TodoWrite
  - Bash
  - Edit
  - MultiEdit
  - Write
  - Read
  - Grep
  - Glob
  - WebFetch
argument-hint: <issue-number> [--skip-checks] [--skip-review] [--validate-only]
---

# Resolve GitHub Issue

GitHub Issueの解決を自動化し、標準的な開発ワークフローを実行します。品質チェックとコードレビューの自動化により、CI失敗を大幅に削減します。

**⚠️ 重要**: このコマンドは必ずTodoWriteツールを使用して進捗を追跡します。TodoWriteなしではワークフローが適切に実行されません。

## 使用方法

```
/resolve-gh-issue <issue-number> [options]
```

### オプション

- `--skip-checks`: 品質チェック（lint, test, build）をスキップ（非推奨・緊急時のみ）
- `--skip-review`: コードレビューをスキップ（非推奨）
- `--validate-only`: 検証のみを実行し、実装は行わない

## 説明

このコマンドは、Simple Bookkeepingプロジェクトの標準的なIssue駆動開発ワークフローを自動化します。一貫性のある品質の高い実装を保証し、手作業によるミスを削減します。

## ワークフローステップ

### 0. TodoWrite初期化【最重要】

**最初に必ず実行**：TodoWriteツールでタスクリストを作成し、進捗を追跡する

```
タスクリスト:
- [ ] Issue分析と理解（issue-analyzer）
- [ ] Issue妥当性検証
- [ ] コードベース分析（codebase-investigator）
- [ ] ブランチ作成とセットアップ
- [ ] 実装（implementation）
- [ ] テスト作成/実行（test-runner）
- [ ] 品質保証チェック（pre-push-validator）
- [ ] コードレビュー（code-reviewer）
- [ ] 自動修正（auto-fixer）※必要時
- [ ] コミット作成
- [ ] ドラフトPR作成（pr-creator）
- [ ] CI監視と修正
- [ ] フォローアップ確認（follow-up-creator）
```

### 1. Issue分析と理解

- **Sub Agent呼び出し**: `Task tool` で `issue-analyzer` エージェントを実行
  - GitHub Issueの詳細を取得・分析
  - 要件と受け入れ条件を構造化
  - 実装に必要な情報を抽出
- TodoWriteのステータスを「completed」に更新

### 2. Issue妥当性検証

実装前にIssueの要件を詳細に検証し、問題のある要件や実装不可能な内容を早期に検出します。

#### 検証カテゴリー

**A. 技術的実現可能性**

- 現在の技術スタック（Next.js/Supabase/PostgreSQL）で実装可能か
- 必要な依存関係が利用可能か（package.jsonの確認）
- ブラウザ/Node.jsバージョンとの互換性
- 外部APIの制限との互換性
- モノレポ構造での実装可能性

**B. システム互換性**

- 既存アーキテクチャとの衝突がないか
- データベーススキーマへの影響評価（Prisma）
- 既存APIとの互換性（RESTful設計）
- デザインパターンの一貫性（shadcn/ui、Zustand）
- Vercelデプロイメント互換性

**C. セキュリティ評価**

- 新たなセキュリティリスクが導入されないか
- 認証・認可への影響
- データ保護要件の検証
- OWASP Top 10の観点からのチェック

**D. パフォーマンス影響**

- データベースクエリの複雑さ（N+1問題の回避）
- フロントエンドバンドルサイズへの影響（Next.js最適化）
- APIレスポンス時間への影響（100ms以内目標）
- メモリ使用量増加の予測
- Server Components vs Client Componentsの選択

**E. 要件の明確さ**

- 受け入れ条件が明確か
- エッジケースが考慮されているか
- エラーハンドリングが明記されているか
- UI/UX仕様が明確か（shadcn/uiコンポーネント使用）
- 会計ルールとの整合性（借方貸方バランス等）

#### 検証結果の処理

- **🟢 グリーン（問題なし）**: 実装を続行
- **🟡 イエロー（軽微な問題/不明瞭な点）**: 警告を表示し、ユーザーに確認を求める
- **🔴 レッド（重大な問題）**: 実装を停止し、問題を報告し、代替案を提案

### 3. コードベース分析

- 現在の実装を理解するためコードベースを検索
- 関連するファイル、モジュール、コンポーネントを特定
- 既存のパターンと規約をレビュー
- ドキュメントと関連コードを分析
- 変更の影響範囲を特定

### 4. テスト駆動開発計画

**Simple Bookkeepingのテスト戦略：**

- 実装前に失敗するテストを作成（該当する場合）
- 必要な機能を捉えるテストケースを定義
  - Unit Test: `apps/*/src/**/__tests__/*.test.ts`
  - E2E Test: `apps/web/e2e/*.spec.ts`
- 実装前にテスト構造を作成
- コードベースの既存のテストパターンに従う
  - Jest for Unit Tests
  - Playwright for E2E Tests
- カバレッジ目標: Unit 80%以上

### 5. 開発計画【重要：TodoWrite必須】

- **必須**: TodoWriteツールを使用して構造化された開発計画を作成
- 複雑なタスクを管理可能なステップに分解
- 依存関係に基づいてタスクの優先順位を決定
- 既存の規約に従った実装アプローチを計画

**TodoWriteの必須タスクリスト例：**

```
1. Issue分析と理解（in_progress → completed）
2. Issue妥当性検証（pending → in_progress → completed）
3. コードベース分析（pending → in_progress → completed）
4. ブランチ作成（pending → in_progress → completed）
5. 実装（pending → in_progress → completed）
6. テスト作成/実行（pending → in_progress → completed）
7. コミット作成（pending → in_progress → completed）
8. PR作成（pending → in_progress → completed）
9. CI監視（pending → in_progress → completed）
```

**注意**: TodoWriteを使用せずに進めるとワークフローが適切に実行されません

### 6. ブランチ作成とセットアップ

- 規約に従って適切な名前のブランチを作成:
  - `feature/<issue-num>-<short-description>` 新機能用
  - `fix/<issue-num>-<short-description>` バグ修正用
  - `doc/<issue-num>-<short-description>` ドキュメント用
  - `refactor/<issue-num>-<short-description>` リファクタリング用
  - `test/<issue-num>-<short-description>` テスト用
  - `chore/<issue-num>-<short-description>` メンテナンス用
- 最新のmainブランチから開始することを確認
- アップストリーム追跡でブランチをリモートにプッシュ

### 7. 実装

- 既存のコードパターンと規約に従う（CLAUDE.mdを参照）
- 変更を段階的に実装
- 明確なメッセージでアトミックなコミットを作成
- コミットメッセージでIssue番号を参照
- 実装をシンプルに保ち、過度なエンジニアリングを避ける
- TypeScriptの型安全性を維持（any型の使用禁止）
- 共通型定義の使用（`@simple-bookkeeping/types`）
- エラークラスの使用（`@simple-bookkeeping/errors`）

#### 実装中の問題追跡【重要機能】

実装中に以下のような問題を発見した場合は、TodoWriteツールを使用して記録し、後でフォローアップIssue作成時に参照する:

- **スコープ外の問題**: 現在のIssueの範囲外だが修正が必要な問題
- **技術的負債**: リファクタリングが必要だが今回は見送る箇所
  - 例: 古いReactパターンの使用、重複コード
- **パフォーマンス改善**: 最適化の余地があるが今回は実装しない改善
  - 例: データベースクエリ最適化、バンドルサイズ削減
- **セキュリティ考慮事項**: 将来的に対処が必要なセキュリティ関連の改善
  - 例: より厳格な入力検証、レート制限
- **テストカバレッジ**: 追加のテストが望ましいが今回は省略する箇所
  - 例: エッジケースのE2Eテスト、エラーパスのUnit Test
- **ドキュメント更新**: 更新が必要だが今回は対象外のドキュメント
  - 例: API仕様書、アーキテクチャドキュメント
- **データベース最適化**: インデックスやクエリの最適化
- **UI/UX改善**: より良いユーザー体験のための改善点

これらは後でフォローアップIssue作成時に参照される。

### 8. 品質保証チェック

必要なすべての品質チェックを順番に実行:

- `pnpm lint` - ESLintとPrettierチェック
- `pnpm typecheck` - TypeScriptの型チェック
- `pnpm test` - すべてのUnit Testを実行
- `pnpm --filter web test:e2e` - E2Eテストを実行（該当する場合）
  - 失敗時: `npx playwright show-trace` でトレース確認
- `pnpm build` - ビルドが成功することを確認
  - `pnpm build:web` - Vercel用ビルド確認
- データベース変更がある場合:
  - `pnpm --filter database prisma:generate`
  - `pnpm db:migrate` でマイグレーション確認

### 9. コミット作成

- 明確で説明的なメッセージでアトミックなコミットを作成
- 既存のコミットメッセージ規約に従う:
  - `feat:` 新機能
  - `fix:` バグ修正
  - `docs:` ドキュメントのみの変更
  - `style:` コードの意味に影響しない変更
  - `refactor:` バグ修正や機能追加を含まないコード変更
  - `test:` テストの追加や修正
  - `chore:` ビルドプロセスやツールの変更
- コミットメッセージでIssue番号を参照
- pre-commitフックをバイパスするために `--no-verify` を使用しない

### 10. ドラフトPR作成

- `gh pr create --draft --repo knishioka/simple-bookkeeping` を使用してドラフトPRを作成
- 適切なタイトル形式を使用:
  - `feat: [説明] (#issue-number)`
  - `fix: [説明] (#issue-number)`
  - `docs: [説明] (#issue-number)`
- 包括的なPR説明を含める:
  - 変更の概要
  - 元のIssueへのリンク
  - テスト計画と検証手順
  - 破壊的変更や考慮事項

### 11. CIモニタリングと解決

**Simple BookkeepingのCI環境：**

- PR作成後のGitHub Actionsステータスを監視
  - E2E Tests (Docker) - 最重要、**約13-15分**
  - Unit Tests - 全パッケージのテスト
  - Lint & Type Check

**⚠️ CI監視のベストプラクティス：**

```bash
# 推奨: gh pr checksを使用（自動的に待機）
gh pr checks --repo knishioka/simple-bookkeeping --watch --interval 60  # 60秒間隔でチェック

# 手動チェックの場合
gh pr checks --repo knishioka/simple-bookkeeping  # 現在の状態を確認

# タイムアウトを考慮（E2Eテストは時間がかかる）
# 最初のチェックは2-3分後に実行
sleep 180 && gh pr checks --repo knishioka/simple-bookkeeping
```

**注意事項：**

- E2Eテストは13-15分かかるため、頻繁なチェックは避ける
- 最初のチェックは2-3分後に実施
- その後は2-3分間隔でチェック（過度なAPI呼び出しを避ける）
- `--watch`オプションを使用すると自動的に適切な間隔でチェック

- CIが失敗した場合:
  - 失敗ログを分析（`gh run view --repo knishioka/simple-bookkeeping`コマンド使用）
  - E2Eテスト失敗時:
    - `REUSE_SERVER=true npx playwright test --project=chromium-desktop`
    - トレースファイル確認: `npx playwright show-trace`
  - ローカルで問題を修正
  - 品質チェックを再度実行
  - 同じブランチに修正をプッシュ
  - すべてのチェックが通過するまでCIを監視
- **自動的にreadyに変換しない**: CI通過後、ユーザーに確認を求める
- 以下の条件を満たした後のみ、`gh pr ready --repo knishioka/simple-bookkeeping` でレビュー準備完了にする:
  - すべてのCIチェックが通過
  - ユーザーが明示的に続行を確認
- **必ずPR URLを最後に表示**: 最終出力としてPRリンクを表示

### 12. フォローアップIssueの作成（条件付き必須）

Issue解決中に発見された問題や後回しにした課題がある場合:

- **【必須】無視した問題の確認**: CI通過後、必ずユーザーに以下を確認
  - 「実装中に無視した問題や後回しにした課題はありますか？」
  - 「フォローアップIssueを作成しますか？」
- **Issue作成が必要な場合**:
  1. 新しいIssueの作成:
     ```bash
     gh issue create --repo knishioka/simple-bookkeeping \
       --title "[Follow-up] <簡潔なタイトル>" \
       --body "<詳細な説明>" \
       --label "follow-up,<適切なラベル>"
     ```
  2. Issue内容に含めるべき情報:
     - 元のIssue番号とPRへの参照
     - 無視した問題の詳細な説明
     - なぜ今回実装しなかったかの理由
     - 推奨される解決アプローチ
     - 実装の優先度と影響範囲
     - 必要な作業の詳細リスト
     - 技術的な考慮事項
  3. 作成したIssueのURLを表示
- **PR URLの再表示**: フォローアップIssue作成後、必ず元のPR URLを再度表示

#### フォローアップIssueテンプレート例

```markdown
## 概要

PR #<PR番号> での Issue #<元のIssue番号> の実装中に発見された課題です。

## 背景

<なぜこの問題が発生したか、なぜ後回しにしたかの説明>

## 問題の詳細

<具体的な問題の説明>

## 推奨される解決方法

1. <ステップ1>
2. <ステップ2>
3. <ステップ3>

## 技術的考慮事項

- <考慮事項1>
- <考慮事項2>

## 影響範囲

- 影響を受けるコンポーネント: <コンポーネント名>
- ユーザーへの影響: <影響の説明>
- 優先度: <High/Medium/Low>

## 関連リンク

- 元のIssue: #<Issue番号>
- 実装PR: #<PR番号>
```

### 13. 最終検証とフォローアップ確認【必須】

- 元のIssueのすべての受け入れ条件が満たされていることを確認
- すべてのテストがローカルとCIで通過することを確認
- ビルドが成功することを確認
- PR変更を最終的にレビュー
- TodoWriteタスクを完了としてマーク
- **【必須】実装中に記録した問題の確認**:
  1. スキップした項目や未実装機能をリストアップ
  2. ユーザーに「フォローアップIssueを作成しますか？」と確認
  3. 必要に応じてフォローアップIssue作成
- **【必須】最後にPR URLを表示**: 最終出力として必ずPRリンクを表示

## 前提条件

- `gh` CLIツールが設定され、認証されている
- すべての依存関係でローカル開発環境がセットアップされている
- 適切な権限でリポジトリにアクセスできる
- 必要なツールがすべてインストールされている（pnpm、node等）

## エラーハンドリング

ステップが失敗した場合:

1. ワークフローを即座に停止
2. エラーを明確に報告
3. 手動解決のガイダンスを提供
4. 問題が解決されるまで次のステップに進まない

## 品質基準

- すべてのコードはlinting、testing、型チェックを通過する必要がある
- 既存のコードパターンと規約に従う
- TypeScriptのany型を使用しない
- 絶対インポートを使用（`@/`エイリアス）
- 型エラーを無視しない、`// @ts-ignore` を使用しない
- すべてのpre-commitフックが通過することを確認
- 品質チェックをバイパスしない

## ブランチとPR規約

- ブランチ名は形式に従う: `<prefix>/<issue-num>-<short-description>`
- PRは最初にドラフトとして作成する
- PRタイトルはIssueタイプの規約に従う
- すべてのGitHub操作は `gh` コマンドを使用
- すべてのCIが通過し、ユーザーが確認した後のみreadyに変換
- 最終出力として常にPR URLを表示

## 既存ツールとの統合

- タスク追跡と計画にTodoWriteを使用
  - スキップした項目は「skipped」ステータスで記録
  - 最終段階でスキップされたタスクを確認しフォローアップIssue作成を促す
- プロジェクトのnpmスクリプトと統合
- CLAUDE.md開発標準に従う
- プロジェクトの品質ゲートと要件を尊重
- 既存のCI/CDパイプラインとの互換性を維持

## プロジェクト固有の考慮事項【Simple Bookkeeping】

### モノレポ構造

- 変更がどのワークスペースに影響するか確認
  - `apps/web`: Next.jsアプリケーション（Port 3000）
  - `apps/web/src/app/api`: Next.js API Routes
  - `packages/database`: Prismaスキーマ
  - `packages/types`: 共通型定義
  - `packages/errors`: エラー定義
  - `packages/shared`: 共有ユーティリティ
- 共有パッケージへの変更は全体への影響を考慮
- 適切なフィルターでコマンドを実行（例: `pnpm --filter @simple-bookkeeping/web test`）

### 環境変数

- 新しい環境変数を追加する場合は `.env.example` を更新
- Supabase関連の環境変数:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- 機密情報は絶対にコミットしない

### データベース変更

- Supabaseマイグレーションの管理:
  - Supabase Dashboardでのスキーマ変更
  - SQLマイグレーションファイルの作成
  - Row Level Security (RLS)ポリシーの更新
- Prismaスキーマの同期（Supabaseをソースとして）
- 必要に応じてシードデータを更新
- トランザクション処理の適切な使用（特に仕訳入力）
- ソフトデリート（deletedAt）の考慮
- 会計期間との整合性確認

### デプロイメント考慮事項

- Vercelでビルドが成功することを確認
  - `pnpm build:web` でローカルチェック
  - API Routesのビルドも含まれる
- 環境固有の設定を考慮
  - Vercel環境変数: `NEXT_PUBLIC_*` プレフィックス必須
  - Supabase環境変数の設定
- デプロイメント状態の確認:
  - `vercel` - プレビューデプロイ
  - `vercel --prod` - 本番デプロイ
  - `vercel logs` - ログ確認

## 検証の例

### 成功例（🟢 グリーン）

```
Issueの検証を実行しています...
✅ 技術的実現可能性: OK - Next.js + TypeScriptで実装可能
✅ システム互換性: OK - 既存APIと互換性あり
✅ セキュリティ評価: OK - セキュリティリスクなし
✅ パフォーマンス影響: OK - 軽微な影響のみ
✅ 要件の明確さ: OK - 受け入れ条件が明確

検証結果: 🟢 問題なし - 実装を続行します
```

### 警告例（🟡 イエロー）

```
Issueの検証を実行しています...
✅ 技術的実現可能性: OK
✅ システム互換性: OK
⚠️ セキュリティ評価: 警告 - CORS設定の変更が必要
✅ パフォーマンス影響: OK
⚠️ 要件の明確さ: 警告 - エラーハンドリングの詳細が不明瞭

検証結果: 🟡 軽微な問題あり
以下の点について確認が必要です:
1. CORS設定の変更による影響を確認してください
2. エラーハンドリングの詳細仕様を明確にしてください

続行しますか？ (y/n/details):
```

### エラー例（🔴 レッド）

```
Issueの検証を実行しています...
✅ 技術的実現可能性: OK
❌ システム互換性: エラー - データベーススキーマの破壊的変更が必要
⚠️ セキュリティ評価: 警告 - 認証フローへの影響あり
❌ パフォーマンス影響: エラー - N+1クエリが発生する可能性
✅ 要件の明確さ: OK

検証結果: 🔴 重大な問題あり
実装を停止します。以下の問題を解決する必要があります:
1. データベーススキーマの破壊的変更を回避する方法を検討
2. パフォーマンス問題を解決する実装方法を再設計

代替案:
- マイグレーション戦略を立てて段階的に実装
- クエリ最適化またはキャッシュ層の追加を検討
```

## 実装完了チェックリスト

実装完了時に必ず確認:

- [ ] すべての要件を実装したか？
- [ ] スキップした項目を記録したか？
- [ ] CI/CDチェックが通過したか？
- [ ] **【必須】フォローアップIssueの必要性を確認したか？**
- [ ] フォローアップIssueを作成したか？（必要な場合）
- [ ] PR URLを表示したか？

## 成功基準

コマンドは以下の条件を満たしたときに成功:

- [ ] Issueが完全に分析され理解されている
- [ ] Issue妥当性検証を通過している（または明示的にスキップ）
- [ ] 適切なブランチが作成されプッシュされている
- [ ] 必要なすべての変更が実装されている
- [ ] すべてのテストが通過（`pnpm test`）
- [ ] コードが適切にlintされている（`pnpm lint`）
- [ ] 型チェックが通過（`pnpm typecheck`）
- [ ] ビルドが成功（`pnpm build`）
- [ ] 適切な形式でドラフトPRが作成されている
- [ ] すべてのCIチェックが通過
- [ ] Issue要件が完全に満たされている
- [ ] 【必須】フォローアップIssueの必要性を確認している
- [ ] 無視した問題がある場合、フォローアップIssueが適切に作成されている
- [ ] 【必須】最終的にPR URLが表示されている
