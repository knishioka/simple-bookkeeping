---
description: AI開発に最適化されたGitHub Issue作成（Claude Code向け）
argument-hint: <概要説明> [--type feature|bug|refactor|docs|test|chore] [--priority high|medium|low]
allowed-tools: [Bash, Read, Grep, Glob, WebSearch, Task]
---

# AI駆動開発のためのGitHub Issue作成

タスク概要: **$ARGUMENTS**

## 🎯 Issue作成プロセス

**⚠️ 重要な原則**：

- **簡潔性**: 1つのIssueで1つの明確なゴール
- **測定可能**: 完了条件が客観的に判断できる
- **適切なサイズ**: 大きすぎるIssueは分割を検討

### 1. 要件の明確化と補足情報収集

まず、以下の情報を整理・確認します：

#### 1.1 基本情報の整理

- **何を作るか/修正するか** (WHAT)
- **なぜ必要か** (WHY)
- **誰が使うか** (WHO)
- **いつまでに必要か** (WHEN) - 必要に応じて確認

#### 1.2 技術的コンテキストの収集

```bash
# モノレポ構造の確認
ls -la apps/ packages/

# 関連ファイルの特定
find apps -name "*.tsx" -o -name "*.ts" | head -20
find packages -name "*.ts" | head -10

# 既存のIssueとPRの確認
gh issue list --repo knishioka/simple-bookkeeping --limit 10
gh pr list --repo knishioka/simple-bookkeeping --limit 10

# プロジェクト構造の理解
tree -L 3 -I 'node_modules|.git|dist|.next' apps/ packages/ 2>/dev/null
```

### 2. AI向けIssueテンプレート生成

#### 2.1 Issue構造の設計原則

**AI（Claude Code）が効率的に作業するための情報構成：**

1. **明確なゴール定義**: 完了条件を具体的に記載
2. **柔軟な実装余地**: HOWは制約しすぎない
3. **判断基準の提供**: トレードオフの優先順位を明示
4. **コンテキスト情報**: 関連ファイル、依存関係を記載
5. **失敗許容設計**: エラー時の対処方針を含む

#### 2.2 Issueテンプレート

```markdown
## 🎯 ゴール

{明確で測定可能な完了条件}

## 📝 背景とコンテキスト

### ビジネス要件

{なぜこの機能/修正が必要か}

### 技術的背景

{現在の実装状況、制約条件}

## 🔧 実装要件

### 必須要件

- [ ] {絶対に満たすべき条件1}
- [ ] {絶対に満たすべき条件2}

### 推奨要件

- [ ] {できれば満たしたい条件1}
- [ ] {できれば満たしたい条件2}

### 実装の自由度

以下の点はAIの判断に委ねます：

- {実装方法の選択}
- {コンポーネント設計の詳細}
- {パフォーマンス最適化の方法}

## 🏗️ 技術仕様

### 関連ファイル

- `apps/web/src/app/...` - Next.js App Router実装
- `apps/web/src/app/api/...` - Next.js API Routes
- `packages/database/prisma/schema.prisma` - データベーススキーマ
- {その他関連ファイル}

### 依存関係

- {外部ライブラリ/API}
- {共有パッケージ}
- {他のコンポーネント/モジュール}

### 制約事項

- **パフォーマンス**: {レスポンスタイム要件}
- **セキュリティ**: {認証・認可要件}
- **互換性**: {ブラウザ/Node.jsバージョン}

## 💡 実装ヒント（AIへの推奨事項）

### アプローチ候補

1. **Option A**: {アプローチ1の概要}
   - メリット:
   - デメリット:

2. **Option B**: {アプローチ2の概要}
   - メリット:
   - デメリット:

### 判断基準

優先順位（高い順）:

1. {最優先事項}
2. {次点の優先事項}
3. {その他の考慮事項}

## ✅ 受け入れ基準

### 機能要件

- [ ] {ユーザーストーリー1}
- [ ] {ユーザーストーリー2}

### 非機能要件

- [ ] TypeScriptの型安全性確保
- [ ] ESLint/Prettierのチェック通過
- [ ] 適切なエラーハンドリング
- [ ] ログ出力の実装
- [ ] ドキュメント更新（必要な場合）

### テスト要件

- [ ] Unit Testの追加（カバレッジ80%以上）
- [ ] E2Eテストの追加（主要フロー）
- [ ] `pnpm test` が通過
- [ ] `pnpm test:e2e` が通過（該当する場合）

### データベース要件（該当する場合）

- [ ] Prismaスキーマの更新
- [ ] マイグレーションファイルの作成
- [ ] シードデータの更新

## 🚨 リスクと対策

### 想定されるリスク

1. **リスク**: {潜在的な問題}
   **対策**: {推奨される対処法}

### エラーハンドリング方針

- エラー発生時は詳細ログを出力
- ユーザーへの適切なエラーメッセージ表示
- トランザクション処理での適切なロールバック

## 📚 参考資料

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [プロジェクトCLAUDE.md](./CLAUDE.md)
- {関連するIssue/PR}

## 🏷️ メタデータ

- **タイプ**: {feature|bug|refactor|docs|test|chore}
- **優先度**: {high|medium|low}
- **見積もり**: {size:XS|size:S|size:M|size:L|size:XL}
- **影響範囲**: {web|api-routes|database|shared|all}
- **デプロイメント**: vercel
```

### 3. GitHub Labels管理

#### 3.1 標準ラベルセット確認と作成

```bash
# 現在のラベル確認
gh label list --repo knishioka/simple-bookkeeping --limit 50

# AI開発用の推奨ラベルセット（既存ラベルを活用しつつ新規追加）
LABELS=(
  # AI開発特有（新規）
  "ai-ready:#00ff00:AI実装可能"
  "needs-clarification:#fbca04:要確認事項あり"
  "in-progress:#0E8A16:作業中"

  # サイズ（AI作業量の目安）
  "size:XS:#c5def5:~30分"
  "size:S:#7aa3e5:~2時間"
  "size:M:#5b8bdf:~1日"
  "size:L:#3f68d9:~3日"
  "size:XL:#2546d3:3日以上"

  # 影響範囲
  "scope:web:#4285f4:Next.jsアプリケーション"
  "scope:api-routes:#ff6f00:API Routes"
  "scope:database:#7e4e8a:Supabaseデータベース"
  "scope:shared:#008672:共有パッケージ"
)

# ラベル作成（存在しない場合）
for label_def in "${LABELS[@]}"; do
  IFS=':' read -r name color description <<< "$label_def"
  gh label create "$name" --repo knishioka/simple-bookkeeping --color "$color" --description "$description" 2>/dev/null || echo "Label $name already exists or skipped"
done
```

### 4. Issue作成実行

#### 4.1 プロジェクト固有の情報収集

必要に応じて以下を確認します：

1. **影響範囲確認**: 「この変更はWebアプリ、API Routes、データベースのどれに影響しますか？」
2. **モノレポ確認**: 「どのworkspace（apps/web、packages/\*）に変更が必要ですか？」
3. **テスト戦略**: 「E2Eテスト、Unit Test、または両方が必要ですか？」
4. **デプロイメント**: 「Vercelのビルド設定に影響しますか？」
5. **データベース**: 「Supabaseスキーマの変更やマイグレーションが必要ですか？」

#### 4.2 Issue作成コマンド

```bash
gh issue create --repo knishioka/simple-bookkeeping \
  --title "{簡潔で明確なタイトル}" \
  --body "{上記テンプレートに基づく内容}" \
  --label "ai-ready,{type},{priority},{size},{scope},{deploy}" \
  --assignee "@me"
```

### 5. AI開発のベストプラクティス

#### 5.1 Issue設計の原則

**明確な What、柔軟な How**

- ✅ 良い例: 「仕訳入力フォームにバリデーションを追加し、借方貸方の合計が一致しない場合にエラー表示」
- ❌ 悪い例: 「JournalEntryForm.tsxの150行目にuseEffectでバリデーションを追加」

**判断基準の明示**

- ✅ 良い例: 「パフォーマンス優先。100件の仕訳でも1秒以内にバリデーション完了」
- ❌ 悪い例: 「適切にバリデーションする」

**エラー処理の方針**

- ✅ 良い例: 「バリデーションエラー時はtoast通知で表示、フォーカスを該当フィールドに移動」
- ❌ 悪い例: 「エラーが出ないようにする」

#### 5.2 AIフレンドリーな情報提供

1. **関連コードの場所を明示**

   ```
   関連ファイル:
   - apps/web/src/components/journal/JournalEntryForm.tsx:45-120
   - apps/web/src/app/api/v1/journal-entries/route.ts:230-280
   - packages/types/src/journal.ts:15-45
   ```

2. **既存パターンの参照**

   ```
   類似実装:
   - components/accounts/AccountForm.tsx のバリデーションを参考に
   - 既存のzodスキーマパターンに従う
   ```

3. **テスト方法の明確化**
   ```
   テスト手順:
   1. pnpm test -- journalEntries
   2. pnpm --filter web test:e2e journal-entries.spec.ts
   3. ローカル環境での動作確認（pnpm dev）
   ```

### 6. Issue作成後のフォロー

#### 6.1 自動化可能なタスク

- GitHub Actions CIでのチェック
- 依存関係の自動更新チェック
- 関連Issue/PRの自動リンク
- TypeScriptの型チェック

#### 6.2 人間のレビューが必要な部分

- UI/UXの大幅な変更
- データベーススキーマの変更
- 認証・認可フローの変更
- 会計ロジックの変更
- 外部APIとの連携追加

### 7. Simple Bookkeeping固有の考慮事項

#### 7.1 会計システム特有の要件

- **借方貸方の一致**: 仕訳入力では必ず借方と貸方の合計が一致
- **会計期間**: すべての取引は特定の会計期間に属する
- **監査ログ**: 重要な操作には監査ログが必要
- **権限管理**: 組織単位でのアクセス制御

#### 7.2 技術スタック考慮事項

**フロントエンド (Next.js)**

- Server ComponentsとClient Componentsの使い分け
- shadcn/uiコンポーネントの活用
- Zustandでの状態管理
- React Hook Form + Zodでのフォームバリデーション

**API Routes (Next.js)**

- Supabase認証の実装
- Prismaでのデータベースアクセス
- トランザクション処理の適切な使用
- Route Handlersでのエラーハンドリング

**データベース (Supabase/PostgreSQL)**

- Supabaseマイグレーション戦略
- Row Level Security (RLS)の活用
- リアルタイム機能の考慮
- インデックスの適切な使用
- ソフトデリート（deletedAt）の考慮

#### 7.3 デプロイメント環境

**Vercel**

- 環境変数の管理（NEXT*PUBLIC*\*、Supabaseキー）
- Edge Functionsの制限事項
- API Routesの最適化
- ビルド時間の最適化
- Supabase接続の管理

### 8. 継続的改善

作成されたIssueの効果を測定：

- AIの実装成功率
- 追加確認の頻度
- 実装時間
- 手戻り率
- テストカバレッジの向上率

これらのメトリクスを基にIssueテンプレートを改善していきます。

---

_このコマンドはSimple BookkeepingプロジェクトのAI駆動開発を最適化するために設計されています。_
