# Render無料プランのセットアップ手順

## 📋 無料プランの内容

### Web Service（APIサーバー）

- **料金**: 無料
- **制限**: 月750時間（約31日）
- **スペック**: 512MB RAM, 0.1 CPU
- **注意**: 15分間アクセスがないとスリープ

### PostgreSQL

- **料金**: 無料
- **制限**: 90日後に自動削除
- **スペック**: 256MB RAM, 1GB ストレージ
- **⚠️ 重要**: データは90日で消えます

## 🚀 セットアップ手順

### ステップ1: GitHubにプッシュ

```bash
git add render.yaml
git commit -m "feat: Render無料プランを明示的に指定"
git push origin main
```

### ステップ2: Renderアカウント作成

1. [Render.com](https://render.com) にアクセス
2. 「Get Started for Free」をクリック
3. GitHubアカウントでサインアップ（推奨）

### ステップ3: Blueprintデプロイ

1. Renderダッシュボードで「New +」→「Blueprint」
2. GitHubリポジトリを接続:
   - 「Connect GitHub」をクリック
   - `knishioka/simple-bookkeeping`を選択
3. 「Apply」をクリック

### ステップ4: 無料プランの確認

デプロイ時に以下を確認：

- Web Service: 「Free」プランが選択されている
- PostgreSQL: 「Free」プランが選択されている

## 📌 無料プランの制限事項

### 1. スリープモード

- 15分間アクセスがないとスリープ
- 次回アクセス時に起動（30秒程度かかる）
- 回避方法: UptimeRobotなどで定期的にping

### 2. データベース90日制限

- 90日後にデータベースが削除される
- 回避方法:
  - 定期的にバックアップ
  - 90日前に再作成
  - または有料プラン（$7/月）

### 3. リソース制限

- CPU/メモリが限定的
- 大規模なアプリには不向き

## 💡 無料プランの活用方法

### 開発・テスト用途

- 個人プロジェクト
- プロトタイプ
- デモアプリケーション

### 本番移行時

無料プランで開発し、本番では有料プランに移行：

```bash
# render.yamlを編集
plan: free → plan: starter  # $7/月
```

## 🔧 セットアップ後の作業

1. **データベースマイグレーション**
   - Render Shellでマイグレーション実行
2. **Vercel環境変数の更新**
   - API URLをVercelに設定
3. **動作確認**
   - APIエンドポイントのテスト
   - フロントエンドとの連携確認
