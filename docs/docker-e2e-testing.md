# Docker E2E Testing Environment

## 概要

このドキュメントでは、Docker Composeを使用した完全に独立したE2Eテスト環境の構築と使用方法について説明します。この環境により、ローカル開発環境とCI/CD環境の両方で一貫したテスト結果を得ることができます。

## 🎯 主な特徴

- **完全な環境分離**: ホストマシンのポートを使用しない内部ネットワーク
- **CI/CD対応**: GitHub ActionsでそのままSh可能
- **高速なビルド**: マルチステージビルドとキャッシュ戦略
- **デバッグ機能**: スクリーンショット、トレース、詳細ログ
- **柔軟な実行**: 特定のテストのみ実行、ウォッチモード対応

## 📋 前提条件

- Docker 20.10以上
- Docker Compose v2.0以上
- 8GB以上のメモリ（推奨）

## 🚀 クイックスタート

### 基本的な使用方法

```bash
# 1. すべてのE2Eテストを実行
make -f Makefile.docker test

# 2. 特定のテストファイルを実行
./scripts/docker-e2e-test.sh e2e/basic.spec.ts

# 3. パターンにマッチするテストを実行
./scripts/docker-e2e-test.sh --grep "login"

# 4. ウォッチモードで実行（UIモード）
make -f Makefile.docker test-watch

# 5. デバッグモードで実行
make -f Makefile.docker debug
```

### 環境のセットアップ

```bash
# Docker イメージをビルド
make -f Makefile.docker build

# サービスを起動（テストは実行しない）
make -f Makefile.docker start

# サービスの状態を確認
make -f Makefile.docker status

# ログを表示
make -f Makefile.docker logs
```

## 🏗️ アーキテクチャ

### Docker Compose 構成

```
┌─────────────────────────────────────────────────┐
│            Docker Network (172.28.0.0/16)        │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ PostgreSQL   │  │ API Server   │             │
│  │ (postgres-   │  │ (api-test)   │             │
│  │  test)       │◄─┤ Port: 3001   │             │
│  │ Port: 5432   │  │              │             │
│  └──────────────┘  └──────────────┘             │
│                            ▲                      │
│                            │                      │
│                     ┌──────────────┐             │
│                     │ Web Server   │             │
│                     │ (web-test)   │             │
│                     │ Port: 3000   │             │
│                     └──────────────┘             │
│                            ▲                      │
│                            │                      │
│                     ┌──────────────┐             │
│                     │ Playwright   │             │
│                     │ Test Runner  │             │
│                     └──────────────┘             │
│                                                   │
└─────────────────────────────────────────────────┘
```

### サービス詳細

#### 1. PostgreSQL (postgres-test)

- **イメージ**: postgres:16-alpine
- **用途**: テスト用データベース
- **特徴**: tmpfsによる高速I/O

#### 2. API Server (api-test)

- **ビルド**: apps/api/Dockerfile.test
- **用途**: バックエンドAPI
- **ヘルスチェック**: /api/v1/health

#### 3. Web Server (web-test)

- **ビルド**: apps/web/Dockerfile.test
- **用途**: Next.jsフロントエンド
- **ヘルスチェック**: /

#### 4. Playwright Runner

- **ビルド**: Dockerfile.playwright
- **用途**: E2Eテスト実行
- **ブラウザ**: Chromium（デフォルト）

## 🔧 設定

### 環境変数

```bash
# デバッグモード
DEBUG=true make -f Makefile.docker test

# コンテナを実行後も維持
KEEP_RUNNING=true make -f Makefile.docker test

# 複数ブラウザでテスト
BROWSERS="chromium firefox" make -f Makefile.docker test
```

### Docker Compose 設定のカスタマイズ

`docker-compose.test.yml` を編集して設定を変更できます：

```yaml
# ポートマッピングを有効化（デバッグ用）
services:
  web-test:
    ports:
      - '3010:3000' # コメントアウトを解除
```

## 🐛 トラブルシューティング

### よくある問題と解決方法

#### 1. コンテナが起動しない

```bash
# ログを確認
make -f Makefile.docker logs

# 個別のサービスログを確認
make -f Makefile.docker logs-api-test
```

#### 2. テストがタイムアウトする

```bash
# タイムアウト値を増やす
TEST_TIMEOUT=120000 make -f Makefile.docker test
```

#### 3. メモリ不足エラー

```bash
# Docker のメモリ制限を確認
docker system info | grep Memory

# 不要なコンテナとイメージを削除
docker system prune -a
```

#### 4. ビルドキャッシュの問題

```bash
# キャッシュなしでリビルド
make -f Makefile.docker rebuild
```

### デバッグ方法

```bash
# 1. Playwright コンテナ内でシェルを開く
make -f Makefile.docker shell

# 2. コンテナ内でテストを手動実行
cd /app/apps/web
npx playwright test --debug

# 3. スクリーンショットを確認
ls -la artifacts/
```

## 📊 テスト結果

### レポートの確認

テスト実行後、以下の場所に結果が保存されます：

- **HTML レポート**: `playwright-report/index.html`
- **JUnit XML**: `test-results/results.xml`
- **スクリーンショット**: `artifacts/`
- **トレースファイル**: `test-results/`

```bash
# HTML レポートを開く
open playwright-report/index.html

# トレースビューアーを開く
npx playwright show-trace test-results/trace.zip
```

## 🚀 CI/CD 統合

### GitHub Actions

`.github/workflows/e2e-docker.yml` が自動的に以下のタイミングで実行されます：

- main ブランチへのプッシュ
- Pull Request の作成・更新
- 手動トリガー（workflow_dispatch）

### ローカルでCIを再現

```bash
# CI環境と同じ設定でテスト
CI=true make -f Makefile.docker test
```

## 📈 パフォーマンス最適化

### ビルド時間の短縮

1. **マルチステージビルドの活用**

   ```dockerfile
   FROM base AS deps
   FROM deps AS build
   FROM base AS runtime
   ```

2. **キャッシュマウントの使用**

   ```dockerfile
   RUN --mount=type=cache,target=/root/.pnpm-store \
       pnpm install --frozen-lockfile
   ```

3. **並列ビルド**
   ```bash
   docker compose -f docker-compose.test.yml build --parallel
   ```

### テスト実行時間の短縮

1. **並列実行**

   ```bash
   TEST_WORKERS=4 make -f Makefile.docker test
   ```

2. **特定のプロジェクトのみ実行**
   ```bash
   ./scripts/docker-e2e-test.sh --project=chromium-desktop
   ```

## 🔐 セキュリティ考慮事項

- テスト環境専用の認証情報を使用
- 本番環境の情報は絶対に含めない
- ネットワークは完全に分離

## 📚 関連ドキュメント

- [E2Eテスト実装ガイド](./e2e-test-implementation.md)
- [Playwright設定](../apps/web/playwright.config.ts)
- [CI/CD設定](.github/workflows/)

## 🤝 貢献方法

1. 新しいテストケースの追加
2. Docker設定の改善提案
3. ドキュメントの更新

問題が発生した場合は、GitHubでIssueを作成してください。
