# Render データベースセットアップ手順

## 1. Render Dashboardでシェルを開く

1. [Render Dashboard](https://dashboard.render.com) にログイン
2. 「simple-bookkeeping-api」サービスをクリック
3. 左側メニューの「Shell」タブをクリック
4. 「Connect」ボタンをクリックしてシェルセッションを開始

## 2. データベースマイグレーションの実行

シェルで以下のコマンドを順番に実行：

```bash
# 1. データベースディレクトリに移動
cd packages/database

# 2. Prismaクライアントの生成（念のため）
npx prisma generate

# 3. マイグレーションの実行
npx prisma migrate deploy

# 4. 初期データの投入
npx prisma db seed
```

## 3. テストユーザー情報の確認

シードスクリプトの実行後、以下の情報が表示されます：

- Email: test@example.com
- Password: (ランダムに生成されたパスワード)

このパスワードは必ずメモしてください。

## 4. データベース接続の確認（オプション）

```bash
# Prisma Studioを使用してデータを確認
npx prisma studio
```

※ ただし、Render ShellではGUIは使用できないため、以下のコマンドで確認：

```bash
# ユーザー数を確認
npx prisma db execute --stdin <<EOF
SELECT COUNT(*) FROM users;
EOF

# 組織数を確認
npx prisma db execute --stdin <<EOF
SELECT COUNT(*) FROM organizations;
EOF
```

## トラブルシューティング

### マイグレーションエラーが発生した場合

1. DATABASE_URL環境変数が正しく設定されているか確認
2. PostgreSQLサービスが「Available」状態か確認
3. エラーメッセージを確認して対処

### シードエラーが発生した場合

1. すでにデータが存在する可能性があります
2. 以下のコマンドでリセット可能（注意：すべてのデータが削除されます）：
   ```bash
   npx prisma migrate reset --force
   ```
