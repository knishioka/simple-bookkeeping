# 環境変数管理ガイド

このドキュメントでは、simple-bookkeeping プロジェクトにおける環境変数の管理方法を説明します。

## 📁 整理済みファイル構成（2025年10月最新版）

### 現在使用するファイル（10個のみ）

```
.
├── .env.example                    # [Git管理] プロジェクト全体の設定テンプレート
├── .env.local                      # [Gitignore] Workspace全体の実際の設定
├── .env.local.example              # [Git管理] .env.local のテンプレート
├── .env.test.example               # [Git管理] テスト設定テンプレート（未使用）
├── .env.test.local.example         # [Git管理] テスト設定テンプレート（未使用）
├── .envrc                          # [Git管理] direnv設定（自動読み込み）
├── .envrc.example                  # [Git管理] direnvテンプレート
├── apps/web/.env.local             # [Gitignore] Next.js app実際の設定
├── apps/web/.env.test.example      # [Git管理] E2Eテスト設定テンプレート
└── packages/database/.env          # [Gitignore] Prisma設定（必要に応じて）
```

### 削除済みファイル（整理完了）

以下のファイルは2025年10月に整理・削除されました：

- `.env` - 空ファイルのため削除
- `.env.demo`, `.env.docker` - 古い設定
- `.env.local.simplified` - バックアップファイル
- `.env.production*` - 複数の重複ファイル
- `.env.vercel` - Vercel CLIが自動管理
- `.env.supabase.example` - 不要
- `apps/web/.env.local.backup` - バックアップ
- `apps/web/.env.production` - 不要
- `apps/web/.env.test` - .exampleで十分
- `apps/web/.env.vercel.production` - Vercel管理

## 📋 ファイル別の役割と使い方

### 1. リポジトリルート: `.env.local`

**場所**: `/Users/ken/Developer/private/simple-bookkeeping/.env.local`

**目的**: Workspace全体で共有される設定（CLIツール用）

**含まれる設定**:

- `SUPABASE_ACCESS_TOKEN`: Supabase CLI用アクセストークン
- `LOCAL_DB_URL`: ローカル開発用PostgreSQL接続文字列
- `PROD_DB_URL`: 本番DB接続文字列（psql/pgAdmin用）
- `VERCEL_TOKEN`: Vercel API Token（オプション）

**作成方法**:

```bash
# テンプレートからコピー
cp .env.local.example .env.local

# 必要な値を設定
# - SUPABASE_ACCESS_TOKEN: supabase login で取得
# - PROD_DB_URL: Supabase Dashboard > Settings > Database から取得
```

**使用例**:

```bash
# psqlでローカルDBに接続
psql $LOCAL_DB_URL

# psqlで本番DBに接続（管理作業時のみ）
psql $PROD_DB_URL -c "SELECT * FROM organizations LIMIT 10;"
```

### 2. Web アプリ: `apps/web/.env.local`

**場所**: `/Users/ken/Developer/private/simple-bookkeeping/apps/web/.env.local`

**目的**: Next.js Webアプリケーション固有の設定

**含まれる設定**:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase APIエンドポイント
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase匿名キー
- `E2E_USE_MOCK_AUTH`: E2Eテストでのモック認証フラグ

**環境切り替え方法**:

```bash
# ローカル開発モード（推奨）
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...（ローカル用キー）

# 本番デバッグモード（トラブルシューティング時のみ）
NEXT_PUBLIC_SUPABASE_URL=https://eksgzskroipxdwtbmkxm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...（本番用キー）
```

## 🔄 使い分けガイド

### 開発作業時

```bash
# 1. Supabaseをローカルで起動
pnpm supabase:start

# 2. apps/web/.env.local をローカルモードに設定
# （ローカルSupabaseの設定をコメント解除、本番をコメントアウト）

# 3. 開発サーバー起動
pnpm dev

# 4. ローカルDBを確認する場合
psql $LOCAL_DB_URL
# または
pnpm db:studio  # Prisma Studio
```

### 本番環境のデバッグ時

```bash
# 1. apps/web/.env.local を本番モードに設定
# （本番Supabaseの設定をコメント解除、ローカルをコメントアウト）

# 2. 開発サーバー起動（本番DBに接続）
pnpm dev

# 3. 本番DBを直接確認する場合
psql $PROD_DB_URL

# ⚠️ 作業後は必ずローカルモードに戻すこと！
```

### psql での DB 操作

```bash
# ローカルDB接続
psql $LOCAL_DB_URL

# よく使うコマンド例
psql $LOCAL_DB_URL -c "\dt"  # テーブル一覧
psql $LOCAL_DB_URL -c "SELECT * FROM organizations;"

# 本番DB接続（管理作業時のみ）
psql $PROD_DB_URL

# RLSポリシー確認（本番DB）
psql $PROD_DB_URL -c "SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'organizations';"
```

## 📋 チェックリスト

### 開発開始時

- [ ] `pwd` で作業ディレクトリ確認
- [ ] `apps/web/.env.local` がローカルモードになっているか確認
- [ ] `pnpm supabase:start` でローカルSupabase起動

### 本番デバッグ終了時

- [ ] `apps/web/.env.local` をローカルモードに戻す
- [ ] 本番DB接続を切断
- [ ] 不要なテストデータを削除（本番DBに作成した場合）

### コミット前

- [ ] `.env.local` ファイルが `.gitignore` に含まれているか確認
- [ ] パスワードやシークレットが含まれていないか確認
- [ ] `apps/web/.env.local` がローカルモードに戻っているか確認

## 🔐 セキュリティ注意事項

1. **絶対にコミットしない**
   - `.env.local` ファイルは `.gitignore` に含まれています
   - `git status` で Untracked になっていることを確認

2. **本番DB接続は慎重に**
   - 本番DBへの直接接続は必要最小限に
   - 作業後は即座に接続を切断
   - 読み取り専用クエリを推奨

3. **パスワードの取り扱い**
   - `PROD_DB_URL` のパスワードは定期的にローテーション
   - チーム内でも共有しない（各自で取得）
   - 画面共有時は環境変数を表示しない

## 🆘 トラブルシューティング

### Q: どの .env.local を使えばいいかわからない

**A**:

- **psql, Supabase CLI等**: リポジトリルートの `.env.local`
- **Next.jsアプリ開発**: `apps/web/.env.local`

### Q: 環境変数が反映されない

**A**:

```bash
# Next.js開発サーバーを再起動
# Ctrl+C で停止
pnpm dev
```

### Q: ローカルと本番のどちらに接続されているかわからない

**A**:

```bash
# apps/web/.env.local を確認
cat apps/web/.env.local | grep NEXT_PUBLIC_SUPABASE_URL
# → http://localhost:54321 ならローカル
# → https://eksgzskroipxdwtbmkxm.supabase.co なら本番
```

### Q: psql接続でパスワードエラーが出る

**A**:

```bash
# Supabase Dashboard でパスワードを確認
# Settings > Database > Connection String > Password
# 正しいパスワードで .env.local を更新
```

## 📚 関連ドキュメント

- [Supabaseガイドライン](./ai-guide/supabase-guidelines.md)
- [セキュリティとデプロイメント](./ai-guide/security-deployment.md)
- [npm スクリプトガイド](./npm-scripts-guide.md)
