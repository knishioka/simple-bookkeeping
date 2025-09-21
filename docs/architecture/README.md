# Simple Bookkeeping システム構成

## 🏗️ アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────┐
│                    外部からのアクセス                        │
├─────────────────────────────────────────────────────────────┤
│  🌐 ユーザー (ブラウザ)                                      │
│      ↓ HTTP/HTTPS                                           │
│  📱 Frontend (Next.js + Server Actions) - Port 3000 [公開]  │
│      ↓ Supabase Client / Prisma ORM                         │
│  🗄️ PostgreSQL Database (Supabase) - [セキュア接続]          │
└─────────────────────────────────────────────────────────────┘
```

## 🐳 Docker構成とポート公開状況

### 公開ポート（外部からアクセス可能）

| サービス               | ポート  | 用途                         | アクセス方法             |
| ---------------------- | ------- | ---------------------------- | ------------------------ |
| **Frontend (Next.js)** | `3000`  | フルスタックアプリケーション | `http://localhost:3000`  |
| **Supabase Studio**    | `54323` | データベース管理UI           | `http://localhost:54323` |
| **Supabase API**       | `54321` | Supabase API                 | `http://localhost:54321` |

### 内部ポート（Supabase内部）

| サービス       | 内部ポート | 用途         | セキュリティ          |
| -------------- | ---------- | ------------ | --------------------- |
| **PostgreSQL** | `54322`    | データベース | 🔒 Supabase経由でのみ |

## 🔧 開発環境での動作

### 現在の開発サーバー状況

```bash
# Supabase起動（必須）
pnpm supabase:start
# → http://localhost:54321 (API)
# → http://localhost:54323 (Studio)

# Next.js開発サーバー
pnpm dev
# → http://localhost:3000 で起動

# PostgreSQL
# → localhost:54322（Supabase経由）
```

## 🚀 本番環境でのデプロイ

### Docker Compose構成

```yaml
services:
  web: # Next.js Fullstack App
    ports: ['3000:3000'] # 🌐 外部公開

  # Supabase services (local development)
  supabase-studio:
    ports: ['54323:3000'] # 🌐 管理UI

  supabase-kong:
    ports: ['54321:8000'] # 🌐 API Gateway

  postgres: # PostgreSQL Database
    ports: ['54322:5432'] # 🔒 開発時のみ
```

### 環境変数での制御

```bash
# ポート番号の変更
WEB_PORT=8080    # Frontend port変更

# Supabase接続設定
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 🔐 セキュリティ設計

### ネットワーク分離

- **PostgreSQL**: 完全に内部ネットワークに隔離
- **API**: JWT認証による保護
- **Frontend**: 静的ファイル配信（セキュアヘッダー設定）

### アクセス制御

```
外部 → Frontend (3000) ✅ 公開
外部 → API (3001) ✅ 公開（JWT認証必須）
外部 → PostgreSQL ❌ アクセス不可
Frontend → API ✅ HTTP calls
API → PostgreSQL ✅ 内部ネットワーク
```

## 🌐 Server Actions

### 主要な機能

```typescript
// app/actions/auth.ts
- signIn()  # ログイン処理
- signUp()  # 新規登録
- signOut() # ログアウト

// app/actions/accounts.ts
- getAccounts()    # 勘定科目一覧取得
- createAccount()  # 勘定科目作成
- updateAccount()  # 勘定科目更新
- deleteAccount()  # 勘定科目削除

// app/actions/journal-entries.ts
- getJournalEntries()    # 仕訳一覧取得
- createJournalEntry()   # 仕訳作成
- updateJournalEntry()   # 仕訳更新
- deleteJournalEntry()   # 仕訳削除

// app/actions/reports.ts
- getBalanceSheet()  # 貸借対照表
- getProfitLoss()    # 損益計算書
```

## 📊 データフロー

### 1. ユーザー認証

```
ブラウザ → Frontend (3000) → API (3001) → PostgreSQL
    ↓
JWT Token取得
    ↓
以降のAPIリクエストでJWT使用
```

### 2. 勘定科目管理

```
勘定科目画面 → Server Action → データベース操作
Frontend → createAccount() → Supabase/PostgreSQL INSERT
```

### 3. 仕訳入力

```
仕訳入力画面 → 複式簿記検証 → データベース保存
Frontend → createJournalEntry() → Supabase/PostgreSQL Transaction
```

## 🔧 開発・運用コマンド

### 開発環境起動

```bash
# Supabase起動（必須）
pnpm supabase:start    # Supabase CLI版
# または
pnpm supabase:docker   # Docker Compose版

# 開発サーバー起動
pnpm dev              # Next.js開発サーバー (Port 3000)
```

### ポート競合時の対策

```bash
# Next.jsポート変更
export PORT=3030
pnpm dev

# または .env.local ファイルで設定
echo "PORT=3030" >> .env.local
```

## 🌍 外部公開時の考慮事項

### Reverse Proxy設定例（nginx）

```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
    }
}

# API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
    }
}
```

### セキュリティヘッダー

```javascript
// Next.js (frontend)
headers: {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'origin-when-cross-origin'
}

// Express.js (backend)
app.use(helmet()); // セキュリティヘッダー自動設定
```

## 📈 スケーリング戦略

### 水平スケーリング

- **Frontend**: 複数インスタンス + Load Balancer
- **API**: 複数インスタンス + Load Balancer
- **Database**: Read Replica + Connection Pooling

### ポート分散例

```yaml
# Load Balancer背後
web-1: 3000
web-2: 3010
api-1: 3001
api-2: 3011
```

## 🎯 まとめ

### 現在の公開ポート

- **Frontend**: `3000` （一般ユーザーアクセス）
- **API**: `3001` （アプリケーション間通信）

### セキュリティレベル

- **高**: PostgreSQLは完全内部化
- **中**: API認証による保護
- **設定可能**: ポート番号変更でコンフリクト回避

この構成により、セキュリティを保ちながら必要最小限のポートのみを公開し、開発・運用両方に対応できる柔軟なシステムとなっています。
