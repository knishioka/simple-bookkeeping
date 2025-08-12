# Refactor: Eliminate 'any' types and improve type safety

## 🎯 概要

TypeScriptの型安全性を向上させるため、コードベース内の`any`型使用箇所を適切な型定義に置き換えます。現在、主にテストファイルで9箇所以上の`any`型が使用されており、型安全性が損なわれています。

## 🔍 現状の問題点

### any型の使用箇所

#### 1. テストファイルでの使用

| ファイル                                      | 行数 | 使用状況             |
| --------------------------------------------- | ---- | -------------------- |
| apps/api/src/controllers/**tests**/\*.test.ts | 複数 | モックデータの型付け |
| apps/web/e2e/\*.spec.ts                       | 複数 | テストヘルパー関数   |
| packages/_/tests/_.test.ts                    | 複数 | アサーション         |

#### 2. エラーハンドリング

```typescript
// ❌ 現状の問題のあるコード
try {
  await someOperation();
} catch (error: any) {
  console.log(error.message); // 型安全でない
}

// ❌ テストでの型アサーション
const mockUser = {
  id: '123',
  name: 'Test',
} as any; // 型チェックを回避
```

#### 3. 型推論が不十分な箇所

```typescript
// ❌ 明示的な型がない
const processData = (data: any) => {
  return data.map((item: any) => item.value);
};

// ❌ 関数の戻り値型が不明
const fetchData = async (id: string) => {
  const response = await api.get(`/data/${id}`);
  return response.data; // any型として推論される
};
```

### 影響範囲

- **型安全性の欠如**: ランタイムエラーのリスク増大
- **IDE支援の低下**: 自動補完やリファクタリングツールが機能しない
- **コードの可読性**: 型情報がないため、コードの意図が不明確
- **バグの潜在**: コンパイル時に検出できるエラーを見逃す

## 💡 推奨される解決策

### 1. エラーハンドリングの改善

```typescript
// ✅ 型ガードを使用
try {
  await someOperation();
} catch (error) {
  if (error instanceof Error) {
    logger.error('Operation failed', { message: error.message });
  } else {
    logger.error('Unknown error', { error: String(error) });
  }
}

// ✅ カスタムエラー型の定義
interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}
```

### 2. テストモックの型定義

```typescript
// ✅ 適切な型定義を使用
import { User } from '@simple-bookkeeping/types';

const mockUser: Partial<User> = {
  id: '123',
  name: 'Test User',
  email: 'test@example.com',
};

// ✅ テストユーティリティの型定義
function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 'default-id',
    name: 'Default User',
    email: 'default@example.com',
    role: 'viewer',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
```

### 3. ジェネリクスの活用

```typescript
// ✅ ジェネリクスで型安全性を保つ
interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

async function fetchData<T>(endpoint: string): Promise<T> {
  const response = await api.get<ApiResponse<T>>(endpoint);
  return response.data.data;
}

// 使用例
const user = await fetchData<User>('/users/123');
// userは User型として推論される
```

### 4. Unknown型の活用

```typescript
// ✅ any の代わりに unknown を使用
function parseJson(jsonString: string): unknown {
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

// 使用時に型ガードで絞り込み
const data = parseJson(jsonString);
if (isUser(data)) {
  // dataはUser型として扱える
  console.log(data.name);
}
```

## 📋 アクセプタンスクライテリア

- [ ] 全ての`any`型が適切な型に置き換えられている
- [ ] エラーハンドリングで型ガードが使用されている
- [ ] テストファイルで適切な型定義が使用されている
- [ ] 型定義ファイルが整理されている
- [ ] TSConfigで`strict`モードが有効化されている
- [ ] 型チェックエラーが0件になっている
- [ ] IDE支援が全ての箇所で機能する

## 🏗️ 実装ステップ

1. **型定義の整備**（1日）
   - 共通型定義の確認と拡充
   - カスタム型ガードの作成
   - ユーティリティ型の定義

2. **エラーハンドリングの改善**（1日）
   - エラー型の定義
   - 型ガードの実装
   - catchブロックの更新

3. **テストファイルの型付け**（2日）
   - モックデータの型定義
   - テストユーティリティの型付け
   - アサーションの改善

4. **APIクライアントの型定義**（1日）
   - レスポンス型の定義
   - ジェネリクスの適用
   - 型推論の改善

5. **検証と最適化**（1日）
   - 型チェックの実行
   - パフォーマンステスト
   - ドキュメント更新

## ⏱️ 見積もり工数

- **総工数**: 6人日
- **優先度**: Medium 🟡
- **影響度**: コード品質とメンテナンス性

## 🏷️ ラベル

- `typescript`
- `technical-debt`
- `medium-priority`
- `code-quality`

## 📊 成功指標

- `any`型の使用: 0件
- 型カバレッジ: 100%
- TypeScriptエラー: 0件
- IDE支援の改善: 全機能有効
- バグ検出率: 向上

## ⚠️ リスクと考慮事項

- **ビルド時間の増加**: 厳密な型チェックによる
- **一時的な生産性低下**: 型定義の作成に時間がかかる
- **学習コスト**: チームメンバーのTypeScript習熟度
- **サードパーティライブラリ**: 型定義がない場合の対応

## 🛠️ TSConfig推奨設定

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## 📚 参考資料

- [TypeScript Handbook - Type Guards](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TypeScript Do's and Don'ts](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
- [Type-Safe Error Handling](https://github.com/supermacro/neverthrow)
- [TypeScript Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
