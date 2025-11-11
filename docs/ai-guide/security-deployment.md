# セキュリティとデプロイメント

## ⛔️ 最重要：チェック回避の完全禁止

### 絶対に使用してはいけない環境変数・コマンド

**以下の使用は完全禁止（自動検出により即座にブロックされます）：**

- `SKIP=gitleaks` - Gitleaksによるシークレット検出の回避
- `SKIP=lint-staged` - ESLint/Prettierチェックの回避
- `PRE_COMMIT_ALLOW_NO_CONFIG=1` - pre-commitフック全体の回避
- `git commit --no-verify` - フックのスキップ
- その他あらゆるチェック回避手段

**セキュリティ対策の実装：**

1. **ローカル環境**: `.husky/pre-commit`でSKIP環境変数を自動検出・ブロック
2. **CI/CD環境**: GitHub Actions `security-check.yml`で全PR/pushを監視
3. **コミット履歴**: 禁止パターンを含むコミットメッセージを自動検出

## 🔐 機密情報の取り扱い

### 絶対にコミットしてはいけないもの

**以下の情報は絶対にGitリポジトリにコミットしない：**

- APIキー、トークン、シークレット
- データベースの接続情報
- JWT秘密鍵
- OAuth クライアントシークレット
- Vercelトークン、AWSアクセスキー
- その他のクレデンシャル情報

**適切な管理方法：**

```bash
# ❌ Bad: ファイルに直接記載
const API_KEY = "sk-1234567890abcdef";

# ✅ Good: 環境変数から読み込み
const API_KEY = process.env.API_KEY;
```

**必須の対策：**

1. `.env`ファイルは必ず`.gitignore`に含める
2. `env/templates/*.env.example` を整備してサンプル値を提供
3. 機密情報は環境変数またはシークレット管理サービスを使用
4. コミット前に`git diff`で確認

```bash
# コミット前の確認
git diff --staged | grep -E "(password|secret|key|token)" -i
```

### Vercel環境での機密情報管理

```bash
# Vercel CLIを使用した環境変数の設定
vercel env add DATABASE_URL
vercel env add JWT_SECRET
vercel env ls  # 確認

# ローカル開発時は env/secrets/ 配下で管理
mkdir -p env/secrets
cp env/templates/common.env.example env/secrets/common.env
echo "SUPABASE_DB_URL=postgresql://..." >> env/secrets/supabase.local.env
```

## 🔐 セキュリティ対策

### 機密情報の漏洩防止

#### 1. **Gitleaksの使用**

pre-commitフックで自動的に機密情報をチェックします。

```bash
# Gitleaksのインストール
brew install gitleaks

# 手動でチェック
gitleaks detect --source . --verbose

# コミット履歴をチェック
gitleaks detect --source . --log-opts="--all" --verbose
```

#### 2. **.gitignoreの重要パターン**

```gitignore
# 環境変数
.env
.env.*
!.env.*.example
env/secrets/

# 認証情報
*secret*
*token*
*password*
*credential*
*.jwt
*.pem
*.key
*.cert

# プラットフォーム固有
railway.json
.env.railway
supabase/.env
```

#### 3. **コミット前確認事項**

- [ ] 環境変数ファイルは.gitignoreに含まれているか
- [ ] ハードコードされた認証情報はないか
- [ ] テスト用の認証情報はダミー値か
- [ ] gitleaksのチェックをパスしたか

#### 4. **漏洩時の対応**

1. **即座にキーを無効化**
   - 該当サービスのダッシュボードでキーを再生成
   - データベースパスワードの変更

2. **Git履歴から削除**

   ```bash
   # BFG Repo-Cleanerを使用
   brew install bfg
   bfg --delete-files .env
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```

3. **影響範囲の確認**
   - アクセスログの確認
   - 不正アクセスの有無をチェック

### 環境変数管理のベストプラクティス

1. **環境変数ファイルの管理場所を固定**
   - Git 管理対象: `env/templates/*.example`
   - Gitignore 対象: `env/secrets/*.env`（各自が作成）
   - `.env.local` は `env/secrets/supabase.*.env` へのシンボリックリンクとして運用

2. **テンプレートは例示のみに留める**

   ```bash
   cp env/templates/common.env.example env/secrets/common.env
   cp env/templates/supabase.local.env.example env/secrets/supabase.local.env
   # 値をプレースホルダーから実際の値に置き換える
   sed -i '' 's/your-production-anon-key/<real key>/' env/secrets/supabase.prod.env
   ```

3. **プラットフォームごとの管理**
   - Vercel: ダッシュボードまたはCLIで管理
   - GitHub Actions: Secretsで管理

## 🚀 Vercel デプロイメント

### Vercel CLIの使用

**重要：Vercel関連の操作は必ずVercel CLIを使用する**

```bash
# プロジェクトのリンク
vercel link

# 環境変数の管理
vercel env ls                          # 一覧表示
vercel env add SECRET_KEY             # 追加（対話形式で値を入力）
vercel env rm OLD_SECRET              # 削除
# ローカルにエクスポートする場合は、.env.localではなく一時ファイルを指定
scripts/vercel-env-manager.sh pull --env production ./tmp/vercel.env

# デプロイメント
vercel                                # プレビューデプロイ
vercel --prod                         # 本番デプロイ

# ログ確認
vercel logs                           # 最新のログ
vercel logs [deployment-url]          # 特定のデプロイメントのログ

# プロジェクト設定
vercel project                        # 現在の設定確認
```

### デプロイ前のチェックリスト

1. **機密情報の確認**

   ```bash
   # ステージングエリアに機密情報が含まれていないか確認
   git diff --staged | grep -E "(password|secret|key|token|credential)" -i
   ```

2. **環境変数の設定**

   ```bash
   # 本番環境に必要な環境変数が設定されているか確認
   vercel env ls
   ```

3. **ビルドの確認**
   ```bash
   # ローカルでビルドが成功することを確認
   pnpm build
   ```

### Vercelプロジェクト設定

`vercel.json`で以下の設定を管理：

```json
{
  "buildCommand": "pnpm build --filter=@simple-bookkeeping/web",
  "outputDirectory": "apps/web/.next",
  "installCommand": "pnpm install --frozen-lockfile",
  "framework": "nextjs",
  "devCommand": "pnpm dev --filter=@simple-bookkeeping/web"
}
```

**注意：vercel.jsonに機密情報を記載しない**

## 🚀 Vercelでのデプロイメント設定

### package.jsonのビルドスクリプト設定

```json
// apps/web/package.json
{
  "scripts": {
    "build": "next build",
    "start": "next start",
    "dev": "next dev"
  }
}
```

### 環境変数の設定

```bash
# Vercel用（Webアプリ）
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### ビルドコマンドの統一

```json
// ルートのpackage.json
{
  "scripts": {
    "build": "turbo run build",
    "build:packages": "turbo run build --filter='./packages/*'",
    "build:apps": "turbo run build --filter='./apps/*'",
    "build:web": "pnpm --filter @simple-bookkeeping/database prisma:generate && pnpm build:packages && pnpm --filter @simple-bookkeeping/web build"
  }
}
```

### Vercelでのデプロイ設定（vercel.json）

```json
// ルートのvercel.json（Gitデプロイメント設定のみ）
{
  "git": {
    "deploymentEnabled": {
      "main": true
    }
  }
}

// apps/web/vercel.json（実際のビルド設定）
{
  "buildCommand": "cd ../.. && pnpm build:web",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile --prod=false"
}
```

#### 6. **TypeScriptの設定**

両プラットフォームで動作するように、各アプリのtsconfig.jsonを適切に設定：

```json
// apps/api/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "references": [{ "path": "../../packages/database" }, { "path": "../../packages/types" }]
}
```

#### 7. **依存関係の解決**

```json
// 各パッケージのpackage.json
{
  "dependencies": {
    "@simple-bookkeeping/database": "workspace:*",
    "@simple-bookkeeping/types": "workspace:*"
  }
}
```

#### 8. **ビルド時の注意点**

1. **パッケージの順序**：共通パッケージを先にビルド

   ```bash
   pnpm --filter './packages/*' build
   pnpm --filter './apps/*' build
   ```

2. **Prismaクライアントの生成**：

   ```bash
   pnpm --filter @simple-bookkeeping/database prisma:generate
   ```

3. **環境変数の確認**：
   - Vercel: `vercel env add`で設定

4. **Vercel特有の設定**：
   - apps/web内に専用のvercel.jsonを配置する
   - ルートのvercel.jsonはGitデプロイメント設定のみに使用
   - buildCommandでは必ず`cd ../..`でモノレポルートに移動

5. **デバッグのコツ**：
   - Vercel CLIで`vercel logs`コマンドを活用
   - ビルドエラーは`vercel inspect`で詳細確認
   - ローカルで`vercel dev`を使って環境を再現

### トラブルシューティング

#### Vercel特有の問題と解決策

**1. TypeScriptコンパイルエラー（`tsc: command not found`）**

問題：本番ビルドでTypeScriptがdevDependenciesにあるため利用できない

```bash
# ❌ エラーが発生する設定
"installCommand": "pnpm install --frozen-lockfile"

# ✅ 解決策：devDependenciesも含める
"installCommand": "pnpm install --frozen-lockfile --prod=false"
```

**2. outputDirectoryパスエラー**

問題：`routes-manifest.json`が見つからない

```bash
# ❌ モノレポルートからの相対パスは問題を起こす
{
  "outputDirectory": "apps/web/.next"
}

# ✅ 解決策：apps/web内にvercel.jsonを配置
# apps/web/vercel.json
{
  "outputDirectory": ".next",
  "buildCommand": "cd ../.. && pnpm build:web"
}
```

**3. buildCommandの文字数制限（256文字）**

問題：Vercelのschema validationエラー

```bash
# ❌ 長すぎるbuildCommand
"buildCommand": "cd ../.. && pnpm --filter @simple-bookkeeping/database prisma:generate && pnpm --filter @simple-bookkeeping/database build && ..."

# ✅ 解決策：ルートのpackage.jsonにスクリプトを追加
// package.json
"scripts": {
  "build:web": "pnpm --filter @simple-bookkeeping/database prisma:generate && pnpm build:packages && pnpm --filter @simple-bookkeeping/web build"
}

// apps/web/vercel.json
"buildCommand": "cd ../.. && pnpm build:web"
```

**4. Prismaクライアント生成エラー**

問題：`Cannot find module '.prisma/client'`

```bash
# ✅ buildCommandに必ず含める
pnpm --filter @simple-bookkeeping/database prisma:generate
```

**5. seed.tsの配置場所**

問題：seed.tsがsrcディレクトリにあるとビルドエラー

```bash
# ❌ 間違った配置
packages/database/src/seed.ts

# ✅ 正しい配置
packages/database/prisma/seed.ts
```

#### 共通の問題

**型定義が見つからない場合：**

```bash
# 全パッケージをビルド
pnpm build:packages
```

**モノレポの依存関係エラー：**

```bash
# workspace:* の解決に失敗する場合
pnpm install --shamefully-hoist
```

### デプロイ前のチェックリスト

- [ ] ローカルで`pnpm build`が成功する
- [ ] 環境変数が各プラットフォームに設定されている
- [ ] データベースマイグレーションが完了している
- [ ] CORSの設定が正しい（APIサーバー）
- [ ] APIのURLが正しく設定されている（Webアプリ）
- [ ] TypeScriptのdevDependenciesが本番でも利用可能（`--prod=false`）
- [ ] Vercelの場合、apps/web/vercel.jsonが存在する
- [ ] Prismaクライアント生成がbuildCommandに含まれている

### デプロイメント成功の鍵

1. **段階的なデバッグ**
   - まずローカルでプロダクションビルドを確認
   - Vercel CLIで`vercel`コマンドでプレビューデプロイ
   - 問題があれば`vercel logs`で詳細確認

2. **モノレポ構造の理解**
   - ビルドコマンドは常にモノレポルートから実行
   - 各アプリケーションは自身のディレクトリにvercel.jsonを配置
   - 共有パッケージのビルドを忘れない

3. **よくある落とし穴の回避**
   - `db:generate`ではなく`prisma:generate`を使用
   - outputDirectoryは相対パスで指定
   - installCommandでdevDependenciesを含める（`--prod=false`）
   - buildCommandは256文字以内に収める
   - seed.tsはprismaディレクトリに配置

4. **プラットフォーム別の注意点**

   **Vercel:**
   - apps/web内に独自のvercel.jsonを配置
   - ルートのvercel.jsonはGit設定のみ
   - buildCommandが長い場合はpackage.jsonにスクリプト化

## 🚀 デプロイメント状況の確認

### デプロイメント監視コマンド

```bash
# デプロイメント状態の確認
pnpm deploy:check

# Vercelの状態確認（API版）
pnpm vercel:status

# Vercelのログ確認
pnpm vercel:logs build      # ビルドログ
pnpm vercel:logs runtime    # ランタイムログ
```

### Vercel APIのセットアップ

1. **APIトークンの取得**
   - https://vercel.com/account/tokens にアクセス
   - 「Create Token」をクリック

2. **環境変数の設定**
   ```bash
   # .env.localに追加
   VERCEL_TOKEN=xxxxxxxxxxxxxxxxxxxx
   ```

### デプロイメントステータスの意味

**Vercel:**

- 🟢 Ready (Production)
- 🔵 Ready (Preview)
- 🔴 Error/Failed
- 🟡 Building/Deploying

### デプロイメント操作（npm-first アプローチ）

Vercelデプロイメントの確認や調査は、npmスクリプト経由で行います：

```bash
# 本番ログ確認
pnpm logs:prod

# デプロイメント一覧
pnpm vercel:list

# 詳細ステータス
pnpm vercel:status
```

詳細は[CLAUDE.md](../../CLAUDE.md)の「Vercel/Supabase CLIの安全な操作ガイド」セクションを参照してください。

## 🛡️ セキュリティヘッダー

**実装場所：** `apps/web/next.config.js`

セキュリティヘッダー（CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Strict-Transport-Security）を設定済み。

**検証：**

```bash
curl -I http://localhost:3000 | grep -E "(X-Frame|X-Content|Referrer|Permissions)"
```

## 🛡️ プロジェクトのセキュリティポリシー

### 必須のセキュリティツール

1. **Gitleaks** - 機密情報の検出

   ```bash
   brew install gitleaks
   ```

2. **pre-commitフック** - 自動チェック
   - ESLint
   - TypeScript
   - Gitleaks
   - Prettier

3. **依存関係の脆弱性チェック**
   ```bash
   pnpm audit
   pnpm update --interactive
   ```

### セキュリティチェックリスト

**毎回のコミット前：**

- [ ] `git diff --staged`で差分を確認
- [ ] 機密情報が含まれていないか目視確認
- [ ] pre-commitフックが正常に動作

**定期的に実施：**

- [ ] 依存関係の更新
- [ ] セキュリティ監査
- [ ] アクセスログの確認

## 🏗️ ビルドチェックの重要性

**本プロジェクトのビルドチェック体制：**

1. **pre-commit時（軽量チェック）**
   - ESLint + Prettier
   - 変更されたパッケージの型チェック
   - Gitleaksによる機密情報チェック

2. **pre-push時（完全ビルドチェック）**
   - Vercel用Webアプリの完全ビルド
   - 共有パッケージのビルド

**ローカルでのビルドチェック方法：**

```bash
# 軽量チェック（commit前）
pnpm check:types        # TypeScriptの型チェック
pnpm lint              # ESLintチェック

# 完全ビルドチェック（push前）
pnpm build:check       # ビルドチェック
pnpm prepush:check     # pre-pushフックと同じチェック

# 個別のビルドチェック
pnpm --filter @simple-bookkeeping/web build    # Vercel (Web)
```

**ビルドエラーが発生した場合：**

1. **まずエラーメッセージを確認**
2. **依存関係の問題の場合**：
   ```bash
   pnpm install
   pnpm --filter @simple-bookkeeping/database prisma:generate
   ```
3. **型エラーの場合**：
   - 該当ファイルを修正
   - 必要に応じて型定義を更新
4. **それでも解決しない場合**：
   - `pnpm clean && pnpm install`
   - `.next`や`dist`ディレクトリを削除

**重要：デプロイメント前には必ずローカルでビルドが成功することを確認してください。**
