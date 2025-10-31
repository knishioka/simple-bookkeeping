# direnv セットアップガイド

direnv は、ディレクトリに入ると自動的に環境変数を読み込むツールです。このプロジェクトでは、開発効率を向上させるために direnv を使用しています。

## インストール

### macOS

```bash
brew install direnv
```

### その他のOS

[公式インストールガイド](https://direnv.net/docs/installation.html) を参照してください。

## シェル設定

使用しているシェルに応じて、以下の設定を追加してください：

### bash (~/.bashrc)

```bash
eval "$(direnv hook bash)"
```

### zsh (~/.zshrc)

```bash
eval "$(direnv hook zsh)"
```

### fish (~/.config/fish/config.fish)

```fish
direnv hook fish | source
```

## プロジェクトでの使用方法

### 1. 初回セットアップ

```bash
# プロジェクトディレクトリに移動
cd /path/to/simple-bookkeeping

# direnv を有効化（初回のみ許可）
direnv allow
```

### 2. 環境変数の設定

direnv は以下の順番で環境変数を読み込みます：

1. `env/secrets/common.env` — 共有できる非機密デフォルト
2. `.env.local` — `scripts/env-manager.sh` が指す Supabase プロファイル
3. `env/secrets/vercel.env` — Vercel CLI/API 用トークンなど
4. `env/secrets/ai.env` — （任意）AI エージェント専用トークン

テンプレートは `env/templates/` に配置してあるので、以下のようにコピーして使用します：

```bash
mkdir -p env/secrets
cp env/templates/common.env.example env/secrets/common.env
cp env/templates/supabase.local.env.example env/secrets/supabase.local.env
cp env/templates/vercel.env.example env/secrets/vercel.env
# （任意）AI/自動化用トークンを分離したい場合
# cp env/templates/ai.env.example env/secrets/ai.env

# もしくは
# scripts/env-manager.sh bootstrap
scripts/env-manager.sh switch local
```

### 3. 提供される機能

direnv を有効化すると、以下の機能が利用可能になります：

#### 環境変数の自動読み込み

- `env/secrets/common.env` → `.env.local` → `env/secrets/vercel.env` の順に読み込み
- Node.js バージョンの自動切り替え（nvm 使用時）
- pnpm のパス設定

#### 便利なエイリアス

```bash
# 開発サーバー起動
dev

# ビルド
build

# テスト実行
test

# データベース操作
db:migrate
db:studio

# デプロイメント確認
vercel:status
vercel:logs
deploy:check
```

### 4. 環境確認

direnv が正しく設定されていると、ディレクトリに入った際に以下のような表示が出ます：

```
✅ direnv: Loaded environment for simple-bookkeeping
   Node.js: v18.17.0
   pnpm: 8.6.0
   Vercel API: not configured (set VERCEL_TOKEN)
```

## トラブルシューティング

### direnv: error .envrc is blocked

```bash
# .envrc への変更を承認
direnv allow
```

### 環境変数が読み込まれない

```bash
# direnv の状態を確認
direnv status

# 手動で再読み込み
direnv reload
```

### シェルフックが動作しない

シェルの設定ファイル（~/.bashrc, ~/.zshrc など）に `eval "$(direnv hook <shell>)"` が追加されているか確認し、シェルを再起動してください。

## セキュリティに関する注意

- `.envrc` ファイルは Git 管理から除外されています
- 機密情報は `env/secrets/` 配下に置き、テンプレートのみ Git 管理します
- チーム開発では `.envrc.example` を共有し、各自がカスタマイズしてください

## 参考リンク

- [direnv 公式ドキュメント](https://direnv.net/)
- [direnv Wiki](https://github.com/direnv/direnv/wiki)
