# Supabaseガイドライン

## 概要

このドキュメントは、Simple BookkeepingプロジェクトにおけるSupabaseの利用方法とベストプラクティスをまとめたものです。開発者とClaude Codeが適切にSupabaseを活用できるよう、環境設定、開発フロー、トラブルシューティングについて説明します。

## 🌍 環境別Supabase設定

### 開発環境（ローカル）

```bash
# Supabase CLIを使用（推奨）
pnpm supabase:start

# またはDocker Composeを使用
pnpm supabase:docker
```

- **URL**: `http://localhost:54321`
- **API URL**: `http://localhost:54321`
- **Anon Key**: ローカルで自動生成
- **Service Role Key**: ローカルで自動生成
- **Studio URL**: `http://localhost:54323`

### テスト環境

```bash
# Docker Compose版を使用
pnpm supabase:docker

# E2Eテスト実行
pnpm test:e2e
```

- **URL**: `http://localhost:54321`
- **特徴**: CIパイプラインで使用
- **データ**: テストごとにリセット

### 本番環境

- **URL**: `https://[project-id].supabase.co`
- **管理**: Supabase Dashboard
- **認証**: 本番用のAnon Key/Service Role Key
- **注意**: 環境変数はVercelで管理

## 🚀 開発フローのベストプラクティス

### 1. 必須：開発前のSupabase起動

```bash
# 開発開始前に必ず実行
pnpm supabase:start

# 起動確認
curl http://localhost:54321/rest/v1/

# Studio確認（データベース管理UI）
open http://localhost:54323
```

### 2. Server Actionsでの実装パターン

```typescript
// app/actions/example.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createRecord(formData: FormData) {
  const supabase = createClient();

  // 認証チェック
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (!user || authError) {
    return { error: '認証が必要です' };
  }

  // データ挿入
  const { data, error } = await supabase
    .from('table_name')
    .insert({
      user_id: user.id,
      // ... other fields
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  // キャッシュの再検証
  revalidatePath('/dashboard');

  return { data };
}
```

### 3. クライアントコンポーネントでの実装

```typescript
// components/example-client.tsx
'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export function ExampleComponent() {
  const [data, setData] = useState([]);
  const supabase = createClient();

  useEffect(() => {
    // リアルタイムサブスクリプション
    const channel = supabase
      .channel('custom-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_name' }, (payload) => {
        console.log('Change received!', payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // ... component logic
}
```

### 4. Row Level Security (RLS) の実装

```sql
-- すべてのテーブルでRLSを有効化
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- ユーザーが自分のデータのみ参照可能
CREATE POLICY "Users can view own data" ON table_name
  FOR SELECT USING (auth.uid() = user_id);

-- ユーザーが自分のデータのみ挿入可能
CREATE POLICY "Users can insert own data" ON table_name
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ユーザーが自分のデータのみ更新可能
CREATE POLICY "Users can update own data" ON table_name
  FOR UPDATE USING (auth.uid() = user_id);
```

## 🔐 認証の実装

### サインアップ/サインイン

```typescript
// app/actions/auth.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function signUp(email: string, password: string) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard');
}

export async function signIn(email: string, password: string) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard');
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/');
}
```

### 認証状態の確認

```typescript
// app/dashboard/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <>{children}</>
}
```

## 🗄️ データベース操作

### Prismaとの併用

現在、PrismaとSupabase Clientを併用しています：

- **Prisma**: 既存コードのマイグレーション管理
- **Supabase Client**: 新規実装とリアルタイム機能

```typescript
// Prismaでのスキーマ管理（既存コード）
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Supabase Clientでのデータ操作（新規実装）
import { createClient } from '@/lib/supabase/server';
const supabase = createClient();
```

### マイグレーション

```bash
# Supabaseマイグレーション作成
pnpm supabase migration new migration_name

# マイグレーション適用
pnpm supabase db push

# Prismaスキーマの同期
pnpm db:pull
pnpm db:generate
```

## 🐛 トラブルシューティング

### よくある問題と解決策

#### 1. Supabaseが起動しない

```bash
# Dockerが起動しているか確認
docker ps

# 古いコンテナを削除
docker compose -f docker-compose.supabase.yml down -v

# 再起動
pnpm supabase:docker
```

#### 2. 認証エラー

```typescript
// 環境変数を確認
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Cookieの設定を確認
// lib/supabase/server.ts で正しいCookie設定になっているか確認
```

#### 3. RLSポリシーエラー

```sql
-- ポリシーの確認
SELECT * FROM pg_policies WHERE tablename = 'your_table';

-- 一時的にRLSを無効化（デバッグ用）
ALTER TABLE your_table DISABLE ROW LEVEL SECURITY;
```

#### 4. リアルタイム更新が動作しない

```typescript
// Realtimeが有効か確認
const { data } = await supabase.from('your_table').select('*').eq('realtime', true);

// Publication設定を確認（Supabase Studio）
// Database → Publications → supabase_realtime
```

## 📋 Claude Code用の特記事項

### 必須ルール

1. **常にSupabase優先**: 新規実装は必ずSupabase Clientを使用
2. **Server Actions使用**: APIエンドポイントは作成しない
3. **環境変数確認**: `NEXT_PUBLIC_SUPABASE_*`が設定されているか確認
4. **RLS考慮**: すべてのテーブル操作でRLSを意識
5. **エラーハンドリング**: Supabaseエラーを適切に処理

### 推奨パターン

```typescript
// ✅ Good: Server Actionでの実装
export async function serverAction() {
  const supabase = createClient();
  // ...
}

// ❌ Bad: APIルートの作成
export async function GET() {
  // Express.js時代のパターン - 使用禁止
}

// ✅ Good: 型安全な実装
import { Database } from '@/types/database';
const supabase = createClient<Database>();

// ❌ Bad: any型の使用
const data: any = await supabase.from('table').select();
```

### デバッグコマンド

```bash
# Supabase状態確認
pnpm supabase status

# ログ確認
pnpm supabase db logs

# 型定義生成
pnpm supabase gen types typescript --local > types/database.ts

# データベースリセット（注意：全データ削除）
pnpm supabase db reset
```

## 🔗 関連リソース

- [Supabase公式ドキュメント](https://supabase.com/docs)
- [Next.js + Supabase統合ガイド](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [プロジェクト固有の移行ガイド](../migration/express-to-server-actions.md)

## 🚨 セキュリティ注意事項

1. **Service Role Keyは絶対にクライアントで使用しない**
2. **環境変数は`.env.local`で管理（コミット禁止）**
3. **RLSは必ず有効化する**
4. **SQLインジェクション対策としてパラメータ化クエリを使用**
5. **認証トークンの適切な管理**

---

_最終更新: 2025年9月_
