# Simple Bookkeeping API Reference

## Overview

The Simple Bookkeeping API provides a RESTful interface for managing accounting data. All endpoints require authentication unless otherwise specified.

## Base URL

- **Development**: `http://localhost:3001/api/v1`
- **Production**: `https://simple-bookkeeping-api.onrender.com/api/v1`

## Authentication

All API requests (except `/auth/login` and `/auth/register`) require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### Token Expiration

- Access tokens expire after 24 hours
- Refresh tokens expire after 7 days
- Use `/auth/refresh` endpoint to get a new access token

## Common Response Format

### Success Response

```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "total": 100,
    "pageSize": 20
  }
}
```

### Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

## Endpoints

### Authentication

#### POST /auth/login

Login with email and password.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "accountant"
    }
  }
}
```

#### POST /auth/register

Register a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "organizationName": "株式会社サンプル"
}
```

**Response:**

```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "123",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

#### POST /auth/refresh

Refresh access token using refresh token.

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

#### POST /auth/logout

Logout and invalidate token.

**Response:**

```json
{
  "data": {
    "message": "Logged out successfully"
  }
}
```

#### GET /auth/me

Get current user information.

**Response:**

```json
{
  "data": {
    "id": "123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "accountant",
    "organizations": [
      {
        "id": "org-123",
        "name": "株式会社サンプル",
        "role": "admin"
      }
    ]
  }
}
```

#### POST /auth/change-password

Change user password.

**Request Body:**

```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword456"
}
```

### Organizations

#### GET /organizations

Get all organizations for the authenticated user.

**Query Parameters:**

- `active` (boolean): Filter by active status

**Response:**

```json
{
  "data": [
    {
      "id": "org-123",
      "name": "株式会社サンプル",
      "taxNumber": "1234567890123",
      "address": "東京都...",
      "isActive": true,
      "createdAt": "2024-01-15T00:00:00Z"
    }
  ]
}
```

#### POST /organizations

Create a new organization.

**Request Body:**

```json
{
  "name": "株式会社サンプル",
  "taxNumber": "1234567890123",
  "address": "東京都渋谷区...",
  "phone": "03-1234-5678",
  "email": "info@example.com"
}
```

### Accounts (勘定科目)

#### GET /accounts

Get all accounts for the organization.

**Query Parameters:**

- `type` (enum): Filter by account type (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE)
- `active` (boolean): Filter by active status
- `parentId` (string): Filter by parent account
- `search` (string): Search by name or code

**Response:**

```json
{
  "data": [
    {
      "id": "acc-123",
      "code": "1110",
      "name": "現金",
      "accountType": "ASSET",
      "parentId": null,
      "description": "手元現金",
      "isActive": true,
      "balance": 1000000
    }
  ]
}
```

#### POST /accounts

Create a new account.

**Request Body:**

```json
{
  "code": "1110",
  "name": "現金",
  "accountType": "ASSET",
  "parentId": null,
  "description": "手元現金"
}
```

**Validation Rules:**

- `code`: Required, numeric string, max 20 characters
- `name`: Required, max 100 characters
- `accountType`: Required, must be valid enum value
- `description`: Optional, max 500 characters

#### PUT /accounts/:id

Update an existing account.

**Request Body:**

```json
{
  "name": "現金（更新）",
  "description": "更新された説明",
  "isActive": false
}
```

#### DELETE /accounts/:id

Delete an account (soft delete).

### Journal Entries (仕訳)

#### GET /journal-entries

Get journal entries with pagination.

**Query Parameters:**

- `page` (number): Page number (default: 1)
- `pageSize` (number): Items per page (default: 20, max: 100)
- `startDate` (string): Filter by date range start (YYYY-MM-DD)
- `endDate` (string): Filter by date range end (YYYY-MM-DD)
- `status` (enum): Filter by status (DRAFT, APPROVED, CANCELLED)
- `accountId` (string): Filter by account
- `search` (string): Search in description

**Response:**

```json
{
  "data": [
    {
      "id": "je-123",
      "entryNumber": "2024-001",
      "entryDate": "2024-01-15",
      "description": "売上計上",
      "status": "APPROVED",
      "documentNumber": "INV-001",
      "lines": [
        {
          "id": "jel-123",
          "accountId": "acc-123",
          "account": {
            "code": "1110",
            "name": "現金"
          },
          "debitAmount": 110000,
          "creditAmount": 0,
          "description": "売上代金",
          "taxRate": 10
        },
        {
          "id": "jel-124",
          "accountId": "acc-456",
          "account": {
            "code": "4110",
            "name": "売上高"
          },
          "debitAmount": 0,
          "creditAmount": 110000,
          "description": "商品売上",
          "taxRate": 10
        }
      ],
      "totalAmount": 110000,
      "createdAt": "2024-01-15T10:00:00Z",
      "createdBy": {
        "id": "user-123",
        "name": "John Doe"
      }
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### POST /journal-entries

Create a new journal entry.

**Request Body:**

```json
{
  "entryDate": "2024-01-15",
  "description": "売上計上",
  "documentNumber": "INV-001",
  "lines": [
    {
      "accountId": "acc-123",
      "debitAmount": 110000,
      "creditAmount": 0,
      "description": "売上代金",
      "taxRate": 10
    },
    {
      "accountId": "acc-456",
      "debitAmount": 0,
      "creditAmount": 110000,
      "description": "商品売上",
      "taxRate": 10
    }
  ]
}
```

**Validation Rules:**

- `entryDate`: Required, valid date format (YYYY-MM-DD)
- `description`: Required, min 1 character
- `lines`: Required array, min 2 items
- Total debits must equal total credits (balanced entry)
- Each line must have either debitAmount or creditAmount (not both)

#### PUT /journal-entries/:id

Update a journal entry (only DRAFT status can be updated).

**Request Body:**
Same as POST

#### POST /journal-entries/:id/approve

Approve a draft journal entry.

**Response:**

```json
{
  "data": {
    "id": "je-123",
    "status": "APPROVED",
    "approvedAt": "2024-01-15T11:00:00Z",
    "approvedBy": {
      "id": "user-123",
      "name": "Manager"
    }
  }
}
```

#### POST /journal-entries/:id/cancel

Cancel a journal entry.

**Request Body:**

```json
{
  "reason": "入力ミス"
}
```

#### POST /journal-entries/import

Import journal entries from CSV.

**Request Body (multipart/form-data):**

- `file`: CSV file
- `dateFormat` (optional): Date format in CSV (default: YYYY-MM-DD)

**CSV Format:**

```csv
日付,摘要,勘定科目,借方金額,貸方金額,税率
2024-01-15,売上計上,現金,110000,0,10
2024-01-15,売上計上,売上高,0,110000,10
```

**Response:**

```json
{
  "data": {
    "imported": 10,
    "failed": 2,
    "errors": [
      {
        "row": 5,
        "error": "借方と貸方の合計が一致しません"
      }
    ]
  }
}
```

### Reports

#### GET /reports/balance-sheet

Get balance sheet report.

**Query Parameters:**

- `date` (string): Report date (YYYY-MM-DD)
- `format` (enum): Output format (json, csv, pdf)

**Response:**

```json
{
  "data": {
    "date": "2024-01-31",
    "assets": {
      "current": {
        "total": 5000000,
        "accounts": [
          {
            "code": "1110",
            "name": "現金",
            "balance": 1000000
          }
        ]
      },
      "fixed": {
        "total": 3000000,
        "accounts": []
      },
      "total": 8000000
    },
    "liabilities": {
      "current": {
        "total": 2000000,
        "accounts": []
      },
      "fixed": {
        "total": 1000000,
        "accounts": []
      },
      "total": 3000000
    },
    "equity": {
      "total": 5000000,
      "accounts": []
    }
  }
}
```

#### GET /reports/income-statement

Get income statement report.

**Query Parameters:**

- `startDate` (string): Period start date
- `endDate` (string): Period end date
- `format` (enum): Output format (json, csv, pdf)

**Response:**

```json
{
  "data": {
    "period": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    },
    "revenue": {
      "total": 1000000,
      "accounts": [
        {
          "code": "4110",
          "name": "売上高",
          "amount": 1000000
        }
      ]
    },
    "expenses": {
      "total": 600000,
      "accounts": []
    },
    "netIncome": 400000
  }
}
```

#### GET /reports/trial-balance

Get trial balance report.

**Query Parameters:**

- `date` (string): Report date
- `includeZeroBalance` (boolean): Include accounts with zero balance

#### GET /reports/general-ledger

Get general ledger for an account.

**Query Parameters:**

- `accountId` (string): Account ID (required)
- `startDate` (string): Period start
- `endDate` (string): Period end

### Accounting Periods

#### GET /accounting-periods

Get all accounting periods.

**Response:**

```json
{
  "data": [
    {
      "id": "period-123",
      "name": "2024年度",
      "startDate": "2024-01-01",
      "endDate": "2024-12-31",
      "isClosed": false,
      "isActive": true
    }
  ]
}
```

#### POST /accounting-periods

Create a new accounting period.

**Request Body:**

```json
{
  "name": "2024年度",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31"
}
```

#### POST /accounting-periods/:id/close

Close an accounting period.

**Response:**

```json
{
  "data": {
    "id": "period-123",
    "isClosed": true,
    "closedAt": "2024-12-31T23:59:59Z"
  }
}
```

### Audit Logs

#### GET /audit-logs

Get audit logs (admin only).

**Query Parameters:**

- `userId` (string): Filter by user
- `action` (string): Filter by action type
- `entityType` (string): Filter by entity type
- `startDate` (string): Date range start
- `endDate` (string): Date range end

**Response:**

```json
{
  "data": [
    {
      "id": "log-123",
      "userId": "user-123",
      "userName": "John Doe",
      "action": "CREATE",
      "entityType": "JournalEntry",
      "entityId": "je-123",
      "details": {
        "description": "売上計上",
        "amount": 110000
      },
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

## Error Codes

| Code                   | Description                         |
| ---------------------- | ----------------------------------- |
| `VALIDATION_ERROR`     | Request validation failed           |
| `AUTHENTICATION_ERROR` | Invalid or missing authentication   |
| `AUTHORIZATION_ERROR`  | Insufficient permissions            |
| `NOT_FOUND`            | Resource not found                  |
| `CONFLICT`             | Resource conflict (e.g., duplicate) |
| `INTERNAL_ERROR`       | Internal server error               |
| `RATE_LIMIT_ERROR`     | Too many requests                   |

## Rate Limiting

- 100 requests per minute per API key
- 1000 requests per hour per API key

Rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642329600
```

## Pagination

All list endpoints support pagination:

- `page`: Page number (1-based)
- `pageSize`: Items per page (max 100)

Pagination metadata is returned in the `meta` object.

## Filtering and Sorting

Most list endpoints support:

- Filtering by specific fields
- Date range filtering
- Full-text search
- Sorting by multiple fields

Example:

```
GET /journal-entries?startDate=2024-01-01&endDate=2024-01-31&sort=-entryDate,entryNumber
```

## Webhooks

Configure webhooks to receive real-time notifications:

```json
{
  "url": "https://your-app.com/webhook",
  "events": ["journal_entry.created", "journal_entry.approved"],
  "secret": "webhook-secret"
}
```

## Testing

### Test Environment

A sandbox environment is available for testing:

- **Base URL**: `https://sandbox.simple-bookkeeping.com/api/v1`
- **Test Credentials**: Contact support for test account

### Test Data

Test accounts come pre-populated with sample data:

- Sample organization
- Chart of accounts
- Sample journal entries
- Sample reports

## SDK Examples

### JavaScript/TypeScript

```typescript
import { SimpleBookkeepingClient } from '@simple-bookkeeping/sdk';

const client = new SimpleBookkeepingClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.simple-bookkeeping.com/v1',
});

// Get accounts
const accounts = await client.accounts.list({
  type: 'ASSET',
  active: true,
});

// Create journal entry
const entry = await client.journalEntries.create({
  entryDate: '2024-01-15',
  description: '売上計上',
  lines: [
    {
      accountId: 'acc-123',
      debitAmount: 110000,
      creditAmount: 0,
    },
    {
      accountId: 'acc-456',
      debitAmount: 0,
      creditAmount: 110000,
    },
  ],
});
```

### cURL Examples

```bash
# Get accounts
curl -X GET "http://localhost:3001/api/v1/accounts?type=ASSET" \
  -H "Authorization: Bearer <token>"

# Create journal entry
curl -X POST "http://localhost:3001/api/v1/journal-entries" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "entryDate": "2024-01-15",
    "description": "売上計上",
    "lines": [...]
  }'
```

## Changelog

### v1.1.0 (2024-01-15)

- Added CSV import for journal entries
- Improved validation error messages
- Performance optimizations

### v1.0.0 (2024-01-01)

- Initial release
