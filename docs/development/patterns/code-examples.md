# コード実装パターン集

本ドキュメントでは、Simple Bookkeepingプロジェクトで使用する実装パターンと例を示します。

## TypeScript パターン

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
```

## React/Next.js パターン

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

### Radix UI Select の実装

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

### 状態管理（Zustand）

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

### フォーム処理（React Hook Form + Zod）

```typescript
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

## API設計パターン

### RESTfulエンドポイント

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

## データベース操作パターン

### Prismaトランザクション

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

## テストパターン

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

### E2Eテストパターン

```typescript
// ✅ Good: ページを開いてから認証設定
test('認証が必要なページ', async ({ page, context }) => {
  // まず適当なページを開く
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // 認証設定
  await UnifiedAuth.setupMockRoutes(context);
  await UnifiedAuth.setAuthData(page);

  // APIモックの設定
  await context.route('**/api/v1/auth/me', async (route) => {
    // ユーザー情報のモック
  });

  // 認証が必要なページへ移動
  await page.goto('/dashboard/...', { waitUntil: 'domcontentloaded' });
});
```

## 関連ドキュメント

- [コーディング規約](../CLAUDE.md#typescript-コーディング規約)
- [テストガイド](../../testing/)
- [API仕様](../../specifications/api-design.md)
