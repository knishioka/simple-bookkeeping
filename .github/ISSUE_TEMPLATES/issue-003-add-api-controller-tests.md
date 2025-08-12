# Test: Add missing test coverage for API controllers

## 🎯 概要

現在、APIコントローラーのテストカバレッジが著しく不足しています。8つの主要コントローラーのうち、部分的にテストされているのは1つ（auth.controller.ts）のみで、残り7つは完全に未テストです。これは品質保証とリグレッション防止の観点から重大なリスクです。

## 🔍 現状の問題点

### テストカバレッジ状況

| コントローラー                     | ファイルパス                                             | テスト状況   | 優先度 |
| ---------------------------------- | -------------------------------------------------------- | ------------ | ------ |
| ❌ accounts.controller.ts          | apps/api/src/controllers/accounts.controller.ts          | テストなし   | High   |
| ❌ auditLog.controller.ts          | apps/api/src/controllers/auditLog.controller.ts          | テストなし   | Medium |
| ❌ journalEntries.controller.ts    | apps/api/src/controllers/journalEntries.controller.ts    | テストなし   | High   |
| ❌ ledgers.controller.ts           | apps/api/src/controllers/ledgers.controller.ts           | テストなし   | Medium |
| ❌ organizations.controller.ts     | apps/api/src/controllers/organizations.controller.ts     | テストなし   | High   |
| ❌ reports.controller.ts           | apps/api/src/controllers/reports.controller.ts           | テストなし   | Medium |
| ❌ accountingPeriods.controller.ts | apps/api/src/controllers/accountingPeriods.controller.ts | テストなし   | High   |
| ⚠️ auth.controller.ts              | apps/api/src/controllers/auth.controller.ts              | 部分的 (30%) | High   |

### 影響範囲

- **ビジネスロジック**: 仕訳入力、勘定科目管理、会計期間管理など重要機能が未テスト
- **セキュリティ**: 認証・認可のエッジケースが未検証
- **データ整合性**: トランザクション処理のテストが不足
- **エラーハンドリング**: 異常系のテストが完全に欠如

## 💡 推奨される解決策

### テスト実装計画

#### Phase 1: 最重要コントローラー（Week 1）

```typescript
// 1. journalEntries.controller.test.ts
describe('JournalEntriesController', () => {
  describe('POST /journal-entries', () => {
    it('should create a balanced journal entry');
    it('should reject unbalanced entries');
    it('should validate required fields');
    it('should handle transaction rollback on error');
  });

  describe('GET /journal-entries', () => {
    it('should return paginated results');
    it('should filter by date range');
    it('should filter by account');
    it('should handle invalid query parameters');
  });

  describe('PUT /journal-entries/:id', () => {
    it('should update entry with valid data');
    it('should prevent updating approved entries');
    it('should validate balance after update');
  });

  describe('DELETE /journal-entries/:id', () => {
    it('should soft delete entry');
    it('should prevent deletion of approved entries');
    it('should check permissions');
  });
});
```

#### Phase 2: 認証・組織管理（Week 2）

```typescript
// 2. auth.controller.test.ts (完全版)
describe('AuthController', () => {
  describe('POST /auth/login', () => {
    it('should login with valid credentials');
    it('should reject invalid password');
    it('should handle non-existent user');
    it('should rate limit login attempts');
    it('should log audit events');
  });

  describe('POST /auth/refresh', () => {
    it('should refresh valid token');
    it('should reject expired refresh token');
    it('should maintain user session');
  });
});

// 3. organizations.controller.test.ts
describe('OrganizationsController', () => {
  describe('Organization CRUD', () => {
    it('should create organization with admin user');
    it('should update organization settings');
    it('should handle member management');
    it('should enforce role-based access');
  });
});
```

#### Phase 3: 会計機能（Week 3）

```typescript
// 4. accounts.controller.test.ts
describe('AccountsController', () => {
  describe('Account Management', () => {
    it('should create account with valid category');
    it('should prevent duplicate account codes');
    it('should update account properties');
    it('should handle account hierarchy');
    it('should calculate account balances');
  });
});

// 5. accountingPeriods.controller.test.ts
describe('AccountingPeriodsController', () => {
  describe('Period Management', () => {
    it('should create non-overlapping periods');
    it('should close period with validation');
    it('should prevent changes to closed periods');
    it('should handle fiscal year transitions');
  });
});
```

#### Phase 4: レポート・監査（Week 4）

```typescript
// 6. reports.controller.test.ts
// 7. ledgers.controller.test.ts
// 8. auditLog.controller.test.ts
```

### テストユーティリティの作成

```typescript
// apps/api/src/test/utils/test-helpers.ts
export const createTestUser = async (role: string);
export const createTestOrganization = async ();
export const authenticateUser = async (user);
export const createTestJournalEntry = async (balanced: boolean);
```

## 📋 アクセプタンスクライテリア

- [ ] 各コントローラーに対応するテストファイルが存在する
- [ ] 各エンドポイントの正常系・異常系がテストされている
- [ ] テストカバレッジが80%以上達成されている
- [ ] 認証・認可のテストが網羅されている
- [ ] トランザクション処理のテストが含まれている
- [ ] エラーハンドリングのテストが含まれている
- [ ] テストが独立して実行可能（テスト間の依存なし）
- [ ] CI/CDパイプラインでテストが自動実行される

## 🏗️ 実装ステップ

1. **準備**（2日）
   - テストデータベースのセットアップ
   - テストユーティリティの作成
   - モックとスタブの準備

2. **Phase 1実装**（5日）
   - journalEntries.controller.test.ts
   - 基本的なCRUDテスト
   - バリデーションテスト

3. **Phase 2実装**（5日）
   - auth.controller.test.ts（完全版）
   - organizations.controller.test.ts
   - 権限管理テスト

4. **Phase 3実装**（5日）
   - accounts.controller.test.ts
   - accountingPeriods.controller.test.ts
   - ビジネスロジックテスト

5. **Phase 4実装**（3日）
   - reports.controller.test.ts
   - ledgers.controller.test.ts
   - auditLog.controller.test.ts

## ⏱️ 見積もり工数

- **総工数**: 20人日
- **優先度**: High 🔴
- **影響度**: アプリケーション全体の品質保証

## 🏷️ ラベル

- `testing`
- `technical-debt`
- `high-priority`
- `quality-assurance`

## 📊 成功指標

- コードカバレッジ: 80%以上
- エンドポイントカバレッジ: 100%
- CI/CD実行時間: 5分以内
- バグ検出率の向上: 30%以上
- リグレッションの削減: 50%以上

## ⚠️ リスクと考慮事項

- **実装時間**: 全テスト実装には約1ヶ月必要
- **テストデータ管理**: テストデータの準備と管理方法の確立が必要
- **パフォーマンス**: テスト実行時間の増加によるCI/CDの遅延
- **メンテナンス**: テストコードの保守コスト

## 🛠️ 必要なツール・設定

```json
// package.json
{
  "devDependencies": {
    "@types/jest": "^29.0.0",
    "@types/supertest": "^2.0.0",
    "jest": "^29.0.0",
    "supertest": "^6.0.0",
    "ts-jest": "^29.0.0"
  },
  "scripts": {
    "test:api": "jest --config apps/api/jest.config.js",
    "test:api:watch": "jest --config apps/api/jest.config.js --watch",
    "test:api:coverage": "jest --config apps/api/jest.config.js --coverage"
  }
}
```

## 📚 参考資料

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [API Testing Guide](https://martinfowler.com/articles/practical-test-pyramid.html)
