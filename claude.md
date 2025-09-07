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
- **Database**: Supabase (PostgreSQL)
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

# 4. マージ後の自動クリーンアップ
npm run setup:auto-cleanup enable  # 自動実行を有効化
npm run cleanup        # 手動インタラクティブ版
npm run cleanup:smart  # 手動スマート版（GitHub CLI連携）
```

## 詳細ドキュメント

### 📋 セットアップ・環境構築

- [プロジェクトセットアップ](./docs/setup/PROJECT_SETUP.md) - 技術スタック・初期設定
- [開発コマンド一覧](./docs/development/COMMANDS.md) - npm scripts・使い方
- [フォーマット設定](./docs/development/FORMATTING_SETUP.md) - Biome/Prettier統合・VSCode設定
- [コーディングルール](./docs/development/CODING_RULES.md) - 定数参照・静的import・品質基準
- [Post-merge自動化](./scripts/) - マージ後のブランチクリーンアップ自動化

### 🧪 テスト・品質管理

- [Jest テスト設定](./docs/testing/JEST_SETUP.md) - テスト環境・146テスト実装状況
- [GitHub Actions](./docs/ci-cd/GITHUB_ACTIONS.md) - CI/CDパイプライン・自動品質チェック
- [Pre-commit Hooks](./docs/ci-cd/PRE_COMMIT_HOOKS.md) - Husky・自動修正・品質チェック
- [PR自動化](./docs/ci-cd/PR_AUTOMATION.md) - PR説明自動生成・コード分析
- [自動リリース](./docs/ci-cd/AUTO_RELEASE.md) - develop→main自動PR・リリース管理

### 🔒 セキュリティ

- [セキュリティ設定](./docs/security/RLS_SETUP.md) - Supabase RLS・Server Actions・認証
- [開発環境セキュリティ](./docs/security/DEVELOPMENT_SECURITY.md) - セキュリティベストプラクティス・チェック手順

### 🎮 ゲーム実装

- [実装状況](./docs/game-logic/IMPLEMENTATION_STATUS.md) - Napoleon Game機能・UI・データ管理・セキュリティ強化
- [最新改善ログ](./docs/game-logic/RECENT_IMPROVEMENTS.md) - UI改善・ゲームルール修正・COMタイミング制御

## 現在のステータス

### ✅ 完了

- **開発環境**: TypeScript, Next.js, Tailwind CSS, Biome
- **テスト環境**: Jest設定完了（141テスト実装・全合格）
- **CI/CD**: GitHub Actions・pre-commit hooks・品質チェック自動化
- **PR自動化**: 説明自動生成・コード分析・レビュー支援（GitHub Actions構文修正済み）
- **ゲームロジック**: 52枚デッキ・4人プレイ・基本ルール・スコア計算
- **Supabase統合**: データベース接続・リアルタイム同期・セッション管理
- **セキュリティ強化**: RLS・Server Actions・入力検証・レート制限・プレイヤーID同期
- **Quick Start**: 4人対戦ゲームの即座開始機能
- **エラー修正**: 404/PGRST202エラー解消・RLS設定最適化・プレイヤーID不一致修正
- **Post-merge自動化**: ブランチクリーンアップ自動化・developブランチ自動移行・GitHub CLI連携・Git hooks統合

### 🚧 進行中

- **UI改善**: アニメーション・レスポンシブ対応
- **マルチプレイヤー**: リアルタイム対戦機能の拡張

### 📋 予定

- **AI対戦**: コンピュータ対戦相手
- **統計機能**: プレイヤー履歴・戦績
- **本番環境**: RLS有効化・セキュリティ強化

## 開発ルール

### コード規約

- **言語**: 英語中心、重要ロジックは日本語コメント
- **品質**: Biome linting・formatting 必須
- **型安全**: TypeScript strict mode
- **テスト**: 新機能にはJestテスト追加
- **定数**: 文字列リテラル禁止・定数参照徹底
- **Import**: 動的import禁止・静的import推奨

**詳細**: [コーディングルール](./docs/development/CODING_RULES.md) を参照

### Claude Code設定

- SHALL use the MCP server 'serena' for source code retrieval and modification.
- SHALL limit response token length to avoid usage limit.
- SHALL break down large files for stepwise parsing.

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

### Post-merge 自動クリーンアップ

**自動実行設定:**

- `npm run setup:auto-cleanup enable` - 自動クリーンアップ有効化
- `npm run setup:auto-cleanup disable` - 自動クリーンアップ無効化
- `npm run setup:auto-cleanup status` - 設定状況確認

**手動実行:**

- `npm run cleanup` - インタラクティブ版（確認あり）
- `npm run cleanup:smart` - スマート版（GitHub CLI連携）
  - `-- --force` - 自動削除（確認なし）
  - `-- --keep` - ブランチ保持
  - `-- --help` - 使用方法表示

**自動実行の仕組み:**

- Git post-merge hookでPRマージ後に自動実行
- developブランチへのマージを検出して自動クリーンアップ
- マージされたブランチのローカル・リモート削除
- GitHub CLI連携でPRステータス確認

## 次のステップ

1. **Supabaseプロジェクト設定** - データベース・環境変数
2. **4人対戦実装** - COM3人との対戦モード
3. **UI/UX改善** - ゲーム体験向上

---

> 詳細な技術情報・実装状況は `docs/` フォルダ内の各ドキュメントを参照してください。
