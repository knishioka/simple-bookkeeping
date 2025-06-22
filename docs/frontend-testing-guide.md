# フロントエンドテスト実装ガイド

## 概要

このドキュメントは、Simple Bookkeepingプロジェクトにおけるフロントエンドテストの実装方針とベストプラクティスをまとめたものです。実際のユーザー行動を想定し、技術的負債を避けながら価値のあるテストを作成するためのガイドです。

## 基本方針

### 1. ユーザーシナリオベーステスト

テストは技術的な実装詳細ではなく、**実際のユーザーの使用方法**に基づいて作成します。

```typescript
// ❌ 悪い例: 実装詳細をテスト
it('should call useState with correct initial value', () => {
  // useStateの内部動作をテスト
});

// ✅ 良い例: ユーザーの行動をテスト
it('【シナリオ1】新規スタッフが必須項目を未入力で登録しようとした場合、適切なエラーメッセージが表示される', async () => {
  // 実際のユーザー操作をシミュレート
});
```

### 2. 負債を避ける実装

完璧を求めず、**実用的で保守可能**なテストレベルを維持します。

- 複雑なUIライブラリの細部は無理にテストしない
- モックは最小限に留める
- テスト環境での制約は受け入れる

### 3. 価値の高いテストケースの優先

以下の優先順位でテストを実装します：

1. **High**: ユーザーの業務に直接影響するエラーケース
2. **Medium**: ユーザビリティ・アクセシビリティ
3. **Low**: エッジケース・パフォーマンス

## 実装パターン

### パターン1: フォームバリデーションテスト

ユーザーが最も遭遇しやすいエラーケースをテストします。

```typescript
describe('バリデーションエラーのユーザーシナリオ', () => {
  it('【シナリオ1】借方・貸方のバランスが合わない場合の処理', async () => {
    const user = userEvent.setup();

    render(<JournalEntryDialog open={true} {...props} />);

    // 意図的に不一致データを入力
    await user.type(screen.getByLabelText('摘要'), 'バランスエラーテスト');
    await user.clear(screen.getAllByDisplayValue('0')[0]);
    await user.type(screen.getAllByDisplayValue('0')[0], '50000');
    await user.clear(screen.getAllByDisplayValue('0')[3]);
    await user.type(screen.getAllByDisplayValue('0')[3], '30000');

    // 差額が表示されることを確認
    await waitFor(() => {
      expect(screen.getByText('差額: ¥20,000')).toBeInTheDocument();
    });

    // 保存ボタンが無効化されていることを確認
    const saveButton = screen.getByRole('button', { name: '作成' });
    expect(saveButton).toBeDisabled();
  });
});
```

**実装のコツ:**

- 実際のユーザーが入力するデータパターンを使用
- エラー状態の視覚的フィードバックを確認
- 操作が適切にブロックされることを検証

### パターン2: API通信エラーハンドリング

ネットワーク不安定時の実際のユーザー体験をテストします。

```typescript
describe('API通信エラーのユーザーシナリオ', () => {
  it('【シナリオ5】API通信エラー時に適切なエラーメッセージが表示される', async () => {
    const user = userEvent.setup();

    // API エラーをモック
    mockApiClient.post.mockRejectedValue(new Error('Network error'));

    render(<AccountDialog open={true} {...props} />);

    // 正常なデータを入力
    await user.type(screen.getByLabelText('コード'), '1110');
    await user.type(screen.getByLabelText('科目名'), '現金');

    // 保存実行
    await user.click(screen.getByRole('button', { name: '作成' }));

    // エラーメッセージが表示されることを確認
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('勘定科目の作成に失敗しました');
    });

    // ダイアログが閉じられていないことを確認
    expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);
  });
});
```

**実装のコツ:**

- 実際に起こりうるネットワークエラーをシミュレート
- ユーザーへの適切なフィードバックを確認
- データ損失を防ぐ処理を検証

### パターン3: ローディング状態とユーザビリティ

操作中の適切なフィードバックをテストします。

```typescript
describe('ローディング状態のユーザーシナリオ', () => {
  it('【シナリオ11】保存中のローディング表示と操作無効化', async () => {
    const user = userEvent.setup();

    // 保存API を遅延させる
    let resolvePromise: (value: any) => void;
    const savePromise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    mockApiClient.post.mockReturnValue(savePromise);

    render(<JournalEntryDialog open={true} {...props} />);

    // データ入力と保存開始
    await user.type(screen.getByLabelText('摘要'), 'ローディングテスト');
    await user.click(screen.getByRole('button', { name: '作成' }));

    // ローディング状態の確認
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '保存中...' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '保存中...' })).toBeDisabled();
    });

    // 保存完了
    resolvePromise!({ data: { id: '1' } });
  });
});
```

**実装のコツ:**

- Promise制御による非同期処理のシミュレート
- ローディング中のUI状態を詳細に確認
- ユーザーの操作ミスを防ぐ仕組みを検証

## UIライブラリの制約への対応

### Radix UI Select コンポーネント

テスト環境では完全に動作しない場合があります。実用的なアプローチを採用します。

```typescript
// ✅ 実用的なアプローチ
it('【シナリオ8】タイプ変更時に親科目選択肢が適切にフィルタリングされる', async () => {
  const user = userEvent.setup();

  render(<AccountDialog open={true} {...props} />);

  // 基本的な操作のみテスト
  await user.click(screen.getByRole('combobox', { name: 'タイプ' }));

  // 期待値をテストするが、完全な動作は求めない
  expect(screen.getByRole('option', { name: '1000 - 流動資産' })).toBeInTheDocument();

  // コメントで制約を明記
  // Note: Radix UI Select の完全なテストはJSDOM環境では困難
});
```

## モックの実装方針

### 1. 外部依存関係のモック

```typescript
// API クライアント
jest.mock('@/lib/api-client', () => ({
  apiClient: {
    post: jest.fn(),
    put: jest.fn(),
    get: jest.fn(),
  },
}));

// トースト通知
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Next.js ルーター
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));
```

### 2. 認証コンテキストのモック

```typescript
jest.mock('@/contexts/auth-context', () => ({
  useAuth: jest.fn(),
}));

// テスト内で状態を制御
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
mockUseAuth.mockReturnValue({
  login: mockLogin,
  loading: false,
  // ... その他のプロパティ
});
```

## テストデータの設計

### リアルなテストデータの使用

```typescript
// ✅ 実際の業務データパターン
const mockAccounts = [
  { id: '1', code: '1110', name: '現金', accountType: 'ASSET' as const },
  { id: '2', code: '1120', name: '売掛金', accountType: 'ASSET' as const },
  { id: '3', code: '4000', name: '売上高', accountType: 'REVENUE' as const },
];

// ✅ 実際のユーザー入力パターン
const realisticFormData = {
  entryDate: '2024-12-10',
  description: '現金売上',
  lines: [
    { accountId: '1', debitAmount: 50000, creditAmount: 0 },
    { accountId: '3', debitAmount: 0, creditAmount: 50000 },
  ],
};
```

## エラーケースの網羅

### 1. ユーザー入力エラー

- 必須項目未入力
- 不正な形式の入力
- 文字数制限超過
- 業務ロジック違反（借方・貸方不一致など）

### 2. システムエラー

- ネットワーク接続失敗
- サーバーエラー（500系）
- バリデーションエラー（400系）
- 認証エラー（401, 403）

### 3. ユーザビリティ

- ローディング状態の適切な表示
- キャンセル操作の適切な処理
- アクセシビリティ（ラベル関連付けなど）

## パフォーマンス考慮事項

### テスト実行時間の最適化

```typescript
// ✅ 必要最小限の待機
await waitFor(
  () => {
    expect(screen.getByText('エラーメッセージ')).toBeInTheDocument();
  },
  { timeout: 1000 }
);

// ✅ 並行テスト実行
describe.concurrent('API Client Tests', () => {
  // 独立したテストは並行実行
});

// ❌ 不要な待機時間
await new Promise((resolve) => setTimeout(resolve, 2000));
```

## ファイル構成

```
src/
├── components/
│   ├── accounts/
│   │   ├── __tests__/
│   │   │   ├── account-dialog.test.tsx
│   │   │   └── account-dialog-demo.test.tsx
│   │   └── account-dialog.tsx
│   └── journal-entries/
├── lib/
│   ├── __tests__/
│   │   └── api-client.test.ts
│   └── api-client.ts
└── app/
    └── login/
        ├── __tests__/
        │   └── page.test.tsx
        └── page.tsx
```

## ベストプラクティス

### 1. テスト名の命名規則

```typescript
// ✅ ユーザーシナリオを明記
it('【シナリオ1】新規スタッフが必須項目を未入力で登録しようとした場合、適切なエラーメッセージが表示される', () => {});

// ✅ 具体的な状況を説明
it('【シナリオ5】API通信エラー時に適切なエラーメッセージが表示される', () => {});

// ❌ 抽象的すぎる
it('should show error', () => {});
```

### 2. アサーションの書き方

```typescript
// ✅ ユーザーが見る内容をテスト
expect(screen.getByText('借方と貸方の合計が一致しません')).toBeInTheDocument();

// ✅ 期待される状態変化を確認
expect(screen.getByRole('button', { name: '作成' })).toBeDisabled();

// ✅ API呼び出しの内容を検証
expect(mockApiClient.post).toHaveBeenCalledWith('/accounts', expectedData);
```

### 3. テストの独立性

```typescript
beforeEach(() => {
  jest.clearAllMocks();
  // 各テストで清潔な状態から開始
});

// ✅ テスト間でデータを共有しない
describe('AccountDialog Tests', () => {
  const freshProps = () => ({
    open: true,
    onOpenChange: jest.fn(),
    accounts: [
      /* fresh data */
    ],
    onSuccess: jest.fn(),
  });
});
```

## 継続的改善

### 1. テストカバレッジの監視

重要なユーザーフローが適切にカバーされているかを定期的に確認します。

### 2. 実際のバグからのフィードバック

本番環境で発見されたバグに対応するテストケースを追加します。

### 3. ユーザビリティテストとの連携

実際のユーザーテストで発見された問題をテストケースに反映します。

## まとめ

このガイドに従うことで、以下を実現できます：

- **実用的**: 実際のユーザー行動に基づいたテスト
- **保守可能**: 技術的負債を避けた持続可能な実装
- **価値ある**: ビジネス価値の高いケースを優先したテスト

テストは完璧である必要はありません。ユーザーにとって価値があり、開発チームにとって保守可能なレベルで実装することが重要です。
