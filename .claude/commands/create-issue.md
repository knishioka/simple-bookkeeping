---
description: AI開発に最適化されたGitHub Issue作成（issue-creatorサブエージェント使用）
argument-hint: <概要説明> [--type feature|bug|refactor|docs|test|chore] [--priority high|medium|low]
allowed-tools: [Task, TodoWrite]
---

# AI駆動開発のためのGitHub Issue作成

タスク概要: **$ARGUMENTS**

## 🚀 Issue Creator サブエージェントを起動

このコマンドは専門の`issue-creator`サブエージェントを呼び出して、GitHub Issueを自動作成します。

Task toolを使用して`issue-creator`サブエージェントを呼び出します。

```typescript
// サブエージェント呼び出し
const result = await Task(
  'Create GitHub issue',
  `GitHub Issueを作成してください。要件: ${ARGUMENTS}`,
  'issue-creator'
);
```

### issue-creatorサブエージェントの機能

`issue-creator`サブエージェントは以下の処理を自動実行します：

1. **要件分析と構造化**
   - ユーザー要求の解析と明確化
   - 技術要件への変換
   - 受け入れ基準の定義

2. **プロジェクト調査**
   - コードベース構造の理解
   - 既存Issue/PRの確認
   - 重複検出と関連付け

3. **Issue作成**
   - AI最適化テンプレートの生成
   - 適切なラベル付け
   - 優先度とサイズの判定

4. **品質保証**
   - 必要情報の網羅性確認
   - 実装可能性の検証
   - 明確な完了条件の設定

### 利用可能なオプション

`$ARGUMENTS`には以下のオプションを含めることができます：

- `--type`: Issue タイプ (feature|bug|refactor|docs|test|chore)
- `--priority`: 優先度 (high|medium|low)
- `--size`: 見積もりサイズ (XS|S|M|L|XL)
- `--scope`: 影響範囲 (web|api|database|shared|all)

### 使用例

```
/create-issue 仕訳入力フォームにバリデーション機能を追加 --type feature --priority high
```

### サブエージェントの出力

issue-creatorは以下の情報を返します：

```json
{
  "status": "success",
  "issue": {
    "number": 446,
    "title": "feat: 仕訳入力バリデーション機能の実装",
    "url": "https://github.com/knishioka/simple-bookkeeping/issues/446",
    "labels": ["ai-ready", "feature", "priority:high", "size:M"],
    "assignee": "@me"
  },
  "message": "✅ Issue #446を作成しました"
}
```

### エラーハンドリング

サブエージェントが以下のエラーを検出した場合、適切に処理されます：

- **重複Issue**: 既存のIssue URLを提示
- **認証エラー**: `gh auth login`の実行を促す
- **必須情報不足**: 追加情報の入力を要求

### ベストプラクティス

1. **簡潔な説明**: `$ARGUMENTS`は簡潔で明確に
2. **オプション活用**: タイプや優先度を明示的に指定
3. **コンテキスト提供**: なぜ必要かを含める

### Simple Bookkeeping固有の考慮事項

issue-creatorサブエージェントは以下のプロジェクト固有の要件を自動的に考慮します：

- **会計システム要件**: 借方貸方の一致、会計期間、監査ログ
- **技術スタック**: Next.js, Supabase, PostgreSQL, Prisma
- **モノレポ構造**: apps/web, packages/\*の影響範囲
- **デプロイメント**: Vercel環境の考慮

---

_このコマンドは`issue-creator`サブエージェントを使用してGitHub Issue作成を自動化します。_
_サブエージェント定義: `.claude/agents/issue-creator.md`_
