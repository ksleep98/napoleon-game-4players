# Pre-commit Hooks 設定

## Husky + lint-staged セットアップ完了

### 設定ファイル
- ✅ `.husky/pre-commit` - メインpre-commitフック
- ✅ `.husky/pre-commit-light` - 軽量版（フォーマットのみ）
- ✅ `.husky/pre-commit-enhanced` - 拡張版（詳細フィードバック付き）
- ✅ `package.json` lint-staged設定

## 動作内容

### git commit 実行時の自動処理

**1. lint-staged（ステージファイル対象）:**
```bash
# TypeScript/JavaScript files
npx @biomejs/biome check --write   # 自動修正
npx @biomejs/biome format --write  # フォーマット

# JSON files
npx @biomejs/biome format --write  # フォーマット
```

**2. プロジェクト全体チェック:**
```bash
npm run type-check  # TypeScript型チェック
npm test           # Jest テスト実行
```

## Pre-commit バリエーション

### デフォルト（包括的チェック）
```bash
git commit -m "message"
# → 自動修正 + 型チェック + テスト実行
```

### 軽量版に切り替え
```bash
cp .husky/pre-commit-light .husky/pre-commit
# → フォーマット・lint のみ
```

### 緊急時スキップ
```bash
git commit -m "message" --no-verify
# → 全チェック無効化
```

## 実行例

```bash
🚀 Pre-commit checks starting...
📝 Running automatic fixes on staged files...
[COMPLETED] *.{js,jsx,ts,tsx} — 7 files
[COMPLETED] *.{json,md,css} — 2 files
🔍 Running comprehensive quality checks...
🔧 TypeScript type checking...
🧪 Running tests...
Test Suites: 4 passed, 4 total
Tests:       34 passed, 34 total
✅ All pre-commit checks passed!
🎉 Ready to commit!
```

## パフォーマンス

- **自動修正**: ~15ms
- **型チェック**: ~2s
- **テスト実行**: ~400ms
- **合計時間**: ~3-5秒

## lint-staged 設定詳細

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "npx @biomejs/biome check --write",
      "npx @biomejs/biome format --write"
    ],
    "*.json": [
      "npx @biomejs/biome format --write"
    ]
  }
}
```

## 注意事項

### Husky 非推奨警告
```
husky - DEPRECATED
Please remove the following two lines from .husky/pre-commit:
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
```
- 動作には影響なし
- v10.0.0 で修正予定

### 推奨ワークフロー
1. コード変更
2. `npm run ci-check` で事前確認
3. `git add .`
4. `git commit -m "message"` （自動チェック実行）
5. 問題修正後に再コミット
6. Push