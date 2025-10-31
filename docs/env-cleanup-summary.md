# 環境変数ファイル整理完了サマリー

**実施日**: 2025年10月10日
**実施者**: Claude Code

> **2025-02 更新**  
> 現在は `env/secrets/` ディレクトリで環境プロファイルを管理しています。本資料に登場する `.env.supabase-*` などは `env/secrets/supabase.*.env` に置き換えて読み替えてください。  
> `.env.example` / `.envrc.example` はテンプレートとして維持せず、`env/templates/*.env.example` とルートの `.envrc` に集約しました。

## 📊 整理結果

### 整理前のファイル数

- **合計**: 24ファイル

### 整理後のファイル数

- **合計**: 10ファイル
- **削減率**: 58%削減

## ✅ 保持したファイル（10個）

| ファイル                      | Git管理 | 用途                                     |
| ----------------------------- | ------- | ---------------------------------------- |
| `env/templates/*.env.example` | ✅      | プロファイル/サービス別テンプレート      |
| `.env.local`                  | ❌      | Workspace全体の実際の設定（psql, CLI用） |
| `.env.local.example`          | ✅      | .env.local のテンプレート（整理済み）    |
| `.env.test.example`           | ✅      | テスト設定テンプレート（将来用）         |
| `.env.test.local.example`     | ✅      | テスト設定テンプレート（将来用）         |
| `.envrc`                      | ✅      | direnv設定（更新済み）                   |
| `apps/web/.env.local`         | ❌      | Next.js app設定（整理済み）              |
| `apps/web/.env.test.example`  | ✅      | E2Eテスト設定テンプレート                |
| `packages/database/.env`      | ❌      | Prisma設定（必要に応じて）               |

## 🗑️ 削除したファイル（14個）

| ファイル                          | 削除理由                     |
| --------------------------------- | ---------------------------- |
| `.env`                            | ほぼ空ファイル、不要         |
| `.env.demo`                       | 古い設定ファイル             |
| `.env.docker`                     | Docker環境は非推奨           |
| `.env.local.simplified`           | バックアップファイル         |
| `.env.production`                 | 本番設定は不要（Vercel管理） |
| `.env.production.demo`            | 重複・不要                   |
| `.env.production.example`         | 重複・不要                   |
| `.env.production.vercel`          | 重複・不要                   |
| `.env.vercel`                     | Vercel CLIが自動管理         |
| `.env.supabase.example`           | 不要（.exampleに統合）       |
| `apps/web/.env.local.backup`      | バックアップファイル         |
| `apps/web/.env.production`        | 本番設定は不要               |
| `apps/web/.env.test`              | .exampleで十分               |
| `apps/web/.env.vercel.production` | Vercel管理                   |

## 📝 主要な変更点

### 1. `.env.local` の役割明確化（リポジトリルート）

**変更前**:

- 古いPostgreSQL設定
- API設定（廃止済み）
- JWT設定（使用していない）

**変更後**:

- Supabase CLI用設定のみ
- PostgreSQL直接接続文字列（psql用）
  - `LOCAL_DB_URL`: ローカル開発
  - `PROD_DB_URL`: 本番DB（デバッグ用）
- Vercel/Render API Token（オプション）

### 2. `apps/web/.env.local` の整理

**変更前**:

- PostgreSQL接続文字列（重複）
- その他不要な設定

**変更後**:

- Supabase接続設定のみ（Next.js用）
- E2Eテスト設定
- PostgreSQL設定は削除（ルートの.env.localに集約）

### 3. `.envrc` の更新

**変更前**:

```bash
if [ -f .env ]; then
  dotenv .env
fi
```

**変更後**:

```bash
# .envは削除されたため、.env.localのみ読み込み
if [ -f .env.local ]; then
  dotenv .env.local
fi
```

### 4. `.env.local.example` の簡素化

**変更前**:

- 180行以上のテンプレート
- 多数の廃止済み設定

**変更後**:

- 50行の簡潔なテンプレート
- Workspace用設定のみ
- 明確なコメントと使用例

## 🎯 次のステップ

### 1. Supabase本番DB接続文字列の設定

**必要な作業**:

1. Supabase Dashboard にアクセス

   ```
   https://supabase.com/dashboard/project/eksgzskroipxdwtbmkxm/settings/database
   ```

2. Connection String をコピー

3. `.env.local` の `PROD_DB_URL` を更新

   ```bash
   PROD_DB_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

4. 接続テスト
   ```bash
   source .env.local
   psql "$PROD_DB_URL" -c "SELECT current_database();"
   ```

### 2. 本番環境テスト実行

1. サインアップテスト（Playwright MCP使用）
2. ログインテスト
3. 基本機能の動作確認

## 📚 参照ドキュメント

- [環境変数管理ガイド](./environment-variables.md) - 完全ガイド（更新済み）
- [Supabase接続文字列取得方法](/tmp/get-supabase-connection.md) - 一時ガイド

## ✨ 整理の効果

### Before

```
24個の.envファイル
├── 重複したファイル多数
├── 役割が不明確
├── 廃止済み設定が残存
└── 管理が煩雑
```

### After

```
10個の.envファイル
├── 役割が明確
│   ├── Workspace用: .env.local
│   └── Next.js用: apps/web/.env.local
├── テンプレート整備
│   ├── env/templates/*.env.example (共有)
│   └── .env.local.example (Workspace)
└── ドキュメント完備
```

## ⚠️ 注意事項

1. **Gitignore確認**
   - `.env.local` は必ずGitignoreに含まれている ✅
   - パスワードや秘密鍵は絶対にコミットしない

2. **本番DB接続**
   - 必要最小限の使用
   - 作業後は即座に切断
   - 読み取り専用クエリを推奨

3. **環境切り替え**
   - 本番デバッグ後は必ずローカル設定に戻す
   - `apps/web/.env.local` の設定確認を習慣化

---

**整理完了**: 環境変数ファイルの管理が大幅に改善されました 🎉
