# 認証システム移行ガイド

## 概要

Express.js + JWT認証からSupabase Authへの移行手順を説明します。

## 移行前後の比較

### Before (Express.js + JWT)

```typescript
// 認証フロー
1. POST /api/v1/auth/login → JWT発行
2. Authorization: Bearer {jwt} → 各APIリクエスト
3. JWT検証 → ユーザー情報取得
4. Passport.js + bcrypt でパスワード管理
```

### After (Supabase Auth)

```typescript
// 認証フロー
1. supabase.auth.signInWithPassword() → セッション作成
2. Cookieベース認証 → 自動的にリクエストに含まれる
3. RLSによる自動的な権限チェック
4. Supabase Authでパスワード管理
```

## 移行手順

### 1. 既存ユーザーデータの移行

#### 1.1 ユーザーエクスポートスクリプト

```typescript
// scripts/export-users.ts
import { prisma } from '../apps/api/src/lib/prisma';
import { writeFileSync } from 'fs';

async function exportUsers() {
  const users = await prisma.user.findMany({
    include: {
      userOrganizations: {
        include: {
          organization: true,
        },
      },
    },
  });

  const exportData = users.map((user) => ({
    email: user.email,
    name: user.name,
    password_hash: user.passwordHash, // 注: bcryptハッシュ
    organizations: user.userOrganizations.map((uo) => ({
      organization_id: uo.organizationId,
      organization_name: uo.organization.name,
      role: uo.role,
      is_default: uo.isDefault,
    })),
  }));

  writeFileSync('users-export.json', JSON.stringify(exportData, null, 2));
  console.log(`Exported ${exportData.length} users`);
}

exportUsers();
```

#### 1.2 Supabaseへのインポート

```typescript
// scripts/import-users-to-supabase.ts
import { createClient } from '@supabase/supabase-js';
import usersData from './users-export.json';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function importUsers() {
  for (const userData of usersData) {
    // 1. Supabase Authでユーザー作成
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: generateTempPassword(), // 一時パスワード
      email_confirm: true,
      app_metadata: {
        organizations: userData.organizations,
        current_organization_id: userData.organizations.find((o) => o.is_default)?.organization_id,
        current_role: userData.organizations.find((o) => o.is_default)?.role,
      },
      user_metadata: {
        name: userData.name,
      },
    });

    if (authError) {
      console.error(`Failed to create user ${userData.email}:`, authError);
      continue;
    }

    // 2. usersテーブルに追加
    const { error: dbError } = await supabase.from('users').insert({
      id: authUser.user.id,
      email: userData.email,
      name: userData.name,
      is_active: true,
    });

    if (dbError) {
      console.error(`Failed to insert user ${userData.email}:`, dbError);
    }

    // 3. user_organizationsテーブルに追加
    for (const org of userData.organizations) {
      await supabase.from('user_organizations').insert({
        user_id: authUser.user.id,
        organization_id: org.organization_id,
        role: org.role,
        is_default: org.is_default,
      });
    }

    console.log(`Imported user: ${userData.email}`);
  }
}

function generateTempPassword() {
  // 一時的なランダムパスワード生成
  return Math.random().toString(36).slice(-8) + 'Aa1!';
}
```

### 2. 認証フローの実装

#### 2.1 ログイン処理の更新

```typescript
// apps/web/src/app/(auth)/login/page.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      return
    }

    // 組織情報の取得
    const { data: userData } = await supabase
      .from('user_organizations')
      .select('*, organization:organizations(*)')
      .eq('user_id', data.user.id)
      .eq('is_default', true)
      .single()

    if (userData) {
      // 組織情報をセッションストレージに保存
      sessionStorage.setItem('current_organization', JSON.stringify(userData.organization))
      sessionStorage.setItem('user_role', userData.role)
    }

    router.push('/dashboard')
  }

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="メールアドレス"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="パスワード"
        required
      />
      {error && <div className="error">{error}</div>}
      <button type="submit">ログイン</button>
    </form>
  )
}
```

#### 2.2 認証ミドルウェアの実装

```typescript
// apps/web/src/middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 保護されたルートへのアクセス制御
  if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ログイン済みユーザーのリダイレクト
  if (session && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|demo).*)'],
};
```

### 3. 既存APIの段階的移行

#### 3.1 移行期間中の互換性レイヤー

```typescript
// apps/web/src/lib/auth/compatibility.ts
import { createClient } from '@/lib/supabase/client';

/**
 * 既存のJWTベースのAPIとの互換性を保つためのヘルパー
 */
export async function getAuthHeaders() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('No active session');
  }

  // 移行期間中: SupabaseのアクセストークンをJWTとして使用
  return {
    Authorization: `Bearer ${session.access_token}`,
    'X-Organization-Id': session.user.app_metadata.current_organization_id,
  };
}

/**
 * 既存のAPIクライアントをラップ
 */
export async function callLegacyAPI(endpoint: string, options: RequestInit = {}) {
  const headers = await getAuthHeaders();

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  return response.json();
}
```

#### 3.2 段階的な移行例

```typescript
// apps/web/src/hooks/useAccounts.ts
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

/**
 * 段階的移行: フラグで新旧APIを切り替え
 */
export function useAccounts() {
  const supabase = createClient();
  const useSupabase = process.env.NEXT_PUBLIC_USE_SUPABASE === 'true';

  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      if (useSupabase) {
        // 新: Supabase直接アクセス
        const { data, error } = await supabase.from('accounts').select('*').order('code');

        if (error) throw error;
        return data;
      } else {
        // 旧: Express.js API経由
        const { callLegacyAPI } = await import('@/lib/auth/compatibility');
        return callLegacyAPI('/accounts');
      }
    },
  });
}
```

### 4. 権限管理の移行

#### 4.1 ロールベースアクセス制御

```typescript
// apps/web/src/lib/auth/permissions.ts
import { createClient } from '@/lib/supabase/client'

export type UserRole = 'admin' | 'accountant' | 'viewer'

export async function getCurrentUserRole(): Promise<UserRole | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  return user.app_metadata.current_role as UserRole
}

export async function hasPermission(requiredRole: UserRole[]): Promise<boolean> {
  const role = await getCurrentUserRole()
  if (!role) return false

  const roleHierarchy: Record<UserRole, number> = {
    admin: 3,
    accountant: 2,
    viewer: 1,
  }

  const userLevel = roleHierarchy[role]
  const requiredLevel = Math.min(...requiredRole.map(r => roleHierarchy[r]))

  return userLevel >= requiredLevel
}

// 使用例: コンポーネント内での権限チェック
export function ProtectedComponent({ requiredRole }: { requiredRole: UserRole[] }) {
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    hasPermission(requiredRole).then(setHasAccess)
  }, [requiredRole])

  if (!hasAccess) {
    return <div>権限がありません</div>
  }

  return <div>保護されたコンテンツ</div>
}
```

### 5. セッション管理

#### 5.1 自動セッション更新

```typescript
// apps/web/src/app/layout.tsx
import { createClient } from '@/lib/supabase/server'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()

  // セッションの自動更新
  const { data: { session } } = await supabase.auth.getSession()

  return (
    <html lang="ja">
      <body>
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
```

```typescript
// apps/web/src/components/SessionProvider.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function SessionProvider({
  session,
  children,
}: {
  session: any
  children: React.ReactNode
}) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login')
      } else if (event === 'SIGNED_IN') {
        router.refresh()
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed')
      }
    })

    return () => subscription.unsubscribe()
  }, [router, supabase])

  return <>{children}</>
}
```

## テスト戦略

### 1. 認証テストの更新

```typescript
// apps/web/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Supabase認証', () => {
  test('ログイン成功', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('[type="submit"]');

    await page.waitForURL('/dashboard');
    expect(page.url()).toContain('/dashboard');

    // セッションクッキーの確認
    const cookies = await page.context().cookies();
    const authCookie = cookies.find((c) => c.name.includes('supabase-auth-token'));
    expect(authCookie).toBeDefined();
  });

  test('認証が必要なページへのアクセス', async ({ page }) => {
    // 未認証状態でダッシュボードへアクセス
    await page.goto('/dashboard');

    // ログインページへリダイレクト
    await page.waitForURL('/login');
    expect(page.url()).toContain('/login');
  });
});
```

## チェックリスト

### 移行前の準備

- [ ] 既存ユーザーデータのバックアップ
- [ ] Supabaseプロジェクトの作成
- [ ] RLSポリシーの設定
- [ ] テスト環境の準備

### 移行作業

- [ ] ユーザーデータのエクスポート
- [ ] Supabase Authへのインポート
- [ ] 認証フローの実装
- [ ] ミドルウェアの設定
- [ ] 権限管理の移行

### 移行後の確認

- [ ] ログイン機能の動作確認
- [ ] セッション管理の動作確認
- [ ] 権限チェックの動作確認
- [ ] E2Eテストの実行
- [ ] パフォーマンステスト

## トラブルシューティング

### よくある問題

1. **セッションが維持されない**
   - 原因: Cookieの設定ミス
   - 解決: middleware.tsのCookie設定を確認

2. **RLSポリシーエラー**
   - 原因: auth.uid()がnull
   - 解決: Service Roleキーを使用するか、RLSポリシーを見直す

3. **既存APIとの互換性問題**
   - 原因: JWTフォーマットの違い
   - 解決: 互換性レイヤーを使用して段階的に移行

## 次のステップ

- [API Routes実装ガイド](./api-routes-migration.md)
- [データ移行スクリプト](./data-migration.md)
- [E2Eテスト移行ガイド](./e2e-test-migration.md)
