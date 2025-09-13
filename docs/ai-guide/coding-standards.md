# コーディング規約

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
// ✅ Good: Server Actions内でのエラーハンドリング
// Server Actions内で適切なエラーメッセージを返す
export async function getAccount(id: string) {
  if (!account) {
    return { error: 'Account not found' };
  }
  return { data: account };
}
```

### 3. 認証が必要な処理（Server Actions）

```typescript
// Server Actionでの認証チェック
import { createClient } from '@/lib/supabase/server';

export async function createAccount(formData: FormData) {
  'use server';

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // 処理を実装
  const result = await supabase.from('accounts').insert({
    /* ... */
  });

  return result;
}
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

// ❌ Bad: any型の使用（厳格に禁止）
const processData = (data: any) => { ... }  // ESLintエラーになります
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

## Server Actions設計規約

### Server Actionsの実装パターン

```typescript
// app/actions/journal-entries.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// 取得
export async function getJournalEntries() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// 作成
export async function createJournalEntry(formData: FormData) {
  const supabase = createClient();

  // 認証チェック
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const entry = {
    date: formData.get('date') as string,
    description: formData.get('description') as string,
    // ...
  };

  const { data, error } = await supabase.from('journal_entries').insert(entry).select().single();

  if (error) throw error;

  // キャッシュの再検証
  revalidatePath('/journal-entries');

  return data;
}
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

- **`any` 型は絶対に使用しない** - ESLintでエラーとして扱われ、CIも失敗します
- `as` によるアサーションは最小限に
- 型推論で十分な場合は明示的な型注釈を避ける
- ジェネリクスを適切に使用する
- **エラーオブジェクトの型は必ず適切に処理する**
- 不明な型には`unknown`を使用し、型ガードで絞り込む

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

### 3. エラーハンドリングの徹底

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

### 4. コードレビューシミュレーション

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
