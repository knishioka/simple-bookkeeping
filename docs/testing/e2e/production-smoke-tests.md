# Production E2E Smoke Tests

## 概要

Production環境でのE2Eスモークテストは、本番環境で最も重要なユーザーフローが正常に動作することを確認するための軽量なテストスイートです。

## 特徴

- **読み取り専用**: 破壊的操作は一切行いません
- **Viewer権限**: 最小限の権限でテストを実行
- **実行制限**: 1日最大3回の実行制限
- **自動実行**: デプロイ後または定期的に自動実行

## セットアップ

### ローカル環境

1. 環境変数ファイルを作成:

```bash
cp .env.test.production.example .env.test.production
```

2. `.env.test.production`を編集して認証情報を設定:

```env
PROD_URL=https://simple-bookkeeping-mu.vercel.app
PROD_TEST_EMAIL=your-test-email@example.com
PROD_TEST_PASSWORD=your-test-password
MAX_DAILY_RUNS=3
```

⚠️ **重要**: `.env.test.production`ファイルは絶対にコミットしないでください。

### GitHub Actions

GitHub Secretsに以下の環境変数を設定:

1. リポジトリの Settings → Secrets and variables → Actions に移動
2. 以下のSecretsを追加:
   - `PROD_TEST_EMAIL`: テスト用アカウントのメールアドレス
   - `PROD_TEST_PASSWORD`: テスト用アカウントのパスワード

## テストの実行

### ローカル実行

```bash
# すべてのProduction E2Eテストを実行
pnpm --filter @simple-bookkeeping/web test:e2e:prod

# スモークテストのみ実行
pnpm --filter @simple-bookkeeping/web test:e2e:prod:smoke

# デバッグモードで実行
TEST_MODE=prod pnpm --filter @simple-bookkeeping/web playwright test --debug --grep @smoke
```

### CI/CD実行

GitHub Actionsで以下のタイミングで自動実行されます:

- **手動トリガー**: Actions → Production Smoke Tests → Run workflow
- **定期実行**: 毎日午前10時（JST）
- **mainブランチへのマージ後**: 自動的に実行

## テストカバレッジ

### 現在カバーされている領域

1. **公開ページ**
   - ホームページの表示
   - ログイン画面の表示
   - 新規登録画面の表示
   - 基本的なナビゲーション

2. **認証フロー**
   - Viewer権限でのログイン
   - ログイン後のリダイレクト
   - ログアウトリンクの表示

3. **保護されたページ（読み取りのみ）**
   - ダッシュボードへのアクセス
   - 主要ページへのナビゲーション
   - コンテンツの表示確認

### 今後追加予定

- パフォーマンス測定
- アクセシビリティチェック
- レスポンシブデザインの確認
- エラーハンドリングの詳細テスト

## セキュリティ考慮事項

### テストアカウントの要件

- **権限**: Viewer権限のみ（読み取り専用）
- **データアクセス**: 最小限のテストデータのみ
- **パスワード**: 強力なパスワードを使用
- **定期更新**: 3ヶ月ごとにパスワードを更新

### 実行制限

- **頻度**: 1日最大3回
- **タイムアウト**: 30分以内
- **並列実行**: 1インスタンスのみ

### 監視とアラート

- テスト失敗時の通知
- 異常なアクセスパターンの検出
- 実行ログの保存（7日間）

## トラブルシューティング

### よくある問題

#### テストがタイムアウトする

```bash
# タイムアウトを延長して実行
TEST_MODE=prod playwright test --grep @smoke --timeout=60000
```

#### 認証エラー

1. 環境変数が正しく設定されているか確認
2. テストアカウントが有効か確認
3. パスワードが最新か確認

#### ネットワークエラー

```bash
# リトライを有効にして実行
TEST_MODE=prod playwright test --grep @smoke --retries=2
```

## ベストプラクティス

1. **破壊的操作の禁止**: CREATE、UPDATE、DELETEは絶対に行わない
2. **データの独立性**: 特定のデータに依存しない
3. **冪等性**: 何度実行しても同じ結果になる
4. **タグの使用**: `@smoke`タグで重要なテストを識別
5. **エラーハンドリング**: 適切なエラーメッセージとログ

## 関連ドキュメント

- [Playwright設定](../../apps/web/playwright.config.ts)
- [E2Eテストガイド](./README.md)
- [CI/CD設定](../.github/workflows/production-smoke-test.yml)
