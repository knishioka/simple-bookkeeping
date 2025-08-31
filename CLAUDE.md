# CLAUDE.md - AIコーディングガイドライン

## 概要

このドキュメントは、AIアシスタント（Claude）が本プロジェクトのコードを記述・修正する際のガイドラインをまとめたものです。一貫性のある高品質なコードを維持するために、以下のルールに従ってください。

## 🚀 クイックスタート

### プロジェクト概要

- **目的**: 日本の個人事業主・中小企業向け複式簿記システム
- **技術**: Next.js 14 (App Router) + TypeScript + Supabase + PostgreSQL
- **構成**: pnpm workspaceによるモノレポ
- **アーキテクチャ**: Server Actions を使用したフルスタック Next.js アプリケーション

### 重要なディレクトリ構造

```
apps/web/                 # Next.js フルスタックアプリケーション (port: 3000)
├── app/
│   ├── actions/         # Server Actions (ビジネスロジック)
│   │   ├── accounts.ts
│   │   ├── journal-entries.ts
│   │   └── reports.ts
│   ├── (auth)/         # 認証ページ
│   ├── dashboard/      # ダッシュボード
│   └── layout.tsx
├── components/
│   └── ui/            # shadcn/ui コンポーネント
└── lib/
    └── supabase.ts    # Supabase クライアント

packages/
├── database/          # Prisma スキーマ (@simple-bookkeeping/database)
└── shared/           # 共有ユーティリティ (@simple-bookkeeping/shared)

[廃止予定]
apps/api/             # Express.js API (移行中につき使用禁止)
packages/types/       # 型定義 (TypeScript推論で代替)
packages/errors/      # エラー定義 (Server Actions内で定義)
```

### よく使うコマンド

```bash
# 開発サーバー起動
pnpm dev                     # Next.js開発サーバー起動
pnpm --filter web dev        # 同上（互換性のため残存）

# ビルド
pnpm build                   # 全体ビルド
pnpm build:web              # Vercel用Webアプリビルド

# テスト実行
pnpm test                    # 全テスト
pnpm test:e2e               # E2Eテスト
pnpm test:coverage          # カバレッジ付きテスト

# 問題のあるテストの確認
pnpm test:failing           # 失敗した8つのテストのみ実行
pnpm test:accounting        # 会計期間管理のテスト
pnpm test:audit            # 監査ログのテスト
pnpm test:demo             # デモページのテスト

# サービス状態確認
pnpm health                 # Web/APIサービスの状態確認
pnpm health:services       # HTTP応答確認
pnpm health:api           # Port 3001の使用状況確認（廃止予定）

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

## ⚠️ アーキテクチャ移行中の注意事項

### 現在進行中の移行

**From (現在):**

- Express.js APIサーバー (Port 3001)
- Next.js フロントエンド (Port 3000)
- JWT認証
- Prisma ORM

**To (移行先):**

- Next.js Server Actions のみ
- Supabase (Database + Auth)
- Row Level Security (RLS)
- Edge Functions (必要に応じて)

### 実装時の重要な指針

1. **新機能はServer Actionsで実装**
   - `/app/actions/` ディレクトリに配置
   - Express.js APIは使用しない
   - 例: `app/actions/accounts.ts`

2. **認証はSupabaseを使用**
   - JWT認証コードは追加しない
   - `@supabase/ssr` を使用
   - サーバーコンポーネントでの認証チェック

3. **データベースアクセス**
   - 新規: Supabase Client経由
   - 既存: Prisma (移行までの暫定)

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

## テスト記述規約

### Server Actionsのテスト

```typescript
// ✅ Good: Server Actionsのテスト
import { createJournalEntry, getJournalEntries } from '@/app/actions/journal-entries';
import { createClient } from '@/lib/supabase/server';

// モックの設定
jest.mock('@/lib/supabase/server');

describe('Journal Entry Actions', () => {
  describe('createJournalEntry', () => {
    it('should create a balanced journal entry', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'test-user' } },
          }),
        },
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: '123', date: '2024-01-15' },
              }),
            }),
          }),
        }),
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      const formData = new FormData();
      formData.append('date', '2024-01-15');
      formData.append('description', '売上計上');

      const result = await createJournalEntry(formData);

      expect(result.id).toBe('123');
      expect(mockSupabase.from).toHaveBeenCalledWith('journal_entries');
    });

    it('should throw error if user is not authenticated', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
          }),
        },
      };

      (createClient as jest.Mock).mockReturnValue(mockSupabase);

      const formData = new FormData();

      await expect(createJournalEntry(formData)).rejects.toThrow('Unauthorized');
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

## E2Eテスト実装の教訓

### 1. **実装前の確認事項**

E2Eテストを実装する前に必ず以下を確認すること：

1. **実際のファイル存在確認**

   ```bash
   # テスト対象のファイルが存在するか確認
   ls -la apps/web/e2e/
   find apps/web -name "*.spec.ts" -type f
   ```

2. **アプリケーション構造の理解**

   ```bash
   # ページ構造を確認
   ls -la apps/web/src/app/
   # デモページと認証が必要なページを区別
   ls -la apps/web/src/app/demo/
   ls -la apps/web/src/app/dashboard/
   ```

3. **既存のテストパターンを参照**
   ```bash
   # 成功しているテストを参考にする
   grep -r "test\|describe" apps/web/e2e/*.spec.ts
   ```

### 2. **認証の扱い**

認証が必要なページのテストでは以下のパターンを使用：

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

// ❌ Bad: beforeEachで全テスト共通の認証設定
test.beforeEach(async ({ page, context }) => {
  await UnifiedAuth.setAuthData(page); // about:blankで失敗する可能性
});
```

### 3. **セレクタの選択**

```typescript
// ✅ Good: 複数の可能性を考慮した柔軟なセレクタ
const pageHasContent = await page.evaluate(() => {
  const bodyText = document.body.innerText || '';
  return (
    bodyText.includes('勘定科目') ||
    bodyText.includes('Accounts') ||
    document.querySelector('table') !== null ||
    document.querySelector('main') !== null
  );
});

// ❌ Bad: 単一の厳密なセレクタ
await expect(page.locator('h1:has-text("勘定科目")')).toBeVisible();
```

### 4. **デモページ vs ダッシュボードページ**

- **デモページ（/demo/...）**: 認証不要、公開ページ
- **ダッシュボードページ（/dashboard/...）**: 認証必要、適切なモック設定が必要

### 5. **ローカルテストの重要性**

```bash
# 必ずローカルで実行してから commit/push
REUSE_SERVER=true npx playwright test --project=chromium-desktop --reporter=list

# 特定のテストファイルのみ実行
REUSE_SERVER=true npx playwright test extended-coverage.spec.ts --project=chromium-desktop --reporter=list
```

### 6. **エラー時のデバッグ**

```bash
# トレースファイルを確認
npx playwright show-trace test-results/.../trace.zip

# スクリーンショットを確認
open test-results/.../test-failed-1.png
```

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

# 疎通確認（廃止予定）
# Express.js APIサーバーは段階的に廃止されます
# curl -I http://localhost:3001/api/v1/
# curl -s http://localhost:3001/api/v1/ | grep -q "Simple Bookkeeping API"
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

## 📚 プロジェクト固有のドキュメント

### 必読ドキュメント

- [システム構成](./docs/architecture/README.md) - システム構成とポート番号
- [E2Eテストドキュメント](./docs/testing/e2e/) - E2Eテストの実装方法
- [docs/user-story-testing-guide.md](./docs/user-story-testing-guide.md) - ユーザーストーリーテスト
- [docs/npm-scripts-guide.md](./docs/npm-scripts-guide.md) - npmスクリプトの一覧と説明
- [docs/direnv-setup.md](./docs/direnv-setup.md) - direnvを使用した環境変数管理
- [docs/deployment/](./docs/deployment/) - デプロイメントガイド

### API仕様（廃止予定）

**注意: 以下のExpress.js APIエンドポイントは廃止予定です。新規実装ではServer Actionsを使用してください。**

- ~~認証エンドポイント: `/api/v1/auth/*`~~ → Supabase Auth
- ~~勘定科目: `/api/v1/accounts`~~ → Server Actions
- ~~仕訳: `/api/v1/journal-entries`~~ → Server Actions
- ~~レポート: `/api/v1/reports/*`~~ → Server Actions

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

## 🧑‍💻 E2Eテストの改善と教訓

### E2Eテストを修正する際のステップ

1. **サーバーの確認**

   ```bash
   # Webサーバーが正しく起動しているか確認
   curl -s http://localhost:3000 | grep -q "Simple Bookkeeping"

   # 間違ったアプリが起動している場合は停止
   pkill -f "next dev" || true

   # 正しいアプリを起動
   pnpm --filter @simple-bookkeeping/web dev
   ```

2. **実際のページ構造の確認**

   ```bash
   # HTML構造を確認
   curl -s http://localhost:3000/demo/accounts | grep -o "<h1[^>]*>[^<]*</h1>"
   ```

3. **セレクタの適切な選択**
   - `waitUntil: 'networkidle'` を使用してページの完全な読み込みを待つ
   - `timeout` オプションを設定して十分な待機時間を確保
   - `filter({ hasText: '...' })` を使用してより正確な要素を選択

4. **認証が必要なページのテスト**

   ```typescript
   // 必ずbeforeEachでAPIモックを設定
   test.beforeEach(async ({ page, context }) => {
     await UnifiedAuth.setupMockRoutes(context);
     await context.route('**/api/v1/auth/me', async (route) => {
       // ユーザー情報のモック
     });
   });

   // テスト内で認証設定
   await page.goto('/', { waitUntil: 'domcontentloaded' });
   await UnifiedAuth.setAuthData(page);
   ```

5. **ダイアログテストの注意点**
   - Radix UIのダイアログは`[data-state="open"]`属性を持つ
   - `waitForTimeout`を使用してダイアログのアニメーションを待つ
   - フォーム要素は`name`属性で特定

6. **テストの実行とデバッグ**

   ```bash
   # 全テストを実行
   REUSE_SERVER=true npx playwright test --project=chromium-desktop --reporter=list

   # 特定のテストのみ実行
   REUSE_SERVER=true npx playwright test extended-coverage.spec.ts:203 --project=chromium-desktop

   # トレースを表示
   npx playwright show-trace test-results/output/.../trace.zip
   ```

### よくある問題と解決策

1. **「要素が見つからない」エラー**
   - ページが完全に読み込まれていない可能性
   - 解決策: `waitUntil: 'networkidle'` や `timeout` オプションを使用

2. **認証ページがエラーになる**
   - APIモックが正しく設定されていない
   - 解決策: 必要なAPIエンドポイントをすべてモックする

3. **テストの不安定性**
   - タイミング問題や環境依存
   - 解決策: 適切な待機時間と柔軟なアサーションを使用
