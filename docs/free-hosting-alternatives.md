# 無料ホスティングの代替案

## 現在の構成の問題点

- **Render PostgreSQL**: 90日後に削除される
- **長期的な無料利用には不向き**

## 代替案

### 1. Supabase（PostgreSQL）+ Render（APIのみ）

- **Supabase**: PostgreSQL無料枠（500MBまで永続的）
- **Render**: APIサーバーのみ（月750時間無料）
- **メリット**: データベースが削除されない
- **デメリット**: 2つのサービスを管理

### 2. Supabase（フルスタック）

- **Supabase**: PostgreSQL + Edge Functions
- **Vercel**: フロントエンドのみ
- **メリット**: 統合されたバックエンド
- **デメリット**: Edge Functionsの学習コスト

### 3. Railway.app（以前試した）

- **メリット**: 統合環境
- **デメリット**: 無料枠が限定的（$5クレジット/月）

### 4. Vercel + Vercel Postgres

- **Vercel**: フロントエンド + API Routes + PostgreSQL
- **メリット**: 完全統合
- **デメリット**: API RoutesはNext.jsに限定

### 5. 開発用のみ無料、本番は有料

- **開発**: Docker Compose（ローカル）
- **本番**: Render有料プラン（月$14〜）
- **メリット**: 最も安定
- **デメリット**: 月額費用

## 推奨構成

### 短期プロジェクト（3ヶ月以内）

- 現在のRender無料プランで問題なし

### 長期プロジェクト（無料重視）

1. **Supabase（DB）+ Render（API）**

   - データベースが永続的
   - APIサーバーは無料枠内

2. **Supabase（フルスタック）**
   - すべてSupabaseで完結
   - 既存コードの修正が必要

### 本番運用

- **Render有料プラン**（月$14〜）
- または**Vercel Pro**（月$20〜）

## 移行の労力

| 構成                     | 移行労力 | 安定性 | コスト |
| ------------------------ | -------- | ------ | ------ |
| 現在のまま（90日制限）   | なし     | 低     | 無料   |
| Supabase DB + Render API | 小       | 中     | 無料   |
| Supabase フルスタック    | 大       | 高     | 無料   |
| Render有料               | なし     | 高     | $14/月 |
