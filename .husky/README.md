# Pre-commit Hook 設定

## 現在の設定

`pre-commit` - 包括的な品質チェック

- 自動フォーマット・lint修正
- TypeScript型チェック
- Jestテスト実行
- 全てパスしないとコミット不可

## 一時的に無効化（緊急時）

```bash
git commit -m "message" --no-verify
```

## 手動でのチェック実行

```bash
# 全体的な品質チェック
pnpm ci-check

# 個別実行
pnpm lint:fix      # 自動修正
pnpm type-check    # 型チェック
pnpm test              # テスト実行
pnpm format        # フォーマット
```
