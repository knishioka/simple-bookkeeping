# データベースマイグレーションガイド

## 概要

本ドキュメントは、Simple Bookkeepingアプリケーションのデータベースマイグレーション方法について説明します。

## 🔄 自動マイグレーション（推奨）

### Renderでの自動マイグレーション

v0.2.0以降、Renderへのデプロイ時に自動的にデータベースマイグレーションが実行されます。

**仕組み:**

1. `scripts/start-production.sh` がアプリケーション起動前に実行される
2. Prismaマイグレーションが自動的に適用される
3. エラーが発生してもアプリケーションは起動する（エラーログに記録）

**設定ファイル:**

- `render.yaml` - startCommandで自動マイグレーションスクリプトを指定
- `scripts/start-production.sh` - マイグレーションとアプリケーション起動を管理

## 🛠️ 手動マイグレーション

### 方法1: Render CLIを使用（推奨）

```bash
# Render CLIがインストールされていることを確認
brew install render

# マイグレーションを実行
./scripts/render-migrate.sh

# または特定のサービスを指定
./scripts/render-migrate.sh simple-bookkeeping-api
```

### 方法2: Renderシェルに直接接続

```bash
# Renderシェルに接続
render shell simple-bookkeeping-api

# 接続後、以下のコマンドを実行
cd /opt/render/project/src/packages/database
npx prisma migrate deploy
npx prisma generate

# サービスを再起動（Renderダッシュボードから）
```

### 方法3: ローカルから手動実行

```bash
# 環境変数を設定（.env.localまたは環境変数）
export DATABASE_URL="postgresql://..."

# マイグレーションスクリプトを実行
bash scripts/manual-migrate.sh

# 開発環境の場合
bash scripts/manual-migrate.sh --env development
```

## 🚨 トラブルシューティング

### 500エラーが発生する場合

1. **症状**: 補助簿（現金出納帳など）を開くと500エラー
2. **原因**: データベーススキーマが最新でない
3. **解決方法**:

   ```bash
   # 手動マイグレーションを実行
   ./scripts/render-migrate.sh

   # またはRenderダッシュボードから「Manual Deploy」を実行
   ```

### マイグレーションが失敗する場合

1. **データベース接続を確認**:

   ```bash
   # Renderシェルで接続テスト
   render shell simple-bookkeeping-api
   npx prisma db pull --print
   ```

2. **強制リセット（データが失われます！）**:
   ```bash
   # ⚠️ 警告: すべてのデータが削除されます
   bash scripts/manual-migrate.sh --force-reset
   ```

### エラーコードの意味

- `P2021`: テーブルが存在しない → マイグレーションが必要
- `P2022`: カラムが存在しない → マイグレーションが必要
- `DB_SCHEMA_ERROR`: スキーマ不整合 → 手動マイグレーションを実行

## 📝 マイグレーション履歴

| 日付       | マイグレーション名        | 説明                   |
| ---------- | ------------------------- | ---------------------- |
| 2025-01-04 | add_name_kana_to_accounts | 勘定科目にカナ名を追加 |
| 2025-01-10 | initial_schema            | 初期スキーマ           |
| 2025-01-11 | add_multi_tenant_support  | マルチテナント対応     |
| 2025-06-28 | add_is_system             | システムフラグを追加   |
| 2025-06-28 | fix_schema_sync           | スキーマ同期の修正     |

## 🔍 ログの確認

```bash
# Renderのランタイムログを確認
pnpm render:logs runtime

# エラーログのみ表示
pnpm render:logs errors

# ビルドログを確認
pnpm render:logs build
```

## 📚 関連ドキュメント

- [Renderデプロイメントガイド](./README.md)
- [トラブルシューティング](./troubleshooting.md)
- [Prisma公式ドキュメント](https://www.prisma.io/docs/concepts/components/prisma-migrate)
