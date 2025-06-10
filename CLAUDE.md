# CLAUDE.md - AIコーディングガイドライン

## 概要
このドキュメントは、AIアシスタント（Claude）が本プロジェクトのコードを記述・修正する際のガイドラインをまとめたものです。一貫性のある高品質なコードを維持するために、以下のルールに従ってください。

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
  constructor(public field: string, message: string) {
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
  lines: z.array(z.object({
    accountId: z.string().uuid(),
    debitAmount: z.number().min(0),
    creditAmount: z.number().min(0),
  })).refine(
    (lines) => {
      const totalDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
      const totalCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);
      return totalDebit === totalCredit;
    },
    { message: '借方と貸方の合計が一致しません' }
  ),
});

type JournalEntryForm = z.infer<typeof journalEntrySchema>;

const { register, handleSubmit, formState: { errors } } = useForm<JournalEntryForm>({
  resolver: zodResolver(journalEntrySchema),
});
```

## API設計規約

### RESTful エンドポイント
```typescript
// ✅ Good: RESTful な設計
router.get('/api/v1/journal-entries', authenticate, getJournalEntries);
router.post('/api/v1/journal-entries', authenticate, authorize('accountant'), createJournalEntry);
router.put('/api/v1/journal-entries/:id', authenticate, authorize('accountant'), updateJournalEntry);
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
  meta: { page: 1, total: 100 }
});

// エラー時
res.status(400).json({
  error: {
    code: 'VALIDATION_ERROR',
    message: '入力値が不正です',
    details: errors
  }
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
      }
    });

    // 仕訳明細の作成
    await tx.journalEntryLine.createMany({
      data: data.lines.map((line, index) => ({
        journalEntryId: entry.id,
        accountId: line.accountId,
        debitAmount: line.debitAmount || 0,
        creditAmount: line.creditAmount || 0,
        lineNumber: index + 1,
      }))
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
        ]
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

      await expect(service.createEntry(unbalancedEntry))
        .rejects
        .toThrow('借方と貸方の合計が一致しません');
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
            entryDate: { lte: date }
          }
        }
      }
    }
  });
};

// ❌ Bad: N+1問題
const accounts = await prisma.account.findMany();
for (const account of accounts) {
  const balance = await prisma.journalEntryLine.aggregate({
    where: { accountId: account.id },
    _sum: { debitAmount: true, creditAmount: true }
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