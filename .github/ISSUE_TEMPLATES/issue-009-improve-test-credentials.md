# Security: Improve test credentials management

## 🎯 概要
テストファイル内にハードコードされた認証情報が散在しており、セキュリティリスクと管理上の問題を引き起こしています。テスト用認証情報を安全かつ効率的に管理する仕組みを構築します。

## 🔍 現状の問題点

### 1. ハードコードされた認証情報
| 値 | 出現箇所 | リスク |
|----|---------|-------|
| "admin123" | E2Eテスト全般 | パスワードが公開 |
| "test@example.com" | 複数のテストファイル | メールアドレスの漏洩 |
| "password123" | ユニットテスト | 弱いパスワード |
| JWTトークン | テストファイル | トークンの漏洩 |

### 2. 現在の問題のあるコード
```typescript
// ❌ E2Eテストでのハードコード
test('should login as admin', async ({ page }) => {
  await page.fill('#email', 'admin@example.com');
  await page.fill('#password', 'admin123'); // ハードコード
});

// ❌ APIテストでのハードコード
const mockUser = {
  email: 'test@example.com',
  password: 'password123', // ハードコード
};

// ❌ JWTトークンのハードコード
const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // 実際のトークン
```

### 3. リスクと影響
- **セキュリティリスク**: テスト用認証情報が本番環境で使用される可能性
- **管理の複雑さ**: 認証情報変更時に複数箇所の更新が必要
- **コンプライアンス**: セキュリティ監査での指摘リスク
- **再利用性**: テストデータの共有が困難

## 💡 推奨される解決策

### 1. テスト用認証情報の中央管理
```typescript
// packages/test-utils/src/credentials.ts
export const TEST_CREDENTIALS = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin.test@localhost',
    password: process.env.TEST_ADMIN_PASSWORD || generateSecurePassword(),
  },
  user: {
    email: process.env.TEST_USER_EMAIL || 'user.test@localhost',
    password: process.env.TEST_USER_PASSWORD || generateSecurePassword(),
  },
  viewer: {
    email: process.env.TEST_VIEWER_EMAIL || 'viewer.test@localhost',
    password: process.env.TEST_VIEWER_PASSWORD || generateSecurePassword(),
  },
} as const;

// セキュアなパスワード生成
function generateSecurePassword(): string {
  return `Test_${crypto.randomBytes(8).toString('hex')}_${Date.now()}`;
}
```

### 2. 環境変数を使用した管理
```bash
# .env.test (テスト環境専用)
TEST_ADMIN_EMAIL=admin.test@localhost
TEST_ADMIN_PASSWORD=Test_Admin_2024_Secure
TEST_USER_EMAIL=user.test@localhost
TEST_USER_PASSWORD=Test_User_2024_Secure
TEST_JWT_SECRET=test-only-jwt-secret-do-not-use-in-production
```

### 3. テストヘルパーの作成
```typescript
// packages/test-utils/src/auth-helpers.ts
import { TEST_CREDENTIALS } from './credentials';

export async function loginAsAdmin(page: Page) {
  const { email, password } = TEST_CREDENTIALS.admin;
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

export function generateTestJWT(userId: string, role: string): string {
  const secret = process.env.TEST_JWT_SECRET || 'test-secret';
  return jwt.sign(
    { userId, role, test: true }, // testフラグを含める
    secret,
    { expiresIn: '1h' }
  );
}
```

### 4. テストデータファクトリ
```typescript
// packages/test-utils/src/factories/user.factory.ts
import { faker } from '@faker-js/faker';
import { User } from '@simple-bookkeeping/types';

export class UserFactory {
  static create(overrides?: Partial<User>): User {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email({ provider: 'test.local' }),
      password: this.generateTestPassword(),
      name: faker.person.fullName(),
      role: 'viewer',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  private static generateTestPassword(): string {
    // テスト用の安全なパスワード生成
    return `Test_${faker.string.alphanumeric(16)}`;
  }
}
```

### 5. CI/CDでのシークレット管理
```yaml
# .github/workflows/test.yml
name: Test

jobs:
  test:
    runs-on: ubuntu-latest
    env:
      TEST_ADMIN_EMAIL: ${{ secrets.TEST_ADMIN_EMAIL }}
      TEST_ADMIN_PASSWORD: ${{ secrets.TEST_ADMIN_PASSWORD }}
      TEST_JWT_SECRET: ${{ secrets.TEST_JWT_SECRET }}
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: pnpm test
```

## 📋 アクセプタンスクライテリア
- [ ] ハードコードされた認証情報が完全に除去されている
- [ ] テスト用認証情報が中央管理されている
- [ ] 環境変数を使用した設定が可能
- [ ] テストヘルパーが整備されている
- [ ] CI/CDでシークレット管理が設定されている
- [ ] テストデータが本番データと明確に区別される
- [ ] セキュリティスキャンがパスする

## 🏗️ 実装ステップ

1. **テストユーティリティパッケージの作成**（1日）
   - test-utilsパッケージの作成
   - 認証情報管理モジュール
   - テストヘルパー関数

2. **既存テストの移行**（2日）
   - ハードコードの置き換え
   - テストヘルパーの適用
   - テストの動作確認

3. **CI/CD設定**（0.5日）
   - GitHub Secretsの設定
   - ワークフローの更新
   - テスト実行

4. **ドキュメント化**（0.5日）
   - 使用方法のドキュメント
   - セキュリティガイドライン
   - 移行ガイド

## ⏱️ 見積もり工数
- **総工数**: 4人日
- **優先度**: Low 🟢
- **影響度**: セキュリティとテスト管理

## 🏷️ ラベル
- `security`
- `testing`
- `low-priority`
- `best-practices`

## 📊 成功指標
- ハードコードされた認証情報: 0件
- セキュリティスキャン通過率: 100%
- テストメンテナンス時間: 50%削減
- 認証情報変更時の工数: 80%削減

## ⚠️ リスクと考慮事項
- **テストの互換性**: 既存テストが壊れる可能性
- **環境変数の管理**: 各環境での設定が必要
- **パフォーマンス**: 動的生成による速度低下
- **学習コスト**: 新しいテストパターンへの適応

## 🔒 セキュリティベストプラクティス

1. **テスト環境の分離**
   - テスト用ドメインの使用（*.test.local）
   - テストフラグの付与
   - 本番環境での拒否

2. **認証情報のローテーション**
   - 定期的なパスワード変更
   - JWTシークレットの更新
   - アクセスログの監視

3. **コードレビューチェックリスト**
   - [ ] ハードコードされた認証情報がないか
   - [ ] テスト用と本番用が区別されているか
   - [ ] シークレットがgitにコミットされていないか
   - [ ] Gitleaksチェックをパスしているか

## 📚 参考資料
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [Test Data Management Best Practices](https://martinfowler.com/articles/test-data-management.html)
- [Secure Coding Practices](https://github.com/OWASP/CheatSheetSeries)
- [GitHub Secrets Management](https://docs.github.com/en/actions/security-guides/encrypted-secrets)