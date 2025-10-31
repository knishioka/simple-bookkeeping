# 🔐 Security Documentation

このディレクトリには、Simple Bookkeepingプロジェクトのセキュリティに関するすべてのドキュメントが含まれています。

## 📋 目次

1. [セキュリティガイド](#セキュリティガイド)
2. [機密情報漏洩防止（Gitleaks）](#機密情報漏洩防止gitleaks)
3. [Supabaseセキュリティ](#supabaseセキュリティ)
4. [セキュリティポリシー](#セキュリティポリシー)
5. [インシデント対応](#インシデント対応)
6. [開発者向けガイドライン](#開発者向けガイドライン)

---

## セキュリティガイド

### 🔐 環境変数の設定

#### 必須の環境変数

以下の環境変数は**必ず**設定してください：

```bash
# JWT署名用の秘密鍵（本番環境では64文字以上のランダム文字列）
JWT_SECRET=your-64-character-random-string-here
JWT_REFRESH_SECRET=your-different-64-character-random-string-here

# データベース接続文字列（本番環境では強いパスワードを使用）
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

#### 🎲 安全なランダム文字列の生成

**Node.js使用**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**OpenSSL使用**

```bash
openssl rand -hex 32
```

**Python使用**

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### ⚠️ セキュリティチェックリスト

#### 本番環境デプロイ前

- [ ] JWT_SECRETとJWT_REFRESH_SECRETが設定されている
- [ ] データベースパスワードが強力である
- [ ] .envファイルがGitにコミットされていない
- [ ] NODE_ENVがproductionに設定されている
- [ ] HTTPSが有効化されている

#### 開発環境

- [ ] テスト用パスワードがランダム生成されている
- [ ] `env/templates/*.env.example` が最新のプレースホルダーになっている
- [ ] 本番用の秘密鍵がコードにハードコードされていない

### 🚫 やってはいけないこと

#### ❌ ハードコードされた秘密情報

```typescript
// ❌ 悪い例
const secret = 'hardcoded-secret-key';

// ✅ 良い例
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

#### ❌ 弱いテストパスワード

```typescript
// ❌ 悪い例
const password = 'password123';

// ✅ 良い例
const password = process.env.TEST_PASSWORD || generateRandomPassword();
```

#### ❌ 本番環境での平文パスワード

```typescript
// ❌ 悪い例
console.log('Password:', plainPassword);

// ✅ 良い例（開発環境のみ）
if (process.env.NODE_ENV === 'development') {
  console.log('Generated test password:', testPassword);
}
```

---

## 機密情報漏洩防止（Gitleaks）

### 🔍 概要

Gitleaksは、Gitリポジトリに含まれる機密情報（APIキー、パスワード、トークンなど）を検出するツールです。

**主な保護対象**:

- Supabase API Keys (Legacy & 2025形式)
- JWT Secrets
- データベース接続文字列
- Vercelトークン
- その他の環境変数

### 📚 詳細ガイド

包括的なGitleaks設定とベストプラクティスについては、以下のドキュメントを参照してください：

- **[Gitleaks Best Practices](./gitleaks-best-practices.md)** - Supabase特有のカスタムルール、使い方、トラブルシューティング
- **[Supabase Key Rotation Guide](./supabase-key-rotation-guide.md)** - 機密情報漏洩時の対応手順

### ⚡ クイックスタート

#### ローカル開発

```bash
# ステージングエリアのファイルをスキャン（pre-commit相当）
gitleaks protect --staged --verbose

# リポジトリ全体をスキャン
gitleaks detect --verbose
```

#### Pre-commitフック

コミット時に自動的にスキャンが実行されます：

```bash
git commit -m "feat: 新機能追加"
# → 自動的にGitleaksスキャン実行
```

#### GitHub Actions

すべてのPRとmain/developへのpushで自動実行されます。

**ワークフロー**: [.github/workflows/security-check.yml](../../.github/workflows/security-check.yml)

### 🚨 検出された場合の対処

1. **機密情報を削除**
2. **`.env.local` などに移動**（gitignoreに含まれている）
3. **再度コミット**

詳細は [Gitleaks Best Practices](./gitleaks-best-practices.md#トラブルシューティング) を参照。

---

## Supabaseセキュリティ

### 🔑 API Keys Management

Supabaseは2025年に新しいキーフォーマットに移行します：

| 種類                  | フォーマット         | リスクレベル | 使用場所     |
| --------------------- | -------------------- | ------------ | ------------ |
| Service Role (Legacy) | `eyJhbGci...`        | 🔴 Critical  | サーバーのみ |
| Secret Key (2025)     | `sb_secret_...`      | 🔴 Critical  | サーバーのみ |
| Anon (Legacy)         | `eyJhbGci...`        | 🟢 Low       | ブラウザOK   |
| Publishable (2025)    | `sb_publishable_...` | 🟢 Low       | ブラウザOK   |

**重要**: Service Role KeyとSecret Keyは**絶対に**ブラウザで使用しないでください。

### 📖 関連ドキュメント

- [Supabase Key Rotation Guide](./supabase-key-rotation-guide.md)
- [Gitleaks Best Practices](./gitleaks-best-practices.md)

---

### 🔒 認証・認可

#### JWT設定

- **有効期限**: アクセストークン1時間、リフレッシュトークン7日
- **アルゴリズム**: HS256（HMAC with SHA-256）
- **署名検証**: すべてのAPIエンドポイントで必須

#### パスワードハッシュ

- **アルゴリズム**: bcrypt
- **ソルトラウンド**: 10（開発環境）、12以上（本番環境）

### 🛡️ データ保護

#### データベース

- PostgreSQL接続はSSL必須（本番環境）
- 最小権限の原則（アプリケーション用ユーザー）
- 定期的なバックアップ

#### API

- CORS設定の適切な制限
- レート制限の実装
- SQLインジェクション対策（Prisma ORM使用）

---

## セキュリティポリシー

### 🎯 セキュリティ目標

- **脆弱性ゼロの維持**: 高・重大レベルの脆弱性を24時間以内に対応
- **依存関係の最新化**: セキュリティパッチを1週間以内に適用
- **予防的対策**: 定期的な監査と自動化による早期発見

### 📦 サポートバージョン

| Version | Supported | Notes        |
| ------- | --------- | ------------ |
| main    | ✅        | 本番環境     |
| develop | ✅        | 開発環境     |
| < 30d   | ⚠️        | 限定サポート |
| > 30d   | ❌        | サポート終了 |

### ⏱️ 対応時間目標

| 脆弱性レベル | 対応時間目標 | 対応内容                         |
| ------------ | ------------ | -------------------------------- |
| Critical     | 24時間以内   | 即座にパッチ適用、緊急リリース   |
| High         | 3日以内      | パッチ適用、次回リリースに含める |
| Medium       | 1週間以内    | 定期アップデートで対応           |
| Low          | 次回定期更新 | 月次アップデートで対応           |

### 🔄 アップデート戦略

#### 自動アップデート（Dependabot）

**パッチアップデート（x.x.X）**

- **自動マージ**: CI通過後、自動的にマージ
- **頻度**: 随時
- **グループ化**: 週次でまとめてPR作成

**マイナーアップデート（x.X.x）**

- **自動承認**: CIチェック後、手動マージ
- **頻度**: 週次
- **レビュー**: 破壊的変更の確認

**メジャーアップデート（X.x.x）**

- **手動対応**: 四半期ごとに計画的に実施
- **プロセス**:
  1. 影響調査とテスト計画作成
  2. 開発環境での検証
  3. 段階的な移行
  4. ドキュメント更新

#### セキュリティアップデート

- **最優先対応**: 脆弱性レベルに関わらず即座に対応
- **個別PR**: グループ化せず個別に作成
- **自動承認**: High以上は自動承認後、手動マージ

### 🛡️ セキュリティ監査

#### 定期監査スケジュール

| 監査タイプ         | 頻度   | 実施日時        | ツール                |
| ------------------ | ------ | --------------- | --------------------- |
| 依存関係スキャン   | 毎週   | 月曜日 9:00 JST | pnpm audit            |
| 脆弱性チェック     | 毎日   | CI/CD実行時     | GitHub Security       |
| 包括的セキュリティ | 月次   | 第1月曜日       | Snyk/OWASP Dependency |
| ペネトレーション   | 四半期 | 要計画          | 外部ツール            |

#### 監査ツール

1. **pnpm audit**
   - 基本的な脆弱性検出
   - CI/CDパイプラインに統合

2. **GitHub Security**
   - Dependabotアラート
   - Code scanning
   - Secret scanning

3. **追加ツール（オプション）**
   - Snyk: 高精度な脆弱性検出
   - OWASP Dependency Check: 包括的な分析
   - Socket: サプライチェーン攻撃対策

#### 定期チェック項目

1. 依存関係の脆弱性スキャン

   ```bash
   pnpm audit
   ```

2. 秘密情報の漏洩チェック
   - Gitleaksによる自動スキャン（pre-commit + GitHub Actions）
   - 詳細: [Gitleaks Best Practices](./gitleaks-best-practices.md)

3. セキュリティヘッダーの確認
   - helmet.jsの使用
   - HTTPSリダイレクト

---

## インシデント対応

### 🚨 脆弱性発見時のフロー

```mermaid
graph TD
    A[脆弱性発見] --> B{重要度判定}
    B -->|Critical/High| C[即座に対応チーム招集]
    B -->|Medium| D[次回定期MTGで議論]
    B -->|Low| E[バックログに追加]
    C --> F[パッチ適用]
    F --> G[テスト実施]
    G --> H[緊急リリース]
    H --> I[ユーザー通知]
```

### 対応手順

1. **評価**
   - 影響範囲の特定
   - 悪用可能性の評価
   - ユーザーへの影響確認

2. **緩和策**
   - 一時的な回避策の実施
   - WAF/セキュリティルールの更新
   - 該当機能の一時停止（必要時）

3. **修正**
   - パッチの適用
   - テストの実施
   - デプロイメント

4. **事後対応**
   - インシデントレポート作成
   - 再発防止策の検討
   - プロセス改善

### 報告手順

1. 即座に開発チームに連絡
2. 影響範囲の特定
3. 一時的な修正の実施
4. 根本原因の分析と恒久対策

### 緊急対応

- **Supabase Service Role Key漏洩**: [Key Rotation Guide](./supabase-key-rotation-guide.md) に従って即座にローテーション
- **JWT秘密鍵の漏洩**: 即座にローテーション
- **データベース情報の漏洩**: パスワード変更とアクセス制限
- **APIキーの漏洩**: 無効化と再生成

詳細な対応手順については以下を参照：

- [Supabase Key Rotation Guide](./supabase-key-rotation-guide.md)
- [Gitleaks Best Practices](./gitleaks-best-practices.md)

---

## 開発者向けガイドライン

### 🔐 セキュリティベストプラクティス

#### 依存関係の管理

- 不要な依存関係を削除
- 信頼できるパッケージのみ使用
- ライセンスの確認

#### コードセキュリティ

- 入力値の検証
- SQLインジェクション対策
- XSS対策
- 認証・認可の適切な実装

#### 機密情報の管理

- 環境変数の使用
- シークレットのローテーション
- コミット前のチェック

### CI/CD セキュリティ

- **ブランチ保護**: mainブランチへの直接pushを禁止
- **レビュー必須**: セキュリティ関連の変更は2名以上のレビュー
- **自動テスト**: セキュリティテストの自動実行
- **監査ログ**: すべての変更を記録

### 🔧 開発者向け設定

#### Git設定

```bash
# .gitignore で環境ファイルを除外
echo ".env" >> .gitignore
echo "env/secrets/" >> .gitignore
echo ".env.local" >> .gitignore
```

#### Pre-commit Hook

Gitleaksによる自動スキャンが有効化されています：

```bash
# Pre-commitフックは自動的に実行されます
git commit -m "feat: 新機能"
# → Gitleaks自動スキャン

# 手動でテスト
gitleaks protect --staged --verbose
```

詳細は [Gitleaks Best Practices](./gitleaks-best-practices.md) を参照。

---

## 📊 KPI（重要業績評価指標）

| 指標                         | 目標値   | 測定頻度 |
| ---------------------------- | -------- | -------- |
| Critical脆弱性の平均解決時間 | < 24時間 | 月次     |
| High脆弱性の平均解決時間     | < 72時間 | 月次     |
| 脆弱性ゼロの維持率           | > 95%    | 週次     |
| Dependabot PR処理時間        | < 7日    | 週次     |
| セキュリティ監査実施率       | 100%     | 月次     |

---

## 📞 連絡先

### セキュリティインシデント報告

- **GitHub Issues**: セキュリティラベルを付けて報告（公開情報のみ）
- **プライベート報告**: セキュリティアドバイザリを使用
- **緊急時**: プロジェクトオーナーに直接連絡

---

## 📚 参考資料

### プロジェクト内ドキュメント

- [Gitleaks Best Practices](./gitleaks-best-practices.md) - 機密情報漏洩防止
- [Supabase Key Rotation Guide](./supabase-key-rotation-guide.md) - キーローテーション手順
- [RLS Policies](./rls-policies.md) - Row Level Security設定

### 外部リソース

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [npm Security Best Practices](https://docs.npmjs.com/packages-and-modules/securing-your-code)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-jwt-bcp-07)
- [Supabase Security](https://supabase.com/docs/guides/database/secure-data)
- [Gitleaks Documentation](https://github.com/gitleaks/gitleaks)

---

## 🔄 ポリシーの更新

このセキュリティポリシーは定期的に見直され、以下のタイミングで更新されます：

- 四半期ごとの定期レビュー
- 重大なセキュリティインシデント後
- 新しい脅威や攻撃手法の出現時
- 規制やコンプライアンス要件の変更時

---

_最終更新日: 2025年10月（Gitleaks統合）_
_次回レビュー予定: 2026年1月_
