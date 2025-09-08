# Branch Protection Settings

このプロジェクトでCI/CDを有効にするため、以下のブランチ保護ルールをGitHubリポジトリに設定してください。

## 設定手順

1. GitHubリポジトリページに移動
2. **Settings** → **Branches** に移動
3. **Add rule** をクリック
4. 以下の設定を適用：

### Branch name pattern

- `main`
- `develop`

### Branch protection rules

#### ✅ Require a pull request before merging

- **Require approvals**: 1人以上のレビュー必須
- **Dismiss stale PR approvals when new commits are pushed**: ON
- **Require review from code owners**: ON（.github/CODEOWNERS設定時）

#### ✅ Require status checks to pass before merging

- **Require branches to be up to date before merging**: ON
- **Status checks that are required**:
  - `ci-pipeline` (Push/PR時のCI/CDチェック)

#### ✅ Require conversation resolution before merging

- ON: すべてのコメントが解決済みであることを必須

#### ✅ Restrict pushes that create files

- **Restrict pushes to matching branches**: ON
- mainブランチへの直接pushを禁止

#### ✅ Allow force pushes

- OFF: force pushを禁止

#### ✅ Allow deletions

- OFF: ブランチ削除を禁止

## 追加推奨設定

### Code owners (.github/CODEOWNERS)

```
# Global owners
* @owner-username

# Frontend
/src/app/ @frontend-team
/src/components/ @frontend-team

# Backend/API
/src/lib/ @backend-team
/src/hooks/ @backend-team

# Configuration
/.github/ @devops-team
/biome.json @devops-team
/package.json @devops-team
```

### Auto-merge設定

PRがすべてのチェックをパスした場合の自動マージを有効化:

- **Settings** → **General** → **Pull Requests**
- **Allow auto-merge**: ON

## CI/CDジョブ説明

### lint-and-type-check

- Biome linter実行
- TypeScript型チェック
- コードフォーマットチェック

### build

- Next.jsアプリケーションビルド
- ビルドエラーの検出

### test

- Jest単体テスト実行
- カバレッジレポート生成

## ローカル開発での推奨ワークフロー

1. developブランチから機能ブランチを作成

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

2. 開発前にlintとformatを実行

```bash
pnpm lint:fix
pnpm format
```

3. コミット前にすべてのチェックを実行

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

4. Pull Request作成

- developブランチに対してPR作成
- CI/CDがすべてパスするまで待機
- レビューを受けてマージ
