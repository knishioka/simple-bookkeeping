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
pnpm --filter @simple-bookkeeping/web dev
pnpm --filter @simple-bookkeeping/api dev

# テスト実行
pnpm test                    # 全テスト
pnpm --filter web test:e2e   # E2Eテスト

# DB操作
pnpm db:migrate   # マイグレーション
pnpm db:studio    # Prisma Studio
```

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
```

### 2. TypeScriptの型安全性

**厳守事項：**

- `any` 型は絶対に使用しない（既存コードの修正時を除く）
- `as` によるアサーションは最小限に
- 型推論で十分な場合は明示的な型注釈を避ける
- ジェネリクスを適切に使用する

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

# 4. 該当する場合はE2Eテストも実行
pnpm --filter web test:e2e

# 5. ビルドが通ることを確認
pnpm build
```

**テストが失敗した場合：**

1. 必ず失敗の原因を調査する
2. テストを修正するか、コードを修正する
3. テストをスキップしたり削除したりしない
4. `test.skip` や `describe.skip` は使用しない

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
