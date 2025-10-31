# Environment Management Guide

## 概要

このガイドでは、simple-bookkeepingプロジェクトの環境管理システムについて詳しく説明します。プロジェクトは3つの異なる環境プロファイルをサポートし、それぞれの環境で適切なSupabase設定を使用できます。

## 目次

- [環境プロファイル](#環境プロファイル)
- [環境の切り替え](#環境の切り替え)
- [Supabase操作](#supabase操作)
- [Vercel環境変数管理](#vercel環境変数管理)
- [トラブルシューティング](#トラブルシューティング)
- [ベストプラクティス](#ベストプラクティス)

## 環境プロファイル

### サポートされる環境

| 環境名             | プロファイル | ファイル                                  | 用途                 | Supabase URL                             |
| ------------------ | ------------ | ----------------------------------------- | -------------------- | ---------------------------------------- |
| ローカル開発       | `local`      | `env/secrets/supabase.local.env`          | ローカルSupabase使用 | http://localhost:54321                   |
| 本番接続ローカル   | `prod`       | `env/secrets/supabase.prod.env`           | 本番Supabase使用     | https://eksgzskroipxdwtbmkxm.supabase.co |
| Vercelデモサーバー | N/A          | Vercel環境変数 / `env/secrets/vercel.env` | デモ環境             | https://eksgzskroipxdwtbmkxm.supabase.co |

### 環境ファイル構造

```
/Users/ken/Developer/private/simple-bookkeeping/
├── .env.local                      # 現在アクティブな環境（シンボリックリンク）
├── env/
│   ├── README.md
│   ├── templates/…               # 共有されるテンプレート
│   └── secrets/
│       ├── common.env            # 非機密デフォルト
│       ├── supabase.local.env    # ローカルSupabase環境設定
│       ├── supabase.prod.env     # 本番Supabase環境設定
│       └── vercel.env            # Vercel CLI/デプロイ情報
```

**重要**: `.env.local` は `env/secrets/supabase.*.env` へのシンボリックリンクです。

### 環境識別子

各環境ファイルには識別用の環境変数が含まれています：

```bash
# env/secrets/supabase.local.env
ENV_PROFILE=local
ENV_SUPABASE=local

# env/secrets/supabase.prod.env
ENV_PROFILE=local-with-production-supabase
ENV_SUPABASE=production
```

## 初期セットアップ

```bash
direnv allow  # 初回のみ
scripts/env-manager.sh bootstrap
scripts/env-manager.sh switch local
```

`bootstrap` はテンプレートを `env/secrets/` にコピーします（既存ファイルは保持）。その後、必要な値を編集してから `switch local` でプロファイルを有効化してください。

## 環境の切り替え

### 基本的な切り替えコマンド

#### 現在の環境を確認

```bash
pnpm env:current
```

出力例：

```
═══════════════════════════════════════════════════════
Current Environment Configuration
═══════════════════════════════════════════════════════

[INFO] Configuration: Symlink to env/secrets/supabase.local.env

--- Environment Identifiers ---
[SUCCESS] ENV_PROFILE: local
[SUCCESS] ENV_SUPABASE: local

--- Supabase Configuration ---
[INFO] Supabase URL: http://localhost:54321
[SUCCESS] Anon Key: Configured
[SUCCESS] Service Role Key: Configured
```

#### 利用可能な環境を一覧表示

```bash
pnpm env:list
```

#### 環境を切り替え

```bash
# ローカルSupabaseに切り替え（安全）
pnpm env:switch local

# 本番Supabaseに切り替え（警告表示あり）
pnpm env:switch prod
```

### 環境切り替えのワークフロー

#### 1. ローカル環境への切り替え

```bash
# 1. 現在の環境を確認
pnpm env:current

# 2. ローカル環境に切り替え
pnpm env:switch local

# 3. ローカルSupabaseを起動
pnpm supabase:start

# 4. 開発サーバーを再起動
pnpm dev
```

#### 2. 本番環境への切り替え（慎重に！）

```bash
# 1. 現在の作業を保存
git add .
git stash

# 2. 本番環境に切り替え
pnpm env:switch prod
# ⚠️ 警告メッセージを確認し、'y' で承認

# 3. 環境設定を検証
pnpm env:check

# 4. 開発サーバーを再起動
pnpm dev
```

### 環境切り替え時の注意事項

#### ⚠️ 本番環境切り替え時の警告

本番環境に切り替えると、以下の警告が表示されます：

```
═══════════════════════════════════════════════════════
  ⚠️  PRODUCTION ENVIRONMENT WARNING  ⚠️
═══════════════════════════════════════════════════════

You are about to connect to PRODUCTION Supabase
All database operations will affect LIVE data

Before proceeding:
  1. Ensure you have proper backups
  2. Test all changes on local first
  3. Understand the impact of your changes
```

#### 環境切り替え後の必須手順

1. **開発サーバーの再起動**

   ```bash
   # 既存のサーバーを停止（Ctrl+C）
   pnpm dev
   ```

2. **Supabaseの起動確認**（ローカル環境の場合）

   ```bash
   pnpm supabase:status
   pnpm supabase:start  # 必要に応じて
   ```

3. **接続テスト**
   ```bash
   pnpm sb:status
   ```

## Supabase操作

### 基本コマンド

#### 状態確認

```bash
# Supabaseサービス状態を確認
pnpm sb:status
```

出力例（ローカル環境）：

```
═══════════════════════════════════════════════════════
Supabase Service Status
═══════════════════════════════════════════════════════

[INFO] Environment: local
[INFO] Supabase URL: http://localhost:54321

--- Local Services ---
API URL: http://localhost:54321
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
[SUCCESS] Supabase API: Online (http://localhost:54321)
[SUCCESS] PostgreSQL: Running (port 54322)
[SUCCESS] Studio: Available (http://localhost:54323)
```

### PostgreSQL操作

#### 対話型SQLシェル

```bash
# psqlを起動
pnpm sb:psql
```

ローカル環境では自動的に `postgresql://postgres:postgres@localhost:54322/postgres` に接続します。

#### SQLクエリの実行

```bash
# 単一クエリ実行
pnpm sb:query "SELECT * FROM users LIMIT 5"

# テーブル一覧を表示
pnpm sb:query "\dt"

# ユーザー数をカウント
pnpm sb:query "SELECT COUNT(*) FROM users"
```

#### SQLファイルの実行

```bash
# シードデータを投入
pnpm sb:file supabase/seeds/sample-data.sql

# マイグレーションファイルを実行
pnpm sb:file supabase/migrations/20240101000000_create_tables.sql
```

### マイグレーション管理

#### 新規マイグレーション作成

```bash
# マイグレーションファイルを生成
pnpm sb:migrate new add_users_table

# 生成されるファイル: supabase/migrations/TIMESTAMP_add_users_table.sql
```

#### マイグレーションの適用

```bash
# ローカル環境にマイグレーション適用
pnpm sb:migrate up

# 本番環境にマイグレーション適用（慎重に！）
# 環境を `prod` に切り替えてから実行
pnpm sb:migrate up
```

#### マイグレーション状態確認

```bash
# 適用済みマイグレーション一覧
pnpm sb:migrate status
```

### データベースリセット

```bash
# ⚠️ ローカル環境のみ使用可能
pnpm sb:reset
```

このコマンドは：

- すべてのデータを削除
- マイグレーションを再適用
- シードデータを投入（設定されている場合）

**注意**: 本番環境では実行できません。

### TypeScript型生成

```bash
# データベーススキーマからTypeScript型を生成
pnpm sb:types
```

生成されるファイル: `apps/web/lib/supabase/database.types.ts`

使用例：

```typescript
import type { Database } from '@/lib/supabase/database.types';

type User = Database['public']['Tables']['users']['Row'];
```

## Vercel環境変数管理

### 読み取り専用操作

これらの操作は常に安全です：

```bash
# すべての環境変数を一覧表示（本番環境）
pnpm vercel:env:list

# プレビュー環境の変数を表示
pnpm vercel:env:list --env preview

# 特定の変数を取得
pnpm vercel:env:get NEXT_PUBLIC_SUPABASE_URL

# Vercel設定を検証
pnpm vercel:env:validate
```

### 書き込み操作

これらの操作は確認プロンプトが表示されます：

#### 環境変数の追加

```bash
# 本番環境に変数を追加
pnpm vercel:env:add MY_VAR my_value --env production

# 確認をスキップして追加（慎重に使用）
pnpm vercel:env:add MY_VAR my_value --env production --yes
```

#### 環境変数の削除

```bash
# 本番環境から変数を削除
pnpm vercel:env:rm MY_VAR --env production
```

#### 環境変数のプル

```bash
# 本番環境の変数をファイルにダウンロード
pnpm vercel:env:pull --env production .env.vercel.prod

# プレビュー環境の変数をダウンロード
pnpm vercel:env:pull --env preview .env.vercel.preview
```

**⚠️ 注意**: ダウンロードしたファイルには機密情報が含まれます。`.gitignore`に含まれていることを確認してください。

### Supabase設定の同期

Supabase設定をVercelに同期するには：

```bash
pnpm vercel:env:sync
```

このコマンドは対話的に以下を実行します：

1. 既存のSupabase環境変数を削除
2. `NEXT_PUBLIC_SUPABASE_URL` を設定
3. `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定（手動入力）
4. `SUPABASE_SERVICE_ROLE_KEY` を設定（手動入力）

キーの取得先：
https://supabase.com/dashboard/project/eksgzskroipxdwtbmkxm/settings/api

### Dry-runモード

実行前に変更内容を確認できます：

```bash
# 変更内容のプレビュー
pnpm vercel:env:add MY_VAR value --dry-run
pnpm vercel:env:rm OLD_VAR --dry-run
```

## トラブルシューティング

### 問題1: 環境変数が反映されない

**症状**: 環境を切り替えても設定が変わらない

**解決策**:

```bash
# 1. シンボリックリンクを確認
ls -la .env.local
# 出力例: .env.local -> env/secrets/supabase.local.env

# 2. 環境設定を確認
pnpm env:current

# 3. 開発サーバーを完全に再起動
# Ctrl+C で停止後
pnpm dev
```

### 問題2: Supabase接続エラー

**症状**: `Failed to connect to Supabase`

**ローカル環境の場合**:

```bash
# 1. Supabaseステータス確認
pnpm supabase:status

# 2. Supabaseが停止している場合は起動
pnpm supabase:start

# 3. ポート競合を確認
lsof -i :54321
lsof -i :54322
```

**本番環境の場合**:

```bash
# 1. 環境設定を確認
pnpm env:current

# 2. Supabase URLを確認
grep NEXT_PUBLIC_SUPABASE_URL .env.local

# 3. Supabase Dashboardで状態確認
# https://supabase.com/dashboard/project/eksgzskroipxdwtbmkxm
```

### 問題3: マイグレーション失敗

**症状**: `Migration failed`

**解決策**:

```bash
# 1. マイグレーション履歴を確認
pnpm sb:migrate status

# 2. ローカル環境ならリセット
pnpm sb:reset

# 3. マイグレーションファイルを確認
cat supabase/migrations/TIMESTAMP_migration_name.sql

# 4. 手動でSQLを実行して確認
pnpm sb:psql
# psql内で: \i supabase/migrations/TIMESTAMP_migration_name.sql
```

### 問題4: Vercel環境変数が反映されない

**症状**: Vercelデプロイ後にSupabaseに接続できない

**解決策**:

```bash
# 1. Vercel環境変数を検証
pnpm vercel:env:validate

# 2. 環境変数一覧を確認
pnpm vercel:env:list --env production

# 3. 再デプロイ
vercel --prod

# 4. デプロイメントログを確認
pnpm vercel:logs runtime
```

### 問題5: psqlが見つからない

**症状**: `psql: command not found`

**解決策**:

macOSの場合：

```bash
brew install postgresql
```

Ubuntuの場合：

```bash
sudo apt-get install postgresql-client
```

## ベストプラクティス

### 開発フロー

#### 日常的な開発

```bash
# 1. プロジェクトディレクトリに移動
cd /Users/ken/Developer/private/simple-bookkeeping

# 2. 環境確認
pnpm env:current

# 3. ローカルSupabase起動
pnpm supabase:start

# 4. 開発サーバー起動
pnpm dev
```

#### 本番データベースでの作業が必要な場合

```bash
# 1. 現在の作業を保存
git add .
git commit -m "WIP: current changes"

# 2. ローカルでテスト
pnpm env:switch local
pnpm sb:reset  # クリーンな状態から開始
# マイグレーションやクエリをテスト

# 3. 本番環境に切り替え
pnpm env:switch prod

# 4. バックアップを確認
# Supabase Dashboardでバックアップを確認

# 5. 慎重に実行
pnpm sb:migrate up
# または
pnpm sb:query "YOUR_SAFE_QUERY"

# 6. ローカル環境に戻す
pnpm env:switch local
```

### 環境別の使用ガイドライン

#### Local環境（推奨）

**用途**:

- 日常的な開発
- 新機能のテスト
- マイグレーションのテスト
- データベーススキーマの変更

**利点**:

- 完全に隔離された環境
- 自由にリセット可能
- 失敗しても影響なし

```bash
pnpm env:switch local
pnpm sb:reset  # 何度でもリセット可能
```

#### Production環境（制限的使用）

**用途**:

- 本番データの確認
- 緊急のデータ修正
- 本番環境のデバッグ

**注意事項**:

- すべての操作がライブデータに影響
- 必ずローカルでテスト後に実行
- バックアップを確認
- `--dry-run` を使用

```bash
pnpm env:switch prod

# ✅ 安全な操作
pnpm sb:status
pnpm sb:query "SELECT * FROM users LIMIT 1"  # 読み取り専用

# ⚠️ 注意が必要な操作
pnpm sb:migrate up  # 必ずローカルでテスト後

# ❌ 絶対禁止
pnpm sb:reset  # 本番環境では実行不可
```

#### Vercel環境（デプロイメント）

**用途**:

- デモ環境の提供
- 本番環境のプレビュー
- ステージング環境

**管理方法**:

```bash
# 環境変数の確認
pnpm vercel:env:list

# 環境変数の更新（慎重に）
pnpm vercel:env:sync

# デプロイ
vercel --prod
```

### Claude Codeへの推奨事項

Claude Codeがこのプロジェクトで作業する際は：

1. **作業開始時に環境確認**

   ```bash
   pnpm env:current
   pnpm sb:status
   ```

2. **デフォルトはローカル環境**
   - 明示的な指示がない限り `local` 環境を使用
   - 本番環境への操作はユーザーの明示的な承認が必要

3. **本番操作の前に確認**
   - ユーザーに操作内容を説明
   - リスクを明確に伝える
   - 承認を得てから実行

4. **環境切り替え後の確認**
   - 開発サーバーの再起動を促す
   - Supabase接続を確認
   - 環境識別子を確認

## スクリプトリファレンス

### 環境管理スクリプト

| コマンド           | スクリプト                        | 説明             |
| ------------------ | --------------------------------- | ---------------- |
| `pnpm env:list`    | `scripts/env-manager.sh list`     | 環境一覧表示     |
| `pnpm env:current` | `scripts/env-manager.sh current`  | 現在の環境表示   |
| `pnpm env:switch`  | `scripts/env-manager.sh switch`   | 環境切り替え     |
| `pnpm env:check`   | `scripts/env-manager.sh validate` | 環境設定検証     |
| `pnpm env:diff`    | `scripts/env-manager.sh diff`     | 環境間の差分表示 |

### Supabase操作スクリプト

| コマンド          | スクリプト                          | 説明                       |
| ----------------- | ----------------------------------- | -------------------------- |
| `pnpm sb:status`  | `scripts/supabase-tools.sh status`  | Supabase状態確認           |
| `pnpm sb:psql`    | `scripts/supabase-tools.sh psql`    | psqlシェル起動             |
| `pnpm sb:query`   | `scripts/supabase-tools.sh query`   | SQLクエリ実行              |
| `pnpm sb:file`    | `scripts/supabase-tools.sh file`    | SQLファイル実行            |
| `pnpm sb:migrate` | `scripts/supabase-tools.sh migrate` | マイグレーション管理       |
| `pnpm sb:reset`   | `scripts/supabase-tools.sh reset`   | DBリセット（ローカルのみ） |
| `pnpm sb:types`   | `scripts/supabase-tools.sh types`   | TypeScript型生成           |
| `pnpm sb:logs`    | `scripts/supabase-tools.sh logs`    | ログ表示                   |

### Vercel環境変数スクリプト

| コマンド                   | スクリプト                               | 説明             |
| -------------------------- | ---------------------------------------- | ---------------- |
| `pnpm vercel:env:list`     | `scripts/vercel-env-manager.sh list`     | 環境変数一覧     |
| `pnpm vercel:env:get`      | `scripts/vercel-env-manager.sh get`      | 変数取得         |
| `pnpm vercel:env:add`      | `scripts/vercel-env-manager.sh add`      | 変数追加         |
| `pnpm vercel:env:rm`       | `scripts/vercel-env-manager.sh rm`       | 変数削除         |
| `pnpm vercel:env:pull`     | `scripts/vercel-env-manager.sh pull`     | 変数ダウンロード |
| `pnpm vercel:env:sync`     | `scripts/vercel-env-manager.sh sync`     | Supabase設定同期 |
| `pnpm vercel:env:validate` | `scripts/vercel-env-manager.sh validate` | 設定検証         |

## セキュリティ考慮事項

### 機密情報の取り扱い

1. **環境ファイルの管理**
   - `env/secrets/supabase.local.env` と `env/secrets/supabase.prod.env` は `.gitignore` に含まれています
   - 本番環境のService Role Keyは絶対にコミットしない
   - 環境ファイルのバックアップは暗号化して保存

2. **本番環境のアクセス制限**
   - 本番環境への切り替えは必要最小限に
   - 操作ログを記録（将来実装予定）
   - 複数人での作業時は Slack等で通知

3. **Vercel環境変数**
   - Vercel Dashboardから削除しない限り永続化
   - `vercel env pull` を使用する場合は `.env.local` ではなく一時ファイル（例: `./tmp/vercel.env`）に書き出し、内容を見た後は速やかに破棄
   - 不要になったら `rm .env.vercel.*` で削除

### 推奨される権限設定

```bash
# 環境ファイルの権限を制限
chmod 600 env/secrets/supabase.*.env
chmod 600 .env.local

# スクリプトの実行権限
chmod +x scripts/env-manager.sh
chmod +x scripts/supabase-tools.sh
chmod +x scripts/vercel-env-manager.sh
```

## まとめ

- **ローカル環境**: 日常的な開発に使用。自由にリセット可能
- **本番環境**: 必要最小限の使用。すべての操作を慎重に
- **環境切り替え**: `pnpm env:switch` で簡単に切り替え可能
- **Supabase操作**: 統一されたCLIで一貫した操作
- **Vercel管理**: 安全な環境変数管理ツール

---

**Version**: 1.0.0
**Last Updated**: 2025-10-27
**Maintainer**: @ken
