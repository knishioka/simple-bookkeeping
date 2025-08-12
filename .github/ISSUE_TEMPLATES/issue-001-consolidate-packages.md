# Refactor: Consolidate duplicated packages (core vs shared vs errors)

## 🎯 概要

現在、`packages/`ディレクトリ内で複数のパッケージが同様の機能を持っており、コードの重複と保守性の低下を引き起こしています。特に`core`、`shared`、`errors`パッケージ間で機能の重複が顕著です。

## 🔍 現状の問題点

### 1. パッケージ間の機能重複

- **`packages/core`** と **`packages/shared`**
  - 両方にエラークラスが存在
  - 両方にスキーマ定義が存在
  - 両方に型定義が存在

- **`packages/errors`** と **`packages/core/src/errors`**
  - 同じエラークラスが重複定義されている
  - `ValidationError`, `NotFoundError`, `UnauthorizedError`などが複数箇所に存在

### 2. 影響を受けるファイル

```
packages/
├── core/
│   ├── src/
│   │   ├── errors/          # エラークラス定義
│   │   ├── schemas/         # スキーマ定義
│   │   └── types/           # 型定義
├── shared/
│   ├── src/
│   │   ├── errors.ts        # エラークラス定義（重複）
│   │   ├── schemas.ts       # スキーマ定義（重複）
│   │   └── types.ts         # 型定義（重複）
└── errors/
    └── src/
        └── index.ts          # エラークラス定義（重複）
```

### 3. 依存関係の混乱

- アプリケーションが複数のパッケージから同じ機能をimportしている
- どのパッケージを使用すべきか不明確
- メンテナンス時に複数箇所の更新が必要

## 💡 推奨される解決策

### Option 1: coreパッケージへの統合（推奨）

1. **`@simple-bookkeeping/core`** に全機能を統合
2. **`@simple-bookkeeping/shared`** と **`@simple-bookkeeping/errors`** を廃止
3. 明確なディレクトリ構造を定義：
   ```
   packages/core/
   ├── src/
   │   ├── errors/     # 全エラークラス
   │   ├── schemas/    # 全バリデーションスキーマ
   │   ├── types/      # 共通型定義
   │   ├── utils/      # ユーティリティ関数
   │   └── constants/  # 定数定義
   ```

### Option 2: 機能別パッケージ分離

1. **`@simple-bookkeeping/errors`** - エラー処理専用
2. **`@simple-bookkeeping/schemas`** - バリデーション専用
3. **`@simple-bookkeeping/utils`** - ユーティリティ専用
4. `core`と`shared`を廃止

## 📋 アクセプタンスクライテリア

- [ ] 重複したコードが完全に削除されている
- [ ] 全てのimport文が新しいパッケージ構造を参照している
- [ ] 既存のテストが全て通る
- [ ] ビルドプロセスが正常に動作する
- [ ] 依存関係が明確で循環参照がない
- [ ] マイグレーションガイドが作成されている

## 🏗️ 実装ステップ

1. **分析フェーズ**（1日）
   - 現在の依存関係マップの作成
   - 影響を受けるファイルの完全なリスト作成

2. **設計フェーズ**（1日）
   - 新パッケージ構造の詳細設計
   - マイグレーション計画の作成

3. **実装フェーズ**（3日）
   - 新パッケージ構造の作成
   - コードの移動と統合
   - import文の更新

4. **テストフェーズ**（1日）
   - 単体テストの実行
   - E2Eテストの実行
   - ビルドプロセスの確認

5. **ドキュメント更新**（0.5日）
   - README.mdの更新
   - マイグレーションガイドの作成

## ⏱️ 見積もり工数

- **総工数**: 6.5人日
- **優先度**: High 🔴
- **影響度**: 全体のコードベースに影響

## 🏷️ ラベル

- `refactor`
- `technical-debt`
- `high-priority`
- `breaking-change`

## 📊 成功指標

- コードの重複が90%以上削減される
- パッケージ数が現在の6個から3-4個に削減される
- ビルド時間が改善される
- 新規開発者のオンボーディング時間が短縮される

## ⚠️ リスクと考慮事項

- **破壊的変更**: 全てのアプリケーションコードのimport文を更新する必要がある
- **一時的な開発停止**: マイグレーション中は他の開発作業に影響する可能性
- **CI/CDパイプラインの更新**: ビルドスクリプトの修正が必要

## 📚 参考資料

- [Monorepo Best Practices](https://monorepo.tools/)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
