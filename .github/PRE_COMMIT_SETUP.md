# Pre-commit Setup Complete

## 設定内容

### 1. ローカルpre-commitフック

- **Husky**: Git hookの管理
- **lint-staged**: ステージされたファイルのみをlint

### 2. 動作タイミング

- **ローカル**: `git commit` 時に自動実行
- **GitHub Actions**: Push/PR時に品質チェック

### 3. Pre-commit処理内容

ステージされたファイルに対して:

- **TypeScript/JavaScript**: Biome lint + format
- **JSON/Markdown/CSS**: Biome format

### 4. ワークフロー

```
git add .
git commit -m "message"  ← この時点でpre-commitフック実行
  ↓
自動的にlint-stagedが実行
  ↓
エラーがあればコミット中止
  ↓
修正後に再度コミット
```

### 5. 設定ファイル

- `.husky/pre-commit` - Git hookスクリプト
- `package.json` - lint-staged設定
- GitHub Actions は Push/PR時のCI/CDチェック

## 利点

- コミット前に自動的に品質チェック
- 問題のあるコードがリポジトリに入らない
- チーム全体でコード品質を統一

## 無効化方法（緊急時）

```bash
git commit -m "message" --no-verify
```
