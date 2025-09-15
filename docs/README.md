# ドキュメント構成

このフォルダには、Napoleon Game プロジェクトの詳細ドキュメントが機能別に整理されています。

## 📁 フォルダ構成

```
docs/
├── setup/              # セットアップ・環境構築
├── development/        # 開発ツール・コマンド
├── testing/           # テスト環境・設定
├── ci-cd/             # CI/CD・品質管理自動化
├── game-logic/        # ゲーム実装・仕様
└── README.md          # このファイル
```

## 📋 ドキュメント一覧

### セットアップ・環境構築

- **[PROJECT_SETUP.md](./setup/PROJECT_SETUP.md)**
  - 技術スタック詳細
  - 環境要件・VSCode拡張
  - 初期セットアップコマンド
  - 設定ファイル一覧

### 開発ツール

- **[COMMANDS.md](./development/COMMANDS.md)**
  - pnpm scripts 全一覧
  - 使い分けガイド
  - パフォーマンス情報

### テスト環境

- **[JEST_SETUP.md](./testing/JEST_SETUP.md)**
  - Jest設定詳細
  - 34テスト実装状況
  - TypeScript型対応
  - 実行方法

### CI/CD・品質管理

- **[GITHUB_ACTIONS.md](./ci-cd/GITHUB_ACTIONS.md)**
  - GitHub Actions設定
  - 並列実行・パフォーマンス最適化
  - Biome Linux対応
  - ブランチ保護設定

- **[PRE_COMMIT_HOOKS.md](./ci-cd/PRE_COMMIT_HOOKS.md)**
  - Husky + lint-staged設定
  - 自動修正・品質チェック
  - 3つのpre-commitオプション
  - 実行例・パフォーマンス

### ゲーム実装

- **[IMPLEMENTATION_STATUS.md](./game-logic/IMPLEMENTATION_STATUS.md)**
  - Napoleon Game実装完了状況
  - Core Logic, UI, Database統合
  - ゲーム仕様詳細
  - 次のステップ

## 🚀 クイックナビゲーション

### 初めて開発に参加する場合

1. [PROJECT_SETUP.md](./setup/PROJECT_SETUP.md) - 環境構築
2. [CODING_RULES.md](./development/CODING_RULES.md) - **⚠️ ブランチ保護ルール必読**
3. [COMMANDS.md](./development/COMMANDS.md) - 開発コマンド習得
4. [PRE_COMMIT_HOOKS.md](./ci-cd/PRE_COMMIT_HOOKS.md) - 品質チェック理解

### テスト・CI/CDを理解したい場合

1. [JEST_SETUP.md](./testing/JEST_SETUP.md) - テスト環境
2. [GITHUB_ACTIONS.md](./ci-cd/GITHUB_ACTIONS.md) - CI/CD詳細

### ゲーム実装状況を確認したい場合

1. [IMPLEMENTATION_STATUS.md](./game-logic/IMPLEMENTATION_STATUS.md) - 全体状況

## 📝 更新履歴

- 2025-08-24: ドキュメント分割・機能別整理
- 詳細な変更履歴は各ファイル内に記載
