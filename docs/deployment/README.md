# デプロイメントガイド

このディレクトリには、Simple Bookkeeping プロジェクトのデプロイメントに関するドキュメントが含まれています。

## クイックスタート

初めてデプロイする場合は、以下の手順に従ってください：

1. **環境変数の設定** - `.env.example` を参考に必要な環境変数を設定
2. **プラットフォームの選択** - Vercel（Web）を使用
3. **デプロイの実行** - VercelのCLIまたはダッシュボードを使用

詳細は [detailed-guide.md](./detailed-guide.md) を参照してください。

## ドキュメント構成

- **[detailed-guide.md](./detailed-guide.md)** - 詳細なデプロイメント手順
- **[configuration.md](./configuration.md)** - 環境変数と設定ファイルの説明
- **[troubleshooting.md](./troubleshooting.md)** - よくある問題と解決方法
- **[scripts-reference.md](./scripts-reference.md)** - デプロイメントスクリプトのリファレンス

## アーキテクチャ概要

```
┌─────────────┐
│   Vercel    │
│  (Next.js)  │
│   Port:3000 │
└──────┬──────┘
       │
┌──────▼──────┐
│  Supabase   │
│ (PostgreSQL)│
└─────────────┘
```

## 必要な環境変数

### Vercel (Web)

- `DATABASE_URL` - PostgreSQL接続文字列（Supabase）
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase Anonymous Key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key

## デプロイメントチェックリスト

- [ ] 環境変数が正しく設定されている
- [ ] データベースマイグレーションが完了している
- [ ] ビルドが成功することを確認
- [ ] CORSの設定が正しい
- [ ] ヘルスチェックエンドポイントが応答する
