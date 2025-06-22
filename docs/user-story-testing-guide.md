# ユーザーストーリーテスティングガイド

## 概要

Simple Bookkeepingでは、ユーザーストーリーとE2Eテストを密接に連携させることで、実際のユーザー価値を検証しています。

## アーキテクチャ

### 1. ユーザーストーリー定義

```typescript
// apps/web/e2e/user-stories/user-stories.ts
interface UserStory {
  id: string; // 一意のストーリーID
  title: string; // ストーリータイトル
  persona: {
    // ペルソナ情報
    name: string;
    role: string;
    background: string;
  };
  scenarios: Scenario[]; // 具体的なシナリオ
  acceptanceCriteria: string[]; // 受け入れ条件
  priority: 'high' | 'medium' | 'low';
  status: 'not-started' | 'in-progress' | 'completed';
}
```

### 2. テストとの紐付け

各シナリオは専用のE2Eテストファイルと紐付けられます：

```typescript
scenarios: [{
  id: 'US001-S01',
  description: '朝一番の売上確認',
  steps: [...],
  testFiles: ['e2e/user-stories/freelancer/daily-dashboard.spec.ts']
}]
```

## 実装されているストーリー

### US001: 個人事業主の日次経理業務

- **ペルソナ**: 田中さん（フリーランスデザイナー）
- **シナリオ**:
  - US001-S01: 朝一番の売上確認
  - US001-S02: クライアントからの入金処理
  - US001-S03: 経費入力（領収書ベース）

### US002: 小規模店舗の日次売上管理

- **ペルソナ**: 佐藤さん（カフェオーナー）
- **シナリオ**:
  - US002-S01: 開店前のレジ現金確認
  - US002-S02: 仕入れ業者への支払い記録

### US003: 中小企業の月次決算業務

- **ペルソナ**: 山田さん（経理担当）
- **シナリオ**:
  - US003-S01: 月初の前月仕訳レビュー
  - US003-S02: 試算表作成と分析

## テスト実装パターン

### 1. ストーリーテストの基本構造

```typescript
import { storyTest, StoryTestHelper } from '../story-test-base';

storyTest('ユーザーストーリー名', async ({ page, recordStep }) => {
  // 各ステップを実行
  await StoryTestHelper.executeStep(
    page,
    'ステップの説明',
    async () => {
      // 実際のテスト処理
    },
    recordStep
  );

  // 受け入れ条件の検証
  await StoryTestHelper.verifyAcceptanceCriteria(page, '3秒以内に表示される', async () => {
    // 検証処理
  });
});
```

### 2. ステップの記録

各ステップの実行結果は自動的に記録され、レポートに含まれます：

- ✅ passed: ステップ成功
- ❌ failed: ステップ失敗
- ⏭️ skipped: スキップ

### 3. パフォーマンス検証

```typescript
await storyExpect.toCompleteWithin(
  async () => {
    await page.reload();
    await page.waitForLoadState('networkidle');
  },
  3000 // 3秒以内
);
```

### 4. ユーザビリティ検証

```typescript
await storyExpect.toBeUserFriendly(page, {
  hasProperLabels: true, // ラベル付け
  hasHelpText: true, // ヘルプテキスト
  hasErrorMessages: true, // エラーメッセージ
  isKeyboardNavigable: true, // キーボード操作
});
```

## カバレッジレポート

### レポート生成

```bash
# レポート生成スクリプトを実行
cd apps/web
npx ts-node e2e/user-stories/story-coverage-report.ts
```

### 出力形式

1. **HTML レポート** (`story-coverage.html`)

   - ビジュアルなダッシュボード
   - ストーリー別の実装状況
   - シナリオ別のテスト結果

2. **Markdown レポート** (`story-coverage.md`)
   - ドキュメントとして管理
   - PR/レビュー時の参照用

### カバレッジメトリクス

- **ストーリーカバレッジ**: 実装済みストーリー数 / 全ストーリー数
- **シナリオカバレッジ**: 実装済みシナリオ数 / 全シナリオ数
- **受け入れ条件達成率**: 満たされた条件数 / 全条件数

## CI/CD統合

### GitHub Actions設定

```yaml
- name: Run story tests
  run: pnpm test:e2e:stories

- name: Generate coverage report
  run: pnpm test:stories:coverage

- name: Upload coverage report
  uses: actions/upload-artifact@v4
  with:
    name: story-coverage-report
    path: |
      apps/web/story-coverage.html
      apps/web/story-coverage.md
```

## ベストプラクティス

### 1. ストーリーファースト

- 開発前にユーザーストーリーを定義
- ストーリーに基づいてテストを作成
- テストが通るように実装

### 2. ペルソナの明確化

- 各ストーリーには具体的なペルソナを設定
- ペルソナの背景・ニーズを理解
- ペルソナ視点でテストシナリオを設計

### 3. 受け入れ条件の定量化

- 「速い」→「3秒以内」
- 「使いやすい」→「3クリック以内で完了」
- 「わかりやすい」→「ヘルプなしで操作可能」

### 4. 継続的な改善

- ユーザーフィードバックの反映
- 新しいストーリーの追加
- 既存ストーリーの更新

## トラブルシューティング

### テストが失敗する場合

1. ステップの詳細ログを確認
2. スクリーンショット/ビデオを確認
3. 受け入れ条件の妥当性を検証

### カバレッジが低い場合

1. 未実装のストーリーを確認
2. 優先度の高いものから実装
3. チームでストーリーの優先順位を見直し

## 今後の拡張

1. **ストーリーマッピング**

   - ユーザージャーニー全体の可視化
   - ストーリー間の関係性の管理

2. **A/Bテスト統合**

   - 異なるUIパターンの比較
   - ユーザー満足度の測定

3. **実ユーザーデータとの連携**
   - 実際の使用パターンの分析
   - ストーリーの妥当性検証
