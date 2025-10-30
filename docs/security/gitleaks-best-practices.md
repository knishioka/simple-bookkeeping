# Gitleaks Best Practices for Supabase Protection

## 📋 概要

このドキュメントは、Supabaseプロジェクトにおける機密情報漏洩を防ぐためのGitleaks設定とベストプラクティスを説明します。

**最終更新**: 2025-10-30
**対象**: Supabase + Next.js プロジェクト
**Gitleaksバージョン**: v8.x

---

## 🎯 保護対象

### Supabase認証情報（優先度：高）

| 種類                      | フォーマット         | リスクレベル | 説明                        |
| ------------------------- | -------------------- | ------------ | --------------------------- |
| Service Role JWT (Legacy) | `eyJhbGci...`        | 🔴 Critical  | RLSをバイパス、フルアクセス |
| Service Role Key (2025)   | `sb_secret_...`      | 🔴 Critical  | フルデータベースアクセス    |
| Anon JWT (Legacy)         | `eyJhbGci...`        | 🟡 Medium    | 公開可能だがコミット非推奨  |
| Publishable Key (2025)    | `sb_publishable_...` | 🟢 Low       | ブラウザ使用可、RLS保護     |
| JWT Secret                | 32文字以上の文字列   | 🔴 Critical  | トークン署名用              |
| PostgreSQL URL            | `postgresql://...`   | 🔴 Critical  | 認証情報を含むDB接続        |

---

## 🔧 設定ファイル

### `.gitleaks.toml` - カスタムルール

プロジェクトルートに配置されている `.gitleaks.toml` には、以下のSupabase特有のルールが定義されています：

```toml
[extend]
useDefault = true

[[rules]]
id = "supabase-service-role-jwt"
description = "Supabase Legacy Service Role JWT (high risk - bypasses RLS)"
regex = '''(?i)(supabase[_-]?(service[_-]?role|jwt)[_-]?(key|secret|token)['"]?\s*[=:]\s*['"]?)(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)'''
keywords = ["supabase_service_role", "SUPABASE_SERVICE_ROLE_KEY", "service_role"]
secretGroup = 4
entropy = 4.0

[[rules]]
id = "supabase-secret-key-2025"
description = "Supabase Secret API Key (new format 2025 - high risk)"
regex = '''(?i)(supabase[_-]?secret|secret[_-]?key)['"]?\s*[=:]\s*['"]?(sb_secret_[A-Za-z0-9_-]{15,})'''
keywords = ["sb_secret_", "SUPABASE_SERVICE_ROLE_KEY"]
secretGroup = 2
entropy = 3.5
```

**参照**: [.gitleaks.toml](../../.gitleaks.toml)

---

## 🚀 使い方

### ローカル開発

#### Pre-commitフックで自動チェック

コミット前に自動的にGitleaksが実行されます：

```bash
git add .
git commit -m "feat: 新機能追加"
# → 自動的にGitleaksスキャン実行
```

**重要**: 以下の回避手段は**絶対禁止**です：

- `git commit --no-verify`
- `git commit -n`
- `SKIP=gitleaks git commit`
- `HUSKY=0 git commit`

#### 手動スキャン

```bash
# ステージングエリアのファイルをスキャン（pre-commit相当）
gitleaks protect --staged --verbose

# リポジトリ全体をスキャン
gitleaks detect --verbose

# 特定のファイルのみスキャン
gitleaks detect --source . --verbose --no-git --redact
```

### GitHub Actions（CI/CD）

**ワークフロー**: [.github/workflows/security-check.yml](../../.github/workflows/security-check.yml)

すべてのPRとmain/developへのpushで自動実行されます：

```yaml
- name: Run Gitleaks with Custom Config
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    GITLEAKS_CONFIG: .gitleaks.toml
```

---

## 🛡️ ベストプラクティス

### 1. 環境変数の安全な管理

#### ✅ 推奨される方法

```typescript
// Good: 環境変数から読み込み
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// .env.local (gitignoreに含まれている)
SUPABASE_SERVICE_ROLE_KEY=sb_secret_abc123...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
```

#### ❌ 避けるべき方法

```typescript
// Bad: ハードコーディング
const serviceRoleKey = 'sb_secret_abc123...';

// Bad: コメントに記載
// SUPABASE_SERVICE_ROLE_KEY=sb_secret_abc123...
```

### 2. ファイル命名規則

| ファイル            | Gitコミット | 用途                   |
| ------------------- | ----------- | ---------------------- |
| `.env.local`        | ❌ 禁止     | ローカル開発の実際の値 |
| `.env.example`      | ⚠️ 注意     | プレースホルダーのみ   |
| `.env.test.example` | ✅ OK       | テスト用の公開キー     |
| `.env.production`   | ❌ 禁止     | 本番環境の実際の値     |

**`.gitignore` 確認**:

```bash
# これらのファイルがignoreされているか確認
grep -E "\.env\.(local|production)" .gitignore
```

### 3. Supabase API Keys 2025移行ガイド

Supabaseは2025年に新しいキーフォーマットに移行します：

**Legacy (〜2025)**:

- Anon: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Service Role: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

**New (2025〜)**:

- Publishable: `sb_publishable_xxxxx`
- Secret: `sb_secret_xxxxx`

**移行チェックリスト**:

- [ ] Supabase Dashboardで新しいSecret Keyを作成
- [ ] 環境変数を更新（ローカル＋Vercel）
- [ ] Legacy Keysを無効化
- [ ] `.gitleaks.toml`が両方のフォーマットを検出することを確認

---

## 🔍 トラブルシューティング

### Q1: Gitleaksが誤検知する

**A**: `.gitleaks.toml` の `[allowlist]` セクションに除外パターンを追加：

```toml
[allowlist]
paths = [
  '''docs/.*''',
  '''.*\.test\.(ts|js)$''',
]

regexes = [
  '''test@example\.com''',
  '''dummy[-_]?(secret|password)''',
]
```

### Q2: `.env.local` がスキャンされてしまう

**A**: `.gitignore` に含まれているか確認：

```bash
# .gitignore に追加されているか確認
grep ".env.local" .gitignore

# なければ追加
echo ".env.local" >> .gitignore
```

### Q3: Pre-commitフックが動作しない

**A**: Huskyの再インストール：

```bash
# Huskyフックを再インストール
pnpm dlx husky install

# Gitleaksインストール確認
gitleaks version
```

### Q4: GitHub Actionsで誤検知

**A**: `.gitleaksignore` に特定のフィンガープリントを追加：

```bash
# フィンガープリントを取得
gitleaks detect --verbose 2>&1 | grep "Fingerprint:"

# .gitleaksignoreに追加
echo "<commit-hash>:<file>:<rule-id>:<line>" >> .gitleaksignore
```

---

## 📊 検出例

### 例1: Legacy Service Role Key

**検出される コード**:

```typescript
const supabase = createClient(
  'https://xxx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSJ9.xxx'
);
```

**Gitleaks出力**:

```
Finding:     SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
Secret:      eyJhbGci...
RuleID:      supabase-service-role-jwt
Entropy:     5.2
File:        src/lib/supabase.ts
Line:        5
```

**修正方法**:

```typescript
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

### 例2: 新しいSecret API Key (2025)

**検出されるコード**:

```bash
# .env.local
SUPABASE_SERVICE_ROLE_KEY=sb_secret_uQ_Wovur_vPsTFgkKoLKUw_5d5pWq7P
```

**Gitleaks出力**:

```
RuleID:      supabase-secret-key-2025
Description: Supabase Secret API Key (new format 2025 - high risk)
```

---

## 📚 関連ドキュメント

- [Supabase Key Rotation Guide](./supabase-key-rotation-guide.md) - キーローテーション手順
- [Security Deployment Guide](../ai-guide/security-deployment.md) - 全般的なセキュリティガイド
- [Supabase API Keys Documentation](https://supabase.com/docs/guides/api/api-keys) - 公式ドキュメント
- [Gitleaks GitHub](https://github.com/gitleaks/gitleaks) - Gitleaks公式リポジトリ

---

## 🔗 外部リソース

- [GitGuardian: Remediating Supabase JWT Secret leaks](https://www.gitguardian.com/remediation/supabase-jwt-secret)
- [Supabase: Upcoming changes to API Keys](https://github.com/orgs/supabase/discussions/29260)
- [Supabase: JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys)
- [Gitleaks Configuration Reference](https://github.com/gitleaks/gitleaks#configuration)

---

**次のステップ**: [Supabase Key Rotation Guide](./supabase-key-rotation-guide.md) で実際の漏洩対応手順を確認してください。
