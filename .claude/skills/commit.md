# Commit Skill

このスキルは、プロジェクトのコミットメッセージ規約に従った高品質なコミットを作成するためのガイドです。

## コミット規約

### Conventional Commits形式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type（必須）

- `feat`: 新機能追加
- `fix`: バグ修正
- `docs`: ドキュメントのみの変更
- `style`: コードの動作に影響しない変更（フォーマット、セミコロンなど）
- `refactor`: リファクタリング
- `perf`: パフォーマンス改善
- `test`: テストの追加・修正
- `chore`: ビルドプロセスやツールの変更
- `ci`: CI/CD設定の変更
- `security`: セキュリティ関連の変更

### Scope（オプション）

- `game`: ゲームロジック
- `ui`: UI/UXコンポーネント
- `db`: データベース関連
- `auth`: 認証・セキュリティ
- `api`: API/Server Actions
- `test`: テスト
- `deps`: 依存関係

### Subject（必須）

- 50文字以内
- 動詞で始める（英語の場合は命令形）
- 末尾にピリオドを付けない
- 重要な変更は日本語で記述可能

### Body（オプション）

- 変更の理由と内容を詳細に説明
- 72文字で改行
- WHYを重視（WHATはdiffで分かる）

### Footer（オプション）

- 破壊的変更: `BREAKING CHANGE:`
- Issue参照: `Closes #123`, `Fixes #456`
- Co-authored-by: Claude Sonnet 4.5 &lt;noreply@anthropic.com&gt;

## 使用例

### 新機能追加

```
feat(game): add multiplayer room system

- Implement real-time player synchronization
- Add room creation and joining functionality
- Integrate Supabase realtime subscriptions

Closes #161

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### バグ修正

```
fix(auth): resolve player ID mismatch in multiplayer

- Fix session validation logic
- Ensure consistent player ID across components
- Add RLS policy for player verification

Fixes #165

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### パフォーマンス改善

```
perf(db): optimize player creation with batch insert

- Replace 4 sequential inserts with single batch operation
- Reduce database calls by 75% (4 → 1)
- Add parallel data fetching with Promise.all()

Improves initial game load time by ~50ms

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## コミット前チェックリスト

- [ ] `pnpm lint` でlintエラーなし
- [ ] `pnpm type-check` で型エラーなし
- [ ] `pnpm test` でテスト合格
- [ ] `pnpm format:check` でフォーマット確認
- [ ] Conventional Commits形式に従っている
- [ ] 変更内容が明確に説明されている
- [ ] Co-Authored-Byを追加（Claude Codeで作業した場合）

## Pre-commit Hook

このプロジェクトではHuskyによるpre-commit hookが設定されています:

1. Biome linting & formatting（自動修正）
2. TypeScript型チェック
3. Jest テスト実行
4. developブランチ直接コミット防止

すべてのチェックが合格した場合のみコミット可能です。

## Git Commit時の注意

### ❌ 避けるべきコミット

```bash
# developブランチへの直接コミット（禁止）
git checkout develop
git commit -m "fix something"  # ← エラー！

# 曖昧なメッセージ
git commit -m "update"
git commit -m "fix bug"
git commit -m "WIP"
```

### ✅ 推奨されるフロー

```bash
# feature ブランチで作業
git checkout -b feature/add-multiplayer-room

# 変更をステージング
git add .

# コミット（pre-commit hookが自動実行）
git commit -m "feat(game): add multiplayer room system

Implement real-time player synchronization with Supabase.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# リモートにプッシュ
git push -u origin feature/add-multiplayer-room

# Pull Request作成
gh pr create --base develop --title "feat: Add multiplayer room system" --body "..."
```

## 参考リンク

- [Conventional Commits](https://www.conventionalcommits.org/)
- [プロジェクトコーディングルール](../../docs/development/CODING_RULES.md)
- [Pre-commit Hooks](../../docs/ci-cd/PRE_COMMIT_HOOKS.md)
