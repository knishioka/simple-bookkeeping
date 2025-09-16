# Server Actions テストパターンガイド

このドキュメントは、Next.js Server Actionsのテストパターンとベストプラクティスをまとめたものです。

## 目次

1. [概要](#概要)
2. [基本的なテストパターン](#基本的なテストパターン)
3. [フォーム送信のテスト](#フォーム送信のテスト)
4. [非同期データフェッチのテスト](#非同期データフェッチのテスト)
5. [エラーハンドリングのテスト](#エラーハンドリングのテスト)
6. [モック戦略](#モック戦略)
7. [統合テスト](#統合テスト)
8. [E2Eテスト](#e2eテスト)
9. [ベストプラクティス](#ベストプラクティス)

## 概要

Server Actionsは、サーバーサイドで実行される非同期関数で、フォーム送信やデータ操作に使用されます。これらを適切にテストすることで、アプリケーションの信頼性と保守性が向上します。

### テストレベル

1. **Unit Tests**: 個々のServer Actionの動作を検証
2. **Integration Tests**: Server Actionsと他のコンポーネントとの連携を検証
3. **E2E Tests**: ユーザーフローの完全な動作を検証

## 基本的なテストパターン

### Server Action の基本構造

```typescript
// app/actions/example.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function exampleAction(formData: FormData) {
  const supabase = await createClient();

  // 認証チェック
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  // データ処理
  const value = formData.get('value') as string;

  // データベース操作
  const { data, error } = await supabase
    .from('table')
    .insert({ value, user_id: user.id })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // キャッシュ無効化
  revalidatePath('/path');

  return { success: true, data };
}
```

### Unit Test パターン

```typescript
// app/actions/__tests__/example.test.ts
import { exampleAction } from '../example';
import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server');
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

describe('exampleAction', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Supabase モックのセットアップ
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    };
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  it('should successfully process valid data', async () => {
    // Arrange
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
    });

    const mockInsertChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 1, value: 'test', user_id: 'user-123' },
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(mockInsertChain);

    const formData = new FormData();
    formData.append('value', 'test');

    // Act
    const result = await exampleAction(formData);

    // Assert
    expect(result).toEqual({
      success: true,
      data: { id: 1, value: 'test', user_id: 'user-123' },
    });
    expect(mockSupabase.from).toHaveBeenCalledWith('table');
    expect(mockInsertChain.insert).toHaveBeenCalledWith({
      value: 'test',
      user_id: 'user-123',
    });
  });

  it('should handle authentication failure', async () => {
    // Arrange
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const formData = new FormData();
    formData.append('value', 'test');

    // Act
    const result = await exampleAction(formData);

    // Assert
    expect(result).toEqual({
      success: false,
      error: 'Unauthorized',
    });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
```

## フォーム送信のテスト

### FormData の作成とテスト

```typescript
describe('Form submission', () => {
  it('should handle complex form data', async () => {
    const formData = new FormData();
    formData.append('title', 'Test Title');
    formData.append('description', 'Test Description');
    formData.append('items[]', 'item1');
    formData.append('items[]', 'item2');
    formData.append('file', new File(['content'], 'test.txt'));

    const result = await submitFormAction(formData);

    expect(result.success).toBe(true);
  });

  it('should validate required fields', async () => {
    const formData = new FormData();
    // 必須フィールドを意図的に省略

    const result = await submitFormAction(formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });
});
```

### バリデーションテスト

```typescript
describe('Form validation', () => {
  it('should validate email format', async () => {
    const formData = new FormData();
    formData.append('email', 'invalid-email');

    const result = await updateEmailAction(formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid email format');
  });

  it('should sanitize input data', async () => {
    const formData = new FormData();
    formData.append('comment', '<script>alert("XSS")</script>');

    const result = await submitCommentAction(formData);

    // XSSが除去されていることを確認
    expect(result.data?.comment).not.toContain('<script>');
  });
});
```

## 非同期データフェッチのテスト

### データフェッチアクション

```typescript
// app/actions/data.ts
'use server';

export async function fetchUserData(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('users')
    .select('*, posts(*)')
    .eq('id', userId)
    .single();

  if (error) throw new Error(error.message);

  return data;
}
```

### 非同期テストパターン

```typescript
describe('fetchUserData', () => {
  it('should fetch user with related posts', async () => {
    const mockData = {
      id: 'user-123',
      name: 'Test User',
      posts: [
        { id: 1, title: 'Post 1' },
        { id: 2, title: 'Post 2' },
      ],
    };

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
    });

    const result = await fetchUserData('user-123');

    expect(result).toEqual(mockData);
    expect(result.posts).toHaveLength(2);
  });

  it('should handle concurrent requests', async () => {
    const promises = Array.from({ length: 5 }, (_, i) => fetchUserData(`user-${i}`));

    const results = await Promise.all(promises);

    expect(results).toHaveLength(5);
    results.forEach((result, i) => {
      expect(result.id).toBe(`user-${i}`);
    });
  });
});
```

## エラーハンドリングのテスト

### エラーケースのテストパターン

```typescript
describe('Error handling', () => {
  it('should handle database connection errors', async () => {
    mockSupabase.from.mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    const formData = new FormData();
    formData.append('data', 'test');

    const result = await performDatabaseAction(formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain('connection failed');
  });

  it('should handle timeout errors', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      single: jest
        .fn()
        .mockImplementation(
          () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
        ),
    });

    const result = await fetchWithTimeout('test-id');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Timeout');
  });

  it('should handle validation errors', async () => {
    const formData = new FormData();
    formData.append('amount', '-100'); // 負の値

    const result = await processPayment(formData);

    expect(result.success).toBe(false);
    expect(result.errors).toEqual({
      amount: 'Amount must be positive',
    });
  });
});
```

### リトライロジックのテスト

```typescript
describe('Retry logic', () => {
  it('should retry on transient failures', async () => {
    let attempts = 0;
    mockSupabase.from.mockReturnValue({
      insert: jest.fn().mockReturnThis(),
      single: jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Transient error'));
        }
        return Promise.resolve({ data: { id: 1 }, error: null });
      }),
    });

    const result = await actionWithRetry(new FormData());

    expect(result.success).toBe(true);
    expect(attempts).toBe(3);
  });
});
```

## モック戦略

### チェーナブルメソッドのモック

```typescript
// test-helpers/supabase-mock.ts
export function createMockSupabaseClient() {
  const mockClient = {
    auth: {
      getUser: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(),
  };

  const createChainableMock = (finalResult: any) => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      like: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(finalResult),
      maybeSingle: jest.fn().mockResolvedValue(finalResult),
    };
    return chain;
  };

  mockClient.from.mockImplementation(() => createChainableMock({ data: null, error: null }));

  return mockClient;
}
```

### テストデータビルダー

```typescript
// test-helpers/builders.ts
export class TestDataBuilder {
  static user(overrides = {}) {
    return {
      id: 'user-test-id',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
      ...overrides,
    };
  }

  static account(overrides = {}) {
    return {
      id: 1,
      name: 'Test Account',
      code: '1000',
      type: 'asset',
      user_id: 'user-test-id',
      ...overrides,
    };
  }

  static journalEntry(overrides = {}) {
    return {
      id: 1,
      date: new Date().toISOString(),
      description: 'Test Entry',
      entries: [
        { account_id: 1, debit: 1000, credit: 0 },
        { account_id: 2, debit: 0, credit: 1000 },
      ],
      ...overrides,
    };
  }
}
```

## 統合テスト

### 統合テストの構造

```typescript
// app/actions/__tests__/integration/workflow.test.ts
import { createAccount, createJournalEntry, generateReport } from '../../index';
import { createClient } from '@/lib/supabase/server';

describe('Accounting workflow integration', () => {
  let supabase: any;
  let testUserId: string;

  beforeAll(async () => {
    // 実際のテスト用データベースを使用
    supabase = await createClient();

    // テストユーザーの作成
    const {
      data: { user },
    } = await supabase.auth.signUp({
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123',
    });

    testUserId = user!.id;
  });

  afterAll(async () => {
    // テストデータのクリーンアップ
    await supabase.from('journal_entries').delete().eq('user_id', testUserId);
    await supabase.from('accounts').delete().eq('user_id', testUserId);
    await supabase.auth.admin.deleteUser(testUserId);
  });

  it('should complete full accounting workflow', async () => {
    // 1. 勘定科目の作成
    const cashAccount = await createAccount({
      name: '現金',
      code: '1010',
      type: 'asset',
    });
    expect(cashAccount.success).toBe(true);

    const salesAccount = await createAccount({
      name: '売上高',
      code: '4010',
      type: 'revenue',
    });
    expect(salesAccount.success).toBe(true);

    // 2. 仕訳の作成
    const journalEntry = await createJournalEntry({
      date: new Date().toISOString(),
      description: '現金売上',
      entries: [
        { account_id: cashAccount.data.id, debit: 10000, credit: 0 },
        { account_id: salesAccount.data.id, debit: 0, credit: 10000 },
      ],
    });
    expect(journalEntry.success).toBe(true);

    // 3. レポートの生成
    const report = await generateReport({
      type: 'trial_balance',
      period: 'current_month',
    });
    expect(report.success).toBe(true);
    expect(report.data.total_debit).toBe(10000);
    expect(report.data.total_credit).toBe(10000);
  });
});
```

### データベーストランザクションのテスト

```typescript
describe('Database transactions', () => {
  it('should rollback on error', async () => {
    const invalidEntry = {
      date: new Date().toISOString(),
      description: 'Invalid Entry',
      entries: [
        { account_id: 999999, debit: 1000, credit: 0 }, // 存在しないアカウントID
        { account_id: 1, debit: 0, credit: 1000 },
      ],
    };

    const result = await createJournalEntry(invalidEntry);

    expect(result.success).toBe(false);

    // エントリーが作成されていないことを確認
    const { data: entries } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('description', 'Invalid Entry');

    expect(entries).toHaveLength(0);
  });
});
```

## E2Eテスト

### Playwright を使用した E2E テスト

```typescript
// e2e/server-actions.spec.ts
import { test, expect } from '@playwright/test';
import { setupAuth } from './helpers/auth';

test.describe('Server Actions E2E', () => {
  test.beforeEach(async ({ page }) => {
    // 認証のセットアップ
    await setupAuth(page);
  });

  test('should submit form using server action', async ({ page }) => {
    await page.goto('/accounts/new');

    // フォームの入力
    await page.fill('[name="name"]', '現金');
    await page.fill('[name="code"]', '1010');
    await page.selectOption('[name="type"]', 'asset');

    // Server Action の実行を監視
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/accounts/new') && response.request().method() === 'POST'
    );

    // フォーム送信
    await page.click('button[type="submit"]');

    const response = await responsePromise;
    expect(response.status()).toBe(303); // リダイレクト

    // 成功メッセージの確認
    await expect(page.locator('.toast-success')).toContainText('作成しました');

    // データが保存されたことを確認
    await page.goto('/accounts');
    await expect(page.locator('text=現金')).toBeVisible();
  });

  test('should handle server action errors', async ({ page }) => {
    await page.goto('/accounts/new');

    // 重複するコードを入力
    await page.fill('[name="code"]', '1000'); // 既存のコード
    await page.fill('[name="name"]', 'Duplicate');

    await page.click('button[type="submit"]');

    // エラーメッセージの確認
    await expect(page.locator('.field-error')).toContainText('このコードは既に使用されています');
  });
});
```

### Server Actions のモック (E2E)

```typescript
// e2e/helpers/mock-server-actions.ts
import { Page } from '@playwright/test';

export async function mockServerAction(
  page: Page,
  actionName: string,
  mockImplementation: Function
) {
  await page.addInitScript(
    (args) => {
      const { actionName, mockImpl } = args;

      // Next.js の Server Action をインターセプト
      window.__NEXT_ACTION_MOCKS__ = window.__NEXT_ACTION_MOCKS__ || {};
      window.__NEXT_ACTION_MOCKS__[actionName] = new Function('return ' + mockImpl)();

      // オリジナルの fetch をラップ
      const originalFetch = window.fetch;
      window.fetch = async (url, options) => {
        if (options?.headers?.['Next-Action'] === actionName) {
          const formData = await new Response(options.body).formData();
          const result = await window.__NEXT_ACTION_MOCKS__[actionName](formData);
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return originalFetch(url, options);
      };
    },
    { actionName, mockImpl: mockImplementation.toString() }
  );
}

// 使用例
test('should mock server action', async ({ page }) => {
  await mockServerAction(page, 'submitForm', async (formData: FormData) => {
    return { success: true, message: 'Mocked response' };
  });

  await page.goto('/form');
  await page.click('button[type="submit"]');
  await expect(page.locator('.message')).toContainText('Mocked response');
});
```

## ベストプラクティス

### 1. テストの構造化

- **Arrange-Act-Assert (AAA) パターン**を使用
- テストケースは独立して実行可能にする
- 共通のセットアップは `beforeEach` で行う

### 2. モックの使用

- 外部依存関係は必ずモック化
- モックは最小限に留める
- 可能な限り実際のデータ構造を使用

### 3. エラーハンドリング

- すべてのエラーケースをテスト
- エラーメッセージが適切であることを確認
- リトライロジックがある場合はそれもテスト

### 4. パフォーマンス

- 非同期処理のタイムアウトを設定
- 並行処理のテストを含める
- データベースクエリの効率性を確認

### 5. セキュリティ

- 認証・認可のテストを必須とする
- 入力値のサニタイゼーションを確認
- XSS、SQLインジェクション対策をテスト

### 6. 保守性

- テストコードもプロダクションコードと同じ品質基準を適用
- DRY原則に従い、テストヘルパーを活用
- テストの意図が明確になるよう命名

## トラブルシューティング

### よくある問題と解決方法

#### 1. "Cannot find module" エラー

```typescript
// jest.config.js
module.exports = {
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
  },
};
```

#### 2. Async Server Components のテスト

```typescript
// React 18+ の async components をテストする際の注意
import { render, waitFor } from '@testing-library/react'

test('async server component', async () => {
  const Component = await import('./AsyncComponent')
  const { container } = render(<Component.default />)

  await waitFor(() => {
    expect(container.textContent).toContain('Loaded')
  })
})
```

#### 3. FormData のテストでの問題

```typescript
// Node.js 環境で FormData を使用する場合
import { FormData } from 'formdata-node';

global.FormData = FormData as any;
```

## 参考リンク

- [Next.js Server Actions ドキュメント](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Jest 公式ドキュメント](https://jestjs.io/docs/getting-started)
- [Playwright 公式ドキュメント](https://playwright.dev/docs/intro)
- [Testing Library ドキュメント](https://testing-library.com/docs/)

## まとめ

Server Actions のテストは、アプリケーションの信頼性を確保する上で重要です。Unit Test、Integration Test、E2E Test を適切に組み合わせることで、包括的なテストカバレッジを実現できます。このガイドのパターンを参考に、プロジェクトに適したテスト戦略を構築してください。
