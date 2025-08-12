# CLAUDE.md - AIコーディングガイドライン

## 概要

このドキュメントは、AIアシスタント（Claude）が本プロジェクトのコードを記述・修正する際のガイドラインをまとめたものです。一貫性のある高品質なコードを維持するために、以下のルールに従ってください。

## 🚀 クイックスタート

### プロジェクト概要

- **目的**: 日本の個人事業主・中小企業向け複式簿記システム
- **技術**: Next.js 14 + TypeScript + Express.js + PostgreSQL
- **構成**: pnpm workspaceによるモノレポ

### 重要なディレクトリ構造

```
apps/
├── web/          # Next.js フロントエンド (port: 3000)
└── api/          # Express.js バックエンド (port: 3001)
packages/
├── database/     # Prisma スキーマ (@simple-bookkeeping/database)
├── types/        # 共通型定義 (@simple-bookkeeping/types)
├── errors/       # エラー定義 (@simple-bookkeeping/errors)
└── shared/       # 共有ユーティリティ (@simple-bookkeeping/shared)
```

### よく使うコマンド

```bash
# 開発サーバー起動
pnpm dev                     # 全サービス同時起動
pnpm --filter web dev        # フロントエンドのみ
pnpm --filter api dev        # バックエンドのみ

# ビルド
pnpm build                   # 全体ビルド
pnpm build:web              # Vercel用Webアプリビルド

# テスト実行
pnpm test                    # 全テスト
pnpm test:e2e               # E2Eテスト
pnpm test:coverage          # カバレッジ付きテスト

# DB操作
pnpm db:init                # DB初期化（マイグレーション＋シード）
pnpm db:migrate             # マイグレーション
pnpm db:studio              # Prisma Studio

# デプロイメント監視
pnpm deploy:check           # 両プラットフォーム状態確認
pnpm render:logs runtime    # Renderログ確認
pnpm vercel:logs build      # Vercelビルドログ確認
```

詳細は [npm-scripts-guide.md](./docs/npm-scripts-guide.md) を参照してください。

## 基本原則

### 1. コード品質の維持

- **可読性優先**: 巧妙なコードよりも読みやすいコードを書く
- **DRY原則**: 重複を避け、再利用可能なコンポーネント・関数を作成
- **SOLID原則**: 特に単一責任の原則を意識する
- **早期リターン**: ネストを減らすために早期リターンを活用

### 2. セキュリティファースト

- ユーザー入力は常に検証する
- SQLインジェクション対策（Prismaの使用）
- XSS対策（React の自動エスケープを信頼しつつ、dangerouslySetInnerHTMLは避ける）
- 環境変数で機密情報を管理
- 認証・認可の徹底

## 🔐 機密情報の取り扱い

### 絶対にコミットしてはいけないもの

**以下の情報は絶対にGitリポジトリにコミットしない：**

- APIキー、トークン、シークレット
- データベースの接続情報
- JWT秘密鍵
- OAuth クライアントシークレット
- Vercelトークン、AWSアクセスキー
- その他のクレデンシャル情報

**適切な管理方法：**

```bash
# ❌ Bad: ファイルに直接記載
const API_KEY = "sk-1234567890abcdef";

# ✅ Good: 環境変数から読み込み
const API_KEY = process.env.API_KEY;
```

**必須の対策：**

1. `.env`ファイルは必ず`.gitignore`に含める
2. `.env.example`を作成してサンプル値を提供
3. 機密情報は環境変数またはシークレット管理サービスを使用
4. コミット前に`git diff`で確認

```bash
# コミット前の確認
git diff --staged | grep -E "(password|secret|key|token)" -i
```

### Vercel環境での機密情報管理

```bash
# Vercel CLIを使用した環境変数の設定
vercel env add DATABASE_URL
vercel env add JWT_SECRET
vercel env ls  # 確認

# ローカル開発時は.env.localを使用
touch .env.local
echo "DATABASE_URL=postgresql://..." >> .env.local
```

### 3. テスト駆動開発

- 新機能実装時は先にテストを書く
- 単体テストのカバレッジ80%以上を維持
- E2Eテストで主要なユーザーフローをカバー
- バグ修正時は再現テストを先に書く

## 🎯 AIが最初に確認すべきこと

### 1. 共通型定義の利用

```typescript
// ❌ Bad: 独自に型定義
interface Account { ... }

// ✅ Good: 共通パッケージから import
import { Account, JournalEntry } from '@simple-bookkeeping/types';
```

### 2. エラーハンドリング

```typescript
// ✅ Good: 共通エラークラスを使用
import { ValidationError, NotFoundError } from '@simple-bookkeeping/errors';

if (!account) {
  throw new NotFoundError('Account not found');
}
```

### 3. 認証が必要なエンドポイント

```typescript
// APIルート定義時は必ず認証ミドルウェアを使用
import { authenticate, authorize } from '../middlewares/auth';

router.post(
  '/api/v1/accounts',
  authenticate, // JWT認証
  authorize('accountant'), // 権限チェック
  createAccount
);
```

## TypeScript コーディング規約

### 型定義

```typescript
// ✅ Good: 明示的な型定義
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'accountant' | 'viewer';
}

// ❌ Bad: any型の使用
const processData = (data: any) => { ... }
```

### 非同期処理

```typescript
// ✅ Good: async/await の使用
const fetchUserData = async (userId: string): Promise<User> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');
    return user;
  } catch (error) {
    logger.error('Failed to fetch user', { userId, error });
    throw error;
  }
};

// ❌ Bad: コールバック地獄
```

### エラーハンドリング

```typescript
// ✅ Good: カスタムエラークラスの使用
class ValidationError extends Error {
  constructor(
    public field: string,
    message: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// エラーは適切にキャッチして処理
try {
  await processJournalEntry(data);
} catch (error) {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message, field: error.field });
  }
  throw error; // 予期しないエラーは再スロー
}
```

## React/Next.js コーディング規約

### UI コンポーネントの利用

```typescript
// ✅ Good: shadcn/ui コンポーネントを利用
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem } from '@/components/ui/select';

// ❌ Bad: 独自実装
<button className="..." />
```

### Radix UI Select の注意点

```typescript
// ✅ Good: Radix UI Select の正しい使い方
<Select value={accountId} onValueChange={setAccountId}>
  <SelectTrigger>
    <SelectValue placeholder="勘定科目を選択" />
  </SelectTrigger>
  <SelectContent>
    {accounts.map(account => (
      <SelectItem key={account.id} value={account.id}>
        {account.code} - {account.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### コンポーネント設計

```typescript
// ✅ Good: 関数コンポーネント + TypeScript
interface ButtonProps {
  variant: 'primary' | 'secondary';
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant,
  onClick,
  children,
  disabled = false
}) => {
  return (
    <button
      className={cn(
        'px-4 py-2 rounded',
        variant === 'primary' ? 'bg-blue-500' : 'bg-gray-500',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
```

### 状態管理

```typescript
// ✅ Good: Zustandの使用例
interface JournalStore {
  entries: JournalEntry[];
  isLoading: boolean;
  fetchEntries: (filter?: EntryFilter) => Promise<void>;
  addEntry: (entry: CreateJournalEntry) => Promise<void>;
}

export const useJournalStore = create<JournalStore>((set) => ({
  entries: [],
  isLoading: false,
  fetchEntries: async (filter) => {
    set({ isLoading: true });
    try {
      const entries = await api.getJournalEntries(filter);
      set({ entries });
    } finally {
      set({ isLoading: false });
    }
  },
  // ...
}));
```

### フォーム処理

```typescript
// ✅ Good: React Hook Form + Zodの使用
const journalEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1, '摘要は必須です'),
  lines: z
    .array(
      z.object({
        accountId: z.string().uuid(),
        debitAmount: z.number().min(0),
        creditAmount: z.number().min(0),
      })
    )
    .refine(
      (lines) => {
        const totalDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
        const totalCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);
        return totalDebit === totalCredit;
      },
      { message: '借方と貸方の合計が一致しません' }
    ),
});

type JournalEntryForm = z.infer<typeof journalEntrySchema>;

const {
  register,
  handleSubmit,
  formState: { errors },
} = useForm<JournalEntryForm>({
  resolver: zodResolver(journalEntrySchema),
});
```

## API設計規約

### RESTful エンドポイント

```typescript
// ✅ Good: RESTful な設計
router.get('/api/v1/journal-entries', authenticate, getJournalEntries);
router.post('/api/v1/journal-entries', authenticate, authorize('accountant'), createJournalEntry);
router.put(
  '/api/v1/journal-entries/:id',
  authenticate,
  authorize('accountant'),
  updateJournalEntry
);
router.delete('/api/v1/journal-entries/:id', authenticate, authorize('admin'), deleteJournalEntry);
```

### レスポンス形式

```typescript
// ✅ Good: 一貫したレスポンス形式
interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    total?: number;
  };
}

// 成功時
res.json({
  data: journalEntries,
  meta: { page: 1, total: 100 },
});

// エラー時
res.status(400).json({
  error: {
    code: 'VALIDATION_ERROR',
    message: '入力値が不正です',
    details: errors,
  },
});
```

## データベース操作

### Prismaの使用

```typescript
// ✅ Good: トランザクションの適切な使用
const createJournalEntry = async (data: CreateJournalEntryDto) => {
  return await prisma.$transaction(async (tx) => {
    // 仕訳ヘッダーの作成
    const entry = await tx.journalEntry.create({
      data: {
        entryDate: data.date,
        description: data.description,
        accountingPeriodId: data.periodId,
      },
    });

    // 仕訳明細の作成
    await tx.journalEntryLine.createMany({
      data: data.lines.map((line, index) => ({
        journalEntryId: entry.id,
        accountId: line.accountId,
        debitAmount: line.debitAmount || 0,
        creditAmount: line.creditAmount || 0,
        lineNumber: index + 1,
      })),
    });

    return entry;
  });
};
```

## テスト記述規約

### 単体テスト

```typescript
// ✅ Good: 明確なテストケース
describe('JournalEntryService', () => {
  describe('createEntry', () => {
    it('should create a balanced journal entry', async () => {
      const entryData = {
        date: '2024-01-15',
        description: '売上計上',
        lines: [
          { accountId: 'cash-account-id', debitAmount: 1000, creditAmount: 0 },
          { accountId: 'sales-account-id', debitAmount: 0, creditAmount: 1000 },
        ],
      };

      const result = await service.createEntry(entryData);

      expect(result).toBeDefined();
      expect(result.lines).toHaveLength(2);
      expect(result.status).toBe('approved');
    });

    it('should throw error for unbalanced entry', async () => {
      const unbalancedEntry = {
        // ... 借方と貸方が不一致のデータ
      };

      await expect(service.createEntry(unbalancedEntry)).rejects.toThrow(
        '借方と貸方の合計が一致しません'
      );
    });
  });
});
```

## パフォーマンス最適化

### クエリ最適化

```typescript
// ✅ Good: 必要なデータのみ取得
const getAccountsWithBalance = async (date: Date) => {
  return await prisma.account.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      journalLines: {
        select: {
          debitAmount: true,
          creditAmount: true,
        },
        where: {
          journalEntry: {
            entryDate: { lte: date },
          },
        },
      },
    },
  });
};

// ❌ Bad: N+1問題
const accounts = await prisma.account.findMany();
for (const account of accounts) {
  const balance = await prisma.journalEntryLine.aggregate({
    where: { accountId: account.id },
    _sum: { debitAmount: true, creditAmount: true },
  });
}
```

## Git コミット規約

### コミットメッセージ

```bash
# ✅ Good: 明確で具体的
feat: 仕訳入力フォームのバリデーション機能を追加
fix: 貸借対照表の固定資産合計計算を修正
refactor: 仕訳サービスのエラーハンドリングを改善
test: 勘定科目APIの統合テストを追加

# ❌ Bad: 曖昧
update: いろいろ修正
fix: バグ修正
```

## GitHub Issue管理

### Issue作成のルール

**重要：GitHub issueは必ずgh CLIコマンドを使用して作成すること**

```bash
# issueの作成
gh issue create \
  --title "タイトル" \
  --body "本文" \
  --label "bug,high-priority" \
  --assignee "@me"

# テンプレートファイルから作成
gh issue create \
  --title "タイトル" \
  --body-file issue-template.md \
  --label "enhancement"

# 複数ラベルの設定
gh issue create \
  --title "Refactor: パッケージ構造の重複を解消" \
  --label "refactor,technical-debt,high-priority"
```

### よく使うラベル

- `bug`: バグ報告
- `enhancement`: 機能追加
- `refactor`: リファクタリング
- `technical-debt`: 技術的負債
- `documentation`: ドキュメント
- `testing`: テスト関連
- `security`: セキュリティ
- `performance`: パフォーマンス
- `high-priority`: 優先度高
- `medium-priority`: 優先度中
- `low-priority`: 優先度低

### Issue管理コマンド

```bash
# issue一覧
gh issue list
gh issue list --label "bug"
gh issue list --assignee "@me"

# issue詳細
gh issue view 123

# issueの更新
gh issue edit 123 --add-label "in-progress"
gh issue edit 123 --remove-label "todo"

# issueのクローズ
gh issue close 123 --comment "修正完了"
```

### 重要：pre-commitフックを無視しない

**絶対にやってはいけないこと：**

- `git commit --no-verify` の使用
- pre-commitフックのスキップ
- ESLintエラーやTypeScriptエラーを無視したコミット

**エラーが出た場合の対処法：**

1. すべてのESLintエラーを修正する
2. すべてのTypeScriptエラーを修正する
3. テストが通ることを確認する
4. その後でコミットする

pre-commitフックは品質保証のために存在します。必ず守ってください。

## 🚨 コード品質に関する厳格なルール

### 1. ESLintルールの遵守

**絶対にやってはいけないこと：**

- `// eslint-disable-next-line` の安易な使用
- `// @ts-ignore` や `// @ts-nocheck` の使用
- ESLintのルールを `.eslintrc` で無効化する
- 警告を無視してコミットする
- **「実装の都合」「一時的」「後で修正」などの理由でESLint警告を無視する**
- **「動作に影響しない」という判断でTypeScriptエラーを無視する**

**⚠️ 重要な注意事項：**

ESLintやTypeScriptの警告・エラーは、コード品質を保つための重要なフィードバックです。
これらを無視することは技術的負債を生み出し、将来的に大きな問題につながります。

**絶対に守るべきルール：**

1. **ESLint警告が出たら必ず修正する** - 警告を無視してコミットしない
2. **TypeScriptエラーは即座に解決する** - `any`型で逃げない
3. **「実装の都合」は言い訳にしない** - 正しい実装方法を探す
4. **一時的な回避策を恒久化しない** - TODOコメントも禁止
5. **CI/CDでエラーが出たら必ず対処する** - ローカルで再現して修正

**正しい対処法：**

```typescript
// ❌ Bad: ESLintを無視
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const unusedVar = 'test';

// ✅ Good: 使わない変数は削除するか、アンダースコアを付ける
const _intentionallyUnused = 'test';

// ❌ Bad: any型でごまかす
const data: any = fetchData();

// ✅ Good: 適切な型を定義
interface UserData {
  id: string;
  name: string;
}
const data: UserData = fetchData();

// ❌ Bad: 実装の都合でエラーを無視
try {
  await someOperation();
} catch (error: any) {
  // TypeScriptエラーを無視
  console.log(error.message);
}

// ✅ Good: 適切な型ガードを使用
try {
  await someOperation();
} catch (error) {
  if (error instanceof Error) {
    console.log(error.message);
  } else {
    console.log('Unknown error occurred');
  }
}
```

### 2. TypeScriptの型安全性

**厳守事項：**

- `any` 型は絶対に使用しない（既存コードの修正時を除く）
- `as` によるアサーションは最小限に
- 型推論で十分な場合は明示的な型注釈を避ける
- ジェネリクスを適切に使用する
- **エラーオブジェクトの型は必ず適切に処理する**

```typescript
// ❌ Bad: 型を適当に決める
interface ApiResponse {
  data: any;
  status: number;
}

// ✅ Good: ジェネリクスで型安全性を保つ
interface ApiResponse<T> {
  data: T;
  status: number;
  error?: {
    code: string;
    message: string;
  };
}

// 使用例
const response: ApiResponse<User> = await apiClient.get('/users/123');
```

### 3. テストの実行義務

**push前の必須確認事項：**

```bash
# 1. ESLintチェック
pnpm lint

# 2. TypeScriptの型チェック
pnpm typecheck

# 3. 単体テストの実行
pnpm test

# 4. E2Eテストの実行（必須）
pnpm --filter web test:e2e

# 5. ビルドが通ることを確認
pnpm build
```

**⚠️ 重要: Push前の必須手順**

以下の手順を**必ず順番通りに実行**してからpushすること：

1. **Lint チェック**

   ```bash
   pnpm lint
   # エラーがある場合は修正してから次へ
   ```

2. **Unit Test 実行**

   ```bash
   pnpm test
   # 全てのテストが通ることを確認
   ```

3. **E2E Test 実行（絶対にスキップしない）**

   ```bash
   pnpm --filter web test:e2e
   # ローカルでE2Eテストが全て通ることを確認
   # 失敗した場合は必ず修正してから再実行
   ```

4. **最終ビルド確認**
   ```bash
   pnpm build
   # ビルドエラーがないことを確認
   ```

**🚫 絶対にやってはいけないこと：**

- E2Eテストをスキップしてpushする
- テストが失敗したまま`--no-verify`でpushする
- `test.skip`や`describe.skip`を使ってテストを無効化する
- ローカルで確認せずにCIでのテストに頼る

**テストが失敗した場合：**

1. 必ず失敗の原因を調査する
2. テストを修正するか、コードを修正する
3. テストをスキップしたり削除したりしない
4. E2Eテストは特に重要 - 必ず全て通してからpush

### 4. エラーハンドリングの徹底

```typescript
// ❌ Bad: エラーを握りつぶす
try {
  await someAsyncOperation();
} catch (error) {
  // 何もしない
}

// ❌ Bad: 型情報を失う
try {
  await someAsyncOperation();
} catch (error: any) {
  console.log(error.message);
}

// ✅ Good: 適切なエラーハンドリング
try {
  await someAsyncOperation();
} catch (error) {
  if (error instanceof ValidationError) {
    logger.warn('Validation failed', { error });
    throw new BadRequestError(error.message);
  }

  logger.error('Unexpected error', { error });
  throw error;
}
```

### 5. コードレビューシミュレーション

**コミット前の自己チェック：**

- [ ] 追加した型定義は適切か？
- [ ] エラーケースは網羅されているか？
- [ ] テストケースは十分か？
- [ ] パフォーマンスへの影響はないか？
- [ ] セキュリティ上の問題はないか？
- [ ] ログは適切に出力されているか？
- [ ] ドキュメントの更新は必要ないか？

## 実装前のチェックリスト

1. **要件の確認**
   - [ ] 仕様書を読んで理解したか
   - [ ] 不明点は質問したか
   - [ ] 影響範囲を把握したか

2. **設計の検討**
   - [ ] 既存コードとの整合性を確認したか
   - [ ] パフォーマンスへの影響を考慮したか
   - [ ] セキュリティリスクを検討したか

3. **実装時の確認**
   - [ ] TypeScriptの型を適切に定義したか
   - [ ] エラーハンドリングは適切か
   - [ ] テストは書いたか

4. **コミット前の確認**
   - [ ] lintは通ったか
   - [ ] テストは通ったか
   - [ ] 不要なconsole.logは削除したか

## サーバー起動時の必須確認事項

### Webサーバー起動手順

```bash
# サーバー起動
pnpm --filter @simple-bookkeeping/web dev

# 疎通確認（必須）
curl -I http://localhost:3000
curl -s http://localhost:3000 | grep -q "Simple Bookkeeping"
```

### **重要**: サーバー起動時の必須ルール

1. **疎通確認必須**: サーバー起動後は必ず動作確認を行う
2. **複数ページテスト**: 主要ページ（/, /demo, /demo/accounts, /demo/journal-entries）の動作を確認
3. **失敗時の対応**: 疎通確認に失敗した場合は原因調査と再起動を行う
4. **ユーザー報告**: 疎通確認完了後にのみURLを案内する

### 疎通確認コマンド例

```bash
# 基本疎通確認
curl -I http://localhost:3000

# ページ内容確認
curl -s http://localhost:3000 | head -5

# デモページ確認
curl -s http://localhost:3000/demo | grep -q "機能デモ" && echo "✅ Demo working" || echo "❌ Demo failed"
curl -s http://localhost:3000/demo/accounts | grep -q "勘定科目管理" && echo "✅ Accounts working" || echo "❌ Accounts failed"
curl -s http://localhost:3000/demo/journal-entries | grep -q "仕訳入力" && echo "✅ Journal entries working" || echo "❌ Journal entries failed"
```

### APIサーバー起動時も同様に確認

```bash
# APIサーバー起動
pnpm --filter @simple-bookkeeping/api dev

# 疎通確認
curl -I http://localhost:3001/api/v1/
curl -s http://localhost:3001/api/v1/ | grep -q "Simple Bookkeeping API"
```

## 🔐 セキュリティ対策

### 機密情報の漏洩防止

#### 1. **Gitleaksの使用**

pre-commitフックで自動的に機密情報をチェックします。

```bash
# Gitleaksのインストール
brew install gitleaks

# 手動でチェック
gitleaks detect --source . --verbose

# コミット履歴をチェック
gitleaks detect --source . --log-opts="--all" --verbose
```

#### 2. **.gitignoreの重要パターン**

```gitignore
# 環境変数
.env
.env.*
!.env.example
!.env.*.example

# 認証情報
*secret*
*token*
*password*
*credential*
*.jwt
*.pem
*.key
*.cert

# プラットフォーム固有
railway.json
.env.railway
supabase/.env
```

#### 3. **コミット前確認事項**

- [ ] 環境変数ファイルは.gitignoreに含まれているか
- [ ] ハードコードされた認証情報はないか
- [ ] テスト用の認証情報はダミー値か
- [ ] gitleaksのチェックをパスしたか

#### 4. **漏洩時の対応**

1. **即座にキーを無効化**
   - 該当サービスのダッシュボードでキーを再生成
   - データベースパスワードの変更

2. **Git履歴から削除**

   ```bash
   # BFG Repo-Cleanerを使用
   brew install bfg
   bfg --delete-files .env
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```

3. **影響範囲の確認**
   - アクセスログの確認
   - 不正アクセスの有無をチェック

### 環境変数管理のベストプラクティス

1. **環境変数ファイルの命名規則**
   - `.env` - ローカル開発用（.gitignore対象）
   - `.env.example` - サンプル（コミット可）
   - `.env.local` - Next.jsローカル設定（.gitignore対象）
   - `.env.production` - 本番環境設定（絶対にコミットしない）

2. **環境変数のテンプレート化**

   ```bash
   # .env.exampleを常に最新に保つ
   cp .env .env.example
   # 値をプレースホルダーに置換
   sed -i 's/=.*/=your_value_here/' .env.example
   ```

3. **プラットフォームごとの管理**
   - Vercel: ダッシュボードまたはCLIで管理
   - Railway: ダッシュボードまたはCLIで管理
   - GitHub Actions: Secretsで管理

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

## 🚀 Vercel デプロイメント

### Vercel CLIの使用

**重要：Vercel関連の操作は必ずVercel CLIを使用する**

```bash
# プロジェクトのリンク
vercel link

# 環境変数の管理
vercel env ls                          # 一覧表示
vercel env add SECRET_KEY             # 追加（対話形式で値を入力）
vercel env rm OLD_SECRET              # 削除
vercel env pull .env.local            # ローカルに環境変数をダウンロード

# デプロイメント
vercel                                # プレビューデプロイ
vercel --prod                         # 本番デプロイ

# ログ確認
vercel logs                           # 最新のログ
vercel logs [deployment-url]          # 特定のデプロイメントのログ

# プロジェクト設定
vercel project                        # 現在の設定確認
```

### デプロイ前のチェックリスト

1. **機密情報の確認**

   ```bash
   # ステージングエリアに機密情報が含まれていないか確認
   git diff --staged | grep -E "(password|secret|key|token|credential)" -i
   ```

2. **環境変数の設定**

   ```bash
   # 本番環境に必要な環境変数が設定されているか確認
   vercel env ls
   ```

3. **ビルドの確認**
   ```bash
   # ローカルでビルドが成功することを確認
   pnpm build
   ```

### Vercelプロジェクト設定

`vercel.json`で以下の設定を管理：

```json
{
  "buildCommand": "pnpm build --filter=@simple-bookkeeping/web",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install --frozen-lockfile",
  "framework": "nextjs",
  "devCommand": "pnpm dev --filter=@simple-bookkeeping/web"
}
```

**注意：vercel.jsonに機密情報を記載しない**

## 🚀 RenderとVercel両方でのデプロイメント

### マルチプラットフォーム対応の設定のコツ

本プロジェクトはRender（APIサーバー）とVercel（Webアプリ）の両方にデプロイできるよう設計されています。

#### 1. **package.jsonのビルドスクリプト設定**

```json
// apps/api/package.json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  }
}

// apps/web/package.json
{
  "scripts": {
    "build": "next build",
    "start": "next start",
    "dev": "next dev"
  }
}
```

#### 2. **環境変数の分離**

```bash
# Render用（APIサーバー）
DATABASE_URL=postgresql://...
JWT_SECRET=...
NODE_ENV=production
PORT=3001

# Vercel用（Webアプリ）
NEXT_PUBLIC_API_URL=https://your-api.onrender.com
```

#### 3. **ビルドコマンドの統一**

```json
// ルートのpackage.json
{
  "scripts": {
    "build": "turbo run build",
    "build:packages": "turbo run build --filter='./packages/*'",
    "build:apps": "turbo run build --filter='./apps/*'",
    "build:web": "pnpm --filter @simple-bookkeeping/database prisma:generate && pnpm build:packages && pnpm --filter @simple-bookkeeping/web build"
  }
}
```

#### 4. **Renderでのデプロイ設定（render.yaml）**

```yaml
services:
  - type: web
    name: simple-bookkeeping-api
    runtime: node
    plan: free
    buildCommand: pnpm install --prod=false && cd packages/database && npx prisma generate && cd ../.. && pnpm --filter @simple-bookkeeping/database build && pnpm --filter @simple-bookkeeping/core build && pnpm --filter @simple-bookkeeping/shared build && pnpm --filter @simple-bookkeeping/api build
    startCommand: cd apps/api && node dist/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: simple-bookkeeping-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: CORS_ORIGIN
        value: https://your-web-app.vercel.app

databases:
  - name: simple-bookkeeping-db
    plan: free
    databaseName: simple_bookkeeping
    user: simple_bookkeeping_user
```

#### 5. **Vercelでのデプロイ設定（vercel.json）**

```json
// ルートのvercel.json（Gitデプロイメント設定のみ）
{
  "git": {
    "deploymentEnabled": {
      "main": true
    }
  }
}

// apps/web/vercel.json（実際のビルド設定）
{
  "buildCommand": "cd ../.. && pnpm build:web",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile --prod=false"
}
```

#### 6. **TypeScriptの設定**

両プラットフォームで動作するように、各アプリのtsconfig.jsonを適切に設定：

```json
// apps/api/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "references": [{ "path": "../../packages/database" }, { "path": "../../packages/types" }]
}
```

#### 7. **依存関係の解決**

```json
// 各パッケージのpackage.json
{
  "dependencies": {
    "@simple-bookkeeping/database": "workspace:*",
    "@simple-bookkeeping/types": "workspace:*"
  }
}
```

#### 8. **ビルド時の注意点**

1. **パッケージの順序**：共通パッケージを先にビルド

   ```bash
   pnpm --filter './packages/*' build
   pnpm --filter './apps/*' build
   ```

2. **Prismaクライアントの生成**：

   ```bash
   pnpm --filter @simple-bookkeeping/database prisma:generate
   ```

3. **環境変数の確認**：
   - Render: ダッシュボードで設定
   - Vercel: `vercel env add`で設定

4. **Vercel特有の設定**：
   - apps/web内に専用のvercel.jsonを配置する
   - ルートのvercel.jsonはGitデプロイメント設定のみに使用
   - buildCommandでは必ず`cd ../..`でモノレポルートに移動

5. **デバッグのコツ**：
   - Vercel CLIで`vercel logs`コマンドを活用
   - ビルドエラーは`vercel inspect`で詳細確認
   - ローカルで`vercel dev`を使って環境を再現

#### 9. **トラブルシューティング**

##### Vercel特有の問題と解決策

**1. TypeScriptコンパイルエラー（`tsc: command not found`）**

問題：本番ビルドでTypeScriptがdevDependenciesにあるため利用できない

```bash
# ❌ エラーが発生する設定
"installCommand": "pnpm install --frozen-lockfile"

# ✅ 解決策：devDependenciesも含める
"installCommand": "pnpm install --frozen-lockfile --prod=false"
```

**2. outputDirectoryパスエラー**

問題：`routes-manifest.json`が見つからない

```bash
# ❌ モノレポルートからの相対パスは問題を起こす
{
  "outputDirectory": "apps/web/.next"
}

# ✅ 解決策：apps/web内にvercel.jsonを配置
# apps/web/vercel.json
{
  "outputDirectory": ".next",
  "buildCommand": "cd ../.. && pnpm build:web"
}
```

**3. buildCommandの文字数制限（256文字）**

問題：Vercelのschema validationエラー

```bash
# ❌ 長すぎるbuildCommand
"buildCommand": "cd ../.. && pnpm --filter @simple-bookkeeping/database prisma:generate && pnpm --filter @simple-bookkeeping/database build && ..."

# ✅ 解決策：ルートのpackage.jsonにスクリプトを追加
// package.json
"scripts": {
  "build:web": "pnpm --filter @simple-bookkeeping/database prisma:generate && pnpm build:packages && pnpm --filter @simple-bookkeeping/web build"
}

// apps/web/vercel.json
"buildCommand": "cd ../.. && pnpm build:web"
```

**4. Prismaクライアント生成エラー**

問題：`Cannot find module '.prisma/client'`

```bash
# ✅ buildCommandに必ず含める
pnpm --filter @simple-bookkeeping/database prisma:generate
```

##### Render特有の問題と解決策

**1. Node.js型定義エラー**

問題：`Cannot find type definition file for 'node'`、`Cannot find name 'global'`

```bash
# ❌ エラーが発生する設定（render.yaml）
buildCommand: pnpm install && ...

# ✅ 解決策1：devDependenciesもインストール
buildCommand: pnpm install --prod=false && ...

# ✅ 解決策2：tsconfig.jsonから"types": ["node"]を削除
# TypeScriptが自動的に@types/nodeを検出
```

**2. seed.tsの配置場所**

問題：seed.tsがsrcディレクトリにあるとビルドエラー

```bash
# ❌ 間違った配置
packages/database/src/seed.ts

# ✅ 正しい配置
packages/database/prisma/seed.ts
```

**3. Renderでビルドが失敗する場合：**

```bash
# package.jsonに追加
"engines": {
  "node": ">=18.0.0",
  "pnpm": ">=8.0.0"
}
```

##### 共通の問題

**型定義が見つからない場合：**

```bash
# 全パッケージをビルド
pnpm build:packages
```

**モノレポの依存関係エラー：**

```bash
# workspace:* の解決に失敗する場合
pnpm install --shamefully-hoist
```

#### 10. **デプロイ前のチェックリスト**

- [ ] ローカルで`pnpm build`が成功する
- [ ] 環境変数が各プラットフォームに設定されている
- [ ] データベースマイグレーションが完了している
- [ ] CORSの設定が正しい（APIサーバー）
- [ ] APIのURLが正しく設定されている（Webアプリ）
- [ ] TypeScriptのdevDependenciesが本番でも利用可能（`--prod=false`）
- [ ] Vercelの場合、apps/web/vercel.jsonが存在する
- [ ] Prismaクライアント生成がbuildCommandに含まれている

#### 11. **デプロイメント成功の鍵**

1. **段階的なデバッグ**
   - まずローカルでプロダクションビルドを確認
   - Vercel CLIで`vercel`コマンドでプレビューデプロイ
   - 問題があれば`vercel logs`で詳細確認

2. **モノレポ構造の理解**
   - ビルドコマンドは常にモノレポルートから実行
   - 各アプリケーションは自身のディレクトリにvercel.jsonを配置
   - 共有パッケージのビルドを忘れない

3. **よくある落とし穴の回避**
   - `db:generate`ではなく`prisma:generate`を使用
   - outputDirectoryは相対パスで指定
   - installCommandでdevDependenciesを含める（`--prod=false`）
   - buildCommandは256文字以内に収める
   - seed.tsはprismaディレクトリに配置

4. **プラットフォーム別の注意点**

   **Vercel:**
   - apps/web内に独自のvercel.jsonを配置
   - ルートのvercel.jsonはGit設定のみ
   - buildCommandが長い場合はpackage.jsonにスクリプト化

   **Render:**
   - render.yamlでbuildCommandに`--prod=false`を指定
   - TypeScript関連のエラーはdevDependenciesの問題が多い
   - データベース接続はfromDatabaseプロパティで自動設定

## 🚀 デプロイメント状況の確認

### デプロイメント監視コマンド

```bash
# 両プラットフォームの状態を一度に確認
pnpm deploy:check

# Renderの状態確認（API版）
pnpm render:status

# Renderのログ確認
pnpm render:logs runtime    # ランタイムログ
pnpm render:logs build      # ビルドログ
pnpm render:logs errors     # エラーログのみ

# Vercelの状態確認（API版）
pnpm vercel:status

# Vercelのログ確認
pnpm vercel:logs build      # ビルドログ
pnpm vercel:logs runtime    # ランタイムログ
```

### Render APIのセットアップ

1. **APIキーの取得**
   - https://dashboard.render.com/u/settings にアクセス
   - API Keysセクションで新しいキーを作成

2. **環境変数の設定**

   ```bash
   # .env.localに追加
   RENDER_API_KEY=rnd_xxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. **サービス設定（オプション）**
   ```bash
   # .render/services.jsonを作成してサービスIDを保存
   {
     "services": {
       "api": {
         "id": "srv-xxxxxxxxxxxxxxxxxx",
         "name": "simple-bookkeeping-api"
       }
     }
   }
   ```

### Vercel APIのセットアップ

1. **APIトークンの取得**
   - https://vercel.com/account/tokens にアクセス
   - 「Create Token」をクリック

2. **環境変数の設定**
   ```bash
   # .env.localに追加
   VERCEL_TOKEN=xxxxxxxxxxxxxxxxxxxx
   ```

### デプロイメントステータスの意味

**Render:**

- `live`: 稼働中（成功）
- `build_in_progress` / `update_in_progress`: ビルド・更新中
- `build_failed`: ビルド失敗
- `deploy_failed`: デプロイ失敗

**Vercel:**

- 🟢 Ready (Production)
- 🔵 Ready (Preview)
- 🔴 Error/Failed
- 🟡 Building/Deploying

### デプロイメントドキュメント

詳細なデプロイメント手順やトラブルシューティングについては、[docs/deployment/](./docs/deployment/) を参照してください：

- [README.md](./docs/deployment/README.md) - クイックスタート
- [detailed-guide.md](./docs/deployment/detailed-guide.md) - 詳細手順
- [troubleshooting.md](./docs/deployment/troubleshooting.md) - トラブルシューティング
- [scripts-reference.md](./docs/deployment/scripts-reference.md) - スクリプトリファレンス

## 継続的な改善

このガイドラインは生きたドキュメントです。プロジェクトの成長に合わせて、以下の点を定期的に見直してください：

- 新しいベストプラクティスの追加
- 古くなったルールの更新
- チーム全体での合意形成
- 実装例の追加・更新

## 📚 プロジェクト固有のドキュメント

### 必読ドキュメント

- [SYSTEM-ARCHITECTURE.md](./SYSTEM-ARCHITECTURE.md) - システム構成とポート番号
- [docs/e2e-test-implementation.md](./docs/e2e-test-implementation.md) - E2Eテストの実装方法
- [docs/user-story-testing-guide.md](./docs/user-story-testing-guide.md) - ユーザーストーリーテスト
- [docs/npm-scripts-guide.md](./docs/npm-scripts-guide.md) - npmスクリプトの一覧と説明
- [docs/direnv-setup.md](./docs/direnv-setup.md) - direnvを使用した環境変数管理
- [docs/deployment/](./docs/deployment/) - デプロイメントガイド

### API仕様

- 認証エンドポイント: `/api/v1/auth/*`
- 勘定科目: `/api/v1/accounts`
- 仕訳: `/api/v1/journal-entries`
- レポート: `/api/v1/reports/*`

### データベーススキーマ

```bash
# スキーマ確認
cat packages/database/prisma/schema.prisma

# ER図生成
pnpm --filter @simple-bookkeeping/database prisma:studio
```

## リソース

- [TypeScript ドキュメント](https://www.typescriptlang.org/docs/)
- [Next.js ドキュメント](https://nextjs.org/docs)
- [Prisma ドキュメント](https://www.prisma.io/docs/)
- [React Hook Form](https://react-hook-form.com/)
- [Zod](https://zod.dev/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)

### サーバー管理に関する重要メモ

- 修正をする開発するときはサーバーの立ち上げっぱなしをなくすために必ずサーバーを落とすようにしてください。

## 🛡️ プロジェクトのセキュリティポリシー

### 必須のセキュリティツール

1. **Gitleaks** - 機密情報の検出

   ```bash
   brew install gitleaks
   ```

2. **pre-commitフック** - 自動チェック
   - ESLint
   - TypeScript
   - Gitleaks
   - Prettier

3. **依存関係の脆弱性チェック**
   ```bash
   pnpm audit
   pnpm update --interactive
   ```

### セキュリティチェックリスト

**毎回のコミット前：**

- [ ] `git diff --staged`で差分を確認
- [ ] 機密情報が含まれていないか目視確認
- [ ] pre-commitフックが正常に動作

**定期的に実施：**

- [ ] 依存関係の更新
- [ ] セキュリティ監査
- [ ] アクセスログの確認

## 🏗️ ビルドチェックの重要性

**本プロジェクトのビルドチェック体制：**

1. **pre-commit時（軽量チェック）**
   - ESLint + Prettier
   - 変更されたパッケージの型チェック
   - Gitleaksによる機密情報チェック

2. **pre-push時（完全ビルドチェック）**
   - Vercel用Webアプリの完全ビルド
   - Render用APIサーバーの完全ビルド
   - 共有パッケージのビルド

**ローカルでのビルドチェック方法：**

```bash
# 軽量チェック（commit前）
pnpm check:types        # TypeScriptの型チェック
pnpm lint              # ESLintチェック

# 完全ビルドチェック（push前）
pnpm build:check       # Vercel/Render両方のビルドチェック
pnpm prepush:check     # pre-pushフックと同じチェック

# 個別のビルドチェック
pnpm --filter @simple-bookkeeping/web build    # Vercel (Web)
pnpm --filter @simple-bookkeeping/api build    # Render (API)
```

**ビルドエラーが発生した場合：**

1. **まずエラーメッセージを確認**
2. **依存関係の問題の場合**：
   ```bash
   pnpm install
   pnpm --filter @simple-bookkeeping/database prisma:generate
   ```
3. **型エラーの場合**：
   - 該当ファイルを修正
   - 必要に応じて型定義を更新
4. **それでも解決しない場合**：
   - `pnpm clean && pnpm install`
   - `.next`や`dist`ディレクトリを削除

**重要：デプロイメント前には必ずローカルでビルドが成功することを確認してください。**
