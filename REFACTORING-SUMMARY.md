# リファクタリング実施概要

## 実施日: 2025年1月

## 概要

技術的負債の解消とメンテナビリティ向上を目的とした包括的なリファクタリングを実施しました。

## 主な改善点

### 1. 共通コンポーネント・ユーティリティの抽出

#### 作成した共通コンポーネント

- **DateRangePicker** (`/apps/web/src/components/common/DateRangePicker.tsx`)
  - 日付範囲選択UI
  - 帳簿・レポートページで共通利用
- **ReportLayout** (`/apps/web/src/components/common/ReportLayout.tsx`)
  - レポートページの共通レイアウト
  - 印刷機能、タイトル表示を統一
- **LedgerTable** (`/apps/web/src/components/common/LedgerTable.tsx`)
  - 帳簿データ表示用テーブル
  - 借方・貸方・残高表示を標準化
- **ReportTable** (`/apps/web/src/components/common/ReportTable.tsx`)
  - 財務諸表用テーブル
  - 階層表示、合計行のスタイリング対応

#### 作成したカスタムフック

- **useApiCall** (`/apps/web/src/hooks/useApiCall.ts`)
  - API呼び出しの標準化
  - ローディング状態とエラーハンドリング
- **useDateRange** (`/apps/web/src/hooks/useDateRange.ts`)
  - 日付範囲管理
  - デフォルト値の設定と更新

#### ユーティリティ関数

- **formatters** (`/apps/web/src/lib/formatters.ts`)
  - 日付フォーマット: `formatDate`, `formatYearMonth`
  - 金額フォーマット: `formatAmount`, `formatCurrency`
  - 日付計算: `getMonthStart`, `getMonthEnd`, `getToday`

### 2. 型定義の整理と共通化

#### @simple-bookkeeping/types パッケージ

- **auth.ts**: 認証関連の型定義
- **organization.ts**: 組織関連の型定義
- **account.ts**: 勘定科目関連の型定義
- **journal.ts**: 仕訳関連の型定義
- **ledger.ts**: 帳簿関連の型定義
- **report.ts**: 財務諸表関連の型定義
- **api.ts**: API固有の型定義
- **common.ts**: 共通型定義

### 3. エラーハンドリングの統一

#### @simple-bookkeeping/errors パッケージ

- **BaseError**: カスタムエラーの基底クラス
- **ApiError系**: NotFoundError, UnauthorizedError, ValidationApiError等
- **BusinessError系**: UnbalancedEntryError, ClosedPeriodError等
- **handleError**: 統一的なエラーレスポンス生成

### 4. コードの重複削除

#### Before

各帳簿・レポートページで個別に実装していた:

- 日付フォーマット処理
- 金額フォーマット処理
- API呼び出しとエラーハンドリング
- 日付範囲選択UI

#### After

共通化により、各ページは業務ロジックに集中:

```typescript
// 例: 現金出納帳ページ
const { startDate, endDate, setStartDate, setEndDate } = useDateRange();
const { data, loading, execute } = useApiCall<CashBookResponse>();

// UIは共通コンポーネントを利用
<ReportLayout title="現金出納帳">
  <DateRangePicker ... />
  <LedgerTable entries={transformedEntries} />
</ReportLayout>
```

## 技術的改善

### パフォーマンス

- 共通コンポーネント化によるバンドルサイズの最適化
- useCallbackによる不要な再レンダリング防止

### 保守性

- 単一責任の原則に従ったコンポーネント設計
- 型安全性の向上
- エラーハンドリングの一貫性

### テスタビリティ

- 小さく独立したコンポーネントで単体テスト容易
- カスタムフックの独立したテストが可能

## 今後の課題

1. **APIクライアントの改善**
   - axios interceptorでの共通エラーハンドリング
   - リトライ機能の実装

2. **状態管理の最適化**
   - Zustandストアの整理
   - キャッシュ戦略の実装

3. **アクセシビリティ向上**
   - キーボードナビゲーション
   - スクリーンリーダー対応

4. **国際化対応**
   - i18nの導入
   - 多言語対応の準備

## 影響範囲

### 修正したファイル

- 帳簿ページ: 4ファイル
- レポートページ: 3ファイル
- コンポーネント: 2ファイル（Select value修正）

### 新規作成

- 共通コンポーネント: 4ファイル
- カスタムフック: 2ファイル
- ユーティリティ: 1ファイル
- パッケージ: 2パッケージ

## テスト結果

- ✅ 全ユニットテスト合格
- ✅ コンポーネントテスト合格
- ⚠️ E2Eテストは要確認（API依存のため）
