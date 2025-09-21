# npm スクリプトガイド

このガイドでは、プロジェクトで使用可能なnpmスクリプトコマンドを分類して説明します。

## 基本コマンド

最もよく使用する基本的なコマンドです。

| コマンド         | 説明                                   | 使用例           |
| ---------------- | -------------------------------------- | ---------------- |
| `pnpm dev`       | 開発サーバーを起動（すべてのサービス） | `pnpm dev`       |
| `pnpm build`     | すべてのアプリケーションをビルド       | `pnpm build`     |
| `pnpm start`     | プロダクションサーバーを起動           | `pnpm start`     |
| `pnpm test`      | すべてのテストを実行                   | `pnpm test`      |
| `pnpm lint`      | ESLintでコード品質をチェック           | `pnpm lint`      |
| `pnpm typecheck` | TypeScriptの型チェック                 | `pnpm typecheck` |

## ビルド関連

| コマンド              | 説明                                      | 使用例                |
| --------------------- | ----------------------------------------- | --------------------- |
| `pnpm build:packages` | 共有パッケージのみビルド                  | `pnpm build:packages` |
| `pnpm build:apps`     | アプリケーションのみビルド                | `pnpm build:apps`     |
| `pnpm build:web`      | Webアプリケーション専用ビルド（Vercel用） | `pnpm build:web`      |

## 開発補助

| コマンド            | 説明                             | 使用例              |
| ------------------- | -------------------------------- | ------------------- |
| `pnpm dev:ports`    | 使用ポートをチェック             | `pnpm dev:ports`    |
| `pnpm lint:fix`     | ESLintエラーを自動修正           | `pnpm lint:fix`     |
| `pnpm format`       | コードフォーマット実行           | `pnpm format`       |
| `pnpm format:check` | フォーマットチェックのみ         | `pnpm format:check` |
| `pnpm clean`        | ビルド成果物とnode_modulesを削除 | `pnpm clean`        |

## テスト関連

| コマンド             | 説明                               | 使用例               |
| -------------------- | ---------------------------------- | -------------------- |
| `pnpm test:watch`    | テストをウォッチモードで実行       | `pnpm test:watch`    |
| `pnpm test:coverage` | カバレッジレポート付きでテスト実行 | `pnpm test:coverage` |
| `pnpm test:e2e`      | E2Eテストを実行                    | `pnpm test:e2e`      |

## データベース関連

| コマンド          | 説明                                             | 使用例            |
| ----------------- | ------------------------------------------------ | ----------------- |
| `pnpm db:init`    | データベースを初期化（マイグレーション＋シード） | `pnpm db:init`    |
| `pnpm db:migrate` | マイグレーションを実行                           | `pnpm db:migrate` |
| `pnpm db:seed`    | シードデータを投入                               | `pnpm db:seed`    |
| `pnpm db:studio`  | Prisma Studioを起動                              | `pnpm db:studio`  |

## Docker関連

| コマンド           | 説明                 | 使用例             |
| ------------------ | -------------------- | ------------------ |
| `pnpm docker:up`   | Dockerコンテナを起動 | `pnpm docker:up`   |
| `pnpm docker:down` | Dockerコンテナを停止 | `pnpm docker:down` |
| `pnpm docker:logs` | Dockerログを表示     | `pnpm docker:logs` |

## デプロイメント監視

| コマンド             | 説明                     | 使用例                   |
| -------------------- | ------------------------ | ------------------------ |
| `pnpm deploy:check`  | Vercelのデプロイ状況確認 | `pnpm deploy:check`      |
| `pnpm vercel:status` | Vercelのデプロイ状況確認 | `pnpm vercel:status`     |
| `pnpm vercel:logs`   | Vercelのログ表示         | `pnpm vercel:logs build` |

## よく使うコマンドの組み合わせ

### 開発開始時

```bash
# ポートチェック → 開発サーバー起動
pnpm dev:ports && pnpm dev
```

### コミット前

```bash
# フォーマット → Lint → 型チェック → テスト
pnpm format && pnpm lint:fix && pnpm typecheck && pnpm test
```

### デプロイ前

```bash
# クリーンビルド → テスト実行
pnpm clean && pnpm install && pnpm build && pnpm test
```

### データベースリセット

```bash
# マイグレーション実行 → シードデータ投入
pnpm db:migrate && pnpm db:seed
```

## Tips

1. **並列実行**: Turboを使用しているため、依存関係のないタスクは自動的に並列実行されます

2. **フィルタリング**: 特定のパッケージのみ対象にする場合

   ```bash
   pnpm --filter @simple-bookkeeping/web dev
   pnpm --filter @simple-bookkeeping/database test
   ```

3. **環境変数**: direnvを使用している場合、プロジェクトディレクトリに入ると自動的に環境変数が設定されます

4. **ログの詳細度**: Turboのログレベルを調整
   ```bash
   TURBO_LOG_LEVEL=debug pnpm build
   ```
