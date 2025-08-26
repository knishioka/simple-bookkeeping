# GitHub Actions セットアップガイド

## 必須のシークレット設定

GitHub ActionsでE2Eテストを実行するために、以下のシークレットを設定する必要があります：

### Supabase関連

```
NEXT_PUBLIC_SUPABASE_URL    # Supabase プロジェクトのURL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Supabase anon/public key
```

### 設定方法

1. GitHubリポジトリの Settings → Secrets and variables → Actions へ移動
2. "New repository secret" をクリック
3. 以下のシークレットを追加：

#### テスト環境用（ダミー値を使用可）

```bash
# Name: NEXT_PUBLIC_SUPABASE_URL
# Value: https://dummy.supabase.co

# Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
# Value: 任意の有効なJWT形式のトークン
```

#### 本番環境用（実際の値を使用）

```bash
# Name: NEXT_PUBLIC_SUPABASE_URL
# Value: https://[your-project-ref].supabase.co

# Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
# Value: Supabaseダッシュボードから取得したanon key
```

## 注意事項

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` は公開キーですが、オープンソースプロジェクトではリポジトリに含めず、環境変数として管理することを推奨
- CI/CD環境では、これらの値がないとDockerベースのE2Eテストが失敗します
- ローカルでDockerテストを実行する場合は、`.env.docker`ファイルを作成して値を設定してください

## ローカルでのテスト実行

```bash
# .env.dockerファイルを作成
cp .env.docker.example .env.docker

# 値を編集
vi .env.docker

# Dockerテストを実行
docker-compose -f docker-compose.test.yml up --build
```
