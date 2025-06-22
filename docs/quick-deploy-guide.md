# クイックデプロイガイド（初心者向け）

## 最も簡単なデプロイ方法：Vercel + Render

### 必要なもの

- GitHubアカウント
- Vercelアカウント（GitHubでログイン可能）
- Renderアカウント（GitHubでログイン可能）

### 手順

#### 1. GitHubにコードをプッシュ

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

#### 2. Render（バックエンドAPI + データベース）のセットアップ

1. [Render](https://render.com)にアクセスしてサインアップ
2. 「New +」→「Blueprint」を選択
3. GitHubアカウントを連携して、リポジトリを選択
4. `render.yaml`ファイルが自動的に検出される
5. 「Apply」をクリックしてデプロイ開始

**自動的に作成されるもの:**

- APIサーバー（Web Service）
- PostgreSQLデータベース（無料プラン）
- 必要な環境変数

**注意事項:**

- 初回デプロイには5-10分かかります
- 無料プランは15分間アクセスがないとスリープします

#### 3. データベースの初期化

デプロイ完了後、Render Dashboardから:

1. 「simple-bookkeeping-api」サービスを選択
2. 「Shell」タブを開く
3. 以下のコマンドを実行：

```bash
cd packages/database
pnpm prisma migrate deploy
pnpm prisma db seed
```

#### 4. Vercel（フロントエンド）のセットアップ

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
   API_URL=https://simple-bookkeeping-api.onrender.com
   DATABASE_URL=[RenderのPostgreSQLのURL]
   ```

   （RenderのURLに合わせて変更）

6. 「Deploy」をクリック

#### 5. CORS設定の更新

VercelのデプロイURLが確定したら：

1. Renderのダッシュボードに戻る
2. 環境変数の`CORS_ORIGIN`をVercelのURLに更新
3. サービスを再デプロイ

### 動作確認

1. VercelのURLにアクセス
2. デモページで動作を確認
3. 実際にユーザー登録・ログインしてみる

### 月額コスト（概算）

- Render: 無料（PostgreSQL 90日間、Web Service 月750時間まで）
- Vercel: 無料（個人利用）

**合計: 0円**（無料枠内）

**注意事項:**

- Render無料プランのPostgreSQLは90日後に削除される可能性があります
- 本番運用の場合は有料プラン（$7/月〜）への移行を推奨

### カスタムドメインの設定

独自ドメインを使いたい場合：

1. ドメインを購入（お名前.com、ムームードメイン等）
2. Vercelの設定でカスタムドメインを追加
3. DNSレコードを設定

### よくある問題と解決策

#### Q: APIに接続できない

A:

- RenderのサービスのステータスがActiveか確認
- 環境変数のAPI_URLが正しいか確認（https://で始まる）
- CORS_ORIGINがフロントエンドのURLと一致しているか確認
- 無料プランの場合、15分間アクセスがないとスリープするため初回アクセスが遅い

#### Q: データベースエラーが発生する

A:

- Render DashboardでPostgreSQLのステータスを確認
- DATABASE_URLが自動的に設定されているか確認
- Prismaマイグレーションが実行されているか確認

#### Q: ビルドが失敗する

A:

- Node.jsのバージョンが18以上か確認（render.yamlで指定）
- pnpmがビルドコマンドに含まれているか確認
- Render Dashboardでビルドログを確認

#### Q: 「15分後にスリープ」の回避方法

A:

- 外部監視サービス（UptimeRobot等）で定期的にアクセス
- または有料プラン（$7/月）にアップグレード

### 次のステップ

1. **SSL証明書**: すでに自動で設定されています
2. **バックアップ**:
   - 無料プラン: 手動で`pg_dump`を実行
   - 有料プラン: 自動バックアップ機能あり
3. **監視**:
   - Render Dashboard: ログとメトリクス
   - Vercel Dashboard: 関数の実行ログ
4. **スケーリング**:
   - APIサーバー: インスタンス数を増やす
   - データベース: 有料プランでスペック向上

### 本番運用への移行

無料プランから本番環境への移行時のチェックリスト：

1. [ ] Render有料プランへアップグレード（スリープなし）
2. [ ] PostgreSQLを永続化プランに変更
3. [ ] カスタムドメインの設定
4. [ ] 自動バックアップの有効化
5. [ ] アラート・監視の設定
6. [ ] スケーリングポリシーの設定
