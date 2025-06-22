# 🚨 セキュリティインシデント対応手順

## 漏洩した認証情報
- SUPABASE_ACCESS_TOKEN
- SUPABASE_DB_PASSWORD  
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_SUPABASE_ANON_KEY

## 必要な対応手順

### 1. Supabaseダッシュボードでの対応

#### a) アクセストークンの再生成
1. https://supabase.com/dashboard/account/tokens
2. 漏洩したトークンを削除
3. 新しいトークンを生成

#### b) データベースパスワードの変更
1. プロジェクトダッシュボード > Settings > Database
2. "Reset database password"をクリック
3. 新しいパスワードを生成

#### c) APIキーの再生成（重要）
1. プロジェクトダッシュボード > Settings > API
2. "Roll API Keys"セクション
3. 以下を再生成：
   - anon key
   - service_role key

### 2. 環境変数の更新

#### Vercelでの更新
```bash
# 新しいキーで環境変数を更新
vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env rm SUPABASE_SERVICE_ROLE_KEY

# 新しい値を追加
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

#### ローカルファイルの更新
1. `.env.local`の値を新しいキーに更新
2. `.env`に新しいトークンを設定

### 3. セキュリティ確認
- Supabaseのログで不正アクセスがないか確認
- RLSポリシーが正しく設定されているか確認

### 4. 今後の対策
- `.env`ファイルは絶対にコミットしない
- 機密情報は環境変数管理ツールを使用
- 定期的にキーをローテーション