# Docs: Document script purposes and update README

## 🎯 概要

プロジェクトのドキュメントが不足・古くなっており、特にスクリプトの用途や使い分けが不明確です。新規開発者のオンボーディングを円滑にし、既存メンバーの作業効率を向上させるため、包括的なドキュメント更新を行います。

## 🔍 現状の問題点

### 1. ドキュメント不足の箇所

| ドキュメント           | 状態       | 影響                       |
| ---------------------- | ---------- | -------------------------- |
| scripts/README.md      | 存在しない | スクリプトの用途不明       |
| API仕様書              | 不完全     | エンドポイントの使い方不明 |
| 環境構築ガイド         | 古い       | セットアップに失敗         |
| デプロイメント手順     | 分散       | デプロイ方法が不明確       |
| トラブルシューティング | 不足       | 問題解決に時間がかかる     |

### 2. スクリプトの説明不足

```bash
# 現状：スクリプト名だけでは用途が不明
check-deployments.sh    # 何をチェック？
init-db.sh             # どのDB？どの環境？
render-logs.sh         # どのログ？フィルタは？
```

### 3. 更新されていない情報

- Node.jsバージョン要件
- 必要な環境変数
- 依存関係のインストール手順
- テスト実行方法

## 💡 推奨される解決策

### 1. scripts/README.mdの作成

```markdown
# Scripts Documentation

## 概要

このディレクトリには、開発・運用に使用するスクリプトが含まれています。

## スクリプト一覧

### デプロイメント監視

| スクリプト           | 用途                                  | 使用例                             |
| -------------------- | ------------------------------------- | ---------------------------------- |
| check-deployments.sh | Vercel/Renderの両方のデプロイ状態確認 | `./scripts/check-deployments.sh`   |
| render-logs.sh       | Renderのログ取得                      | `./scripts/render-logs.sh runtime` |
| vercel-logs.sh       | Vercelのログ取得                      | `./scripts/vercel-logs.sh build`   |

### データベース管理

| スクリプト | 用途                       | 使用例                 |
| ---------- | -------------------------- | ---------------------- |
| init-db.sh | ローカルDBの初期化とシード | `./scripts/init-db.sh` |

### ビルド・テスト

| スクリプト          | 用途                 | 使用例                          |
| ------------------- | -------------------- | ------------------------------- |
| check-full-build.sh | 全体のビルドチェック | `./scripts/check-full-build.sh` |
| prepush-check.sh    | push前の品質チェック | `./scripts/prepush-check.sh`    |

## 環境変数

各スクリプトで必要な環境変数：

- `DATABASE_URL`: データベース接続文字列
- `RENDER_API_KEY`: Render APIキー（render-\*.sh用）
- `VERCEL_TOKEN`: Vercelトークン（vercel-\*.sh用）
```

### 2. プロジェクトREADMEの更新

````markdown
# Simple Bookkeeping System

## 📋 目次

- [概要](#概要)
- [機能](#機能)
- [技術スタック](#技術スタック)
- [環境構築](#環境構築)
- [開発](#開発)
- [テスト](#テスト)
- [デプロイメント](#デプロイメント)
- [トラブルシューティング](#トラブルシューティング)

## 概要

日本の個人事業主・中小企業向けの複式簿記システム

## 機能

- ✅ 仕訳入力
- ✅ 勘定科目管理
- ✅ 会計期間管理
- ✅ 各種帳票出力
- ✅ ユーザー認証・権限管理

## 技術スタック

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL, Prisma
- **Testing**: Jest, Playwright
- **Deployment**: Vercel (Web), Render (API)

## 環境構築

### 必要要件

- Node.js 18.0.0以上
- pnpm 8.0.0以上
- PostgreSQL 14以上

### セットアップ手順

1. リポジトリのクローン
   ```bash
   git clone https://github.com/your-org/simple-bookkeeping.git
   cd simple-bookkeeping
   ```
````

2. 依存関係のインストール

   ```bash
   pnpm install
   ```

3. 環境変数の設定

   ```bash
   cp .env.example .env.local
   # .env.localを編集して必要な値を設定
   ```

4. データベースのセットアップ

   ```bash
   pnpm db:init
   ```

5. 開発サーバーの起動
   ```bash
   pnpm dev
   ```

## 開発

### よく使うコマンド

```bash
pnpm dev          # 全サービス起動
pnpm build        # ビルド
pnpm test         # テスト実行
pnpm lint         # Lintチェック
pnpm typecheck    # 型チェック
```

詳細は [npm-scripts-guide.md](./docs/npm-scripts-guide.md) を参照。

## テスト

### 単体テスト

```bash
pnpm test
```

### E2Eテスト

```bash
pnpm test:e2e
```

### カバレッジレポート

```bash
pnpm test:coverage
```

## デプロイメント

### Vercel (Web)

```bash
vercel --prod
```

### Render (API)

GitHub mainブランチへのpushで自動デプロイ

詳細は [deployment guide](./docs/deployment/) を参照。

## トラブルシューティング

### よくある問題

#### ポート競合

```bash
# ポート3000/3001が使用中の場合
lsof -i :3000
kill -9 <PID>
```

#### Prismaエラー

```bash
pnpm --filter @simple-bookkeeping/database prisma:generate
```

#### 型エラー

```bash
pnpm build:packages
```

詳細は [troubleshooting.md](./docs/troubleshooting.md) を参照。

````

### 3. API仕様書の作成
```markdown
# API Documentation

## Base URL
- Development: `http://localhost:3001/api/v1`
- Production: `https://api.simple-bookkeeping.com/api/v1`

## 認証
全てのAPIエンドポイントはJWT認証が必要です。

### ヘッダー
````

Authorization: Bearer <token>

````

## エンドポイント

### 認証 /auth

#### POST /auth/login
ログイン
```json
// Request
{
  "email": "user@example.com",
  "password": "password"
}

// Response
{
  "token": "jwt-token",
  "user": { ... }
}
````

### 仕訳 /journal-entries

#### GET /journal-entries

仕訳一覧取得

```
Query Parameters:
- page: ページ番号 (default: 1)
- limit: 件数 (default: 10)
- from: 開始日 (YYYY-MM-DD)
- to: 終了日 (YYYY-MM-DD)
```

#### POST /journal-entries

仕訳作成

```json
// Request
{
  "date": "2024-01-15",
  "description": "売上計上",
  "lines": [
    {
      "accountId": "uuid",
      "debitAmount": 1000,
      "creditAmount": 0
    }
  ]
}
```

````

### 4. 開発者向けガイドの作成
```markdown
# Developer Guide

## アーキテクチャ
````

apps/
├── web/ # Next.js Frontend
└── api/ # Express.js Backend
packages/
├── database/ # Prisma Schema
├── types/ # Shared Types
└── core/ # Business Logic

```

## コーディング規約
- [CLAUDE.md](./CLAUDE.md) - AIコーディングガイドライン
- TypeScript strictモード
- ESLint + Prettier

## Git ワークフロー
1. featureブランチを作成
2. コミット（Conventional Commits）
3. PR作成
4. レビュー
5. mainへマージ

## デバッグ
### VSCode設定
`.vscode/launch.json`に設定済み

### ログ
- Frontend: ブラウザコンソール
- Backend: `pnpm --filter api dev`の出力
```

## 📋 アクセプタンスクライテリア

- [ ] scripts/README.mdが作成されている
- [ ] 全スクリプトの用途が明文化されている
- [ ] プロジェクトREADMEが最新化されている
- [ ] API仕様書が完成している
- [ ] 環境構築手順が正確である
- [ ] トラブルシューティングガイドが充実している
- [ ] 新規開発者が迷わずセットアップできる

## 🏗️ 実装ステップ

1. **現状調査**（0.5日）
   - 既存ドキュメントの確認
   - スクリプトの動作確認
   - 不足情報のリストアップ

2. **スクリプトドキュメント作成**（1日）
   - scripts/README.md作成
   - 各スクリプトへのコメント追加
   - 使用例の作成

3. **プロジェクトドキュメント更新**（1.5日）
   - README.md更新
   - API仕様書作成
   - 開発者ガイド作成

4. **トラブルシューティング**（1日）
   - よくある問題の収集
   - 解決方法の文書化
   - FAQの作成

5. **レビューと改善**（0.5日）
   - チームレビュー
   - フィードバック反映
   - 最終確認

## ⏱️ 見積もり工数

- **総工数**: 4.5人日
- **優先度**: Low 🟢
- **影響度**: 開発効率と新規メンバーオンボーディング

## 🏷️ ラベル

- `documentation`
- `low-priority`
- `developer-experience`
- `good-first-issue`

## 📊 成功指標

- ドキュメントカバレッジ: 90%以上
- 新規開発者セットアップ時間: 1時間以内
- スクリプト実行エラー: 50%削減
- 質問数: 70%削減

## ⚠️ リスクと考慮事項

- **メンテナンスコスト**: ドキュメントの継続的な更新が必要
- **正確性**: 実装と乖離しないよう注意
- **多言語対応**: 将来的に英語版も必要かも
- **バージョン管理**: バージョン別のドキュメント管理

## 📝 ドキュメント構造案

```
docs/
├── README.md                 # 概要
├── getting-started/
│   ├── installation.md       # インストール
│   ├── configuration.md      # 設定
│   └── first-steps.md        # 初期設定
├── development/
│   ├── architecture.md       # アーキテクチャ
│   ├── coding-standards.md   # コーディング規約
│   └── testing.md           # テスト
├── deployment/
│   ├── vercel.md            # Vercelデプロイ
│   ├── render.md            # Renderデプロイ
│   └── troubleshooting.md   # トラブルシューティング
├── api/
│   ├── authentication.md    # 認証
│   ├── endpoints.md         # エンドポイント
│   └── examples.md          # 使用例
└── scripts/
    └── README.md            # スクリプト説明
```

## 🔄 継続的改善

1. **定期レビュー**: 月1回のドキュメントレビュー
2. **フィードバック収集**: 新規メンバーからの意見収集
3. **自動化**: 可能な部分はコードから自動生成
4. **バージョニング**: 重要な変更は変更履歴を記録

## 📚 参考資料

- [Write the Docs](https://www.writethedocs.org/)
- [Documentation Style Guide](https://developers.google.com/style)
- [README Best Practices](https://github.com/matiassingers/awesome-readme)
- [API Documentation Best Practices](https://swagger.io/resources/articles/best-practices-in-api-documentation/)
