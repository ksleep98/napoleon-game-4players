# Napoleon Game (4 Players) - プロジェクト指示書

## プロジェクト概要

- **Project**: Napoleon Game (4 Players)
- **Location**: /Users/kk/napoleon-game-4players
- **Repository**: https://github.com/ksleep98/napoleon-game-4players

## 技術スタック

- **Language**: TypeScript
- **Framework**: Next.js 15.4 (App Router)
- **UI Library**: React 19.x
- **Styling**: Tailwind CSS
- **Database**: Prisma ORM (SQLite)
- **Testing**: Jest + React Testing Library
- **Code Quality**: Biome (Linter + Formatter)
- **Pre-commit**: Husky + lint-staged

## ブランチ戦略

- `main` - 本番リリース
- `develop` - 開発統合
- `feature/xxx` - 機能別ブランチ
- **Conventional Commits** 規約準拠

## 開発環境

- Node.js 22.14.0
- npm (package manager)
- VSCode推奨 + Biome拡張

## クイック スタート

```bash
# 1. リポジトリクローン
git clone https://github.com/ksleep98/napoleon-game-4players.git
cd napoleon-game-4players

# 2. 依存関係インストール
npm install

# 3. 開発サーバー起動
npm run dev
# → http://localhost:3000
```

## 詳細ドキュメント

### 📋 セットアップ・環境構築
- [プロジェクトセットアップ](./docs/setup/PROJECT_SETUP.md) - 技術スタック・初期設定
- [開発コマンド一覧](./docs/development/COMMANDS.md) - npm scripts・使い方

### 🧪 テスト・品質管理
- [Jest テスト設定](./docs/testing/JEST_SETUP.md) - テスト環境・34テスト実装状況
- [GitHub Actions](./docs/ci-cd/GITHUB_ACTIONS.md) - CI/CDパイプライン・自動品質チェック
- [Pre-commit Hooks](./docs/ci-cd/PRE_COMMIT_HOOKS.md) - Husky・自動修正・品質チェック
- [PR自動化](./docs/ci-cd/PR_AUTOMATION.md) - PR説明自動生成・コード分析

### 🎮 ゲーム実装
- [実装状況](./docs/game-logic/IMPLEMENTATION_STATUS.md) - Napoleon Game機能・UI・データ管理

## 現在のステータス

### ✅ 完了
- **開発環境**: TypeScript, Next.js, Tailwind CSS, Biome
- **テスト環境**: Jest設定完了（34テスト実装・全合格）
- **CI/CD**: GitHub Actions・pre-commit hooks・品質チェック自動化
- **ゲームロジック**: 52枚デッキ・4人プレイ・基本ルール・スコア計算

### 🚧 進行中
- **Supabase統合**: データベース・リアルタイム同期
- **UI改善**: アニメーション・レスポンシブ対応

### 📋 予定
- **マルチプレイヤー**: リアルタイム対戦
- **AI対戦**: コンピュータ対戦相手
- **統計機能**: プレイヤー履歴・戦績

## 開発ルール

### コード規約
- **言語**: 英語中心、重要ロジックは日本語コメント
- **品質**: Biome linting・formatting 必須
- **型安全**: TypeScript strict mode
- **テスト**: 新機能にはJestテスト追加

### 開発フロー
1. `feature/xxx` ブランチで開発
2. `npm run ci-check` で品質確認
3. `git commit` で自動チェック実行
4. Pull Request作成・レビュー
5. `develop` → `main` へマージ

### Pre-commit 自動チェック
- Biome linting・formatting 自動修正
- TypeScript型チェック
- Jest テスト実行
- 全チェック合格でコミット可能

## 次のステップ

1. **Supabaseプロジェクト設定** - データベース・環境変数
2. **4人対戦実装** - COM3人との対戦モード
3. **UI/UX改善** - ゲーム体験向上

---

> 詳細な技術情報・実装状況は `docs/` フォルダ内の各ドキュメントを参照してください。