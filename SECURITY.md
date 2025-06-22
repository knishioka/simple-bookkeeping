# セキュリティガイド

## 概要

このドキュメントは、Simple Bookkeepingプロジェクトのセキュリティベストプラクティスと設定方法を説明します。

## 🔐 環境変数の設定

### 必須の環境変数

以下の環境変数は**必ず**設定してください：

```bash
# JWT署名用の秘密鍵（本番環境では64文字以上のランダム文字列）
JWT_SECRET=your-64-character-random-string-here
JWT_REFRESH_SECRET=your-different-64-character-random-string-here

# データベース接続文字列（本番環境では強いパスワードを使用）
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

### 🎲 安全なランダム文字列の生成

#### Node.js使用

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### OpenSSL使用

```bash
openssl rand -hex 32
```

#### Python使用

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

## ⚠️ セキュリティチェックリスト

### 本番環境デプロイ前

- [ ] JWT_SECRETとJWT_REFRESH_SECRETが設定されている
- [ ] データベースパスワードが強力である
- [ ] .envファイルがGitにコミットされていない
- [ ] NODE_ENVがproductionに設定されている
- [ ] HTTPSが有効化されている

### 開発環境

- [ ] テスト用パスワードがランダム生成されている
- [ ] .env.exampleにプレースホルダーのみが含まれている
- [ ] 本番用の秘密鍵がコードにハードコードされていない

## 🚫 やってはいけないこと

### ❌ ハードコードされた秘密情報

```typescript
// ❌ 悪い例
const secret = 'hardcoded-secret-key';

// ✅ 良い例
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

### ❌ 弱いテストパスワード

```typescript
// ❌ 悪い例
const password = 'password123';

// ✅ 良い例
const password = process.env.TEST_PASSWORD || generateRandomPassword();
```

### ❌ 本番環境での平文パスワード

```typescript
// ❌ 悪い例
console.log('Password:', plainPassword);

// ✅ 良い例（開発環境のみ）
if (process.env.NODE_ENV === 'development') {
  console.log('Generated test password:', testPassword);
}
```

## 🔒 認証・認可

### JWT設定

- **有効期限**: アクセストークン1時間、リフレッシュトークン7日
- **アルゴリズム**: HS256（HMAC with SHA-256）
- **署名検証**: すべてのAPIエンドポイントで必須

### パスワードハッシュ

- **アルゴリズム**: bcrypt
- **ソルトラウンド**: 10（開発環境）、12以上（本番環境）

## 🛡️ データ保護

### データベース

- PostgreSQL接続はSSL必須（本番環境）
- 最小権限の原則（アプリケーション用ユーザー）
- 定期的なバックアップ

### API

- CORS設定の適切な制限
- レート制限の実装
- SQLインジェクション対策（Prisma ORM使用）

## 📋 セキュリティ監査

### 定期チェック項目

1. 依存関係の脆弱性スキャン

   ```bash
   pnpm audit
   ```

2. 秘密情報の漏洩チェック

   - GitGuardianなどのツール使用
   - コミット前のpre-commit hook

3. セキュリティヘッダーの確認
   - helmet.jsの使用
   - HTTPSリダイレクト

## 🔧 開発者向け設定

### Git設定

```bash
# .gitignore で環境ファイルを除外
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

### Pre-commit Hook

```bash
# secrets検出
pnpm add -D @commitlint/cli @commitlint/config-conventional
```

## 📞 セキュリティインシデント対応

### 報告手順

1. 即座に開発チームに連絡
2. 影響範囲の特定
3. 一時的な修正の実施
4. 根本原因の分析と恒久対策

### 緊急対応

- JWT秘密鍵の漏洩: 即座にローテーション
- データベース情報の漏洩: パスワード変更とアクセス制限
- APIキーの漏洩: 無効化と再生成

## 📚 参考資料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-jwt-bcp-07)
