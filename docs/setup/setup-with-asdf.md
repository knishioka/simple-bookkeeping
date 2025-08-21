# 🔧 asdfを使った開発環境セットアップ

## asdfとは

asdfは複数の言語/ツールのバージョンを統一管理できるツールです。
このプロジェクトでは、Node.jsとpnpmのバージョンを管理します。

## セットアップ手順

### 1. asdfのインストール

#### macOS (Homebrew)

```bash
brew install asdf

# シェルへの追加（zshの場合）
echo -e "\n. $(brew --prefix asdf)/libexec/asdf.sh" >> ${ZDOTDIR:-~}/.zshrc
source ~/.zshrc
```

#### Linux

```bash
git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.14.0

# bashの場合
echo -e '\n. "$HOME/.asdf/asdf.sh"' >> ~/.bashrc
echo -e '\n. "$HOME/.asdf/completions/asdf.bash"' >> ~/.bashrc
source ~/.bashrc
```

### 2. プラグインのインストール

```bash
# Node.jsプラグイン
asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git

# pnpmプラグイン
asdf plugin add pnpm https://github.com/jonathanmorley/asdf-pnpm.git
```

### 3. プロジェクトのクローンと依存関係のインストール

```bash
# リポジトリのクローン
git clone https://github.com/username/simple-bookkeeping.git
cd simple-bookkeeping

# .tool-versionsに基づいて自動でインストール
asdf install

# インストールされたバージョンの確認
asdf current
```

### 4. 依存関係のインストール

```bash
# pnpmで依存関係をインストール
pnpm install
```

## .tool-versionsファイル

プロジェクトルートの`.tool-versions`ファイルで以下のバージョンを管理しています：

```
nodejs 20.11.0
pnpm 8.14.0
```

## 便利なasdfコマンド

```bash
# インストール済みバージョンの確認
asdf list nodejs
asdf list pnpm

# 利用可能なバージョンの確認
asdf list all nodejs
asdf list all pnpm

# 現在のバージョンの確認
asdf current

# グローバルバージョンの設定
asdf global nodejs 20.11.0
asdf global pnpm 8.14.0
```

## トラブルシューティング

### Node.jsのインストールが失敗する場合

GPGキーの追加が必要な場合があります：

```bash
# Node.js用のGPGキーをインポート
export GNUPGHOME="${ASDF_DIR:-$HOME/.asdf}/keyrings/nodejs"
mkdir -p "$GNUPGHOME"
chmod 0700 "$GNUPGHOME"

# Node.js release teamのキーをインポート
bash -c '${ASDF_DATA_DIR:=$HOME/.asdf}/plugins/nodejs/bin/import-release-team-keyring'
```

### pnpmが認識されない場合

```bash
# asdfのシムを再生成
asdf reshim pnpm
```

## 他の開発者への共有

チームメンバーも同じバージョンを使用できるよう、以下を共有してください：

1. `.tool-versions`ファイルをコミット済み
2. このドキュメントのリンクを共有
3. `asdf install`コマンド一発で環境構築完了

## 参考リンク

- [asdf公式ドキュメント](https://asdf-vm.com/)
- [asdf-nodejs](https://github.com/asdf-vm/asdf-nodejs)
- [asdf-pnpm](https://github.com/jonathanmorley/asdf-pnpm)
