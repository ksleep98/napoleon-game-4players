# 自動リリース機能

Git Flow戦略に基づく、developブランチからmainブランチへの自動リリースPR作成・リリース管理機能。

## 🔄 ワークフロー概要

### 1. develop → main 自動PR作成 (auto-release-pr.yml)

**トリガー**: developブランチへのpush時
**機能**: mainブランチへのリリースPRを自動作成・更新

```mermaid
graph LR
    A[Feature PR] -->|Merge| B[develop branch]
    B -->|Push trigger| C[Auto Release PR]
    C --> D[main branch PR]
    D -->|Manual merge| E[main branch]
```

### 2. main ブランチリリース (auto-release.yml)

**トリガー**: mainブランチへのpush時（リリースPRマージ後）
**機能**: 自動タグ作成・GitHubリリース・リリースノート生成

## 📋 機能詳細

### auto-release-pr.yml

#### 実行タイミング
- developブランチに新しいコミットがpushされた時
- feature/xxx ブランチがdevelopにマージされた時

#### 実行内容

1. **既存PR確認**
   - develop → main の既存PR有無を確認
   - 既存PR有り: 更新, 無し: 新規作成

2. **変更履歴分析**
   - mainブランチとの差分を分析
   - ファイル種別分類（ソースコード・テスト・設定・ドキュメント）
   - コミット履歴の整理

3. **リリースPR作成**
   ```yaml
   Title: 🚀 Release 2025.08.24
   Body: 
   - 📝 Changes Summary (コミット一覧)
   - 📁 Files Changed (ファイル分類)
   - ✅ Release Checklist
   ```

4. **PR更新機能**
   - 既存PRがある場合は説明を更新
   - 更新コメントを自動追加

#### 生成される情報

**リリースノート内容**:
- **Changes Summary**: コミットメッセージ一覧
- **Files Changed**: 変更ファイル分類・集計
- **Release Checklist**: リリース前確認項目
- **Technical Details**: 変更統計情報

### auto-release.yml

#### 実行タイミング
- mainブランチにコミットがpushされた時（通常はリリースPRのマージ後）

#### 実行内容

1. **バージョンタグ生成**
   - 日付ベースのセマンティックバージョン (`v2025.08.24`)
   - 同日複数リリース時は連番追加 (`v2025.08.24.1`)

2. **リリースノート生成**
   - 前回タグからの変更履歴を分析
   - Conventional Commits形式での分類
   - 技術的詳細情報の追加

3. **GitHubリリース作成**
   - 自動タグ作成・push
   - GitHub Release作成
   - リリースノート添付

4. **リリース完了通知**
   - マージされたリリースPRにコメント追加
   - リリース情報・リンクを提供

## 🏷️ バージョン管理

### タグ形式
- **パターン**: `vYYYY.MM.DD[.N]`
- **例**: 
  - `v2025.08.24` - 初回リリース
  - `v2025.08.24.1` - 同日2回目
  - `v2025.08.24.2` - 同日3回目

### リリースノート分類

**Conventional Commits対応**:
- ✨ **New Feature** - `feat:` コミット
- 🐛 **Bug Fix** - `fix:` コミット  
- 📚 **Documentation** - `docs:` コミット
- 🧪 **Testing** - `test:` コミット
- 🚀 **CI/CD** - `ci:` コミット
- ♻️ **Refactor** - `refactor:` コミット
- 🔧 **Other** - その他のコミット

## 📊 運用フロー

### 通常開発サイクル

1. **開発者**: `feature/xxx` ブランチで機能開発
2. **開発者**: `feature/xxx` → `develop` へPR作成・マージ
3. **自動**: develop への push で リリースPR自動作成
4. **リリース管理者**: リリースPR レビュー・承認
5. **リリース管理者**: `develop` → `main` マージ実行
6. **自動**: main への push でリリース・タグ作成

### ホットフィックス対応

```bash
# 緊急修正の場合
git checkout main
git checkout -b hotfix/urgent-fix
# 修正作業
git commit -m "fix: critical security issue"

# mainに直接マージ（例外的運用）
git checkout main
git merge hotfix/urgent-fix
git push origin main
# → 自動リリース実行

# developにも反映
git checkout develop
git merge main
git push origin develop
```

## ⚙️ 設定・カスタマイズ

### 必要な権限
```yaml
permissions:
  contents: write        # タグ作成・リリース
  pull-requests: write   # PR作成・更新・コメント
```

### 環境変数
- `GITHUB_TOKEN`: GitHub API操作用（自動提供）

### カスタマイズ箇所

#### リリースPRテンプレート変更
`auto-release-pr.yml` の以下セクションを編集:
```bash
# Add quality check reminder
echo "## ✅ Release Checklist" >> release_notes.md
echo "- [ ] All CI checks pass" >> release_notes.md
# チェック項目の追加・変更
```

#### バージョン形式変更
`auto-release.yml` の以下セクションを編集:
```bash
# Generate semantic version based on date
current_date=$(date +"%Y.%m.%d")
version_tag="v$current_date"
# フォーマット変更可能
```

#### コミット分類ルール変更
`auto-release.yml` の以下セクションでカスタマイズ:
```bash
if [[ $commit_msg == feat:* ]]; then
  echo "- ✨ **New Feature**: ${commit_msg#feat: }" 
elif [[ $commit_msg == fix:* ]]; then
  echo "- 🐛 **Bug Fix**: ${commit_msg#fix: }"
# 分類ルールの追加・変更
```

## 🔧 トラブルシューティング

### よくある問題

**1. PR作成エラー**
```
Error: GraphQL error: A pull request already exists
```
**解決**: 既存PR確認ロジックが正常動作していることを確認

**2. タグ作成エラー**
```
Error: tag 'v2025.08.24' already exists
```
**解決**: タグ重複防止ロジックが正常動作（通常は自動解決）

**3. GitHub API権限エラー**
```
Error: Resource not accessible by integration
```
**解決**: リポジトリ設定でGitHub Actionsの権限を確認

### デバッグ方法

**1. ワークフロー実行ログ確認**
- GitHub → Actions タブで実行結果確認
- 各ステップの詳細ログをチェック

**2. 手動実行テスト**
```bash
# ローカルでスクリプト部分テスト
git log --oneline --no-merges main..develop
git diff --name-only main..develop
```

**3. dry-run オプション追加**
```bash
# テスト用にecho文でコマンド確認
echo "gh pr create --base main --head develop --title ..."
```

## 📈 期待される効果

### 開発チーム
- **リリース作業時間**: 90%短縮
- **ヒューマンエラー**: 大幅削減
- **リリース品質**: 一貫性確保

### プロジェクト管理
- **リリース頻度**: 向上
- **変更履歴**: 自動記録・追跡
- **バージョン管理**: 体系化

### 運用負荷
- **手動作業**: 最小化
- **ドキュメント**: 自動生成・更新
- **リリースノート**: 標準化

---

> この自動リリース機能により、Git Flow戦略に基づく継続的デリバリーが実現されます。