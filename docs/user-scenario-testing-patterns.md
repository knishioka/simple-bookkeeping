# ユーザーシナリオテストパターン集

## 概要

実際のユーザー行動に基づいたテストパターンを業務フロー別に整理したリファレンスです。Simple Bookkeepingの具体的な実装例を通じて、効果的なテストの書き方を学べます。

## 業務フロー別テストパターン

### 1. 新規ユーザー・研修スタッフのシナリオ

新しくシステムを使い始めるユーザーが遭遇しやすい問題をテストします。

#### パターン1-1: 必須項目の未入力エラー

```typescript
it('【シナリオ1】新規スタッフが必須項目を未入力で登録しようとした場合、適切なエラーメッセージが表示される', async () => {
  const user = userEvent.setup();
  
  render(<AccountDialog open={true} {...props} />);

  // 何も入力せずに作成ボタンをクリック
  const submitButton = screen.getByRole('button', { name: '作成' });
  await user.click(submitButton);

  // バリデーションエラーが表示されることを確認
  await waitFor(() => {
    expect(screen.getByText('コードは必須です')).toBeInTheDocument();
    expect(screen.getByText('科目名は必須です')).toBeInTheDocument();
  });

  // API呼び出しがされていないことを確認
  expect(mockApiClient.post).not.toHaveBeenCalled();
});
```

**適用場面:**
- フォーム入力画面全般
- 新規作成機能
- 設定画面

**ポイント:**
- ユーザーが最初に遭遇しやすいエラー
- 明確で理解しやすいエラーメッセージの確認
- システムが不正な状態にならないことの検証

#### パターン1-2: 操作の中断・キャンセル

```typescript
it('【シナリオ7】キャンセルボタンでダイアログが閉じられる', async () => {
  const user = userEvent.setup();
  
  render(<AccountDialog open={true} {...props} />);

  // データを一部入力
  await user.type(screen.getByLabelText('コード'), '1110');

  // キャンセル
  await user.click(screen.getByRole('button', { name: 'キャンセル' }));

  expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  expect(mockApiClient.post).not.toHaveBeenCalled();
});
```

**適用場面:**
- モーダルダイアログ
- 複数ステップのフォーム
- 編集画面

**ポイント:**
- データ損失の防止
- 意図しない操作の防止
- 適切な状態管理

### 2. 日常業務・経験者のシナリオ

毎日の業務で使用する機能の効率性と正確性をテストします。

#### パターン2-1: 複雑なビジネスロジック

```typescript
it('【シナリオ1】現金売上の仕訳を正しく入力して保存する', async () => {
  const user = userEvent.setup();
  
  mockApiClient.post.mockResolvedValue({
    data: { id: '1', entryNumber: '202412001', status: 'DRAFT' }
  });

  render(<JournalEntryDialog open={true} {...props} />);

  // 基本情報入力
  const dateInput = screen.getByLabelText('日付');
  await user.clear(dateInput);
  await user.type(dateInput, '2024-12-10');

  const descriptionInput = screen.getByLabelText('摘要');
  await user.type(descriptionInput, '現金売上');

  // 1行目: 現金（借方）
  const firstAccountSelect = screen.getAllByRole('combobox')[0];
  await user.click(firstAccountSelect);
  await user.click(screen.getByRole('option', { name: '1110 - 現金' }));

  const firstDebitInput = screen.getAllByDisplayValue('0')[0];
  await user.clear(firstDebitInput);
  await user.type(firstDebitInput, '50000');

  // 2行目: 売上高（貸方）
  const secondAccountSelect = screen.getAllByRole('combobox')[1];
  await user.click(secondAccountSelect);
  await user.click(screen.getByRole('option', { name: '4000 - 売上高' }));

  const secondCreditInput = screen.getAllByDisplayValue('0')[3];
  await user.clear(secondCreditInput);
  await user.type(secondCreditInput, '50000');

  // バランスが取れていることを確認
  await waitFor(() => {
    expect(screen.getByText('差額: ¥0')).toBeInTheDocument();
  });

  // 保存実行
  const saveButton = screen.getByRole('button', { name: '作成' });
  expect(saveButton).not.toBeDisabled();
  await user.click(saveButton);

  // API呼び出しの確認
  await waitFor(() => {
    expect(mockApiClient.post).toHaveBeenCalledWith('/journal-entries', {
      entryDate: '2024-12-10',
      description: '現金売上',
      documentNumber: '',
      lines: [
        {
          accountId: '1',
          debitAmount: 50000,
          creditAmount: 0,
          description: '',
          taxRate: 0,
        },
        {
          accountId: '3',
          debitAmount: 0,
          creditAmount: 50000,
          description: '',
          taxRate: 0,
        },
      ],
    });
  });
});
```

**適用場面:**
- 会計仕訳入力
- 在庫管理
- 売上入力

**ポイント:**
- 業界特有のビジネスルール（借方・貸方の一致）
- リアルタイム計算の確認
- 複数の関連入力項目の協調動作

#### パターン2-2: 動的なUI操作

```typescript
it('【シナリオ6】仕訳明細行の追加と削除', async () => {
  const user = userEvent.setup();

  render(<JournalEntryDialog open={true} {...props} />);

  // 初期状態: 2行
  expect(screen.getAllByRole('combobox')).toHaveLength(2);

  // 行を追加
  const addButton = screen.getByRole('button', { name: /行を追加/ });
  await user.click(addButton);
  await user.click(addButton);

  // 4行になっていることを確認
  expect(screen.getAllByRole('combobox')).toHaveLength(4);

  // 削除ボタンが表示されることを確認（最低2行は残すため）
  const deleteButtons = screen.getAllByRole('button', { name: '' }); // Minus icon buttons
  expect(deleteButtons).toHaveLength(2); // 3行目と4行目のみ削除可能

  // 行を削除
  await user.click(deleteButtons[0]);

  // 3行になっていることを確認
  expect(screen.getAllByRole('combobox')).toHaveLength(3);
});
```

**適用場面:**
- 動的テーブル
- リスト管理
- 複数選択機能

**ポイント:**
- DOM要素の動的追加・削除
- 最小・最大制限の確認
- 操作後の状態整合性

### 3. エラー処理・障害対応のシナリオ

システム障害やネットワーク問題時のユーザー体験をテストします。

#### パターン3-1: ネットワーク障害

```typescript
it('【シナリオ1】ネットワーク接続失敗時の適切なエラーハンドリング', async () => {
  // ネットワークエラーをシミュレート
  mockFetch.mockRejectedValue(new Error('Network connection failed'));

  const result = await apiClient.get('/accounts');

  expect(result.error).toEqual({
    code: 'NETWORK_ERROR',
    message: '通信エラーが発生しました',
  });
  expect(mockToast.error).toHaveBeenCalledWith('通信エラーが発生しました');
});
```

**適用場面:**
- API通信を伴う全ての操作
- ファイルアップロード
- 自動保存機能

**ポイント:**
- ユーザーフレンドリーなエラーメッセージ
- データ損失の防止
- 復旧手順の提供

#### パターン3-2: 認証エラーとリカバリ

```typescript
it('【シナリオ5】期限切れトークンの自動リフレッシュ成功', async () => {
  localStorageMock.getItem.mockImplementation((key) => {
    if (key === 'token') return 'expired-token';
    if (key === 'refreshToken') return 'valid-refresh-token';
    return null;
  });

  // 最初のリクエストは401で失敗
  // リフレッシュリクエストは成功
  // 再試行リクエストは成功
  mockFetch
    .mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Token expired' } }),
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          token: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      }),
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ id: '1', code: '1110', name: '現金' }],
      }),
    } as Response);

  const result = await apiClient.get('/accounts');

  expect(result.data).toEqual([{ id: '1', code: '1110', name: '現金' }]);
  expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'new-access-token');
  expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', 'new-refresh-token');
});
```

**適用場面:**
- 長時間の作業セッション
- 自動保存機能
- バックグラウンド処理

**ポイント:**
- 透明な認証更新
- ユーザー操作の継続性
- セキュリティの維持

### 4. アクセシビリティ・ユーザビリティのシナリオ

多様なユーザーの利用方法をテストします。

#### パターン4-1: キーボード操作

```typescript
it('【シナリオ9】Enterキーでのフォーム送信', async () => {
  const user = userEvent.setup();
  
  render(<LoginPage />);

  // フォーム入力
  await user.type(screen.getByLabelText('メールアドレス'), 'user@example.com');
  await user.type(screen.getByLabelText('パスワード'), 'password123');

  // Enterキーでフォーム送信
  await user.keyboard('{Enter}');

  expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'password123');
});
```

**適用場面:**
- フォーム全般
- ナビゲーション
- ショートカットキー

**ポイント:**
- マウス以外の操作方法
- 効率的な操作フロー
- アクセシビリティ標準の準拠

#### パターン4-2: ラベルとフィールドの関連付け

```typescript
it('【シナリオ7】フォームラベルとフィールドの適切な関連付け', () => {
  render(<LoginPage />);

  // ラベルがフィールドと適切に関連付けられていることを確認
  const emailInput = screen.getByLabelText('メールアドレス');
  const passwordInput = screen.getByLabelText('パスワード');

  expect(emailInput).toHaveAttribute('type', 'email');
  expect(passwordInput).toHaveAttribute('type', 'password');
  expect(emailInput).toHaveAttribute('id', 'email');
  expect(passwordInput).toHaveAttribute('id', 'password');
});
```

**適用場面:**
- 全てのフォーム要素
- ナビゲーション要素
- インタラクティブ要素

**ポイント:**
- スクリーンリーダー対応
- セマンティックHTML
- WCAG準拠

### 5. パフォーマンス・スケーラビリティのシナリオ

大量データや長時間利用時の動作をテストします。

#### パターン5-1: 大量データ処理

```typescript
it('【シナリオ9】大量データ取得時のメモリ使用量を考慮した処理', async () => {
  // 大量データのレスポンスをシミュレート
  const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
    id: `entry-${i}`,
    entryNumber: `202412${String(i).padStart(3, '0')}`,
    description: `仕訳 ${i}`,
  }));

  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: largeDataset }),
  } as Response);

  const result = await apiClient.get('/journal-entries?limit=1000');

  expect(result.data).toHaveLength(1000);
  expect(result.data[0]).toEqual({
    id: 'entry-0',
    entryNumber: '202412000',
    description: '仕訳 0',
  });
});
```

**適用場面:**
- データテーブル
- 検索結果
- エクスポート機能

**ポイント:**
- レスポンス時間の監視
- メモリ使用量の適正性
- UI の応答性維持

#### パターン5-2: 並行処理

```typescript
it('【シナリオ10】並行リクエスト時の適切な処理', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: { success: true } }),
  } as Response);

  // 複数の並行リクエストを実行
  const promises = [
    apiClient.get('/accounts'),
    apiClient.get('/journal-entries'),
    apiClient.get('/organizations/mine'),
  ];

  const results = await Promise.all(promises);

  expect(results).toHaveLength(3);
  expect(mockFetch).toHaveBeenCalledTimes(3);
  results.forEach(result => {
    expect(result.data).toEqual({ success: true });
  });
});
```

**適用場面:**
- ダッシュボード読み込み
- 複数APIの同時実行
- バックグラウンド同期

**ポイント:**
- 競合状態の回避
- エラー処理の一貫性
- パフォーマンスの最適化

## シナリオテストの設計原則

### 1. ユーザーストーリーから始める

```
As a 新人経理スタッフ
I want 勘定科目を正しく登録したい
So that 仕訳入力で適切な科目を選択できる
```

このユーザーストーリーから以下のテストケースを導出：

- 必須項目未入力時のガイダンス
- 重複コード入力時の警告
- 親科目との関係性確認
- 登録後の即座な利用可能性

### 2. 失敗ケースを重視する

成功ケースは1つ、失敗ケースは無数にあります。

```typescript
// ✅ 多様な失敗ケースをテスト
describe('バリデーションエラー', () => {
  test('必須項目未入力');
  test('文字数制限超過');
  test('不正な形式');
  test('重複データ');
  test('業務ルール違反');
});

// ❌ 成功ケースのみ
describe('正常処理', () => {
  test('正しいデータで作成成功');
});
```

### 3. 実際のデータパターンを使用

```typescript
// ✅ 実際の業務データ
const realisticTestData = {
  accounts: [
    { code: '1110', name: '現金', type: 'ASSET' },
    { code: '2110', name: '買掛金', type: 'LIABILITY' },
    { code: '4000', name: '売上高', type: 'REVENUE' },
  ],
  journalEntry: {
    date: '2024-12-10',
    description: '商品販売（現金）',
    lines: [
      { account: '1110', debit: 108000, credit: 0, taxRate: 10 },
      { account: '4000', debit: 0, credit: 100000, taxRate: 10 },
      { account: '2211', debit: 0, credit: 8000, taxRate: 10 }, // 仮受消費税
    ],
  },
};

// ❌ 抽象的なテストデータ
const abstractTestData = {
  field1: 'value1',
  field2: 'value2',
};
```

## テストメンテナンスのベストプラクティス

### 1. テストの独立性確保

```typescript
// ✅ 各テストで独立したデータを使用
beforeEach(() => {
  jest.clearAllMocks();
  setupFreshTestData();
});

// ❌ テスト間でデータを共有
let sharedTestData; // 危険: テスト間で状態が汚染される
```

### 2. 意味のあるアサーション

```typescript
// ✅ ユーザーが実際に見る内容をテスト
expect(screen.getByText('勘定科目を作成しました')).toBeInTheDocument();
expect(screen.getByRole('button', { name: '作成' })).toBeDisabled();

// ❌ 実装詳細をテスト
expect(component.state.isLoading).toBe(true);
expect(mockFunction).toHaveBeenCalledTimes(1);
```

### 3. テスト実行速度の最適化

```typescript
// ✅ 必要最小限の待機
await waitFor(() => {
  expect(screen.getByText('完了')).toBeInTheDocument();
}, { timeout: 1000 });

// ✅ 並行実行可能なテストは並行化
describe.concurrent('Independent API Tests', () => {
  // ...
});

// ❌ 固定の長い待機時間
await new Promise(resolve => setTimeout(resolve, 3000));
```

このパターン集を活用することで、実際のユーザー体験に近い価値の高いテストを効率的に作成できます。