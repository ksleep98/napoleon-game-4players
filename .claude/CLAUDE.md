# Napoleon Game (4 Players) - プロジェクト指示書

## プロジェクト概要

- **Project**: Napoleon Game (4 Players)
- **Location**: /Users/kk/napoleon-game-4players
- **Repository**: https://github.com/ksleep98/napoleon-game-4players

## 技術スタック

バージョンは `package.json` / `python/pyproject.toml` が正。ここは概観。

### Web アプリ

- **Language**: TypeScript 6.x (strict mode)
- **Framework**: Next.js 16.x (App Router)
- **UI Library**: React 19.x
- **Styling**: Tailwind CSS 4.x
- **Database**: Supabase (PostgreSQL)
- **Testing**: Jest 30 + React Testing Library（ユニット）/ Playwright（E2E）
- **Code Quality**: Biome 2.x (Linter + Formatter) + Prettier（yml/yaml/md のみ）
- **Pre-commit**: Husky 9 + lint-staged
- **Hosting**: Vercel
- **Infrastructure**: Terraform + Terraform Cloud (GitHub管理)

### ML（`python/`・別ホスティング）

- **Language**: Python 3.13
- **Package manager**: uv（`uv.lock` が唯一の正。`requirements.txt` は置かない）
- **Serving**: FastAPI + Gradio / **Uvicorn**
- **ML**: scikit-learn + pandas + numpy、モデル永続化は skops
- **Hosting**: Hugging Face Spaces（`ksleep98/napoleon-ml-trainer`・**GitHub とは別リポジトリ**）

詳細: [ML 実装](../docs/ml/) / [python/README.md](../python/README.md)

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

- Node.js **22.22.0**（`.nvmrc`。`package.json` の engines は `22.x`）
- pnpm **10.15.1**（`packageManager` で固定。engines は `>=10.0.0`）
- VSCode推奨 + Biome拡張
- Python 3.13 + uv（`python/` を触るときのみ）

## クイック スタート

### 通常の開発環境（推奨: vercel dev）

```bash
# 1. リポジトリクローン
git clone https://github.com/ksleep98/napoleon-game-4players.git
cd napoleon-game-4players

# 2. 依存関係インストール
pnpm install

# 3. Vercel CLIでログイン（初回のみ）
vercel login

# 4. 開発サーバー起動（Vercel環境変数が自動注入）
vercel dev
# → http://localhost:3000
# ※ .env / .env.local が存在すると競合するため削除しておくこと

# 5. マージ後のブランチクリーンアップ（手動実行のみ）
pnpm cleanup        # インタラクティブ版
pnpm cleanup:smart  # スマート版（GitHub CLI連携）
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

詳細: [Dockerシンプルセットアップ](../docs/setup/DOCKER_SIMPLE_SETUP.md)

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

詳細: [Docker Composeセットアップ](../docs/setup/DOCKER_SETUP.md)

## 詳細ドキュメント

### 📋 セットアップ・環境構築

- [プロジェクトセットアップ](../docs/setup/PROJECT_SETUP.md) - 技術スタック・初期設定
- [Dockerシンプルセットアップ](../docs/setup/DOCKER_SIMPLE_SETUP.md) - Dockerコンテナで開発（シンプル・推奨）
- [Docker Composeセットアップ](../docs/setup/DOCKER_SETUP.md) - フルスタックローカル環境・DB含む
- [開発コマンド一覧](../docs/development/COMMANDS.md) - pnpm scripts・使い方
- [フォーマット設定](../docs/development/FORMATTING_SETUP.md) - Biome/Prettier統合・VSCode設定
- [コーディングルール](../docs/development/CODING_RULES.md) - 定数参照・静的import・品質基準
- [ブランチクリーンアップ](../scripts/) - マージ後のブランチ整理（手動実行）

### 🧪 テスト・品質管理

- [Jest テスト設定](../docs/testing/JEST_SETUP.md) - テスト環境・設定
- [E2E テスト](../docs/testing/E2E_TESTING.md) - Playwright・実行方法
- [GitHub Actions](../docs/ci-cd/GITHUB_ACTIONS.md) - CI/CDパイプライン・自動品質チェック
- [Pre-commit Hooks](../docs/ci-cd/PRE_COMMIT_HOOKS.md) - Husky・自動修正・品質チェック
- [PR自動化](../docs/ci-cd/PR_AUTOMATION.md) - PR説明自動生成・コード分析
- [自動リリース](../docs/ci-cd/AUTO_RELEASE.md) - develop→main自動PR・リリース管理

### 🔒 セキュリティ

- [セキュリティ設定](../docs/security/RLS_SETUP.md) - Supabase RLS・Server Actions・認証
- [開発環境セキュリティ](../docs/security/DEVELOPMENT_SECURITY.md) - セキュリティベストプラクティス・チェック手順
- [環境変数セキュリティ](../docs/security/ENVIRONMENT_VARIABLES.md) - `.env` 管理・Vercel 一元化
- [サプライチェーンセキュリティ](../docs/security/SUPPLY_CHAIN_SECURITY.md) - 依存の供給網・Dependabot cooldown・Spaces 固有の注意

### 🤖 AI・ML

- [カード予測モデル](../docs/ml/CARD_PREDICTION_MODEL.md) - 候補スコアリング方式・精度実測
- [ML 実装ロードマップ](../docs/ml/ML_IMPLEMENTATION_ROADMAP.md) - フェーズ計画（**Phase 3 以前の記述は現状とズレあり**）
- [データ収集の使い方](../docs/ml/DATA_COLLECTION_USAGE.md) - 学習データの貯め方
- [Python セキュリティチェックリスト](../docs/ml/PYTHON_SECURITY_CHECKLIST.md) - （**未追従。`fastapi==0.104.1` 等、現状と乖離**）
- [モンテカルロ実装提案](../docs/ai/MONTE_CARLO_IMPLEMENTATION_PROPOSAL.md) - MCTS の設計

### 🏗️ インフラ管理

- [Terraform README](../terraform/README.md) - GitHub管理・Terraform Cloud設定・運用ガイド

### 🎮 ゲーム実装

- [実装状況](../docs/game-logic/IMPLEMENTATION_STATUS.md) - Napoleon Game機能・UI・データ管理・セキュリティ強化
- [最新改善ログ](../docs/game-logic/RECENT_IMPROVEMENTS.md) - UI改善・ゲームルール修正・COMタイミング制御

### 💨 パフォーマンス最適化

- [データベース最適化セットアップ](../docs/database/DATABASE_PERFORMANCE_SETUP.md) - 50-120ms性能向上・PostgreSQL関数・インデックス

## 現在のステータス

> 個別の実装状況は [実装状況](../docs/game-logic/IMPLEMENTATION_STATUS.md) が正。
> ここは「何が済んでいて何が残っているか」の粒度に留める。

### ✅ 完了

- **開発環境**: TypeScript, Next.js, Tailwind CSS, Biome
- **テスト環境**: Jest（`pnpm test` で **71 suites / 889 tests** 全合格）+ Playwright E2E
- **CI/CD**: GitHub Actions・pre-commit hooks・品質チェック自動化
- **PR自動化**: 説明自動生成・コード分析・レビュー支援
- **ゲームロジック**: 52枚デッキ・4人プレイ・基本ルール・スコア計算
- **Supabase統合**: データベース接続・リアルタイム同期・セッション管理
- **セキュリティ強化**: RLS・Server Actions・入力検証・レート制限・プレイヤーID同期
- **Quick Start**: 4人対戦ゲームの即座開始機能
- **AI対戦**: COM3人との対戦。ルールベース戦略 + **モンテカルロ木探索**（`src/lib/ai/`）
- **ML カード予測**: 候補スコアリングモデル + Hugging Face Space 推論 API（`src/lib/ml/` / `python/`）。
  失敗時は MCTS にフォールバックするので、Space が落ちてもゲームは動く
- **ブランチクリーンアップ**: マージ済みブランチの整理・GitHub CLI連携（手動実行のみ。post-merge hook による自動発火は廃止）
- **パフォーマンス最適化**: PostgreSQL関数統合・50-120ms改善
- **Infrastructure as Code**: Terraform + Terraform Cloud・GitHub Repository Ruleset管理・VCS-driven workflow

### 🚧 進行中

- **UI改善**: アニメーション・レスポンシブ対応
- **マルチプレイヤー**: リアルタイム対戦機能の拡張
- **ML 精度改善**: 直近の実測は accuracy 65.06% / top3 90.14%（116,451 行で学習）

### 📋 予定

- **統計機能**: プレイヤー履歴・戦績
- **本番環境**: RLS有効化・セキュリティ強化

## セキュリティ

### 環境変数管理

**⚠️ 重要**: 認証情報は絶対にGitにコミットしないでください。

**推奨: `vercel dev` による開発**

- ローカルに `.env` / `.env.local` を持たず、Vercel上の環境変数を直接使用
- `vercel dev` で開発サーバーを起動するだけでキーが自動注入される
- 全環境（Production / Preview / Development）の値はVercel Dashboardで一元管理

**ファイル管理:**

- ✅ `.env.example`, `.env.docker.example` のみGit追跡
- ❌ `.env`, `.env.local`, `.env.production` はGit追跡禁止
- `.env.production` ファイルは作成しない（Vercel管理）
- 詳細: [環境変数セキュリティガイド](../docs/security/ENVIRONMENT_VARIABLES.md)

## インフラ管理（Infrastructure as Code）

### Terraform による GitHub 管理

GitHubリポジトリの設定をTerraformで管理し、VCS-driven workflowで自動適用します。

#### 設定ファイル構成

- `terraform/` - Terraform設定ディレクトリ
  - `terraform.tf` - Terraform Cloud設定・GitHub Provider（`integrations/github ~> 6.0`）
  - `variables.tf` - 変数定義（`github_owner` / `github_token` / `repository_name` /
    `repository_description` / `default_branch` / `production_branch`）
  - `github.tf` - リポジトリ・Ruleset・ラベル設定
  - `.terraform.lock.hcl` - プロバイダのバージョンロック（**Git 追跡対象**）

**`terraform.tfvars` は存在しません。** 変数値は Terraform Cloud の Workspace Variables
で管理しています。ローカルに作らないこと（`github_token` を平文で置くことになる）。

#### Terraform Cloud 設定

- **Organization**: ksleep98
- **Workspace**: napoleon-game-4players
- **Working Directory**: `terraform`
- **Execution Mode**: Remote（VCS-driven）
- **Auto Apply**: ON（developマージで自動適用）
- **VCS Branch**: develop

#### Repository Ruleset 設定

正は `terraform/github.tf`。以下は 2026-08-10 に GitHub API
（`gh api repos/:owner/:repo/rulesets`）で実物と突き合わせた内容です。

**develop ブランチ:**

- ブランチ作成・削除・Force push禁止
- Pull Request必須
- スカッシュマージのみ許可（feature → develop）
- レビュー要件: 不要（個人開発）
- **必須ステータスチェック: `ci-pipeline`**

**main ブランチ:**

- ブランチ作成・削除・Force push禁止
- Pull Request必須
- 通常マージのみ許可（develop → main）
- レビュー要件: 不要（個人開発）
- **必須ステータスチェックは無し**（develop 側で通っている前提）

**重要な設計決定:**

- ✅ CI必須チェック: **develop のみ**有効（`ci-pipeline`）。main には設定していない
- ⚠️ **Strict Status Checks: 有効**（`strict_required_status_checks_policy = true`、
  `terraform/github.tf`）。**develop が進むと他の PR は `BEHIND` になり、
  追随するまでマージできません。**
- ✅ Bypass Actors: 空（管理者バイパス無し。`gh pr merge --admin` も
  "Required status check ci-pipeline is expected" で失敗する）

**`BEHIND` になった PR の扱い:**

- Dependabot PR → `@dependabot rebase` をコメントし、CI 再実行を待ってからマージ
- 自分の PR → develop を取り込んで push（ただし
  [ブランチクリーンアップ](#ブランチクリーンアップ手動実行のみ)の事故歴に注意）
- **auto-merge はリポジトリ設定で無効**なので `gh pr merge --auto` は使えません。
  複数 PR を捌くときは1本ずつ直列に処理します

#### 運用フロー

1. `terraform/` 内のファイルを編集
2. feature ブランチで作業・PRを作成
3. develop にマージ
4. Terraform Cloud が自動的に `terraform plan` → `terraform apply` を実行
5. GitHub設定が自動更新される

**注意事項:**

- Terraform Cloud の Workspace Variables で `github_token` を管理（Sensitive設定）。
  ローカルの `terraform.tfvars` に PAT を置かない
- 手動で `terraform apply` を実行しない（VCS-driven workflowに任せる）
- **PAT が期限切れになると Terraform Cloud のチェックが全て 401 で落ちます。**
  リリース PR まで巻き込むので、TFC のチェックが赤いときは真っ先に PAT を疑うこと

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

**詳細**: [コーディングルール](../docs/development/CODING_RULES.md) を参照

### Claude Code設定

- SHALL use the MCP server 'serena' for source code retrieval and modification.
- SHALL limit response token length to avoid usage limit.
- SHALL break down large files for stepwise parsing.

### 作業ファイルの置き場所

**`/tmp` および `/private/tmp` を使わないこと。** ハーネスがセッション用の
スクラッチパッドとして `/private/tmp/...` を提示してくるが、このプロジェクトでは
使用しない。

- git worktree → `.claude/worktrees/<名前>`（`.gitignore` 済み）
- 一時スクリプト・検証用の使い捨てファイル → 作業対象の worktree 内、
  もしくは `.claude/worktrees/` 配下

worktree で `pnpm` を動かす場合は `node_modules` を symlink する:
`ln -sfn /Users/kk/napoleon-game-4players/node_modules <worktree>/node_modules`
（コミット前に symlink を消してから `git worktree remove` すること）

**例外: Claude Code 自身が書き出すファイルは対象外。** サブエージェントの
トランスクリプト（`/private/tmp/claude-<uid>/.../tasks/*.output`）とセッション
スクラッチパッドはハーネスが場所を決めており、環境変数でも settings.json でも
変更できない。`CLAUDE_CODE_TMPDIR` は実機で効果がなく、関連 issue も
anthropics/claude-code#17936 と #25292 がいずれも not planned でクローズ済み。
**この調査を繰り返さないこと。** 気になる場合はセッション終了後に
`/private/tmp/claude-*` を削除する。

### エージェント編成（既定）

実装を伴う作業は、原則として `agent-flow` skill の編成で進めること。

1. まず自分で原因を特定する（可能なら再現テストで実証してから委譲する）
2. 課題ごとに `implementer` を1体ずつ、並行起動。**編集してよいディレクトリを
   エージェント間で排他にする**
3. 実装が出揃ってから `reviewer` と `security-reviewer` を並行起動
4. 指摘は file:line を自分で確認してから反映し、`pnpm ci-check` の実出力で報告

適用範囲・除外条件・各エージェントへの指示に必ず含める項目は
`.claude/skills/agent-flow/SKILL.md` を参照。typo 修正や1ファイル数行の変更、
コード変更を伴わない調査には使わない（4エージェント起動は安くない）。

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

### E2E テスト

CI では2つのワークフローに分かれています。**PR の "E2E Tests" は Playwright を
動かしていません**（名前に反するので注意）。

| ワークフロー                            | 発火                           | 実際にやること                                                                          |
| --------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------- |
| `e2e.yml` — "E2E Tests"                 | PR / push                      | `pnpm build` + `pnpm smoke`（Next.js 起動とトップページ 200 の確認）のみ                |
| `e2e-develop.yml` — "E2E Develop Tests" | develop の Vercel デプロイ完了 | 実デプロイ先に対して Playwright を実行（`SKIP_E2E_TESTS: "false"`）→ リリース PR を作成 |

リリース PR（タイトルに `🚀 Release` を含む）では `e2e.yml` はスキップされます。

`SKIP_E2E_TESTS` 環境変数でローカル実行を制御できます（未設定時は `false` = 実行する）:

```bash
# 通常のE2Eテスト実行
pnpm test:e2e

# スキップ
SKIP_E2E_TESTS=true pnpm test:e2e
```

### ブランチクリーンアップ（手動実行のみ）

**マージ後に自動発火する仕組みは廃止しました。** 以前は `.husky/post-merge` が
feature ブランチ上でのマージを検知して develop へ切り替え、そのブランチを削除して
いましたが、マージの向きを区別できませんでした。`git merge origin/develop`
（develop を feature に取り込む）でも「作業完了」と誤認して発火し、未 push の
作業ブランチを削除します。実際に作業中のブランチが消える事故が起きています。

複数の作業ツリー・エージェントを並行させる場合、Git 操作に暗黙の副作用があること
自体がリスクになるため、ブランチ削除は明示的な実行のみとします。

**手動実行:**

- `pnpm cleanup` - インタラクティブ版（確認あり）
- `pnpm cleanup:smart` - スマート版（GitHub CLI連携）
  - `-- --force` - 自動削除（確認なし）
  - `-- --keep` - ブランチ保持
  - `-- --help` - 使用方法表示
- `pnpm cleanup:polling` - GitHub API を 5 分間隔でポーリングし、マージ済み PR に
  対応するローカルブランチを削除する常駐版（明示的に起動したときのみ動作）

## ML / Python（`python/`）

`python/` は **Hugging Face Space へ丸ごと push する配布単位**です。Space は GitHub とは
別の git リポジトリで、**何も自動同期しません**。GitHub にマージしただけでは Space は
古いまま動き続けます（セキュリティ修正も届きません）。

### 依存は `uv.lock` 一本

**`python/requirements.txt` を作らないこと。** 直接依存は `pyproject.toml` に足して
`uv lock`、`Dockerfile` がビルド時に `uv export --no-hashes --no-dev` で導出します。

生成物をコミットしていた頃、Dependabot が `uv.lock` と独立に**推移的依存**のピンだけを
上げ、解決不能な組み合わせを2回作りました（#520 / #527: `gradio 6.22.0` が
`tomlkit<0.15.0` を要求するのに `tomlkit==0.15.1`）。同じ組み合わせが実際に Space の
ビルドを `ResolutionImpossible` で落としています（#509）。ファイルを置かなければ
この経路自体が消えます（#528）。

### Space へのデプロイ

```bash
git clone https://huggingface.co/spaces/ksleep98/napoleon-ml-trainer
# python/ の追跡ファイルを同期してコミット → push
```

- **永続ストレージが無いため、push によるリビルドで学習済みモデルが消えます。**
  成功・失敗にかかわらず Gradio の **Train を再実行**する必要があります。
  パッチ1つのために push するかは、この再学習コストと天秤にかけること
- 認証トークンの状況は運用メモを参照（`napoleon-ml-trainer-deploy` は失効済み）
- GitHub Actions での自動デプロイは**意図的にやっていません**（HF write token を
  リポジトリ secret に置きたくないため。理由は `python/README.md`）

### 推論が落ちてもゲームは壊れない

`/api/predict-card` が 503 を返すと Next.js 側は MCTS にフォールバックします。
モデル未学習・スキーマ不一致・Space 停止のいずれでも同じ挙動です。

## パフォーマンス最適化

### データベース最適化済み

- **PostgreSQL関数統合**: 50-120ms性能改善
- **最適化されたクエリ**: インデックス活用・高頻度処理対応

> リージョン等の Vercel 側の設定は Dashboard 管理で、`vercel.json` には入っていません
> （`vercel.json` が持つのはデプロイ対象ブランチと alias のみ）。

**詳細**: [データベースパフォーマンス設定](../docs/database/DATABASE_PERFORMANCE_SETUP.md)

---

> 詳細な技術情報・実装状況は `docs/` フォルダ内の各ドキュメントを参照してください。
