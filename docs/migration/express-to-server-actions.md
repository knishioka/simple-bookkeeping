# Express.jsからServer Actionsへの移行ガイドライン

## 概要

このドキュメントは、Express.jsのコントローラーをNext.js Server ActionsまたはAPI Routesに移行するための詳細なガイドラインです。段階的な移行を可能にし、既存のコードベースを最小限の破壊的変更で移行できるように設計されています。

## 移行戦略

### フェーズ1: API Routes（現在）

- Next.js API Routes (`app/api/**/route.ts`) を使用
- Supabaseクライアントによるデータアクセス
- 既存のフロントエンドコードとの互換性維持

### フェーズ2: Server Actions（将来）

- Server Actions (`app/actions/*.ts`) への完全移行
- フォームの直接統合
- より簡潔なコード構造

## 1. 移行マッピング表

| Express.js                       | API Routes                               | Server Actions                                      | 備考                |
| -------------------------------- | ---------------------------------------- | --------------------------------------------------- | ------------------- |
| `router.get('/accounts')`        | `export async function GET()`            | `export async function getAccounts()`               | GETはAPI Routesのみ |
| `router.post('/accounts')`       | `export async function POST()`           | `export async function createAccount(formData)`     | POSTは両方可能      |
| `router.put('/accounts/:id')`    | `export async function PUT()`            | `export async function updateAccount(id, formData)` |                     |
| `router.delete('/accounts/:id')` | `export async function DELETE()`         | `export async function deleteAccount(id)`           |                     |
| `req.body`                       | `await request.json()`                   | `formData` または 引数                              |                     |
| `req.params`                     | URLパラメータ                            | 関数引数                                            |                     |
| `req.query`                      | `searchParams`                           | 関数引数                                            |                     |
| `res.json()`                     | `NextResponse.json()`                    | `return { data }`                                   |                     |
| `res.status(400)`                | `NextResponse.json({}, { status: 400 })` | `return { error }`                                  |                     |
| JWT認証ミドルウェア              | Supabase Auth                            | Supabase RLS                                        | 自動化              |
| トランザクション                 | Prisma Transaction                       | Supabase DB Function                                |                     |

## 2. 変換パターン

### 2.1 基本的なCRUD操作

#### Before (Express.js)

```typescript
// apps/api/src/controllers/accounts.controller.ts
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getAccounts = async (req: Request, res: Response) => {
  try {
    const { type, active } = req.query;

    const accounts = await prisma.account.findMany({
      where: {
        organizationId: req.user.organizationId,
        ...(type && { type }),
        ...(active !== undefined && { active: active === 'true' }),
      },
      orderBy: { code: 'asc' },
    });

    res.json({ data: accounts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createAccount = async (req: Request, res: Response) => {
  try {
    const { code, name, type } = req.body;

    // バリデーション
    if (!code || !name || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const account = await prisma.account.create({
      data: {
        code,
        name,
        type,
        organizationId: req.user.organizationId,
      },
    });

    res.json({ data: account });
  } catch (error) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Account code already exists' });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
};
```

#### After (API Routes)

```typescript
// apps/web/src/app/api/accounts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // クエリパラメータ
    const { searchParams } = new URL(request.url);
    const accountType = searchParams.get('type');
    const isActive = searchParams.get('active');

    // データ取得
    let query = supabase.from('accounts').select('*').order('code', { ascending: true });

    if (accountType) {
      query = query.eq('account_type', accountType);
    }
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // リクエストボディ
    const body = await request.json();
    const { code, name, account_type } = body;

    // バリデーション
    if (!code || !name || !account_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // データ作成
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        code,
        name,
        account_type,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation
        return NextResponse.json({ error: 'Account code already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

#### After (Server Actions)

```typescript
// apps/web/src/app/actions/accounts.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// 統一されたレスポンス型
type ActionResult<T> = { data: T; error?: never } | { data?: never; error: string };

export async function getAccounts(filters?: {
  type?: string;
  active?: boolean;
}): Promise<ActionResult<any[]>> {
  const supabase = await createClient();

  // 認証はRLSで自動的に処理される
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Unauthorized' };
  }

  let query = supabase.from('accounts').select('*').order('code', { ascending: true });

  if (filters?.type) {
    query = query.eq('account_type', filters.type);
  }
  if (filters?.active !== undefined) {
    query = query.eq('is_active', filters.active);
  }

  const { data, error } = await query;

  if (error) return { error: error.message };
  return { data };
}

export async function createAccount(formData: FormData): Promise<ActionResult<any>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Unauthorized' };
  }

  const code = formData.get('code') as string;
  const name = formData.get('name') as string;
  const accountType = formData.get('account_type') as string;

  // バリデーション
  if (!code || !name || !accountType) {
    return { error: 'Missing required fields' };
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      code,
      name,
      account_type: accountType,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { error: 'Account code already exists' };
    }
    return { error: error.message };
  }

  // キャッシュの再検証
  revalidatePath('/accounts');

  return { data };
}
```

### 2.2 複雑なトランザクション処理

#### Before (Express.js with Prisma)

```typescript
// apps/api/src/controllers/journalEntries.controller.ts
export const createJournalEntry = async (req: Request, res: Response) => {
  try {
    const { date, description, lines } = req.body;

    // 借方貸方のバランスチェック
    const totalDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0);

    if (totalDebit !== totalCredit) {
      return res.status(400).json({ error: 'Debit and credit must balance' });
    }

    // トランザクション処理
    const entry = await prisma.$transaction(async (tx) => {
      // ヘッダー作成
      const journalEntry = await tx.journalEntry.create({
        data: {
          entryDate: new Date(date),
          description,
          organizationId: req.user.organizationId,
          createdBy: req.user.id,
        },
      });

      // 明細作成
      await tx.journalEntryLine.createMany({
        data: lines.map((line, index) => ({
          journalEntryId: journalEntry.id,
          accountId: line.accountId,
          debitAmount: line.debitAmount || 0,
          creditAmount: line.creditAmount || 0,
          lineNumber: index + 1,
        })),
      });

      return journalEntry;
    });

    res.json({ data: entry });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
```

#### After (Server Actions with DB Function)

```typescript
// apps/web/src/app/actions/journal-entries.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

interface JournalEntryInput {
  date: string;
  description: string;
  lines: Array<{
    accountId: string;
    debitAmount: number;
    creditAmount: number;
  }>;
}

export async function createJournalEntry(input: JournalEntryInput): Promise<ActionResult<any>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Unauthorized' };
  }

  // 借方貸方のバランスチェック
  const totalDebit = input.lines.reduce((sum, line) => sum + line.debitAmount, 0);
  const totalCredit = input.lines.reduce((sum, line) => sum + line.creditAmount, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { error: 'Debit and credit must balance' };
  }

  // PostgreSQL Functionを使用したトランザクション処理
  const { data, error } = await supabase.rpc('create_journal_entry_transaction', {
    entry_date: input.date,
    entry_description: input.description,
    entry_lines: input.lines.map((line, index) => ({
      account_id: line.accountId,
      debit_amount: line.debitAmount,
      credit_amount: line.creditAmount,
      line_number: index + 1,
    })),
  });

  if (error) {
    return { error: error.message };
  }

  // キャッシュの再検証
  revalidatePath('/journal-entries');
  revalidatePath('/dashboard');

  return { data };
}
```

対応するPostgreSQL Function:

```sql
-- supabase/migrations/xxx_create_journal_entry_function.sql
CREATE OR REPLACE FUNCTION create_journal_entry_transaction(
  entry_date DATE,
  entry_description TEXT,
  entry_lines JSONB
)
RETURNS journal_entries
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_entry journal_entries;
  line_item JSONB;
BEGIN
  -- ヘッダー作成
  INSERT INTO journal_entries (entry_date, description, user_id)
  VALUES (entry_date, entry_description, auth.uid())
  RETURNING * INTO new_entry;

  -- 明細作成
  FOR line_item IN SELECT * FROM jsonb_array_elements(entry_lines)
  LOOP
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_id,
      debit_amount,
      credit_amount,
      line_number
    )
    VALUES (
      new_entry.id,
      (line_item->>'account_id')::UUID,
      (line_item->>'debit_amount')::DECIMAL,
      (line_item->>'credit_amount')::DECIMAL,
      (line_item->>'line_number')::INTEGER
    );
  END LOOP;

  RETURN new_entry;
END;
$$;
```

## 3. 認証とセキュリティ

### 3.1 認証の移行

#### Before (JWT Middleware)

```typescript
// apps/api/src/middlewares/auth.ts
export const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

#### After (Supabase Auth)

```typescript
// apps/web/src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );
}

// 使用例
export async function protectedAction() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: 'Unauthorized' };
  }

  // 認証済みユーザーの処理
}
```

### 3.2 Row Level Security (RLS)

Supabaseでは、データベースレベルで自動的にセキュリティが適用されます。

```sql
-- 勘定科目テーブルのRLSポリシー
CREATE POLICY "Users can only see their own accounts"
  ON accounts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can only create their own accounts"
  ON accounts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can only update their own accounts"
  ON accounts FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can only delete their own accounts"
  ON accounts FOR DELETE
  USING (user_id = auth.uid());
```

## 4. エラーハンドリング

### 4.1 統一されたエラーレスポンス

```typescript
// apps/web/src/app/actions/types.ts
export type ActionResult<T> = { data: T; error?: never } | { data?: never; error: string };

export type PaginatedResult<T> = ActionResult<{
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}>;

// エラーメッセージのマッピング
export const errorMessages = {
  UNAUTHORIZED: 'ログインが必要です',
  NOT_FOUND: 'データが見つかりません',
  VALIDATION_ERROR: '入力内容に誤りがあります',
  DUPLICATE_ERROR: 'すでに登録されています',
  BALANCE_ERROR: '借方と貸方が一致しません',
  PERIOD_CLOSED: '会計期間が締められています',
} as const;
```

### 4.2 エラーハンドリングパターン

```typescript
export async function safeAction<T>(action: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await action();
    return { data };
  } catch (error) {
    console.error('Action error:', error);

    if (error instanceof Error) {
      // Supabaseエラーの処理
      if (error.message.includes('23505')) {
        return { error: errorMessages.DUPLICATE_ERROR };
      }
      if (error.message.includes('auth')) {
        return { error: errorMessages.UNAUTHORIZED };
      }

      return { error: error.message };
    }

    return { error: 'An unexpected error occurred' };
  }
}

// 使用例
export async function createAccount(formData: FormData) {
  return safeAction(async () => {
    const supabase = await createClient();
    // ... 実装
    return data;
  });
}
```

## 5. フォーム統合

### 5.1 Server Actionsとフォームの統合

```tsx
// apps/web/src/app/accounts/new/page.tsx
import { createAccount } from '@/app/actions/accounts';

export default function NewAccountPage() {
  return (
    <form action={createAccount}>
      <div>
        <label htmlFor="code">勘定科目コード</label>
        <input id="code" name="code" type="text" required pattern="[0-9]{4}" />
      </div>

      <div>
        <label htmlFor="name">勘定科目名</label>
        <input id="name" name="name" type="text" required />
      </div>

      <div>
        <label htmlFor="account_type">勘定科目タイプ</label>
        <select id="account_type" name="account_type" required>
          <option value="asset">資産</option>
          <option value="liability">負債</option>
          <option value="equity">資本</option>
          <option value="revenue">収益</option>
          <option value="expense">費用</option>
        </select>
      </div>

      <button type="submit">作成</button>
    </form>
  );
}
```

### 5.2 クライアントコンポーネントでの使用

```tsx
// apps/web/src/components/account-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAccount } from '@/app/actions/accounts';

export function AccountForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setError(null);

    const result = await createAccount(formData);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      router.push('/accounts');
    }
  }

  return (
    <form action={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}

      {/* フォームフィールド */}

      <button type="submit" disabled={isLoading}>
        {isLoading ? '作成中...' : '作成'}
      </button>
    </form>
  );
}
```

## 6. ページネーション

```typescript
// apps/web/src/app/actions/pagination.ts
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function getPaginatedAccounts(
  params: PaginationParams = {}
): Promise<PaginatedResult<Account>> {
  const { page = 1, pageSize = 20, sortBy = 'code', sortOrder = 'asc' } = params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Unauthorized' };
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('accounts')
    .select('*', { count: 'exact' })
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(from, to);

  if (error) {
    return { error: error.message };
  }

  return {
    data: {
      items: data || [],
      total: count || 0,
      page,
      pageSize,
    },
  };
}
```

## 7. 移行チェックリスト

### 7.1 コントローラー別移行状況

| コントローラー    | Express.js | API Routes | Server Actions | 状態              |
| ----------------- | ---------- | ---------- | -------------- | ----------------- |
| accounts          | ✅         | ✅         | 🔄             | 移行中            |
| auth              | ✅         | ✅         | -              | Supabase Auth使用 |
| journalEntries    | ✅         | 🔄         | ⏳             | 計画中            |
| reports           | ✅         | ⏳         | ⏳             | 計画中            |
| accountingPeriods | ✅         | ⏳         | ⏳             | 計画中            |
| auditLog          | ✅         | ⏳         | ⏳             | 計画中            |
| organizations     | ✅         | ⏳         | ⏳             | 計画中            |
| partners          | ✅         | ⏳         | ⏳             | 計画中            |
| ledgers           | ✅         | ⏳         | ⏳             | 計画中            |

### 7.2 移行手順

1. **準備フェーズ**
   - [ ] 対象コントローラーの特定
   - [ ] 依存関係の確認
   - [ ] テストケースの準備

2. **API Routes実装**
   - [ ] ルートファイルの作成 (`app/api/**/route.ts`)
   - [ ] 認証処理をSupabase Authに変更
   - [ ] データアクセスをSupabaseクライアントに変更
   - [ ] エラーハンドリングの統一

3. **Server Actions実装**
   - [ ] アクションファイルの作成 (`app/actions/*.ts`)
   - [ ] フォームデータ処理の実装
   - [ ] キャッシュ再検証の追加
   - [ ] 型定義の整備

4. **フロントエンド更新**
   - [ ] API呼び出しをServer Actionsに変更
   - [ ] フォームの更新
   - [ ] エラーハンドリングの更新

5. **テスト**
   - [ ] Unit Testの更新
   - [ ] E2E Testの更新
   - [ ] 手動テスト

6. **クリーンアップ**
   - [ ] 旧Express.jsコードの削除
   - [ ] ドキュメントの更新
   - [ ] デプロイメント設定の更新

## 8. ベストプラクティス

### 8.1 Server Actions設計原則

1. **単一責任の原則**: 各アクションは1つの操作のみを行う
2. **型安全性**: TypeScriptの型を最大限活用
3. **エラーハンドリング**: 統一されたエラーレスポンス形式
4. **キャッシュ管理**: 適切な`revalidatePath`の使用
5. **セキュリティ**: 必ず認証チェックを実装

### 8.2 パフォーマンス最適化

```typescript
// データの選択的取得
const { data } = await supabase
  .from('accounts')
  .select('id, code, name') // 必要なフィールドのみ
  .limit(100); // 適切な制限

// リレーションの最適化
const { data } = await supabase.from('journal_entries').select(`
    *,
    lines:journal_entry_lines(
      *,
      account:accounts(code, name)
    )
  `);

// キャッシュの活用
import { unstable_cache } from 'next/cache';

const getCachedAccounts = unstable_cache(
  async () => {
    // データ取得ロジック
  },
  ['accounts'],
  { revalidate: 3600 } // 1時間キャッシュ
);
```

## 9. トラブルシューティング

### 9.1 よくある問題と解決策

| 問題                     | 原因                  | 解決策                     |
| ------------------------ | --------------------- | -------------------------- |
| "Unauthorized" エラー    | セッションの期限切れ  | ログイン画面へリダイレクト |
| データが取得できない     | RLSポリシーの設定ミス | ポリシーを確認・修正       |
| フォーム送信が失敗       | CSRFトークンの問題    | Server Actionsを使用       |
| トランザクションエラー   | 複雑な処理            | DB Functionを使用          |
| キャッシュが更新されない | revalidatePathの漏れ  | 適切なパスを追加           |

### 9.2 デバッグ方法

```typescript
// ログ出力
export async function debugAction() {
  console.log('Action called');

  const supabase = await createClient();

  // SQLログの有効化（開発環境のみ）
  if (process.env.NODE_ENV === 'development') {
    const { data, error } = await supabase.from('accounts').select().explain({ analyze: true });

    console.log('Query plan:', data);
  }
}

// エラーの詳細情報
if (error) {
  console.error('Supabase error:', {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });
}
```

## 10. 参考リソース

- [Next.js Server Actions Documentation](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Functions Documentation](https://www.postgresql.org/docs/current/sql-createfunction.html)

## まとめ

Express.jsからServer Actionsへの移行は、以下のメリットをもたらします：

- **簡潔性**: ボイラープレートコードの削減
- **型安全性**: End-to-endの型推論
- **パフォーマンス**: サーバーサイドでの直接実行
- **セキュリティ**: RLSによる自動的なアクセス制御
- **開発体験**: より直感的なAPI設計

段階的な移行により、既存の機能を維持しながら、モダンなアーキテクチャへ移行できます。
