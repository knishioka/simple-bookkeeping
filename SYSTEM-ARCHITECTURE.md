# Simple Bookkeeping システム構成

## 🏗️ アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────┐
│                    外部からのアクセス                        │
├─────────────────────────────────────────────────────────────┤
│  🌐 ユーザー (ブラウザ)                                      │
│      ↓ HTTP/HTTPS                                           │
│  📱 Frontend (Next.js) - Port 3000 [公開]                   │
│      ↓ HTTP API calls                                       │
│  🖥️ Backend API (Express.js) - Port 3001 [公開]             │
│      ↓ SQL                                                  │
│  🗄️ PostgreSQL Database - [非公開・内部ネットワークのみ]      │
└─────────────────────────────────────────────────────────────┘
```

## 🐳 Docker構成とポート公開状況

### 公開ポート（外部からアクセス可能）

| サービス | ポート | 用途 | アクセス方法 |
|---------|--------|------|-------------|
| **Frontend (Next.js)** | `3000` | ユーザーインターフェース | `http://localhost:3000` |
| **Backend API (Express.js)** | `3001` | REST API エンドポイント | `http://localhost:3001/api/v1` |

### 非公開ポート（内部ネットワークのみ）

| サービス | 内部ポート | 用途 | セキュリティ |
|---------|------------|------|-------------|
| **PostgreSQL** | `5432` | データベース | 🔒 外部からアクセス不可 |

## 🔧 開発環境での動作

### 現在の開発サーバー状況
```bash
# フロントエンド開発サーバー
pnpm --filter @simple-bookkeeping/web dev
# → http://localhost:3000 で起動

# バックエンド開発サーバー  
pnpm --filter @simple-bookkeeping/api dev
# → http://localhost:3001 で起動

# PostgreSQL（別途起動が必要）
# → localhost:5432（開発時は直接接続）
```

## 🚀 本番環境でのデプロイ

### Docker Compose構成
```yaml
services:
  web:      # Next.js Frontend
    ports: ["3000:3000"]     # 🌐 外部公開
  
  api:      # Express.js Backend  
    ports: ["3001:3001"]     # 🌐 外部公開
  
  postgres: # PostgreSQL Database
    # ポート公開なし           # 🔒 内部のみ
```

### 環境変数での制御
```bash
# ポート番号の変更
WEB_PORT=8080    # Frontend port変更
API_PORT=8081    # API port変更

# 外部からの接続設定
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
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

## 🌐 API エンドポイント

### パブリック API
```
GET  /api/v1/            # ヘルスチェック
POST /api/v1/auth/login  # ログイン
POST /api/v1/auth/register # 新規登録
```

### 認証が必要な API
```
# 勘定科目管理
GET|POST|PUT|DELETE /api/v1/accounts

# 仕訳入力
GET|POST|PUT|DELETE /api/v1/journal-entries

# レポート
GET /api/v1/reports/balance-sheet
GET /api/v1/reports/profit-loss

# 組織管理
GET|POST|PUT /api/v1/organizations
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
勘定科目画面 → API呼び出し → データベース操作
Frontend → POST /api/v1/accounts → PostgreSQL INSERT
```

### 3. 仕訳入力
```
仕訳入力画面 → 複式簿記検証 → データベース保存
Frontend → POST /api/v1/journal-entries → PostgreSQL Transaction
```

## 🔧 開発・運用コマンド

### 開発環境起動
```bash
# 個別起動
pnpm --filter @simple-bookkeeping/web dev    # Frontend
pnpm --filter @simple-bookkeeping/api dev    # Backend

# Docker Compose起動
docker-compose up -d  # 全サービス起動
```

### ポート競合時の対策
```bash
# ポート変更
export WEB_PORT=3030
export API_PORT=3031
docker-compose up -d

# または .env ファイルで設定
echo "WEB_PORT=3030" >> .env
echo "API_PORT=3031" >> .env
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