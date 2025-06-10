# データモデル仕様書

## 1. 概要
複式簿記システムのデータベース設計とエンティティの関連を定義する。

## 2. 主要エンティティ

### 2.1 会計期間（AccountingPeriod）
```
- id: UUID
- name: string (例: "2024年度")
- start_date: date
- end_date: date
- is_active: boolean
- created_at: timestamp
- updated_at: timestamp
```

### 2.2 勘定科目（Account）
```
- id: UUID
- code: string (勘定科目コード)
- name: string (勘定科目名)
- account_type: enum (資産/負債/純資産/収益/費用)
- parent_id: UUID (親科目ID、NULL可)
- is_system: boolean (システム標準科目)
- is_active: boolean
- created_at: timestamp
- updated_at: timestamp
```

### 2.3 仕訳（JournalEntry）
```
- id: UUID
- entry_date: date (仕訳日付)
- entry_number: string (仕訳番号)
- description: text (摘要)
- document_number: string (証憑番号、NULL可)
- status: enum (draft/approved/locked)
- accounting_period_id: UUID
- created_by: UUID
- created_at: timestamp
- updated_at: timestamp
```

### 2.4 仕訳明細（JournalEntryLine）
```
- id: UUID
- journal_entry_id: UUID
- account_id: UUID
- debit_amount: decimal (借方金額)
- credit_amount: decimal (貸方金額)
- description: text (明細摘要、NULL可)
- tax_rate: decimal (消費税率、NULL可)
- line_number: integer (行番号)
```

### 2.5 取引先（Partner）
```
- id: UUID
- code: string (取引先コード)
- name: string (取引先名)
- name_kana: string (フリガナ)
- partner_type: enum (customer/vendor/both)
- address: text
- phone: string
- email: string
- tax_id: string (法人番号/個人番号、NULL可)
- is_active: boolean
- created_at: timestamp
- updated_at: timestamp
```

### 2.6 固定資産（FixedAsset）
```
- id: UUID
- asset_code: string (資産コード)
- name: string (資産名)
- account_id: UUID (資産勘定科目)
- acquisition_date: date (取得日)
- acquisition_cost: decimal (取得価額)
- depreciation_method: enum (定額法/定率法)
- useful_life: integer (耐用年数)
- salvage_value: decimal (残存価額)
- status: enum (active/disposed/fully_depreciated)
- disposal_date: date (除却日、NULL可)
- created_at: timestamp
- updated_at: timestamp
```

### 2.7 減価償却（Depreciation）
```
- id: UUID
- fixed_asset_id: UUID
- accounting_period_id: UUID
- depreciation_date: date
- depreciation_amount: decimal
- accumulated_depreciation: decimal (累計償却額)
- book_value: decimal (帳簿価額)
- journal_entry_id: UUID (関連仕訳、NULL可)
```

### 2.8 消費税設定（TaxSetting）
```
- id: UUID
- name: string (例: "標準税率")
- rate: decimal (税率)
- tax_type: enum (standard/reduced/exempt)
- effective_from: date
- effective_to: date (NULL可)
- is_active: boolean
```

### 2.9 銀行口座（BankAccount）
```
- id: UUID
- bank_name: string
- branch_name: string
- account_type: enum (普通/当座/定期)
- account_number: string
- account_name: string
- account_id: UUID (関連勘定科目)
- is_active: boolean
```

### 2.10 ユーザー（User）
```
- id: UUID
- email: string (unique)
- password_hash: string
- name: string
- role: enum (admin/accountant/viewer)
- is_active: boolean
- last_login_at: timestamp
- created_at: timestamp
- updated_at: timestamp
```

### 2.11 監査ログ（AuditLog）
```
- id: UUID
- user_id: UUID
- action: enum (create/update/delete/approve)
- entity_type: string (対象エンティティ)
- entity_id: UUID
- old_values: jsonb
- new_values: jsonb
- ip_address: string
- user_agent: string
- created_at: timestamp
```

## 3. リレーションシップ

### 3.1 主要な関連
- JournalEntry 1:N JournalEntryLine
- Account 1:N JournalEntryLine
- Account 1:N Account (親子関係)
- AccountingPeriod 1:N JournalEntry
- User 1:N JournalEntry (created_by)
- FixedAsset 1:N Depreciation
- Partner 1:N JournalEntry (through JournalEntryLine)

### 3.2 制約
- JournalEntryの借方合計と貸方合計は一致する必要がある
- AccountingPeriodは重複してはいけない
- 仕訳日付は対応するAccountingPeriod内である必要がある
- 削除は論理削除を基本とする（is_activeフラグ）

## 4. インデックス設計

### 4.1 主要インデックス
- journal_entries.entry_date
- journal_entries.accounting_period_id
- journal_entry_lines.account_id
- journal_entry_lines.journal_entry_id
- accounts.code (unique)
- partners.code (unique)
- users.email (unique)

### 4.2 複合インデックス
- (accounting_period_id, entry_date) on journal_entries
- (journal_entry_id, line_number) on journal_entry_lines
- (account_id, entry_date) for 元帳検索

## 5. ビュー定義

### 5.1 試算表ビュー（TrialBalanceView）
勘定科目ごとの借方・貸方合計を集計

### 5.2 総勘定元帳ビュー（GeneralLedgerView）
勘定科目別の仕訳明細と残高推移

### 5.3 仕訳帳ビュー（JournalBookView）
日付順の仕訳一覧（明細含む）

## 6. データ整合性

### 6.1 トランザクション管理
- 仕訳の登録・更新・削除は必ずトランザクション内で実行
- 関連する明細行も同一トランザクション内で処理

### 6.2 バリデーションルール
- 借方・貸方の合計チェック
- 勘定科目の有効性チェック
- 会計期間の妥当性チェック
- 消費税計算の整合性チェック

### 6.3 監査証跡
- すべての変更操作をAuditLogに記録
- 仕訳の承認フローを実装
- 決算確定後の仕訳はロック（修正不可）