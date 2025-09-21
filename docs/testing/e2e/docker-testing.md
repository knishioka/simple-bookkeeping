# Docker E2E Testing Environment

このドキュメントでは、Docker Composeを使用した独立したE2Eテスト環境について説明します。

## 概要

Docker E2Eテスト環境は以下の特徴を持ちます：

- **完全に独立**: 開発環境から分離されたテスト専用環境
- **CI環境との一致**: GitHub ActionsのCI環境と同じ構成
- **再現可能**: 毎回クリーンな状態からテストを実行
- **ポート分離**: 開発環境と異なるポートを使用（競合を回避）

## 構成

| サービス      | ポート | 説明                          |
| ------------- | ------ | ----------------------------- |
| supabase-test | 54321  | Supabase Studio（テスト用）   |
| postgres-test | 54323  | PostgreSQL 16（テスト専用DB） |
| web-test      | 3010   | Next.js Web（テスト用）       |
| playwright    | -      | Playwrightテストランナー      |

## 使用方法

### 基本的なテスト実行

```bash
# 全テストを実行
pnpm test:e2e:docker

# 特定のテストのみ実行
pnpm test:e2e:docker:auth

# ブラウザを表示しながら実行（デバッグ用）
pnpm test:e2e:docker:headed
```

### 詳細オプション

```bash
# スクリプトを直接実行
./scripts/e2e-test.sh [OPTIONS]

# オプション一覧
--no-cleanup     # テスト後にコンテナを残す
--no-build       # コンテナのビルドをスキップ
--headed         # ブラウザを表示（非ヘッドレス）
--browser NAME   # ブラウザ指定（chromium, firefox, webkit）
--test PATTERN   # 特定のテストパターンを実行
--timeout SEC    # テストタイムアウト（デフォルト: 30秒）
--help           # ヘルプを表示
```

### 使用例

```bash
# 認証テストのみをFirefoxで実行
./scripts/e2e-test.sh --test "auth-test.spec.ts" --browser firefox

# デバッグモード（ブラウザ表示、コンテナ保持）
./scripts/e2e-test.sh --headed --no-cleanup

# 特定のテストを高速実行
./scripts/e2e-test.sh --test "basic.spec.ts" --no-build --timeout 15
```

## CI環境との違い

### 従来の問題

| 環境     | 実行方法                 | 課題                               |
| -------- | ------------------------ | ---------------------------------- |
| ローカル | 開発サーバー上でテスト   | 開発環境に依存、状態の影響を受ける |
| CI       | 独立したコンテナでテスト | ローカルで再現困難                 |

### Docker E2E環境での解決

| 環境     | 実行方法               | メリット                       |
| -------- | ---------------------- | ------------------------------ |
| ローカル | Docker Composeでテスト | CI環境と同じ構成、独立した環境 |
| CI       | GitHub Actionsでテスト | ローカルと同じ構成で実行       |

## トラブルシューティング

### よくある問題

1. **ポート競合**

   ```bash
   # 開発サーバーが起動している場合は停止
   pnpm dev:stop

   # または異なるポートを使用
   docker compose -f docker-compose.test.yml down
   ```

2. **Docker容量不足**

   ```bash
   # 不要なコンテナとボリュームを削除
   docker system prune -a --volumes
   ```

3. **テストがタイムアウト**
   ```bash
   # タイムアウト時間を延長
   ./scripts/e2e-test.sh --timeout 60
   ```

### デバッグ方法

1. **コンテナを残してデバッグ**

   ```bash
   ./scripts/e2e-test.sh --no-cleanup

   # 各サービスの状態を確認
   docker compose -f docker-compose.test.yml ps
   docker compose -f docker-compose.test.yml logs web-test
   docker compose -f docker-compose.test.yml logs postgres-test
   ```

2. **手動でコンテナにアクセス**

   ```bash
   # Webサーバーに接続
   docker compose -f docker-compose.test.yml exec web-test sh

   # データベースに接続
   docker compose -f docker-compose.test.yml exec postgres-test psql -U postgres postgres

   # Supabase Studioにアクセス
   open http://localhost:54321
   ```

3. **ブラウザを表示してテスト**
   ```bash
   # ヘッドレスモードを無効化
   ./scripts/e2e-test.sh --headed --no-cleanup
   ```

## パフォーマンス最適化

### 初回実行

```bash
# イメージを事前ビルド
docker compose -f docker-compose.test.yml build

# 依存関係のキャッシュ
docker compose -f docker-compose.test.yml pull
```

### 継続実行

```bash
# ビルドをスキップして高速実行
./scripts/e2e-test.sh --no-build
```

### 部分テスト

```bash
# 特定のテストのみ実行
./scripts/e2e-test.sh --test "auth-test.spec.ts"
./scripts/e2e-test.sh --test "basic.spec.ts"
```

## メンテナンス

### 定期的なクリーンアップ

```bash
# テスト環境のリセット
docker compose -f docker-compose.test.yml down --volumes --rmi all

# システム全体のクリーンアップ
docker system prune -a --volumes
```

### アップデート

```bash
# Playwrightイメージの更新
docker pull mcr.microsoft.com/playwright:v1.48.0-focal

# 全体の再ビルド
docker compose -f docker-compose.test.yml build --no-cache
```

## Issue #107との関連

この Docker E2E環境は Issue #107「CI環境での認証モックテストの改善」を解決するために導入されました：

- **CI環境の問題をローカルで再現**: Docker環境でCI同様のテストが可能
- **認証モックの安定性向上**: 独立した環境でのテスト実行
- **デバッグの容易さ**: ローカルでCI環境と同じ問題を調査可能

### 認証テストの実行

```bash
# 認証テストの実行
pnpm test:e2e:docker:auth

# デバッグモードで認証テスト
./scripts/e2e-test.sh --test "auth-test.spec.ts" --headed --no-cleanup
```
