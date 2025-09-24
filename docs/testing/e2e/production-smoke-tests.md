# Production E2E Smoke Tests

## 概要

Production E2E Smoke Testsは、本番環境の基本的な動作を定期的に監視するための自動テストシステムです。このシステムは、本番環境への過度な負荷を防ぎつつ、システムの健全性を継続的に確認します。

## 主な機能

### 1. 実行制限管理

- **1日の実行上限**: デフォルトで5回/日
- **タイムゾーン**: JST (UTC+9) 基準
- **制限チェック**: GitHub APIを使用した実行履歴確認
- **手動オーバーライド**: 必要に応じて制限をスキップ可能

### 2. マルチチャネル通知システム

#### 通知チャネル

1. **Slack通知** (プライマリ)
   - リッチフォーマットメッセージ
   - インタラクティブボタン
   - カスタムアタッチメント

2. **Email通知** (セカンダリ)
   - HTML形式
   - 詳細なテスト結果
   - トレンド情報

3. **GitHub Issue** (クリティカル時)
   - 自動Issue作成
   - 適切なラベル付け
   - アクションアイテム生成

4. **GitHub Annotations** (フォールバック)
   - ワークフロー内での直接表示
   - ステップサマリー
   - エラー/警告/通知レベル

#### 優先度レベル

| 優先度     | 説明           | 通知チャネル          | 自動トリガー条件           |
| ---------- | -------------- | --------------------- | -------------------------- |
| `critical` | 緊急対応が必要 | Slack + Email + Issue | 連続3回失敗、失敗率50%以上 |
| `high`     | 高優先度       | Slack + Email         | 連続2回失敗、失敗率25%以上 |
| `normal`   | 通常           | Slack                 | 失敗率25%未満              |
| `low`      | 低優先度       | Annotations only      | 成功時、手動設定時         |

### 3. トレンド分析

システムは過去7日間のテスト実行データを分析し、以下の情報を提供します：

- **成功率/失敗率**: パーセンテージ表示
- **実行時間統計**: 平均、最小、最大
- **連続失敗検出**: アラート生成
- **日別失敗分布**: パターン分析
- **システムヘルス評価**: 5段階評価

## セットアップ手順

### 1. GitHub Secrets設定

以下のシークレットをGitHubリポジトリに設定してください：

```bash
# 必須
PRODUCTION_URL               # 本番環境URL
PRODUCTION_TEST_EMAIL        # テスト用メールアドレス
PRODUCTION_TEST_PASSWORD     # テスト用パスワード

# オプション（通知用）
SLACK_WEBHOOK_URL           # Slack Webhook URL
MAIL_USERNAME               # SMTP認証ユーザー名
MAIL_PASSWORD               # SMTP認証パスワード
NOTIFICATION_EMAIL          # 通知先メールアドレス
```

### 2. Slack Webhook設定

1. Slackワークスペースの管理画面にアクセス
2. Apps → Incoming Webhooks を選択
3. 新しいWebhookを作成
4. Webhook URLをコピー
5. GitHub Secretsに`SLACK_WEBHOOK_URL`として設定

### 3. Email通知設定（Gmail例）

1. Googleアカウントの2段階認証を有効化
2. アプリパスワードを生成
3. 以下のシークレットを設定：
   ```
   MAIL_USERNAME: your-email@gmail.com
   MAIL_PASSWORD: your-app-password
   NOTIFICATION_EMAIL: recipient@example.com
   ```

### 4. ワークフローファイル作成

```bash
# .example ファイルから本番用ファイルを作成
cp .github/workflows/production-e2e-smoke-test.yml.example \
   .github/workflows/production-e2e-smoke-test.yml
```

## 実行方法

### 自動実行（スケジュール）

デフォルトで毎日午前2時（JST）に自動実行されます：

```yaml
schedule:
  - cron: '0 17 * * *' # 17:00 UTC = 02:00 JST
```

### 手動実行

1. GitHub Actions タブを開く
2. "Production E2E Smoke Tests" ワークフローを選択
3. "Run workflow" をクリック
4. オプションを選択：
   - **Skip execution limit check**: 実行制限をスキップ（慎重に使用）
   - **Notification priority**: 通知優先度を指定

## テストスコープ

Production smoke testsは以下の重要な機能をカバーします：

```typescript
// e2e/smoke-tests/production.spec.ts
describe('Production Smoke Tests @smoke', () => {
  test('ログインフロー', async () => {
    // 本番環境でのログイン確認
  });

  test('ダッシュボード表示', async () => {
    // 主要なダッシュボード要素の確認
  });

  test('基本的なナビゲーション', async () => {
    // 主要ページへのアクセス確認
  });

  test('データ読み込み', async () => {
    // API応答とデータ表示の確認
  });
});
```

## トラブルシューティング

### 実行制限エラー

```bash
# 現在の実行状況を確認
gh api repos/$GITHUB_REPOSITORY/actions/workflows/production-e2e-smoke-test.yml/runs \
  --jq '[.workflow_runs[] | select(.created_at > "'$(date -u -d 'today' '+%Y-%m-%d')'T00:00:00Z")] | length'

# 手動で制限をリセット（翌日まで待つ必要あり）
# または、workflow_dispatch で skip_limit_check: true を使用
```

### 通知が届かない

1. **Slack通知**:

   ```bash
   # Webhook URLをテスト
   curl -X POST $SLACK_WEBHOOK_URL \
     -H 'Content-Type: application/json' \
     -d '{"text": "Test notification"}'
   ```

2. **Email通知**:
   - SMTPサーバー設定を確認
   - アプリパスワードが有効か確認
   - スパムフォルダを確認

3. **GitHub Issue**:
   - GITHUB_TOKENの権限を確認
   - Issue作成権限があるか確認

### テスト失敗の調査

1. **アーティファクトの確認**:
   - GitHub Actions実行ページでアーティファクトをダウンロード
   - Playwright HTMLレポートを確認
   - 失敗時のスクリーンショット/ビデオを確認

2. **ログ分析**:

   ```bash
   # 最近の失敗を検索
   gh run list --workflow=production-e2e-smoke-test.yml --json conclusion,createdAt \
     --jq '.[] | select(.conclusion == "failure")'
   ```

3. **トレンド確認**:

   ```typescript
   // Node.js環境で実行
   import { getWorkflowTrends, formatTrendAnalysis } from './apps/web/e2e/smoke-test-utils';

   const trends = await getWorkflowTrends('your-org/your-repo', 'production-e2e-smoke-test.yml', 7);
   console.log(formatTrendAnalysis(trends));
   ```

## ベストプラクティス

### 1. テストの設計

- **非破壊的**: 読み取り専用操作に限定
- **独立性**: 他のテストに依存しない
- **高速性**: 各テストは1分以内に完了
- **安定性**: フレーキーなテストは即座に修正

### 2. 実行頻度の調整

```yaml
# ピークタイムを避ける
schedule:
  - cron: '0 17 * * *'  # 深夜2時 JST

# 重要なリリース後は一時的に頻度を上げる
schedule:
  - cron: '0 */6 * * *'  # 6時間ごと（一時的）
```

### 3. 通知ルール

- **成功時**: 通知なし（ノイズ削減）
- **初回失敗**: normal優先度
- **連続失敗**: 優先度を自動エスカレート
- **回復時**: 成功通知を送信

### 4. セキュリティ

- **専用テストアカウント**: 最小権限
- **読み取り専用操作**: データ変更なし
- **シークレット管理**: GitHub Secretsを使用
- **アクセスログ監視**: 異常なアクセスパターンを検出

## 拡張と改善

### カスタム通知チャネルの追加

```typescript
// apps/web/e2e/notification-handlers/custom.ts
export async function sendCustomNotification(data: NotificationData) {
  // カスタム通知実装
  await fetch('https://your-api.com/notify', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

### メトリクス収集

```yaml
- name: Send metrics to monitoring service
  if: always()
  run: |
    curl -X POST https://metrics.example.com/api/v1/metrics \
      -H "Authorization: Bearer ${{ secrets.METRICS_TOKEN }}" \
      -d '{
        "test_result": "${{ needs.smoke-tests.outputs.test_result }}",
        "duration": "${{ needs.smoke-tests.outputs.duration }}",
        "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
      }'
```

### カスタムヘルスチェック

```typescript
// e2e/smoke-tests/health-checks.spec.ts
test('API health check @smoke', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.status()).toBe(200);

  const data = await response.json();
  expect(data.status).toBe('healthy');
  expect(data.database).toBe('connected');
});
```

## 関連ドキュメント

- [E2Eテストガイド](./README.md)
- [Playwright設定](../../testing-guide.md)
- [CI/CD設定](../../deployment/ci-cd.md)
- [セキュリティガイドライン](../../ai-guide/security-deployment.md)

## 更新履歴

| バージョン | 日付       | 変更内容                       |
| ---------- | ---------- | ------------------------------ |
| 2.0.0      | 2024-01-XX | マルチチャネル通知システム実装 |
| 1.5.0      | 2024-01-XX | トレンド分析機能追加           |
| 1.0.0      | 2024-01-XX | 初版リリース                   |

---

**注意**: このドキュメントは本番環境のスモークテスト専用です。開発環境やステージング環境のテストについては、それぞれの環境専用のドキュメントを参照してください。
