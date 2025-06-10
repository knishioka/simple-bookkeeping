# API設計仕様書

## 1. 概要

### 1.1 基本設計方針

- RESTful APIとして設計
- JSON形式でのデータ交換
- JWT認証を使用
- エラーレスポンスの統一化
- ページネーション対応

### 1.2 共通仕様

- Base URL: `/api/v1`
- Content-Type: `application/json`
- 認証: `Authorization: Bearer {token}`
- 日付形式: ISO 8601 (YYYY-MM-DD)

## 2. 認証API

### 2.1 ログイン

```
POST /auth/login
{
  "email": "user@example.com",
  "password": "password"
}

Response:
{
  "token": "jwt_token",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "role": "admin"
  }
}
```

### 2.2 ログアウト

```
POST /auth/logout
Authorization: Bearer {token}

Response:
{
  "message": "Logged out successfully"
}
```

### 2.3 トークンリフレッシュ

```
POST /auth/refresh
{
  "refresh_token": "refresh_token"
}

Response:
{
  "token": "new_jwt_token",
  "refresh_token": "new_refresh_token"
}
```

## 3. 会計期間API

### 3.1 会計期間一覧取得

```
GET /accounting-periods

Response:
{
  "data": [
    {
      "id": "uuid",
      "name": "2024年度",
      "start_date": "2024-01-01",
      "end_date": "2024-12-31",
      "is_active": true
    }
  ]
}
```

### 3.2 会計期間作成

```
POST /accounting-periods
{
  "name": "2025年度",
  "start_date": "2025-01-01",
  "end_date": "2025-12-31"
}
```

## 4. 勘定科目API

### 4.1 勘定科目一覧取得

```
GET /accounts?type={account_type}&active=true

Response:
{
  "data": [
    {
      "id": "uuid",
      "code": "1110",
      "name": "現金",
      "account_type": "asset",
      "parent_id": null,
      "balance": 1000000
    }
  ]
}
```

### 4.2 勘定科目階層取得

```
GET /accounts/tree

Response:
{
  "data": [
    {
      "id": "uuid",
      "code": "1000",
      "name": "流動資産",
      "children": [
        {
          "id": "uuid",
          "code": "1110",
          "name": "現金"
        }
      ]
    }
  ]
}
```

### 4.3 勘定科目作成

```
POST /accounts
{
  "code": "1120",
  "name": "小口現金",
  "account_type": "asset",
  "parent_id": "parent_uuid"
}
```

## 5. 仕訳API

### 5.1 仕訳一覧取得

```
GET /journal-entries?from=2024-01-01&to=2024-12-31&page=1&limit=50

Response:
{
  "data": [
    {
      "id": "uuid",
      "entry_date": "2024-01-15",
      "entry_number": "2024-001",
      "description": "売上計上",
      "total_amount": 110000,
      "status": "approved",
      "lines": [
        {
          "account_code": "1140",
          "account_name": "売掛金",
          "debit_amount": 110000,
          "credit_amount": 0
        },
        {
          "account_code": "4110",
          "account_name": "売上高",
          "debit_amount": 0,
          "credit_amount": 100000
        },
        {
          "account_code": "2180",
          "account_name": "仮受消費税",
          "debit_amount": 0,
          "credit_amount": 10000
        }
      ]
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 10,
    "total_count": 500,
    "limit": 50
  }
}
```

### 5.2 仕訳登録

```
POST /journal-entries
{
  "entry_date": "2024-01-15",
  "description": "売上計上",
  "lines": [
    {
      "account_id": "account_uuid",
      "debit_amount": 110000,
      "credit_amount": 0,
      "tax_rate": 10
    },
    {
      "account_id": "account_uuid",
      "debit_amount": 0,
      "credit_amount": 110000
    }
  ]
}
```

### 5.3 仕訳更新

```
PUT /journal-entries/{id}
{
  "description": "売上計上（修正）",
  "lines": [...]
}
```

### 5.4 仕訳削除

```
DELETE /journal-entries/{id}
```

### 5.5 仕訳承認

```
POST /journal-entries/{id}/approve
```

## 6. レポートAPI

### 6.1 試算表取得

```
GET /reports/trial-balance?date=2024-12-31

Response:
{
  "date": "2024-12-31",
  "accounts": [
    {
      "code": "1110",
      "name": "現金",
      "debit_balance": 1000000,
      "credit_balance": 0,
      "net_balance": 1000000
    }
  ],
  "totals": {
    "debit_total": 5000000,
    "credit_total": 5000000
  }
}
```

### 6.2 貸借対照表取得

```
GET /reports/accounting-periods/{accountingPeriodId}/balance-sheet?asOfDate=2024-12-31

Response:
{
  "data": {
    "assets": [
      {
        "accountId": "uuid",
        "accountCode": "1110",
        "accountName": "現金",
        "accountType": "ASSET",
        "balance": 1000000,
        "children": []
      }
    ],
    "liabilities": [
      {
        "accountId": "uuid",
        "accountCode": "2110",
        "accountName": "買掛金",
        "accountType": "LIABILITY",
        "balance": 200000,
        "children": []
      }
    ],
    "equity": [
      {
        "accountId": "uuid",
        "accountCode": "3000",
        "accountName": "資本金",
        "accountType": "EQUITY",
        "balance": 800000,
        "children": []
      }
    ],
    "totalAssets": 1000000,
    "totalLiabilities": 200000,
    "totalEquity": 800000
  }
}
```

### 6.3 損益計算書取得

```
GET /reports/accounting-periods/{accountingPeriodId}/profit-loss?startDate=2024-01-01&endDate=2024-12-31

Response:
{
  "data": {
    "revenues": [
      {
        "accountId": "uuid",
        "accountCode": "4000",
        "accountName": "売上高",
        "accountType": "REVENUE",
        "balance": 10000000,
        "children": []
      }
    ],
    "expenses": [
      {
        "accountId": "uuid",
        "accountCode": "5000",
        "accountName": "仕入高",
        "accountType": "EXPENSE",
        "balance": 6000000,
        "children": []
      },
      {
        "accountId": "uuid",
        "accountCode": "6000",
        "accountName": "販売費及び一般管理費",
        "accountType": "EXPENSE",
        "balance": 1000000,
        "children": []
      }
    ],
    "totalRevenues": 10000000,
    "totalExpenses": 7000000,
    "netIncome": 3000000
  }
}
```

### 6.4 総勘定元帳取得

```
GET /reports/general-ledger/{account_id}?from=2024-01-01&to=2024-12-31

Response:
{
  "account": {
    "code": "1110",
    "name": "現金"
  },
  "period": {
    "from": "2024-01-01",
    "to": "2024-12-31"
  },
  "opening_balance": 500000,
  "entries": [
    {
      "date": "2024-01-15",
      "entry_number": "2024-001",
      "description": "売上入金",
      "debit": 100000,
      "credit": 0,
      "balance": 600000
    }
  ],
  "closing_balance": 1000000
}
```

## 7. マスタデータAPI

### 7.1 取引先API

```
GET /partners
POST /partners
PUT /partners/{id}
DELETE /partners/{id}
```

### 7.2 固定資産API

```
GET /fixed-assets
POST /fixed-assets
PUT /fixed-assets/{id}
POST /fixed-assets/{id}/depreciate
```

## 8. インポート/エクスポートAPI

### 8.1 仕訳CSVインポート

```
POST /import/journal-entries
Content-Type: multipart/form-data

file: journal_entries.csv
```

### 8.2 データエクスポート

```
GET /export/journal-entries?format=csv&from=2024-01-01&to=2024-12-31
GET /export/balance-sheet?format=pdf&date=2024-12-31
```

## 9. エラーレスポンス

### 9.1 標準エラー形式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力データが不正です",
    "details": [
      {
        "field": "entry_date",
        "message": "日付の形式が正しくありません"
      }
    ]
  }
}
```

### 9.2 HTTPステータスコード

- 200: 成功
- 201: 作成成功
- 400: リクエスト不正
- 401: 認証エラー
- 403: 権限エラー
- 404: リソース不在
- 422: バリデーションエラー
- 500: サーバーエラー

## 10. セキュリティ考慮事項

### 10.1 認証・認可

- JWT有効期限: 1時間
- リフレッシュトークン有効期限: 7日
- ロールベースアクセス制御（RBAC）

### 10.2 レート制限

- 認証API: 5回/分
- 一般API: 100回/分
- インポートAPI: 10回/時

### 10.3 データ保護

- HTTPS必須
- SQLインジェクション対策
- XSS対策
- CSRF対策
