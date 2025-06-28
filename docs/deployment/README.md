# デプロイメントガイド

このディレクトリには、Simple Bookkeeping プロジェクトのデプロイメントに関するドキュメントが含まれています。

## クイックスタート

初めてデプロイする場合は、以下の手順に従ってください：

1. **環境変数の設定** - `.env.example` を参考に必要な環境変数を設定
2. **プラットフォームの選択** - Render（API）とVercel（Web）を使用
3. **デプロイの実行** - 各プラットフォームのCLIまたはダッシュボードを使用

詳細は [detailed-guide.md](./detailed-guide.md) を参照してください。

## ドキュメント構成

- **[detailed-guide.md](./detailed-guide.md)** - 詳細なデプロイメント手順
- **[configuration.md](./configuration.md)** - 環境変数と設定ファイルの説明
- **[troubleshooting.md](./troubleshooting.md)** - よくある問題と解決方法
- **[scripts-reference.md](./scripts-reference.md)** - デプロイメントスクリプトのリファレンス
- **[render-tips.md](./render-tips.md)** - Render固有のTipsとベストプラクティス

## アーキテクチャ概要

```
┌─────────────┐     ┌─────────────┐
│   Vercel    │     │   Render    │
│  (Next.js)  │────▶│ (Express.js)│
│   Port:3000 │     │  Port:3001  │
└─────────────┘     └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ PostgreSQL  │
                    │  (Render)   │
                    └─────────────┘
```

## 必要な環境変数

### Vercel (Web)

- `NEXT_PUBLIC_API_URL` - APIサーバーのURL

### Render (API)

- `DATABASE_URL` - PostgreSQL接続文字列
- `JWT_SECRET` - JWT署名用の秘密鍵
- `CORS_ORIGIN` - Vercelアプリケーションのオリジン

## デプロイメントチェックリスト

- [ ] 環境変数が正しく設定されている
- [ ] データベースマイグレーションが完了している
- [ ] ビルドが成功することを確認
- [ ] CORSの設定が正しい
- [ ] ヘルスチェックエンドポイントが応答する
