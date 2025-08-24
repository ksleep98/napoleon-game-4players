# GitHub Personal Access Token (PAT) 設定ガイド

GitHub ActionsでmainブランチへのPR作成・管理を行うためのPersonal Access Token設定方法。

## 🚫 問題の概要

GitHub Actionsの標準`GITHUB_TOKEN`では以下の制限があります：

- **mainブランチへのPR作成権限なし** - セキュリティ上の制限
- **Protected branchesへの操作制限** - ブランチ保護設定との競合
- **Release作成権限の制限** - リポジトリレベルの操作制限

## 🔑 解決方法: Personal Access Token

### 1. GitHub PAT作成

1. **GitHub.com**にログイン
2. **Settings** > **Developer settings** > **Personal access tokens** > **Tokens (classic)**
3. **Generate new token (classic)**をクリック
4. 以下の設定を行う：

#### 基本設定

```
Token name: napoleon-game-ci-cd
Expiration: 90 days (推奨)
Description: Napoleon Game CI/CD automation
```

#### 必要な権限 (Scopes)

```
✅ repo (Full control of private repositories)
  ✅ repo:status
  ✅ repo_deployment
  ✅ public_repo
✅ workflow (Update GitHub Action workflows)
✅ write:packages (Upload packages to GitHub Package Registry)
```

### 2. リポジトリSecrets設定

1. **リポジトリ** > **Settings** > **Secrets and variables** > **Actions**
2. **New repository secret**をクリック
3. 以下を設定：

```
Name: PAT_TOKEN
Secret: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. 設定確認

以下のワークフローが正常動作することを確認：

- ✅ **Auto Release PR** - develop → main PR自動作成
- ✅ **Auto Release** - mainへのpush時にRelease作成
- ✅ **PR Description** - PR説明自動生成

## 🔧 ワークフロー設定詳細

### auto-release-pr.yml

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.PAT_TOKEN || secrets.GITHUB_TOKEN }}
```

### auto-release.yml

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.PAT_TOKEN || secrets.GITHUB_TOKEN }}
```

## 🛡️ セキュリティ考慮事項

### PAT管理のベストプラクティス

1. **最小権限の原則**
   - 必要最小限のスコープのみ許可
   - プロジェクト専用のPATを作成

2. **定期的な更新**
   - 90日ごとにトークン更新
   - 使用しなくなったトークンは即座に削除

3. **アクセス制限**
   - リポジトリ管理者のみがSecrets管理
   - PAT作成者のGitHubアカウント管理強化

### トークン漏洩時の対応

1. **即座にトークンを無効化**

   ```bash
   # GitHub > Settings > Developer settings > Personal access tokens
   # 該当トークンの「Delete」を実行
   ```

2. **新しいトークンを生成・設定**
3. **関連ログの確認**
4. **セキュリティ監査の実施**

## ⚠️ トラブルシューティング

### エラー: "GitHub Actions is not permitted to create or approve pull requests"

**原因**: 標準`GITHUB_TOKEN`の権限不足

**解決策**:

```yaml
# ❌ 動作しない
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

# ✅ 正常動作
env:
  GITHUB_TOKEN: ${{ secrets.PAT_TOKEN || secrets.GITHUB_TOKEN }}
```

### 警告: "Context access might be invalid: PAT_TOKEN"

**原因**: ローカル環境でPAT_TOKENが未定義のためVSCodeが警告表示

**対応**:

- ⚠️ この警告は**正常な動作**です
- 🔧 GitHub Actions実行時には正常に動作します
- 📋 リポジトリSecretsでPAT_TOKENを設定すれば解決

**VSCode警告抑制**:

```json
// .vscode/settings.json
{
  "github-actions.expression-syntax.enableDiagnostics": false,
  "[yaml]": {
    "problems.decorations.enabled": false
  }
}
```

**YAMLコメント抑制**:

```yaml
# yamllint disable-line rule:truthy
GITHUB_TOKEN: ${{ secrets.PAT_TOKEN || secrets.GITHUB_TOKEN }}
```

### エラー: "Resource not accessible by integration"

**原因**: PAT権限不足またはリポジトリアクセス権限なし

**解決策**:

1. PATのscopeを確認（`repo`権限が必要）
2. PAT作成者がリポジトリへの書き込み権限を持っているか確認

### フォールバック機能

設定にはフォールバック機能を実装：

```yaml
GITHUB_TOKEN: ${{ secrets.PAT_TOKEN || secrets.GITHUB_TOKEN }}
```

- **PAT_TOKEN**が設定されている場合: PATを使用（推奨）
- **PAT_TOKEN**が未設定の場合: 標準トークンを使用（制限あり）

## 🎯 期待される動作

### 正常設定後の動作フロー

1. **developブランチにpush**
   - Auto Release PR ワークフロー実行
   - main向けPR自動作成
   - リリースノート自動生成

2. **Release PRをmerge**
   - Auto Release ワークフロー実行
   - GitHubリリース自動作成
   - バージョンタグ自動生成

3. **PR作成時**
   - PR Description ワークフロー実行
   - 変更内容の自動分析・説明生成

---

> PAT設定により、完全に自動化されたCI/CDパイプラインが実現されます。
