# Supabase本番プロジェクト再開ガイド

## 🚨 問題の原因

本番環境（simple-bookkeeping-jp.vercel.app）でログインできない原因は、**Supabaseプロジェクトが一時停止（paused）されている**ためです。

## 📋 解決手順

### Step 1: Supabaseプロジェクトを再開

1. **Supabaseダッシュボードを開く**
   - URL: https://supabase.com/dashboard/project/eksgzskroipxdwtbmkxm
   - ブラウザで自動的に開かれているはずです

2. **プロジェクトの状態を確認**
   - プロジェクト名: `simple-bookkeeping-jp`
   - 状態: `PAUSED` または `一時停止` と表示されている

3. **プロジェクトを再開**
   - 「Restore」または「再開」ボタンをクリック
   - 確認ダイアログが表示されたら「Yes」をクリック

4. **再開を待つ**
   - プロジェクトが `ACTIVE` または `稼働中` になるまで1-2分待つ

### Step 2: APIキーを取得

1. **API設定ページに移動**
   - URL: https://supabase.com/dashboard/project/eksgzskroipxdwtbmkxm/settings/api
   - または、左メニューから「Settings」→「API」を選択

2. **以下のキーをコピー**
   - **Project URL**: `https://eksgzskroipxdwtbmkxm.supabase.co`
   - **anon public key**: `eyJ...` で始まる長い文字列
   - **service_role secret key**: `eyJ...` で始まる長い文字列（Reveal ボタンをクリックして表示）

### Step 3: ターミナルでキーを設定

以下のコマンドをターミナルで実行してください：

```bash
# 1. NEXT_PUBLIC_SUPABASE_URLを設定（改行なし）
vercel env rm NEXT_PUBLIC_SUPABASE_URL production --yes
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# → https://eksgzskroipxdwtbmkxm.supabase.co を入力

# 2. NEXT_PUBLIC_SUPABASE_ANON_KEYを設定（改行なし）
vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY production --yes
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# → ダッシュボードからコピーしたanon keyを入力

# 3. SUPABASE_SERVICE_ROLE_KEYを設定（改行なし）
vercel env rm SUPABASE_SERVICE_ROLE_KEY production --yes
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# → ダッシュボードからコピーしたservice_role keyを入力
```

### Step 4: 本番環境を再デプロイ

```bash
# 最新の変更をデプロイ
vercel --prod
```

### Step 5: ログインテスト

再デプロイ完了後、以下で新規登録→ログインテストを実行：

```bash
pnpm exec playwright test apps/web/e2e/production-auth-test-vercel.spec.ts --project=chromium-desktop --headed
```

---

## 📝 注意事項

- **改行文字に注意**: 環境変数を入力する際、改行文字（`\n`）が含まれないように注意してください
- **プロジェクトの一時停止**: Supabase無料プランでは、一定期間使用しないとプロジェクトが自動的に一時停止されます
- **課金プラン**: 本番環境で継続的に使用する場合は、Pro プランへのアップグレードを検討してください

---

## 🔍 現在の状況

- **プロジェクトRef**: `eksgzskroipxdwtbmkxm`
- **プロジェクト名**: `simple-bookkeeping-jp`
- **リージョン**: Southeast Asia (Singapore)
- **状態**: ❌ PAUSED（一時停止中）
- **Vercel URL**: https://simple-bookkeeping-jp.vercel.app

---

**次のステップ**: Supabaseダッシュボードでプロジェクトを再開してください。
