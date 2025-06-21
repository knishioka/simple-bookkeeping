# クイックデプロイガイド（初心者向け）

## 最も簡単なデプロイ方法：Vercel + Supabase + Render

### 必要なもの
- GitHubアカウント
- クレジットカード（無料枠内で利用可能）

### 手順

#### 1. GitHubにコードをプッシュ
```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

#### 2. Supabase（データベース）のセットアップ

1. [Supabase](https://supabase.com)にアクセスしてサインアップ
2. 「New Project」をクリック
3. プロジェクト名とパスワードを設定
4. リージョンは「Northeast Asia (Tokyo)」を選択
5. プロジェクトが作成されたら、「Settings」→「Database」に移動
6. 「Connection string」の「URI」をコピー（後で使用）

#### 3. Render（バックエンドAPI）のセットアップ

1. [Render](https://render.com)にアクセスしてサインアップ
2. 「New +」→「Web Service」を選択
3. GitHubアカウントを連携して、リポジトリを選択
4. 以下の設定を入力：
   - Name: `simple-bookkeeping-api`
   - Region: `Singapore`
   - Branch: `main`
   - Root Directory: `apps/api`
   - Build Command: `cd ../.. && npm install -g pnpm && pnpm install --frozen-lockfile && pnpm --filter @simple-bookkeeping/database prisma:generate && pnpm --filter @simple-bookkeeping/api build`
   - Start Command: `node dist/index.js`

5. 「Advanced」をクリックして環境変数を追加：
   ```
   DATABASE_URL=[Supabaseでコピーした接続文字列]
   JWT_SECRET=your-super-secret-jwt-key-change-this
   JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this
   JWT_EXPIRES_IN=1h
   JWT_REFRESH_EXPIRES_IN=7d
   NODE_ENV=production
   API_PORT=3001
   CORS_ORIGIN=https://your-app-name.vercel.app
   ```

6. 「Create Web Service」をクリック

#### 4. データベースの初期化

Renderのデプロイが完了したら：

1. Renderのダッシュボードで「Shell」タブを開く
2. 以下のコマンドを実行：
```bash
cd ../.. && pnpm --filter @simple-bookkeeping/database prisma:migrate:prod
```

#### 5. Vercel（フロントエンド）のセットアップ

1. [Vercel](https://vercel.com)にアクセスしてサインアップ
2. 「Import Project」をクリック
3. GitHubリポジトリを選択
4. 以下の設定を入力：
   - Framework Preset: `Next.js`
   - Root Directory: `apps/web`
   - Build Command: デフォルトのまま
   - Output Directory: デフォルトのまま

5. 環境変数を追加：
   ```
   NEXT_PUBLIC_API_URL=https://simple-bookkeeping-api.onrender.com/api/v1
   ```
   （RenderのURLに合わせて変更）

6. 「Deploy」をクリック

#### 6. CORS設定の更新

VercelのデプロイURLが確定したら：

1. Renderのダッシュボードに戻る
2. 環境変数の`CORS_ORIGIN`をVercelのURLに更新
3. サービスを再デプロイ

### 動作確認

1. VercelのURLにアクセス
2. デモページで動作を確認
3. 実際にユーザー登録・ログインしてみる

### 月額コスト（概算）

- Supabase: 無料（500MBまで）
- Render: 無料（月750時間まで）
- Vercel: 無料（個人利用）

**合計: 0円**（無料枠内）

### カスタムドメインの設定

独自ドメインを使いたい場合：

1. ドメインを購入（お名前.com、ムームードメイン等）
2. Vercelの設定でカスタムドメインを追加
3. DNSレコードを設定

### よくある問題と解決策

#### Q: APIに接続できない
A: 
- RenderのサービスのステータスがActiveか確認
- 環境変数のNEXT_PUBLIC_API_URLが正しいか確認
- CORS_ORIGINがフロントエンドのURLと一致しているか確認

#### Q: データベースエラーが発生する
A: 
- DATABASE_URLが正しく設定されているか確認
- Prismaマイグレーションが実行されているか確認

#### Q: ビルドが失敗する
A: 
- Node.jsのバージョンが20以上か確認
- pnpmがインストールされているか確認

### 次のステップ

1. **SSL証明書**: すでに自動で設定されています
2. **バックアップ**: Supabaseの管理画面から設定可能
3. **監視**: RenderとVercelの管理画面でログを確認
4. **スケーリング**: 有料プランにアップグレード