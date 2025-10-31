# コントリビューションガイド

Simple Bookkeepingプロジェクトへの貢献に興味を持っていただき、ありがとうございます！

## 🚀 はじめに

### 開発環境のセットアップ

1. **リポジトリのフォーク & クローン**

   ```bash
   git clone https://github.com/YOUR_USERNAME/simple-bookkeeping.git
   cd simple-bookkeeping
   ```

2. **依存関係のインストール**

   ```bash
   pnpm install
   ```

3. **環境変数の設定**

   ```bash
   direnv allow  # 初回のみ
   mkdir -p env/secrets
   cp env/templates/common.env.example env/secrets/common.env
   cp env/templates/supabase.local.env.example env/secrets/supabase.local.env
   cp env/templates/vercel.env.example env/secrets/vercel.env
   scripts/env-manager.sh switch local
   ```

4. **データベースのセットアップ**

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

5. **開発サーバーの起動**
   ```bash
   pnpm dev
   ```

## 📝 コントリビューションの流れ

### 1. Issueの確認・作成

- 既存のIssueを確認し、重複していないか確認
- 新しい機能や大きな変更の場合は、まずIssueで議論
- バグ報告の場合は、再現手順を明記

### 2. ブランチの作成

```bash
git checkout -b feature/your-feature-name
# または
git checkout -b fix/bug-description
```

命名規則：

- `feature/` - 新機能
- `fix/` - バグ修正
- `docs/` - ドキュメント
- `test/` - テスト追加
- `refactor/` - リファクタリング

### 3. 開発

**必ず[CLAUDE.md](./CLAUDE.md)のガイドラインに従ってください**

重要なポイント：

- TypeScript strict modeを使用
- 共通型定義は`@simple-bookkeeping/types`から import
- エラーハンドリングはServer Actions内で実装
- UIコンポーネントは`shadcn/ui`を優先使用

### 4. テストの作成・実行

```bash
# ユニットテスト
pnpm test

# E2Eテスト
pnpm --filter web test:e2e

# すべてのテスト
pnpm test:all
```

新機能には必ずテストを追加してください：

- ユニットテスト（コンポーネント、関数）
- 統合テスト（API）
- E2Eテスト（重要なユーザーフロー）

### 5. コミット

コミットメッセージの形式：

```
<type>: <subject>

<body>

<footer>
```

例：

```
feat: 仕訳テンプレート機能を追加

- よく使う仕訳パターンを保存可能に
- テンプレートから仕訳を作成する機能
- テンプレートの編集・削除機能

Closes #123
```

タイプ：

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメントのみの変更
- `style`: コードの意味に影響しない変更
- `refactor`: バグ修正や機能追加を含まないコード変更
- `test`: テストの追加・修正
- `chore`: ビルドプロセスやツールの変更

### 6. プッシュ & PR作成

```bash
git push origin feature/your-feature-name
```

PRテンプレート：

```markdown
## 概要

変更の概要を記載

## 変更内容

- [ ] 実装した機能1
- [ ] 実装した機能2

## テスト

- [ ] ユニットテストを追加
- [ ] E2Eテストを追加
- [ ] 手動テスト完了

## スクリーンショット

（UIの変更がある場合）

## 関連Issue

Closes #XXX
```

## 🔍 コードレビューのポイント

レビュアーは以下の点を確認します：

1. **コード品質**
   - TypeScriptの型が適切に定義されているか
   - エラーハンドリングが適切か
   - パフォーマンスへの影響

2. **テスト**
   - 十分なテストカバレッジがあるか
   - エッジケースが考慮されているか

3. **セキュリティ**
   - 入力値の検証
   - 認証・認可の適切な実装
   - SQLインジェクション対策

4. **UI/UX**
   - デザインの一貫性
   - アクセシビリティ
   - レスポンシブ対応

## 🐛 バグ報告

バグ報告時は以下の情報を含めてください：

```markdown
## 環境

- OS:
- ブラウザ:
- Node.js:
- pnpm:

## 再現手順

1.
2.
3.

## 期待される動作

## 実際の動作

## スクリーンショット/エラーログ

## 補足情報
```

## 💡 機能提案

機能提案時は以下を含めてください：

- 解決したい問題
- 提案する解決策
- 代替案の検討
- 実装の複雑さの見積もり

## 📚 ドキュメント

ドキュメントの改善も歓迎します：

- 誤字脱字の修正
- より分かりやすい説明への改善
- 新しい使用例の追加
- 翻訳

## 🤝 行動規範

- 建設的で友好的なコミュニケーション
- 多様性を尊重
- 初心者にも親切に
- 技術的な議論に集中

## 📞 質問・サポート

- **GitHub Discussions**: 一般的な質問や議論
- **GitHub Issues**: バグ報告や機能提案
- **Pull Request**: コードの貢献

## 🙏 謝辞

あなたの貢献がこのプロジェクトをより良いものにします。
ありがとうございます！
