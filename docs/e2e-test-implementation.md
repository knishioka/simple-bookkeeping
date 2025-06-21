# E2Eテスト実装ガイド

## 概要
本ドキュメントは、Simple Bookkeepingプロジェクトに実装したE2Eテストの詳細をまとめたものです。

## 実装したE2Eテスト

### 1. 基本テスト (`e2e/basic.spec.ts`)
- ✅ トップページアクセステスト
- ✅ ログインページテスト
- ✅ デモページテスト
- ✅ レスポンシブデザインテスト

### 2. Select操作テスト (`e2e/select-test.spec.ts`, `e2e/accounts.spec.ts`)
- ✅ Radix UI Selectコンポーネントの操作
- ✅ キーボードナビゲーション
- ✅ 検索機能
- ✅ アクセシビリティ

### 3. 統合テスト (`e2e/integration/`)
- **認証フロー** (`auth-flow.spec.ts`)
  - JWTトークン管理
  - セッション管理
  - 組織切り替え
  - リフレッシュトークン

- **トランザクション整合性** (`transaction-integrity.spec.ts`)
  - 貸借一致検証
  - 会計期間チェック
  - 同時更新制御
  - マスターデータ整合性

### 4. パフォーマンステスト (`e2e/performance/performance.spec.ts`)
- ページロード速度測定
- 大量データ処理（1000件）
- メモリリーク検出
- API応答速度
- CPU使用率モニタリング

### 5. セキュリティテスト (`e2e/security/security.spec.ts`)
- 認可チェック
- SQLインジェクション対策
- XSS対策
- CSRF対策
- セッションセキュリティ
- パスワードポリシー

### 6. エラーハンドリングテスト (`e2e/error-handling/error-handling.spec.ts`)
- ネットワークエラー処理
- サーバーエラー（500, 503, 429）
- クライアントエラー
- ファイルアップロードエラー
- グローバルエラーハンドリング

### 7. ユーザビリティテスト (`e2e/usability/usability.spec.ts`)
- キーボードナビゲーション
- WCAG 2.1 AA準拠チェック
- フォーカス管理
- レスポンシブデザイン
- ユーザーガイダンス

## テスト実行方法

### 基本的な実行
```bash
# すべてのE2Eテストを実行
pnpm --filter @simple-bookkeeping/web test:e2e

# UIモードで実行（デバッグに便利）
pnpm --filter @simple-bookkeeping/web test:e2e:ui

# 基本テストのみ実行
pnpm --filter @simple-bookkeeping/web test:e2e:basic
```

### CI環境での実行
```bash
# GitHub Actionsで自動実行
pnpm --filter @simple-bookkeeping/web test:e2e:ci
```

## Playwright設定

### 対象ブラウザ
- Chromium
- Firefox
- WebKit
- Mobile Chrome
- Mobile Safari

### テスト設定
- `baseURL`: http://localhost:3000
- `timeout`: 30秒
- `retries`: CI環境で2回
- `workers`: ローカル4並列、CI環境1並列

## CI/CD統合

### GitHub Actions
`.github/workflows/e2e-tests.yml`に以下の機能を実装：
- PostgreSQLサービスコンテナ
- 自動的なサーバー起動
- テスト結果のアーティファクト保存
- 失敗時のビデオ記録

## 注意事項

### 現在の制限事項
1. **実装依存のテスト**
   - 一部のテストは実際のUI実装に依存
   - モックAPIの設定が必要な場合がある

2. **パフォーマンステスト**
   - Chrome DevTools Protocolを使用
   - 環境によって結果が変動する可能性

3. **アクセシビリティテスト**
   - axe-coreによる自動チェック
   - 手動確認も推奨

### 推奨事項
1. **テスト環境の分離**
   - テスト専用のデータベースを使用
   - テストデータは毎回クリーンアップ

2. **並列実行の管理**
   - リソース競合を避けるため適切なworker数を設定
   - CI環境では保守的な設定を使用

3. **デバッグ方法**
   - `--debug`フラグでステップ実行
   - `--headed`フラグでブラウザを表示
   - トレースファイルの活用

## 今後の改善点

1. **ビジュアルリグレッションテスト**
   - スクリーンショット比較の追加
   - デザイン変更の検出

2. **パフォーマンスベースライン**
   - 継続的なパフォーマンス計測
   - 劣化の自動検出

3. **テストデータ管理**
   - Fixtureの充実
   - シナリオベースのデータセット

4. **国際化対応**
   - 多言語テストの追加
   - ロケール別の動作確認