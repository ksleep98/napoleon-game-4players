# Terraform Configuration for GitHub Repository Management

このディレクトリには、Napoleon Game (4 Players) GitHubリポジトリの設定をTerraformで管理するための設定ファイルが含まれています。

## 📋 管理対象

- **リポジトリ設定**: 基本設定、マージオプション、セキュリティ設定
- **ブランチ保護**: `develop` と `main` ブランチの保護ルール
- **Issue ラベル**: bug, enhancement, documentation, security など

## 🛠️ 必要な準備

### 1. GitHub Personal Access Token (PAT) の作成

**Fine-grained Personal Access Token（推奨）** を使用します。

#### Fine-grained PAT 作成手順

1. **GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. **"Generate new token"** をクリック
3. 基本設定:
   - **Token name**: `terraform-napoleon-game` (任意の名前)
   - **Expiration**: 90 days または 1 year (推奨)
   - **Description**: Terraform management for napoleon-game-4players
4. **Repository access**:
   - "Only select repositories" を選択
   - `napoleon-game-4players` を選択
5. **Repository permissions** (必要な権限):
   ```
   ✅ Administration: Read and write
   ✅ Contents: Read and write
   ✅ Issues: Read and write
   ✅ Metadata: Read-only (自動付与)
   ✅ Pull requests: Read and write
   ```
6. **"Generate token"** をクリック
7. **トークンをコピー**（後で使用、再表示不可）

#### Classic PAT（代替案）

Fine-grained PATで問題がある場合のみ使用:

1. Personal access tokens → Tokens (classic)
2. 必要なスコープ: `repo`, `admin:repo_hook`

### 2. Terraform Cloud の設定

1. [Terraform Cloud](https://app.terraform.io/) にサインアップ/ログイン
2. Organization を作成（例: `ksleep98`）
3. Workspace `napoleon-game-4players` を作成
   - Execution Mode: Remote
   - VCS connection: 不要（CLI-driven workflow）

### 3. 環境変数の設定

Terraform Cloud の Workspace → Variables で以下を設定:

| Variable Name  | Value           | Category           | Sensitive |
| -------------- | --------------- | ------------------ | --------- |
| `github_token` | YOUR_GITHUB_PAT | Terraform variable | ✅ Yes    |
| `github_owner` | ksleep98        | Terraform variable | No        |

または、ローカルで `terraform.tfvars` ファイルを作成（Git管理対象外）:

```bash
# サンプルファイルをコピー
cp terraform.tfvars.example terraform.tfvars

# エディタで編集してトークンを設定
# github_token = "github_pat_xxxxxxxxxxxxx"
```

`terraform.tfvars` の例:

```hcl
# Fine-grained PAT (github_pat_ で始まる)
github_token = "github_pat_xxxxxxxxxxxxx"
github_owner = "ksleep98"

# Classic PAT の場合 (ghp_ で始まる)
# github_token = "ghp_xxxxxxxxxxxxx"
```

## 🚀 セットアップ手順

### 初回セットアップ

```bash
cd terraform

# 1. Terraform初期化
terraform init

# 2. 既存リポジトリをインポート（初回のみ）
terraform import github_repository.napoleon_game napoleon-game-4players

# 3. 設定の確認
terraform plan

# 4. 適用
terraform apply
```

### Terraform Cloud でログインが必要な場合

```bash
terraform login
# ブラウザが開き、Terraform Cloud の API トークンを生成
# トークンをCLIに貼り付け
```

## 📝 日常的な運用

### 設定変更の適用

```bash
# 1. 変更内容を確認
terraform plan

# 2. 変更を適用
terraform apply
```

### 現在の状態確認

```bash
# State情報を表示
terraform show

# 特定リソースの詳細表示
terraform state show github_repository.napoleon_game
```

### リソースのインポート（既存リソースを管理対象に追加）

```bash
# 例: 既存のブランチ保護ルールをインポート
terraform import github_branch_protection.develop napoleon-game-4players:develop
terraform import github_branch_protection.main napoleon-game-4players:main
```

## 🔧 カスタマイズ

### ブランチ保護ルールの変更

`github.tf` の `github_branch_protection` リソースを編集:

```hcl
resource "github_branch_protection" "develop" {
  # ...
  required_pull_request_reviews {
    required_approving_review_count = 2  # レビュアー数を2人に変更
  }
}
```

### 新しいラベルの追加

`github.tf` に新しいラベルを追加:

```hcl
resource "github_issue_label" "ui_ux" {
  repository  = github_repository.napoleon_game.name
  name        = "ui/ux"
  color       = "d4c5f9"
  description = "User interface and experience improvements"
}
```

### Organization設定の変更

`terraform.tf` の `organization` を自分の Organization名に変更:

```hcl
cloud {
  organization = "your-org-name"  # ここを変更
  # ...
}
```

## 📚 主要ファイル

- `terraform.tf`: Terraform/Provider設定、Terraform Cloud設定
- `variables.tf`: 変数定義
- `github.tf`: GitHub リポジトリ設定（リポジトリ、ブランチ保護、ラベル）
- `.gitignore`: Terraform関連の除外ファイル

## ⚠️ 注意事項

1. **機密情報の管理**
   - `*.tfvars` ファイルは `.gitignore` で除外済み
   - GitHub Token は絶対にコミットしない
   - Terraform Cloud の Variable で管理を推奨

2. **既存リポジトリの管理**
   - 既存リポジトリを管理する場合は `terraform import` が必要
   - 削除操作には注意（`archive_on_destroy = false` で保護済み）

3. **ブランチ保護の変更**
   - 管理者権限でも `enforce_admins = true` にすると制限されます
   - 緊急時は一時的に無効化できます

## 🔗 参考リンク

- [Terraform GitHub Provider](https://registry.terraform.io/providers/integrations/github/latest/docs)
- [Terraform Cloud Documentation](https://developer.hashicorp.com/terraform/cloud-docs)
- [GitHub API - Repository Settings](https://docs.github.com/en/rest/repos/repos)

## 📖 次のステップ

1. **Secrets の管理**: GitHub Actions Secrets を追加
2. **Webhooks の設定**: 自動デプロイ用のWebhookを追加
3. **Teams の管理**: Organization メンバー・チーム権限の管理
4. **Advanced Security**: Dependabot, Code scanning の設定

---

**学習リソース**:

- [Terraform入門](https://developer.hashicorp.com/terraform/tutorials)
- [Infrastructure as Code ベストプラクティス](https://www.terraform.io/docs/cloud/guides/recommended-practices/index.html)
