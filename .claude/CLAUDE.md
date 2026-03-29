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
- **Infrastructure**: Terraform + Terraform Cloud (GitHub管理)

## ブランチ戦略

- `main` - 本番リリース
- `develop` - 開発統合
- `feature/xxx` - 機能別ブランチ
- **Conventional Commits** 規約準拠

### ⚠️ 重要なルール

**`develop`ブランチへの直接コミット禁止**

- 必ず`feature/xxx`ブランチで作業
- Pull Requestを通してのみマージ可能
- 直接pushは避けること

## 開発環境

- Node.js 22.14.0
- pnpm (package manager) - 高速・効率的
- VSCode推奨 + Biome拡張

## クイック スタート

### 通常の開発環境

```bash
# 1. リポジトリクローン
git clone https://github.com/ksleep98/napoleon-game-4players.git
cd napoleon-game-4players

# 2. 依存関係インストール
pnpm install

# 3. 開発サーバー起動
pnpm dev
# → http://localhost:3000

# 4. マージ後の自動クリーンアップ
pnpm setup:auto-cleanup enable  # 自動実行を有効化
pnpm cleanup        # 手動インタラクティブ版
pnpm cleanup:smart  # 手動スマート版（GitHub CLI連携）
```

### Docker環境 (シンプル・推奨)

```bash
# 1. リポジトリクローン
git clone https://github.com/ksleep98/napoleon-game-4players.git
cd napoleon-game-4players

# 2. Dockerイメージをビルド
./docker-dev.sh build

# 3. コンテナを起動してpnpm dev実行
./docker-dev.sh run

# 4. アプリケーションにアクセス
# → http://localhost:3000
```

詳細: [Dockerシンプルセットアップ](./docs/setup/DOCKER_SIMPLE_SETUP.md)

### Docker Compose環境 (フルスタック・DB含む)

```bash
# 1. リポジトリクローン
git clone https://github.com/ksleep98/napoleon-game-4players.git
cd napoleon-game-4players

# 2. 環境変数ファイル作成
cp .env.docker.example .env

# 3. Docker Composeで起動
docker-compose up -d

# 4. アプリケーションにアクセス
# → http://localhost:3000
```

詳細: [Docker Composeセットアップ](./docs/setup/DOCKER_SETUP.md)

## 詳細ドキュメント

### 📋 セットアップ・環境構築

- [プロジェクトセットアップ](./docs/setup/PROJECT_SETUP.md) - 技術スタック・初期設定
- [Dockerシンプルセットアップ](./docs/setup/DOCKER_SIMPLE_SETUP.md) - Dockerコンテナで開発（シンプル・推奨）
- [Docker Composeセットアップ](./docs/setup/DOCKER_SETUP.md) - フルスタックローカル環境・DB含む
- [開発コマンド一覧](./docs/development/COMMANDS.md) - pnpm scripts・使い方
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

### 🏗️ インフラ管理

- [Terraform README](./terraform/README.md) - GitHub管理・Terraform Cloud設定・運用ガイド

### 🎮 ゲーム実装

- [実装状況](./docs/game-logic/IMPLEMENTATION_STATUS.md) - Napoleon Game機能・UI・データ管理・セキュリティ強化
- [最新改善ログ](./docs/game-logic/RECENT_IMPROVEMENTS.md) - UI改善・ゲームルール修正・COMタイミング制御

### 💨 パフォーマンス最適化

- [データベース最適化セットアップ](./docs/database/DATABASE_PERFORMANCE_SETUP.md) - 50-120ms性能向上・PostgreSQL関数・インデックス

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
- **パフォーマンス最適化**: PostgreSQL関数統合・50-120ms改善・Vercel日本リージョン対応
- **Infrastructure as Code**: Terraform + Terraform Cloud・GitHub Repository Ruleset管理・VCS-driven workflow

### 🚧 進行中

- **UI改善**: アニメーション・レスポンシブ対応
- **マルチプレイヤー**: リアルタイム対戦機能の拡張

### 📋 予定

- **AI対戦**: コンピュータ対戦相手
- **統計機能**: プレイヤー履歴・戦績
- **本番環境**: RLS有効化・セキュリティ強化

## セキュリティ

### 環境変数管理

**⚠️ 重要**: 本番環境の認証情報は絶対にGitにコミットしないでください。

- ✅ `.env.example`, `.env.production.example` のみGit追跡
- ❌ `.env`, `.env.local`, `.env.production` はGit追跡禁止
- 本番環境の認証情報は**Vercel環境変数のみ**で管理
- 詳細: [環境変数セキュリティガイド](./docs/security/ENVIRONMENT_VARIABLES.md)

## インフラ管理（Infrastructure as Code）

### Terraform による GitHub 管理

GitHubリポジトリの設定をTerraformで管理し、VCS-driven workflowで自動適用します。

#### 設定ファイル構成

- `terraform/` - Terraform設定ディレクトリ
  - `terraform.tf` - Terraform Cloud設定・GitHub Provider
  - `variables.tf` - 変数定義
  - `github.tf` - リポジトリ・Ruleset・ラベル設定
  - `terraform.tfvars` - 変数値（Git追跡禁止）
  - `terraform.tfvars.example` - 変数値のテンプレート

#### Terraform Cloud 設定

- **Organization**: ksleep98
- **Workspace**: napoleon-game-4players
- **Working Directory**: `terraform`
- **Execution Mode**: Remote（VCS-driven）
- **Auto Apply**: ON（developマージで自動適用）
- **VCS Branch**: develop

#### Repository Ruleset 設定

**develop ブランチ:**

- ブランチ作成・削除・Force push禁止
- Pull Request必須
- スカッシュマージのみ許可（feature → develop）
- レビュー要件: 不要（個人開発）

**main ブランチ:**

- ブランチ作成・削除・Force push禁止
- Pull Request必須
- 通常マージのみ許可（develop → main）
- レビュー要件: 不要（個人開発）

**重要な設計決定:**

- ✅ CI必須チェック: 無効（pre-commit hooksで品質担保）
- ✅ Strict Status Checks: 無効（"Update branch" 不要）
- ✅ Bypass Actors: 無効（"Merge without waiting..." チェックボックス非表示）

#### 運用フロー

1. `terraform/` 内のファイルを編集
2. feature ブランチで作業・PRを作成
3. develop にマージ
4. Terraform Cloud が自動的に `terraform plan` → `terraform apply` を実行
5. GitHub設定が自動更新される

**注意事項:**

- `terraform.tfvars` は絶対にコミットしない（GitHub PAT含む）
- Terraform Cloud の環境変数で `github_token` を管理（Sensitive設定）
- 手動で `terraform apply` を実行しない（VCS-driven workflowに任せる）

#### 認証情報管理

**GitHub Personal Access Token (PAT):**

- Fine-grained PAT 推奨（`github_pat_` で始まる）
- 必要なスコープ: `Administration: Read and write`, `Metadata: Read-only`
- Terraform Cloud Variables で `github_token` として設定（Sensitive: true）

#### トラブルシューティング

**Terraform Cloud でエラーが出る場合:**

1. Working Directory が `terraform` に設定されているか確認
2. `github_token` 変数が設定されているか確認
3. Execution Mode が Remote になっているか確認

**ローカルで動作確認したい場合:**

```bash
cd terraform
terraform init
terraform plan  # 変更内容を確認
# terraform apply は実行しない（Terraform Cloudに任せる）
```

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
2. `pnpm ci-check` で品質確認
3. `git commit` で自動チェック実行
4. Pull Request作成・レビュー
5. `develop` → `main` へマージ

### Pre-commit 自動チェック

- **develop ブランチ保護**: developブランチへの直接コミット禁止
- Biome linting・formatting 自動修正
- TypeScript型チェック
- Jest テスト実行
- 全チェック合格でコミット可能

### Develop ブランチ保護

developブランチへの直接コミット・プッシュを防ぐ保護機能が有効：

```bash
# 保護設定確認
pnpm run develop:status

# 保護有効化（既に設定済み）
pnpm run develop:protect

# 保護無効化（緊急時のみ）
pnpm run develop:unprotect
```

**保護内容:**

- developブランチでの直接コミット防止（pre-commit hook）
- developブランチへの直接プッシュ防止（pre-push hook）
- 自動的にfeatureブランチ作成を促すメッセージ表示

### E2E テスト制御

E2Eテストは環境変数で制御可能:

- **スキップ**: `SKIP_E2E_TESTS=true` - CI/CDでE2Eテストを無効化
- **有効化**: `SKIP_E2E_TESTS=false` またはunset - E2Eテストを実行

```bash
# E2Eテストをスキップしてローカルで実行
SKIP_E2E_TESTS=true pnpm test:e2e

# 通常のE2Eテスト実行（環境変数未設定時はfalseがデフォルト）
pnpm test:e2e
```

**注意**: 現在はCloudflare開発環境セットアップまでE2Eテストをスキップ中

### Post-merge 自動クリーンアップ

**自動実行設定:**

- `pnpm setup:auto-cleanup enable` - 自動クリーンアップ有効化
- `pnpm setup:auto-cleanup disable` - 自動クリーンアップ無効化
- `pnpm setup:auto-cleanup status` - 設定状況確認

**手動実行:**

- `pnpm cleanup` - インタラクティブ版（確認あり）
- `pnpm cleanup:smart` - スマート版（GitHub CLI連携）
  - `-- --force` - 自動削除（確認なし）
  - `-- --keep` - ブランチ保持
  - `-- --help` - 使用方法表示

**ポーリング自動クリーンアップの仕組み:**

- 5分間隔でGitHub APIをポーリング
- マージ済みPRを自動検出
- 対応するローカルブランチを安全に削除
- リモート追跡ブランチも自動削除
- 外部サービス不要の完全自動化

## パフォーマンス最適化

### データベース最適化済み

- **PostgreSQL関数統合**: 50-120ms性能改善
- **Vercel日本リージョン**: レイテンシ大幅削減
- **最適化されたクエリ**: インデックス活用・高頻度処理対応

**詳細**: [データベースパフォーマンス設定](./docs/database/DATABASE_PERFORMANCE_SETUP.md)

## 次のステップ

1. **Supabaseプロジェクト設定** - データベース・環境変数
2. **4人対戦実装** - COM3人との対戦モード
3. **UI/UX改善** - ゲーム体験向上

---

> 詳細な技術情報・実装状況は `docs/` フォルダ内の各ドキュメントを参照してください。
