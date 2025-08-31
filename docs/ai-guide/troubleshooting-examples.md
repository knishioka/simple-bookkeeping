# トラブルシューティングと実装例

## 🔍 トラブルシューティング

### よくある問題と解決策

1. **インポートエラー: "Cannot find module '@/...'"**

   ```bash
   # tsconfig.json のパスマッピングを確認
   # @/ は src/ ディレクトリを指す
   ```

2. **Prisma エラー: "Cannot find module '.prisma/client'"**

   ```bash
   pnpm --filter @simple-bookkeeping/database prisma:generate
   ```

3. **型エラー: "Type 'X' is not assignable to type 'Y'"**

   ```bash
   # 共通型定義パッケージを確認
   pnpm --filter @simple-bookkeeping/types build
   ```

4. **E2Eテストエラー: "Cannot find element"**
   ```bash
   # テスト対象のセレクタを確認
   pnpm --filter web test:e2e:ui  # UIモードで確認
   ```

## 📋 GitHub Issue/PR管理

### ラベル管理

AIアシスタントがIssueやPRを作成する際のラベル管理について：

1. **既存ラベルの優先使用**
   - まず`gh label list`で既存のラベルを確認
   - 既存のラベルで適切なものがあれば使用

2. **新規ラベルの作成**
   - 適切なラベルが存在しない場合は作成可能
   - `gh label create`コマンドを使用
   - 一貫性のある命名規則に従う

3. **ラベル作成例**

   ```bash
   # 新しいラベルを作成
   gh label create "code-quality" \
     --description "Code quality improvements" \
     --color "0e8a16"

   # 色の参考
   # - 緑系 (0e8a16): 改善・品質向上
   # - 青系 (0366d6, 2b7489): 機能・タイプ
   # - 黄系 (fef2c0, fbca04): 注意・メンテナンス
   # - 赤系 (d73a4a): バグ・重要
   # - 紫系 (5319e7): リファクタリング
   ```

4. **推奨ラベルカテゴリー**
   - **タイプ**: bug, feature, refactor, docs, test, chore
   - **優先度**: critical, high-priority, low-priority
   - **状態**: in-progress, blocked, ready-for-review
   - **技術**: typescript, react, database, api
   - **その他**: technical-debt, code-quality, performance, security, follow-up

### GitHub CLI (gh) 使用時の必須ルール

**重要：ghコマンド実行時は必ず対象リポジトリを明示的に指定し、誤操作を防止する**

#### リポジトリの明示的指定

ghコマンドを使用する際は、必ず以下のいずれかの方法でリポジトリを明示的に指定すること：

1. **--repo オプションの使用（推奨）**

   ```bash
   # 必ず --repo オプションでリポジトリを指定
   gh issue create --repo knishioka/simple-bookkeeping
   gh pr create --repo knishioka/simple-bookkeeping
   gh pr view --repo knishioka/simple-bookkeeping
   gh label list --repo knishioka/simple-bookkeeping
   ```

2. **作業ディレクトリの確認と移動**

   ```bash
   # 現在のリポジトリを確認
   gh repo view --json nameWithOwner -q .nameWithOwner

   # 正しいディレクトリに移動してから実行
   cd /Users/ken/Developer/private/simple-bookkeeping && gh pr create
   ```

3. **環境変数の使用（セッション全体で統一する場合）**

   ```bash
   # 環境変数でデフォルトリポジトリを設定
   export GH_REPO="knishioka/simple-bookkeeping"

   # 以降のghコマンドはこのリポジトリを対象とする
   gh issue create  # GH_REPO環境変数が使用される
   ```

#### 実行前の確認事項

**ghコマンド実行前に必ず以下を確認：**

- [ ] 対象リポジトリが正しいか確認
- [ ] 作業ディレクトリが適切か確認
- [ ] --repo オプションを使用しているか確認

#### 作業開始時の確認フロー

```bash
# セッション開始時またはディレクトリ移動後に必ず実行
pwd  # 現在のディレクトリを確認
git remote -v  # Gitリモートを確認
gh repo view --json nameWithOwner -q .nameWithOwner  # 現在のリポジトリを確認
```

#### エラー防止のためのベストプラクティス

1. **重要な操作前の再確認**
   - Issue/PR作成前に必ずリポジトリを確認
   - ラベル作成・削除前に対象リポジトリを確認

2. **定期的なコンテキスト確認**
   - ディレクトリ移動後は必ず確認
   - 長時間の作業セッション中は定期的に確認

3. **エラーハンドリング**
   - 誤ったリポジトリが検出された場合は即座に中断
   - 操作前に確認メッセージを表示

#### AIアシスタント特有の注意事項

- 長時間のセッション中に複数のプロジェクトを扱う可能性があるため、常に明示的な指定を行う
- ファイルシステムの探索中にディレクトリが変更される可能性があるため、--repo オプションの使用を推奨
- 並行タスク実行時のコンテキスト混乱を防ぐため、各コマンドで明示的にリポジトリを指定

### Issue作成時のベストプラクティス

1. **適切なタイトル**

   ```bash
   # ✅ Good: 明確で具体的
   "[Feature] ユーザー認証機能の実装"
   "[Bug] 仕訳入力時のバリデーションエラー"
   "[Refactor] 勘定科目サービスのリファクタリング"

   # ❌ Bad: 曖昧
   "修正"
   "エラー"
   ```

2. **Issue本文の構成**
   - **概要**: 問題や要望の簡潔な説明
   - **背景**: なぜこの変更が必要か
   - **詳細**: 具体的な内容や再現手順
   - **受け入れ条件**: 完了の定義
   - **関連Issue/PR**: 関連する他のIssueやPRへのリンク

3. **フォローアップIssue**
   - 実装中に発見した別の問題は`follow-up`ラベルを付けて新規Issueを作成
   - 元のIssue/PR番号を必ず参照
   - スコープを明確に分離

## 🎯 よくある実装タスクの例（Server Actions版）

### 新しい機能を追加する場合

```typescript
// ❌ Bad: Express.js APIを追加
// apps/api/src/controllers/newFeature.controller.ts
export const createNewFeature = async (req: Request, res: Response) => {
  // Express.js APIは追加しない
};

// ✅ Good: Server Actionを追加
// apps/web/app/actions/new-feature.ts
('use server');

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createNewFeature(formData: FormData) {
  const supabase = createClient();

  // 認証チェック
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // データ処理
  const result = await supabase
    .from('new_features')
    .insert({
      name: formData.get('name'),
      user_id: user.id,
    })
    .select()
    .single();

  if (result.error) throw result.error;

  // キャッシュ更新
  revalidatePath('/new-features');

  return result.data;
}
```

### データ取得の実装

```typescript
// ✅ Good: Server Componentでのデータ取得
// apps/web/app/accounts/page.tsx
import { createClient } from '@/lib/supabase/server';

export default async function AccountsPage() {
  const supabase = createClient();

  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .order('code', { ascending: true });

  if (error) {
    console.error('Failed to fetch accounts:', error);
    return <div>エラーが発生しました</div>;
  }

  return (
    <div>
      <h1>勘定科目一覧</h1>
      <AccountsList accounts={accounts} />
    </div>
  );
}
```

### フォーム処理の実装

```typescript
// ✅ Good: Server Actionを使用したフォーム
// apps/web/app/accounts/new/page.tsx
import { createAccount } from '@/app/actions/accounts';

export default function NewAccountPage() {
  return (
    <form action={createAccount}>
      <input name="code" type="text" required />
      <input name="name" type="text" required />
      <select name="type">
        <option value="asset">資産</option>
        <option value="liability">負債</option>
        <option value="equity">資本</option>
        <option value="revenue">収益</option>
        <option value="expense">費用</option>
      </select>
      <button type="submit">作成</button>
    </form>
  );
}
```

## 継続的な改善

このガイドラインは生きたドキュメントです。プロジェクトの成長に合わせて、以下の点を定期的に見直してください：

- 新しいベストプラクティスの追加
- 古くなったルールの更新
- チーム全体での合意形成
- 実装例の追加・更新

## リソース

- [TypeScript ドキュメント](https://www.typescriptlang.org/docs/)
- [Next.js ドキュメント](https://nextjs.org/docs)
- [Prisma ドキュメント](https://www.prisma.io/docs/)
- [React Hook Form](https://react-hook-form.com/)
- [Zod](https://zod.dev/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)

## サーバー管理に関する重要メモ

- 修正をする開発するときはサーバーの立ち上げっぱなしをなくすために必ずサーバーを落とすようにしてください。
