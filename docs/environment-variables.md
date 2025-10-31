# 環境変数管理ガイド

このドキュメントでは、simple-bookkeeping プロジェクトにおける環境変数の構成と運用方法を説明します。  
2025 年 2 月以降、direnv と `env/` ディレクトリを中心とした運用に統一しました。

## 全体構成

```
.
├── env/
│   ├── README.md                    # 運用サマリ
│   ├── templates/                   # Git 管理されるテンプレート
│   │   ├── common.env.example
│   │   ├── supabase.local.env.example
│   │   ├── supabase.prod.env.example
│   │   ├── vercel.env.example
│   │   └── ai.env.example
│   └── secrets/                     # Gitignore（各自が作成）
│       ├── common.env               # 非機密デフォルト
│       ├── supabase.local.env       # ローカル Supabase プロファイル
│       ├── supabase.prod.env        # 本番 Supabase プロファイル（必要時のみ）
│       └── vercel.env               # Vercel CLI / API メタデータ
├── .env.local → env/secrets/supabase.local.env (symlink)
├── .env.local.example               # symlink 運用の説明
└── .envrc                           # direnv 設定（env/ と連携）
```

`direnv` は以下の順番でファイルを読み込みます。

1. `env/secrets/common.env`（存在すれば）
2. `.env.local`（`scripts/env-manager.sh` がプロファイルへ張るシンボリックリンク）
3. `env/secrets/vercel.env`
4. `env/secrets/ai.env`（任意：AI エージェント専用トークンなど）

`SUPABASE_DB_URL` が定義されている場合、`.envrc` が `DATABASE_URL` と `DIRECT_URL` にエクスポートするため、Prisma や CLI から追加設定なしで利用できます。

## 初期セットアップ

```bash
direnv allow  # 初回のみ

mkdir -p env/secrets
cp env/templates/common.env.example env/secrets/common.env
cp env/templates/supabase.local.env.example env/secrets/supabase.local.env
cp env/templates/vercel.env.example env/secrets/vercel.env
# 任意: automation 用トークンが必要な場合のみ
# cp env/templates/ai.env.example env/secrets/ai.env

# もしくは
# scripts/env-manager.sh bootstrap

# 本番 Supabase へ接続したい場合のみ:
# cp env/templates/supabase.prod.env.example env/secrets/supabase.prod.env

scripts/env-manager.sh switch local
```

主な項目は以下のファイルに記載します。

- `env/secrets/common.env`
  - `NODE_ENV`, `NEXT_PUBLIC_APP_URL`, `WEB_PORT`, `API_PORT`, `ENABLE_SWAGGER` などプロファイル共通の非機密設定。

- `env/secrets/supabase.local.env`
  - ローカル Supabase CLI / Docker 用 URL とキー (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)。
  - `SUPABASE_DB_URL`, `SUPABASE_STUDIO_URL`, `SUPABASE_API_URL` などローカル開発でのみ必要な値。

- `env/secrets/supabase.prod.env`
  - 本番 Supabase を参照したい場合にのみ作成。安全のため read-only トークンで運用し、`scripts/env-manager.sh switch prod` を実行するたびに確認プロンプトが表示されます。

- `env/secrets/vercel.env`
  - `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_NAME`, `VERCEL_PRODUCTION_URL`, `VERCEL_TOKEN` など Vercel CLI の参照情報。トークンは必要最小限のスコープで発行してください。

## プロファイルの切り替え

```bash
# 現在のプロファイル確認
scripts/env-manager.sh current

# 利用可能なプロファイル一覧
scripts/env-manager.sh list

# ローカル Supabase へ切り替え
scripts/env-manager.sh switch local

# 本番 Supabase へ切り替え（警告あり）
scripts/env-manager.sh switch prod
```

`.env.local` は常に `env/secrets/supabase.*.env` へのシンボリックリンクに置き換えられます。  
VS Code などで編集する際は `.env.local` を開くと実体ファイルが更新されます。

## よく使うコマンド

```bash
# direnv が読み込んだ値を確認
direnv status

# Supabase ローカル環境を起動
pnpm supabase:start

# Prisma Studio / psql
pnpm db:studio
psql "$SUPABASE_DB_URL"

# Vercel CLI で情報参照
vercel whoami
pnpm vercel:status
```

## チェックリスト

- [ ] `env/secrets/` が `.gitignore` に含まれていることを確認する（既定で追加済み）。
- [ ] `direnv allow` 実行後に `✅ direnv: Loaded environment for simple-bookkeeping` が表示される。
- [ ] `scripts/env-manager.sh current` の出力で `ENV_PROFILE` と `ENV_SUPABASE` が期待通りになっている。
- [ ] `VERCEL_TOKEN` や `SUPABASE_SERVICE_ROLE_KEY` は最小権限トークンを使用し、不要になったら速やかに無効化する。

## セキュリティと運用上の注意

- `env/secrets/` 配下のファイルは **絶対に Git にコミットしない**。共有が必要な場合は 1Password や Vault などの Secret Manager を使用してください。
- automation や AI へトークンを渡す場合は `env/secrets/ai.env` に別トークンを発行し、利用範囲を限定してください。
- 本番プロファイルで作業した後は `scripts/env-manager.sh switch local` を実行し、誤操作による本番データ更新を防ぎます。
- Vercel CLI で `.env.local` に書き出す `vercel env pull` を使用する場合は、作成されたファイルがシンボリックリンクを上書きしないよう注意してください（必要に応じて `env-manager.sh switch local` で再生成）。

詳細は `env/README.md` と `docs/direnv-setup.md` を参照してください。
