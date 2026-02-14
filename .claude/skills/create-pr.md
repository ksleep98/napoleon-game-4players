# Create PR Skill

## 目的

ローカルでfeatureブランチを作成し、変更をコミットして、developへのPRを自動作成するスキル。

## 前提条件

- Git設定済み
- GitHub CLIインストール済み（`gh --version`で確認）
- ブランチ戦略に従った開発（feature/xxx → develop → main）
- 変更がステージング可能な状態

## ワークフロー

### 1. 現在の状態を確認

```bash
# 現在のブランチ確認
git branch --show-current

# 変更確認
git status --short

# developブランチから作業していることを確認
# developでない場合は移動
git checkout develop
git pull origin develop
```

### 2. Feature ブランチ作成

```bash
# ブランチ命名規則: feature/<機能名>
# 例:
# - feature/add-login-page
# - feature/fix-card-display
# - feature/upgrade-nextjs16
# - feature/improve-performance

git checkout -b feature/<feature-name>
```

**命名のベストプラクティス:**

- 簡潔で説明的な名前
- ケバブケース（小文字とハイフン）
- 動詞で始める（add, fix, update, improve, refactor）

**良い例:**

- `feature/add-dark-mode`
- `feature/fix-scoring-bug`
- `feature/upgrade-dependencies`

**悪い例:**

- `feature/new-feature` （抽象的）
- `feature/Fix_Bug` （大文字、アンダースコア）
- `feature/123` （意味不明）

### 3. 変更をステージング

```bash
# 全ての変更をステージング
git add .

# または特定のファイルのみ
git add <file1> <file2> ...

# .claudeignore, .claude/設定は必ず含める
git add .claudeignore .claude/settings.json .claude/README.md .claude/skills/*.md
```

### 4. コミット作成

```bash
# Conventional Commits形式でコミット
git commit -m "$(cat <<'EOF'
<type>: <short description>

## <Section 1>
<Details>

## <Section 2>
<Details>

<Additional notes>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

**コミットタイプ:**

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメントのみの変更
- `style`: コードの意味に影響を与えない変更（空白、フォーマット等）
- `refactor`: バグ修正も機能追加もしないコード変更
- `perf`: パフォーマンス改善
- `test`: テスト追加・修正
- `chore`: ビルドプロセスやツールの変更
- `ci`: CI設定ファイルの変更

### 5. リモートにプッシュ

```bash
# 初回プッシュ（upstream設定）
git push -u origin feature/<feature-name>

# 2回目以降
git push
```

**Pre-push hooks自動実行:**

- Biome linting & formatting
- TypeScript型チェック
- Jest テスト実行
- develop/mainブランチ保護チェック

### 6. PR作成

````bash
# GitHub CLIでPR作成
gh pr create --base develop --title "<PR Title>" --body "$(cat <<'EOF'
## 🎯 概要

<このPRの目的・背景>

## 🔧 変更内容

### 主な変更

- <変更1>
- <変更2>
- <変更3>

### 影響範囲

- <影響1>
- <影響2>

## 📊 テスト結果

```bash
✅ TypeScript type check: passed
✅ Tests: X/X passed
✅ Build: passed
````

## 🔍 動作確認

- [ ] <確認項目1>
- [ ] <確認項目2>
- [ ] <確認項目3>

## 📝 備考

<追加情報・注意事項>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"

```

**PR タイトルの形式:**
```

<type>: <short description>

````

**例:**
- `feat: add user authentication`
- `fix: resolve card display issue`
- `refactor: improve game state management`
- `docs: update API documentation`

## クイックコマンド（推奨）

### オプション1: 対話的にPR作成

```bash
# 1. ブランチ作成とチェックアウト
git checkout -b feature/<feature-name>

# 2. 変更をステージング
git add .

# 3. コミット（エディタが開く）
git commit

# 4. プッシュ
git push -u origin feature/<feature-name>

# 5. 対話的にPR作成
gh pr create --base develop
# → GitHub CLIが対話的にタイトル・本文を入力できる
````

### オプション2: ワンライナー（上級者向け）

```bash
# ブランチ作成 → ステージング → コミット → プッシュ → PR作成を一気に実行
git checkout -b feature/<name> && \
git add . && \
git commit -m "feat: <description>" && \
git push -u origin feature/<name> && \
gh pr create --base develop --fill
```

## PR本文テンプレート

```markdown
## 🎯 概要

<このPRの目的・背景を簡潔に説明>

## 🔧 変更内容

### 主な変更

- <変更1の説明>
- <変更2の説明>
- <変更3の説明>

### 技術的詳細

<必要に応じて技術的な詳細を記載>

## 📊 テスト結果

\`\`\`bash
✅ TypeScript type check: passed
✅ Tests: X/X passed
✅ Build: passed
✅ Security audit: passed
\`\`\`

## 🔍 動作確認

- [ ] ローカル環境で動作確認
- [ ] ビルド成功
- [ ] テスト成功
- [ ] セキュリティチェック成功

## 📝 備考

<追加情報・注意事項があれば記載>

## 🚨 Breaking Changes

<破壊的変更がある場合のみ記載>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## チェックリスト

PR作成前に確認：

- [ ] `feature/xxx` ブランチで作業している
- [ ] developブランチが最新（`git pull origin develop`）
- [ ] コミットメッセージがConventional Commits形式
- [ ] Pre-commit hooks が全て通過
- [ ] PR本文が明確で理解しやすい
- [ ] テスト結果を記載
- [ ] 動作確認項目をリストアップ
- [ ] Breaking Changesがあれば明記

PR作成後に確認：

- [ ] GitHub ActionsのCIが通過
- [ ] マージコンフリクトがない
- [ ] レビュワーをアサイン（必要に応じて）
- [ ] ラベルを追加（必要に応じて）

## トラブルシューティング

### Pre-commit hooks失敗

```bash
# エラー内容を確認
git commit -v

# 自動修正を試行
pnpm lint:fix
pnpm format

# 再度コミット
git add .
git commit
```

### マージコンフリクト

```bash
# developを最新化
git checkout develop
git pull origin develop

# featureブランチに戻る
git checkout feature/<name>

# developをマージ
git merge develop

# コンフリクト解決後
git add .
git commit
git push
```

### GitHub CLI認証エラー

```bash
# GitHub CLIの認証状態確認
gh auth status

# 再認証
gh auth login
```

### ブランチ名を間違えた

```bash
# ブランチ名変更
git branch -m <old-name> <new-name>

# リモートの古いブランチ削除
git push origin --delete <old-name>

# 新しいブランチをプッシュ
git push -u origin <new-name>
```

## 自動化スクリプト例

```bash
#!/bin/bash
# scripts/create-pr.sh

set -e

# 引数チェック
if [ $# -lt 2 ]; then
  echo "Usage: ./scripts/create-pr.sh <feature-name> <description>"
  exit 1
fi

FEATURE_NAME=$1
DESCRIPTION=$2

echo "🚀 Creating PR for feature/${FEATURE_NAME}..."

# developを最新化
git checkout develop
git pull origin develop

# featureブランチ作成
git checkout -b "feature/${FEATURE_NAME}"

# 変更をステージング
git add .

# コミット
git commit -m "feat: ${DESCRIPTION}

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# プッシュ
git push -u origin "feature/${FEATURE_NAME}"

# PR作成
gh pr create --base develop --title "feat: ${DESCRIPTION}" --fill

echo "✅ PR created successfully!"
```

**使用方法:**

```bash
chmod +x scripts/create-pr.sh
./scripts/create-pr.sh add-dark-mode "add dark mode toggle"
```

## 参考リンク

- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub CLI Documentation](https://cli.github.com/manual/)
- [Git Branch Strategy](../docs/development/BRANCH_STRATEGY.md)
- [Commit Guidelines](./commit.md)
- [PR Review Guidelines](./review-pr.md)

## 使用例

### 例1: 新機能追加

```bash
# 1. ブランチ作成
git checkout develop
git pull origin develop
git checkout -b feature/add-user-profile

# 2. コーディング...
# 3. 変更をステージング
git add src/components/UserProfile.tsx src/app/profile/page.tsx

# 4. コミット
git commit -m "feat: add user profile page

## Features
- Add UserProfile component
- Add profile page route
- Add profile settings

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# 5. プッシュ
git push -u origin feature/add-user-profile

# 6. PR作成
gh pr create --base develop --title "feat: add user profile page" --fill
```

### 例2: バグ修正

```bash
git checkout -b feature/fix-scoring-calculation
git add src/lib/scoring.ts tests/lib/scoring.test.ts
git commit -m "fix: correct scoring calculation for Napoleon wins

## Bug Fix
- Fix scoring calculation when Napoleon team wins
- Add test cases for edge cases
- Update documentation

Fixes #123

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push -u origin feature/fix-scoring-calculation
gh pr create --base develop --title "fix: correct scoring calculation for Napoleon wins"
```

### 例3: リファクタリング

```bash
git checkout -b feature/refactor-game-state
git add src/lib/gameState.ts src/hooks/useGameState.ts
git commit -m "refactor: simplify game state management

## Refactoring
- Extract game state logic to custom hook
- Reduce code duplication
- Improve type safety

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push -u origin feature/refactor-game-state
gh pr create --base develop --title "refactor: simplify game state management"
```
