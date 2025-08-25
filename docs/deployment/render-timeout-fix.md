# Renderデプロイメントタイムアウト対策ガイド

## 問題の概要

Renderの無料プランでは、デプロイメント時にタイムアウト制限があり、データベースマイグレーションに時間がかかるとデプロイが失敗することがあります。

## 🚨 タイムアウトの症状

- デプロイステータスが「Deploy failed」になる
- ビルドログに「Timeout」エラーが表示される
- APIが502 Bad Gatewayを返す
- Renderダッシュボードで「Build failed」と表示される

## 🔧 解決方法

### 方法1: 高速起動スクリプトを使用（推奨）

最新の設定では、タイムアウトを回避する高速起動スクリプトを使用しています：

**`scripts/start-production-fast.sh`の特徴:**

- マイグレーションに30秒のタイムアウトを設定
- マイグレーション失敗時もアプリケーションを起動
- 不要な処理をスキップして起動時間を短縮

### 方法2: マイグレーションをスキップして起動

緊急時は環境変数でマイグレーションをスキップできます：

```bash
# Renderダッシュボードで環境変数を追加
SKIP_MIGRATION=true
```

その後、手動でマイグレーションを実行：

```bash
# Renderシェルで実行
render shell simple-bookkeeping-api
cd /opt/render/project/src
./scripts/post-deploy-migrate.sh
```

### 方法3: 2段階デプロイメント

1. **第1段階: アプリケーションのみデプロイ**

   ```yaml
   # render.yaml
   startCommand: cd apps/api && node dist/index.js
   ```

2. **第2段階: デプロイ後にマイグレーション**

   ```bash
   ./scripts/render-migrate.sh
   ```

3. **第3段階: 通常の起動スクリプトに戻す**
   ```yaml
   # render.yaml
   startCommand: ./scripts/start-production-fast.sh
   ```

## 📝 デプロイメント手順

### 初回デプロイ時

1. **render.yamlの確認**

   ```yaml
   startCommand: ./scripts/start-production-fast.sh
   ```

2. **デプロイ実行**

   ```bash
   git push origin main
   ```

3. **デプロイ完了後、マイグレーション確認**

   ```bash
   # APIヘルスチェック
   curl https://simple-bookkeeping-api.onrender.com/health

   # 必要に応じて手動マイグレーション
   ./scripts/render-migrate.sh
   ```

### タイムアウトが発生した場合

1. **Renderダッシュボードで確認**
   - エラーメッセージを確認
   - ビルドログでタイムアウト箇所を特定

2. **環境変数を一時的に設定**

   ```bash
   # Renderダッシュボード > Environment
   SKIP_MIGRATION=true
   ```

3. **再デプロイ**
   - 「Manual Deploy」をクリック
   - 「Clear build cache & deploy」を選択

4. **デプロイ成功後、手動マイグレーション**

   ```bash
   render shell simple-bookkeeping-api
   cd /opt/render/project/src/packages/database
   npx prisma migrate deploy
   npx prisma generate
   ```

5. **環境変数を削除**
   - `SKIP_MIGRATION`を削除
   - 次回から通常のデプロイが可能

## 🎯 ベストプラクティス

### 1. マイグレーションの最適化

- 大きなマイグレーションは分割する
- インデックス作成は別のマイグレーションに分ける
- データ移行は別プロセスで実行

### 2. ビルド時間の短縮

- 不要な依存関係を削除
- devDependenciesを最小限に
- ビルドキャッシュを活用

### 3. 監視とアラート

- デプロイ後は必ずヘルスチェック
- エラーログを定期的に確認
- データベース接続を監視

## 🔍 トラブルシューティング

### Q: マイグレーションが常にタイムアウトする

A: 以下を確認してください：

1. データベースのレスポンス速度
2. マイグレーションファイルのサイズ
3. ネットワーク遅延

### Q: 502 Bad Gatewayが続く

A: 以下の手順を試してください：

1. `render logs simple-bookkeeping-api`でログ確認
2. データベース接続文字列を確認
3. 手動でサービスを再起動

### Q: マイグレーションがスキップされた

A: 手動で実行してください：

```bash
./scripts/post-deploy-migrate.sh
```

## 📚 関連ドキュメント

- [データベースマイグレーションガイド](./database-migration.md)
- [Renderデプロイメントガイド](./README.md)
- [トラブルシューティング](./troubleshooting.md)

## 🚀 推奨設定

現在の推奨設定は以下の通りです：

1. **render.yaml**

   ```yaml
   startCommand: ./scripts/start-production-fast.sh
   ```

2. **高速起動スクリプト使用**
   - マイグレーションタイムアウト: 30秒
   - 失敗時も起動継続

3. **定期的なメンテナンス**
   - 週次でマイグレーション状態確認
   - 月次でビルドキャッシュクリア

これらの対策により、Renderの無料プランでも安定したデプロイメントが可能になります。
