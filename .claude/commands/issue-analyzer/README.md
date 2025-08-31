# Issue Analyzer Agent

GitHub Issueを詳細に分析し、実装に必要な情報を構造化して返却するIssue Analyzer Agentです。

## 概要

このAgentは、GitHub CLIを使用してIssue詳細を取得し、要件の構造化、実装情報の整理、関連情報の収集を行います。

## 主な機能

1. **GitHub CLI統合**
   - Issue詳細の自動取得
   - ラベル、マイルストーン、アサイニー情報の確認
   - コメントやリンクされたPRの分析

2. **要件抽出**
   - Issue本文からの要件抽出
   - 受け入れ条件の明確化
   - 実装範囲の特定

3. **Issue分類**
   - Issueタイプの判定（feature/fix/docs/refactor/test/chore）
   - 必要なブランチプレフィックスの決定
   - 変更の複雑さと影響範囲の評価

4. **依存関係分析**
   - 関連するIssueやPRの確認
   - 過去の類似実装の調査
   - ドキュメントへの参照確認

## 使用方法

### Task tool経由での使用

```
Task tool, please analyze GitHub Issue #296 using the issue-analyzer agent.

Parameters:
- subagent_type: "issue-analyzer"
- description: "Analyze issue #296 for implementation planning"
- prompt: "Provide comprehensive analysis including requirements and recommendations"
```

## ディレクトリ構造

```
.claude/commands/issue-analyzer/
├── README.md                  # このファイル
├── config.yml                 # Agent設定
├── prompts/                   # プロンプトテンプレート
│   └── analyze.yml           # 分析用プロンプト
├── workflows/                 # ワークフロー定義
│   └── analyze.yml           # 分析ワークフロー
├── src/                      # TypeScript実装
│   ├── types.ts              # 型定義
│   ├── github-cli.ts         # GitHub CLI連携
│   ├── analyzer.ts           # 分析エンジン
│   └── index.ts              # エントリーポイント
├── integration/              # 統合設定
│   └── task-tool.yml         # Task tool統合
└── examples/                 # 使用例
    └── usage-examples.md     # 詳細な使用例

```

## 出力形式

JSON形式で構造化された分析結果を返却します：

```json
{
  "issue_details": {
    "number": 296,
    "title": "Issue Analyzer Agent実装",
    "labels": ["enhancement"],
    "state": "open"
  },
  "requirements": {
    "summary": "...",
    "functional_requirements": [...],
    "acceptance_criteria": [...]
  },
  "classification": {
    "issue_type": "feature",
    "branch_prefix": "feature",
    "complexity": "medium",
    "impact_scope": "module"
  },
  "dependencies": {
    "blocked_by": [],
    "related_issues": [],
    "affected_components": [...]
  },
  "recommendations": {
    "implementation_approach": "...",
    "testing_strategy": "...",
    "risk_factors": [...]
  }
}
```

## 前提条件

- GitHub CLIがインストールされ、認証済みであること
- リポジトリへの読み取りアクセス権があること
- Node.js 18以上

## エラーハンドリング

- GitHub CLI未インストール時の明確なエラーメッセージ
- 認証エラー時の対処法提示
- Issue取得失敗時の適切なフォールバック
- 要件が不明瞭な場合の警告出力

## パフォーマンス

- タイムアウト: 30秒
- 最大リトライ: 3回
- GitHub APIレート制限の考慮

## 開発ガイド

### ビルド

```bash
cd .claude/commands/issue-analyzer
npm install
npm run build
```

### テスト

```bash
npm test
```

### 使用例

詳細な使用例は `examples/usage-examples.md` を参照してください。

## ライセンス

MIT

## 作成者

Claude Code

## バージョン

1.0.0
