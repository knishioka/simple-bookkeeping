# テストアンチパターンと解決策

## 概要

フロントエンドテストでよく見られる問題パターンと、それらを避けるための実践的な解決策をまとめています。Simple Bookkeepingプロジェクトでの実際の経験に基づいて、技術的負債を避けながら価値あるテストを書く方法を説明します。

## 🚫 アンチパターン1: 実装詳細のテスト

### 問題のあるコード

```typescript
// ❌ 実装詳細をテストしている
describe('AccountDialog Component', () => {
  it('should call useState with correct initial value', () => {
    const { result } = renderHook(() => useState(''));
    expect(result.current[0]).toBe('');
  });

  it('should call handleSubmit when form is submitted', () => {
    const handleSubmit = jest.fn();
    const component = shallow(<AccountDialog onSubmit={handleSubmit} />);
    component.find('form').simulate('submit');
    expect(handleSubmit).toHaveBeenCalled();
  });

  it('should update state when input changes', () => {
    const component = mount(<AccountDialog />);
    component.find('input[name="code"]').simulate('change', { target: { value: '1110' } });
    expect(component.state('code')).toBe('1110');
  });
});
```

### 何が問題か

- **脆弱性**: 実装変更時にテストが壊れやすい
- **価値の欠如**: ユーザーが実際に体験する内容をテストしていない
- **保守性**: リファクタリング時にテストも大幅修正が必要

### ✅ 解決策: ユーザーの体験をテスト

```typescript
// ✅ ユーザーの行動と期待結果をテスト
describe('AccountDialog - ユーザーインタラクション', () => {
  it('【シナリオ1】必須項目未入力時に適切なエラーメッセージが表示される', async () => {
    const user = userEvent.setup();
    const mockOnSuccess = jest.fn();

    render(
      <AccountDialog
        open={true}
        onOpenChange={jest.fn()}
        accounts={[]}
        onSuccess={mockOnSuccess}
      />
    );

    // ユーザーが実際に行う操作
    const submitButton = screen.getByRole('button', { name: '作成' });
    await user.click(submitButton);

    // ユーザーが実際に見る内容
    await waitFor(() => {
      expect(screen.getByText('コードは必須です')).toBeInTheDocument();
      expect(screen.getByText('科目名は必須です')).toBeInTheDocument();
    });

    // ビジネス要件の確認
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });
});
```

## 🚫 アンチパターン2: 過度なモック

### 問題のあるコード

```typescript
// ❌ 全てをモックして実際のコードパスをテストしていない
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ onChange, value }: any) => (
    <input onChange={onChange} value={value} />
  ),
}));

jest.mock('@/components/ui/form', () => ({
  Form: ({ children }: any) => <div>{children}</div>,
  FormField: ({ children }: any) => <div>{children}</div>,
  FormItem: ({ children }: any) => <div>{children}</div>,
  FormControl: ({ children }: any) => <div>{children}</div>,
  FormMessage: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('react-hook-form', () => ({
  useForm: () => ({
    handleSubmit: jest.fn(),
    control: {},
    formState: { errors: {} },
  }),
  useFormContext: () => ({}),
}));
```

### 何が問題か

- **偽の安心感**: 実際のコンポーネント間の統合をテストしていない
- **メンテナンス負荷**: モックの更新が実装変更に追いつかない
- **価値の低下**: 実際のバグを検出できない

### ✅ 解決策: 必要最小限のモック

```typescript
// ✅ 外部依存のみモック、内部コンポーネントは実際に使用
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    post: jest.fn(),
    put: jest.fn(),
  },
}));

// 実際のUIコンポーネントを使用して統合をテスト
describe('AccountDialog Integration', () => {
  it('【シナリオ2】正しい情報入力で勘定科目が作成される', async () => {
    const user = userEvent.setup();

    mockApiClient.post.mockResolvedValue({
      data: { id: '1', code: '1110', name: '現金' }
    });

    render(<AccountDialog {...defaultProps} />);

    // 実際のフォームコンポーネントとの統合をテスト
    await user.type(screen.getByLabelText('コード'), '1110');
    await user.type(screen.getByLabelText('科目名'), '現金');

    // 実際のSelectコンポーネントとの統合をテスト
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '資産' }));

    await user.click(screen.getByRole('button', { name: '作成' }));

    // 実際のAPI呼び出しをテスト
    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/accounts', {
        code: '1110',
        name: '現金',
        accountType: 'ASSET',
        parentId: undefined,
      });
    });
  });
});
```

## 🚫 アンチパターン3: テスト環境の制約を無視

### 問題のあるコード

```typescript
// ❌ テスト環境で動作しない複雑なUIライブラリを無理やりテスト
describe('Complex Radix UI Select', () => {
  it('should handle all select interactions perfectly', async () => {
    const user = userEvent.setup();
    render(<ComplexSelectComponent />);

    // これらの操作はJSDOM環境では不安定
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Option 1' }));
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    // scrollIntoViewが存在しないためエラーになる
    expect(screen.getByDisplayValue('Option 2')).toBeInTheDocument();
  });
});
```

### 何が問題か

- **不安定なテスト**: テスト環境の制約により予期しない失敗が発生
- **開発効率の低下**: テストの修正に時間を浪費
- **技術的負債**: 動作しないテストの蓄積

### ✅ 解決策: 制約を受け入れ実用性を重視

```typescript
// ✅ 制約を受け入れつつ、価値ある部分をテスト
describe('Select Component - 実用的テスト', () => {
  it('【シナリオ8】タイプ変更時に親科目選択肢が適切にフィルタリングされる', async () => {
    const user = userEvent.setup();

    render(<AccountDialog {...props} />);

    // 基本的な操作のみテスト（制約を受け入れる）
    await user.click(screen.getByRole('combobox', { name: 'タイプ' }));

    // 期待される要素が存在するかのみ確認
    expect(screen.getByRole('option', { name: '1000 - 流動資産' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '4000 - 売上' })).not.toBeInTheDocument();

    // 制約について明確にコメント
    // Note: Radix UI Selectの完全なインタラクションはJSDOM環境では制限があります
    // ブラウザでの手動テストまたはE2Eテストで補完してください
  });
});
```

## 🚫 アンチパターン4: 同期的なテストコード

### 問題のあるコード

```typescript
// ❌ 非同期処理を適切に扱っていない
describe('API Integration', () => {
  it('should save account successfully', () => {
    const user = userEvent.setup();

    render(<AccountDialog {...props} />);

    // 非同期の入力操作を同期的に実行
    user.type(screen.getByLabelText('コード'), '1110');
    user.click(screen.getByRole('button', { name: '作成' }));

    // すぐに結果を期待（非同期処理を待機していない）
    expect(mockApiClient.post).toHaveBeenCalled();
    expect(screen.getByText('作成しました')).toBeInTheDocument();
  });
});
```

### 何が問題か

- **競合状態**: 非同期処理の完了前にアサーションが実行される
- **不安定なテスト**: 環境によってテストが成功したり失敗したりする
- **デバッグの困難**: 失敗の原因が特定しにくい

### ✅ 解決策: 適切な非同期処理

```typescript
// ✅ 非同期処理を適切に待機
describe('API Integration - 適切な非同期処理', () => {
  it('【シナリオ2】正しい情報入力で勘定科目が作成される', async () => {
    const user = userEvent.setup();

    mockApiClient.post.mockResolvedValue({
      data: { id: '1', code: '1110', name: '現金' }
    });

    render(<AccountDialog {...props} />);

    // 非同期操作を適切に待機
    await user.type(screen.getByLabelText('コード'), '1110');
    await user.type(screen.getByLabelText('科目名'), '現金');
    await user.click(screen.getByRole('button', { name: '作成' }));

    // 非同期結果を適切に待機
    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('勘定科目を作成しました');
    });
  });
});
```

## 🚫 アンチパターン5: 抽象的なテストデータ

### 問題のあるコード

```typescript
// ❌ 業務文脈を無視した抽象的なテストデータ
describe('Form Validation', () => {
  const testData = {
    field1: 'abc',
    field2: '123',
    field3: 'xyz',
  };

  it('should validate required fields', () => {
    render(<SomeForm data={testData} />);
    // ...
  });
});
```

### 何が問題か

- **現実性の欠如**: 実際のユーザーデータパターンをテストしていない
- **バグの見逃し**: 現実的なデータでのみ発生するバグを検出できない
- **理解の困難**: テストを読んでも業務要件が理解できない

### ✅ 解決策: 現実的なテストデータ

```typescript
// ✅ 実際の業務データを模倣したテストデータ
describe('Journal Entry Validation', () => {
  const realisticJournalEntry = {
    entryDate: '2024-12-10',
    description: '商品売上（現金）',
    documentNumber: 'INV-2024-001',
    lines: [
      {
        accountId: 'cash-account-id',
        accountCode: '1110',
        accountName: '現金',
        debitAmount: 108000,  // 税込金額
        creditAmount: 0,
        description: '商品代金受領',
        taxRate: 10,
      },
      {
        accountId: 'sales-account-id',
        accountCode: '4000',
        accountName: '売上高',
        debitAmount: 0,
        creditAmount: 100000,  // 税抜金額
        description: '商品売上',
        taxRate: 10,
      },
      {
        accountId: 'tax-account-id',
        accountCode: '2110',
        accountName: '仮受消費税',
        debitAmount: 0,
        creditAmount: 8000,  // 消費税額
        description: '消費税',
        taxRate: 0,
      },
    ],
  };

  it('【シナリオ1】消費税込みの売上仕訳が正しく処理される', async () => {
    // 実際の会計業務で発生するデータパターンをテスト
    render(<JournalEntryDialog entry={realisticJournalEntry} {...props} />);

    // 借方・貸方の合計が一致していることを確認
    expect(screen.getByText('差額: ¥0')).toBeInTheDocument();

    // 税額計算が正しいことを確認
    expect(screen.getByDisplayValue('8000')).toBeInTheDocument();
  });
});
```

## 🚫 アンチパターン6: 長大で複雑なテスト

### 問題のあるコード

```typescript
// ❌ 1つのテストで複数のシナリオをテスト
describe('Account Management', () => {
  it('should handle complete account lifecycle', async () => {
    const user = userEvent.setup();

    // アカウント作成
    render(<AccountDialog {...createProps} />);
    await user.type(screen.getByLabelText('コード'), '1110');
    await user.type(screen.getByLabelText('科目名'), '現金');
    await user.click(screen.getByRole('button', { name: '作成' }));

    // アカウント一覧表示
    render(<AccountList />);
    expect(screen.getByText('現金')).toBeInTheDocument();

    // アカウント編集
    await user.click(screen.getByRole('button', { name: '編集' }));
    render(<AccountDialog {...editProps} />);
    await user.clear(screen.getByLabelText('科目名'));
    await user.type(screen.getByLabelText('科目名'), '現金・小切手');
    await user.click(screen.getByRole('button', { name: '更新' }));

    // アカウント削除
    await user.click(screen.getByRole('button', { name: '削除' }));

    // 複数のアサーション
    expect(mockApiClient.post).toHaveBeenCalledTimes(1);
    expect(mockApiClient.put).toHaveBeenCalledTimes(1);
    expect(mockApiClient.delete).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('現金・小切手')).not.toBeInTheDocument();
  });
});
```

### 何が問題か

- **デバッグの困難**: どこで失敗したかの特定が困難
- **テストの脆弱性**: 1つの変更で複数のテストケースが壊れる
- **保守性の悪化**: テストの理解と修正が困難

### ✅ 解決策: 単一責任のテスト

```typescript
// ✅ 各テストは単一のシナリオに集中
describe('Account Dialog - 作成機能', () => {
  it('【シナリオ2】正しい情報入力で勘定科目が作成される', async () => {
    const user = userEvent.setup();

    mockApiClient.post.mockResolvedValue({
      data: { id: '1', code: '1110', name: '現金' }
    });

    render(<AccountDialog open={true} {...createProps} />);

    await user.type(screen.getByLabelText('コード'), '1110');
    await user.type(screen.getByLabelText('科目名'), '現金');
    await user.click(screen.getByRole('button', { name: '作成' }));

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/accounts', {
        code: '1110',
        name: '現金',
        accountType: 'ASSET',
        parentId: undefined,
      });
      expect(mockToast.success).toHaveBeenCalledWith('勘定科目を作成しました');
    });
  });
});

describe('Account Dialog - 編集機能', () => {
  it('【シナリオ4】既存勘定科目の名称を変更する', async () => {
    const user = userEvent.setup();
    const existingAccount = {
      id: '1',
      code: '1110',
      name: '現金',
      accountType: 'ASSET' as const,
      parentId: null
    };

    mockApiClient.put.mockResolvedValue({
      data: { ...existingAccount, name: '現金・小切手' }
    });

    render(<AccountDialog open={true} account={existingAccount} {...editProps} />);

    const nameInput = screen.getByLabelText('科目名');
    await user.clear(nameInput);
    await user.type(nameInput, '現金・小切手');
    await user.click(screen.getByRole('button', { name: '更新' }));

    await waitFor(() => {
      expect(mockApiClient.put).toHaveBeenCalledWith('/accounts/1', {
        code: '1110',
        name: '現金・小切手',
        accountType: 'ASSET',
        parentId: undefined,
      });
    });
  });
});
```

## 🚫 アンチパターン7: ハードコードされた待機時間

### 問題のあるコード

```typescript
// ❌ 固定的な待機時間
describe('Async Operations', () => {
  it('should load data after delay', async () => {
    render(<DataComponent />);

    // 固定的な待機（環境により動作が不安定）
    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(screen.getByText('データが読み込まれました')).toBeInTheDocument();
  });
});
```

### 何が問題か

- **テスト実行時間の増加**: 不必要に長い待機時間
- **不安定性**: 環境によって必要な時間が異なる
- **保守性**: 待機時間の調整が困難

### ✅ 解決策: 条件ベースの待機

```typescript
// ✅ 条件に基づく適切な待機
describe('Async Operations - 効率的な待機', () => {
  it('【シナリオ1】データ読み込み完了を適切に待機する', async () => {
    render(<DataComponent />);

    // 条件ベースの待機（最適な時間で完了）
    await waitFor(() => {
      expect(screen.getByText('データが読み込まれました')).toBeInTheDocument();
    }, { timeout: 5000 });

    // ローディング状態が終了していることも確認
    expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument();
  });

  it('【シナリオ2】エラー時の適切な処理', async () => {
    mockApiClient.get.mockRejectedValue(new Error('Network error'));

    render(<DataComponent />);

    // エラーメッセージの表示を待機
    await waitFor(() => {
      expect(screen.getByText('データの読み込みに失敗しました')).toBeInTheDocument();
    });
  });
});
```

## まとめ: 良いテストの原則

### ✅ 採用すべきプラクティス

1. **ユーザー中心**: 実装詳細ではなくユーザー体験をテスト
2. **現実的**: 実際の業務データとシナリオを使用
3. **独立性**: 各テストは独立して実行可能
4. **明確性**: テストの意図と期待結果を明確に記述
5. **保守性**: 変更に強く、理解しやすいテスト

### 🚫 避けるべきパターン

1. **実装詳細への依存**: 内部状態や関数呼び出しのテスト
2. **過度なモック**: 実際のコンポーネント統合を阻害
3. **環境制約の無視**: テスト環境で動作しないコードの無理なテスト
4. **同期的な期待**: 非同期処理の不適切な扱い
5. **抽象的なデータ**: 現実性を欠くテストデータ

このガイドラインに従うことで、技術的負債を避けながら、実際にバグを検出できる価値あるテストを作成できます。
